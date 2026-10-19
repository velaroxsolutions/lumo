// F12.2 / F12.7 — account + sync. Local SQLite stays the source of truth for
// the UI; this pushes the outbox and pulls what other devices changed.
//
// Network calls never run inside the write queue, so a slow connection never
// blocks a tap. Only the short read/apply steps take the queue:
//   1. (queue)  snapshot the outbox into changes, reading current values
//   2. (net)    POST /sync/push
//   3. (queue)  drop the pushed outbox rows
//   4. (net)    GET /sync/pull until caught up
//   5. (queue)  apply, skipping any field edited locally since step 1
// Conflicts resolve on the server: last write wins per field.

import { api, ApiError } from './api';
import { PARENTS, TABLES, getLocal, nowIso, setLocal, setTracking, syncColumns, uid } from './db';

const K = { token: 'auth_token', email: 'account_email', cursor: 'sync_cursor', device: 'device_id', last: 'last_sync_at' };
const PUSH_BATCH = 500;
// Upserts parents-first, deletes children-first, so foreign keys always hold.
const UPSERT_ORDER = ['areas', 'goals', 'milestones', 'goal_logs', 'rituals', 'tasks', 'subtasks', 'day_plans', 'plan_items', 'settings', 'week_reviews'];
const DELETE_ORDER = ['plan_items', 'subtasks', 'tasks', 'day_plans', 'rituals', 'goal_logs', 'milestones', 'goals', 'areas'];
// Snapshot timestamp for settings that were never edited after signing in:
// old enough that an account's existing settings win over this device's.
const OLD = '2000-01-01T00:00:00.000Z';

export async function readAccount(db) {
  let device = await getLocal(db, K.device);
  if (!device) {
    device = uid();
    await setLocal(db, K.device, device);
  }
  return {
    token: await getLocal(db, K.token),
    email: await getLocal(db, K.email),
    lastSyncAt: await getLocal(db, K.last),
    device,
  };
}

// ---- outbox → changes ----------------------------------------------------

async function currentRow(db, tbl, id) {
  if (tbl === 'settings') return db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [id]);
  if (!TABLES.includes(tbl)) return null;
  return db.getFirstAsync(`SELECT * FROM ${tbl} WHERE id = ?`, [id]);
}

export async function buildChanges(db, limit = PUSH_BATCH) {
  const rows = await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY seq LIMIT ?', [limit]);
  const changes = [];
  for (const r of rows) {
    if (r.op === 'delete') {
      changes.push({ tbl: r.tbl, id: r.row_id, op: 'delete', ts: r.ts });
      continue;
    }
    const cur = await currentRow(db, r.tbl, r.row_id);
    if (!cur) continue; // deleted since; its delete is queued after this
    const fields = {};
    for (const f of JSON.parse(r.fields)) if (f in cur) fields[f] = cur[f];
    changes.push({ tbl: r.tbl, id: r.row_id, op: 'upsert', ts: r.ts, fields, full: !!r.full });
  }
  return { changes, maxSeq: rows.length ? rows[rows.length - 1].seq : 0, more: rows.length === limit };
}

// Everything this device holds, queued as full rows. Run when signing in so
// the account ends up with the union of the device and what's already there.
export async function snapshotAll(db) {
  for (const tbl of TABLES) {
    const rows = await db.getAllAsync(`SELECT * FROM ${tbl}`);
    for (const row of rows) {
      const id = tbl === 'settings' ? row.key : row.id;
      const fields = syncColumns(tbl).filter((c) => c in row);
      const ts = tbl === 'settings' ? OLD : row.updated_at || OLD;
      await db.runAsync('INSERT INTO sync_outbox (tbl, row_id, op, fields, full, ts) VALUES (?, ?, ?, ?, 1, ?)', [
        tbl, id, 'upsert', JSON.stringify(fields), ts,
      ]);
    }
  }
}

// ---- pulled changes → local rows ----------------------------------------

async function pendingMap(db) {
  const map = {};
  for (const r of await db.getAllAsync('SELECT tbl, row_id, op, fields FROM sync_outbox')) {
    const k = `${r.tbl}:${r.row_id}`;
    const p = (map[k] ||= { fields: new Set(), deleted: false, upsert: false });
    if (r.op === 'delete') p.deleted = true;
    else {
      p.upsert = true;
      for (const f of JSON.parse(r.fields)) p.fields.add(f);
    }
  }
  return map;
}

const exists = async (db, tbl, id) => !!(await db.getFirstAsync(`SELECT 1 AS x FROM ${tbl} WHERE id = ?`, [id]));

export async function applyPulled(db, changes) {
  const stats = { applied: 0, skipped: 0 };
  // Latest state per row wins within one pull.
  const latest = new Map();
  for (const c of changes) latest.set(`${c.tbl}:${c.id}`, c);
  const all = [...latest.values()].filter((c) => TABLES.includes(c.tbl));

  await db.withTransactionAsync(async () => {
    await db.execAsync('PRAGMA defer_foreign_keys = ON');
    const pending = await pendingMap(db);

    for (const tbl of UPSERT_ORDER) {
      for (const c of all.filter((x) => x.tbl === tbl && !x.deleted)) {
        const p = pending[`${tbl}:${c.id}`];
        if (p?.deleted) { stats.skipped += 1; continue; }
        const cols = syncColumns(tbl).filter((col) => col in c.data && !p?.fields.has(col));
        try {
          if (tbl === 'settings') {
            if (!cols.length) continue;
            await db.runAsync(
              'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
              [c.id, c.data.value],
            );
          } else {
            let orphan = false;
            for (const [col, parent] of PARENTS[tbl] || []) {
              if (c.data[col] && !(await exists(db, parent, c.data[col]))) orphan = true;
            }
            if (orphan) { stats.skipped += 1; continue; }
            if (await exists(db, tbl, c.id)) {
              if (!cols.length) continue;
              await db.runAsync(
                `UPDATE ${tbl} SET ${cols.map((col) => `${col} = ?`).join(', ')} WHERE id = ?`,
                [...cols.map((col) => c.data[col]), c.id],
              );
            } else {
              await db.runAsync(
                `INSERT INTO ${tbl} (id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`,
                [c.id, ...cols.map((col) => c.data[col])],
              );
            }
          }
          stats.applied += 1;
        } catch (e) {
          // One malformed row must never wedge sync for everything else.
          stats.skipped += 1;
          console.warn(`lumo sync: skipped ${tbl}/${c.id}`, e?.message);
        }
      }
    }

    for (const tbl of DELETE_ORDER) {
      for (const c of all.filter((x) => x.tbl === tbl && x.deleted)) {
        const p = pending[`${tbl}:${c.id}`];
        if (p?.upsert) { stats.skipped += 1; continue; } // a local re-add is on its way up
        if (tbl === 'tasks') {
          await db.runAsync('DELETE FROM plan_items WHERE task_id = ?', [c.id]);
          await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', [c.id]);
        }
        await db.runAsync(`DELETE FROM ${tbl} WHERE id = ?`, [c.id]);
        stats.applied += 1;
      }
    }
  });
  return stats;
}

// ---- the engine ------------------------------------------------------------

export function createSync({ db, run, reload, onStatus }) {
  let account = null; // { token, email, lastSyncAt, device }
  let inflight = null;
  let again = false;
  let debounce = null;

  const emit = (patch) => onStatus((s) => ({ ...s, ...patch }));

  async function init() {
    account = await run(() => readAccount(db));
    setTracking(!!account.token);
    emit({ ready: true, signedIn: !!account.token, email: account.email, lastSyncAt: account.lastSyncAt, state: 'idle', error: null });
    return !!account.token;
  }

  async function endSession(message) {
    await run(async () => {
      setTracking(false);
      for (const k of [K.token, K.email, K.cursor, K.last]) await setLocal(db, k, null);
      await db.runAsync('DELETE FROM sync_outbox');
    });
    account = { ...account, token: null, email: null, lastSyncAt: null };
    emit({ signedIn: false, email: null, lastSyncAt: null, state: 'idle', error: message || null });
  }

  async function cycle() {
    const token = account?.token;
    if (!token) return;
    // push
    for (;;) {
      const { changes, maxSeq, more } = await run(() => buildChanges(db));
      if (!maxSeq) break;
      if (changes.length) {
        await api('/sync/push', { method: 'POST', token, body: { device_id: account.device, changes } });
      }
      await run(() => db.runAsync('DELETE FROM sync_outbox WHERE seq <= ?', [maxSeq]));
      if (!more) break;
    }
    // pull
    let cursor = Number(await run(() => getLocal(db, K.cursor))) || 0;
    const pulled = [];
    for (;;) {
      const page = await api(`/sync/pull?since=${cursor}&limit=500`, { token });
      pulled.push(...page.changes);
      cursor = page.cursor;
      if (!page.more) break;
    }
    const last = nowIso();
    await run(async () => {
      if (pulled.length) await applyPulled(db, pulled);
      await setLocal(db, K.cursor, cursor);
      await setLocal(db, K.last, last);
      if (pulled.length) await reload();
    });
    account.lastSyncAt = last;
  }

  async function syncNow() {
    if (!account?.token) return;
    if (inflight) {
      again = true;
      return inflight;
    }
    emit({ state: 'syncing' });
    inflight = (async () => {
      try {
        do {
          again = false;
          await cycle();
        } while (again);
        emit({ state: 'idle', error: null, lastSyncAt: account?.lastSyncAt });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await endSession(e.message);
        else emit({ state: e instanceof ApiError && e.status === 0 ? 'offline' : 'error', error: e.message });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  async function signIn(mode, email, password) {
    const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
    const res = await api(path, { method: 'POST', body: { email, password, device_id: account?.device } });
    await run(async () => {
      await db.runAsync('DELETE FROM sync_outbox');
      await setLocal(db, K.token, res.token);
      await setLocal(db, K.email, res.user.email);
      await setLocal(db, K.cursor, 0);
      setTracking(true);
      await snapshotAll(db);
    });
    account = { ...account, token: res.token, email: res.user.email };
    emit({ signedIn: true, email: res.user.email, error: null });
    await syncNow();
  }

  async function signOut() {
    const token = account?.token;
    if (token) await syncNow(); // don't strand unpushed edits
    if (token) api('/auth/logout', { method: 'POST', token }).catch(() => {});
    await endSession(null);
  }

  async function deleteAccount(password) {
    await api('/account/delete', { method: 'POST', token: account?.token, body: { password } });
    await endSession(null);
  }

  // Called after every local write: sync shortly after the user stops tapping.
  function poke() {
    if (!account?.token) return;
    clearTimeout(debounce);
    debounce = setTimeout(syncNow, 1500);
  }

  return { init, syncNow, poke, signIn, signOut, deleteAccount };
}
