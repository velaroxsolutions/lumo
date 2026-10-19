/**
 * @jest-environment node
 */
import { MIGRATIONS, initDb, insert, update, remove, setSetting, setTracking, planId, SCHEMA_VERSION } from '../src/core/db';
import { applyPulled, buildChanges, snapshotAll } from '../src/core/sync';

const { openTestDb } = require('./helpers/fakeSqlite');

async function fresh() {
  const db = openTestDb();
  await initDb(db);
  return db;
}

const outbox = (db) => db.getAllAsync('SELECT tbl, row_id, op, fields, full FROM sync_outbox ORDER BY seq');

afterEach(() => setTracking(false));

describe('migrations', () => {
  test('fresh install lands on the current version', async () => {
    const db = await fresh();
    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(SCHEMA_VERSION);
  });

  test('v1 → current renames day plans to date ids and keeps their items attached', async () => {
    const db = openTestDb();
    // A database exactly as Phase 1 shipped it, with one legacy random-id plan.
    await db.execAsync(MIGRATIONS[1]);
    await db.execAsync(`
      INSERT INTO day_plans (id, date, system_preset, created_at, updated_at) VALUES ('random123', '2026-10-19', 'top_three', 'x', 'x');
      INSERT INTO plan_items (id, day_plan_id, created_at, updated_at) VALUES ('item1', 'random123', 'x', 'x');
      PRAGMA user_version = 1;
    `);
    await initDb(db);
    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(SCHEMA_VERSION);
    expect(await db.getFirstAsync('SELECT id FROM day_plans')).toEqual({ id: 'dp-2026-10-19' });
    expect(await db.getFirstAsync('SELECT day_plan_id FROM plan_items')).toEqual({ day_plan_id: 'dp-2026-10-19' });
    expect(planId('2026-10-19')).toBe('dp-2026-10-19');
  });

  test('v3 adds recurring tasks, goal modes, subtasks, milestones and logs', async () => {
    const db = await fresh();
    const cols = async (t) => (await db.getAllAsync(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols('tasks')).toEqual(expect.arrayContaining(['repeat', 'series_id']));
    expect(await cols('goals')).toContain('progress_mode');
    for (const t of ['subtasks', 'milestones', 'goal_logs']) expect((await cols(t)).length).toBeGreaterThan(3);
  });
});

describe('outbox tracking', () => {
  test('nothing is recorded while signed out', async () => {
    const db = await fresh();
    await insert(db, 'areas', { name: 'Career', color: '#7C6BFF' });
    expect(await outbox(db)).toEqual([]);
  });

  test('inserts, updates, deletes and settings are recorded while signed in', async () => {
    const db = await fresh();
    setTracking(true);
    const a = await insert(db, 'areas', { name: 'Career', color: '#7C6BFF' });
    await update(db, 'areas', a, { name: 'Job search' });
    await setSetting(db, 'system_preset', 'top_three');
    const t = await insert(db, 'tasks', { area_id: a, title: 'Apply' });
    await remove(db, 'tasks', t);
    const ob = await outbox(db);
    expect(ob.map((r) => [r.tbl, r.op, r.full])).toEqual([
      ['areas', 'upsert', 1], ['areas', 'upsert', 0], ['settings', 'upsert', 1], ['tasks', 'upsert', 1], ['tasks', 'delete', 0],
    ]);
    expect(JSON.parse(ob[1].fields)).toEqual(['name', 'updated_at']);
  });

  test('changes carry current values and skip rows deleted since', async () => {
    const db = await fresh();
    setTracking(true);
    const a = await insert(db, 'areas', { name: 'Career', color: '#7C6BFF' });
    await update(db, 'areas', a, { name: 'Job search' });
    const t = await insert(db, 'tasks', { area_id: a, title: 'Temp' });
    await remove(db, 'tasks', t);
    const { changes } = await buildChanges(db);
    expect(changes[0].fields.name).toBe('Job search'); // insert sends today's value
    expect(changes.filter((c) => c.tbl === 'tasks').map((c) => c.op)).toEqual(['delete']);
  });

  test('signing in snapshots every row as a full insert', async () => {
    const db = await fresh();
    await insert(db, 'areas', { name: 'Career', color: '#7C6BFF' });
    await setSetting(db, 'onboarded', '1');
    await snapshotAll(db);
    const { changes } = await buildChanges(db);
    expect(changes.map((c) => [c.tbl, c.full])).toEqual([['areas', true], ['settings', true]]);
    expect(changes[1].ts).toBe('2000-01-01T00:00:00.000Z'); // the account's own settings win
  });
});

describe('applying pulled changes', () => {
  const area = { name: 'Career', color: '#7C6BFF', icon: 'circle', sort_order: 0, archived: 0, created_at: 'x', updated_at: 'x' };
  const task = (extra) => ({ area_id: 'a1', title: 'Apply', notes: '', estimated_minutes: 30, priority: 'med', status: 'backlog', deferral_count: 0, created_at: 'x', updated_at: 'x', ...extra });

  test('children arriving before parents still land', async () => {
    const db = await fresh();
    const stats = await applyPulled(db, [
      { tbl: 'tasks', id: 't1', deleted: false, data: task() },
      { tbl: 'areas', id: 'a1', deleted: false, data: area },
      { tbl: 'settings', id: 'onboarded', deleted: false, data: { value: '1' } },
    ]);
    expect(stats).toEqual({ applied: 3, skipped: 0 });
    expect((await db.getFirstAsync('SELECT title FROM tasks')).title).toBe('Apply');
    expect((await db.getFirstAsync("SELECT value FROM settings WHERE key = 'onboarded'")).value).toBe('1');
  });

  test('an orphan is skipped instead of breaking the whole pull', async () => {
    const db = await fresh();
    const stats = await applyPulled(db, [{ tbl: 'tasks', id: 't1', deleted: false, data: task({ area_id: 'nope' }) }]);
    expect(stats.skipped).toBe(1);
    expect(await db.getAllAsync('SELECT * FROM tasks')).toEqual([]);
  });

  test('a field edited locally since the push is not overwritten', async () => {
    const db = await fresh();
    await applyPulled(db, [{ tbl: 'areas', id: 'a1', deleted: false, data: area }, { tbl: 'tasks', id: 't1', deleted: false, data: task() }]);
    setTracking(true);
    await update(db, 'tasks', 't1', { title: 'Typed just now' });
    await applyPulled(db, [{ tbl: 'tasks', id: 't1', deleted: false, data: task({ title: 'From server', status: 'done' }) }]);
    const row = await db.getFirstAsync('SELECT title, status FROM tasks');
    expect(row).toEqual({ title: 'Typed just now', status: 'done' });
  });

  test('a tombstone removes the task and its plan slots', async () => {
    const db = await fresh();
    await applyPulled(db, [
      { tbl: 'areas', id: 'a1', deleted: false, data: area },
      { tbl: 'tasks', id: 't1', deleted: false, data: task() },
      { tbl: 'day_plans', id: 'dp-2026-10-20', deleted: false, data: { date: '2026-10-20', system_preset: 'top_three', review_note: '', created_at: 'x', updated_at: 'x' } },
      { tbl: 'plan_items', id: 'pi-2026-10-20-t1', deleted: false, data: { day_plan_id: 'dp-2026-10-20', task_id: 't1', sort_order: 0, outcome: 'pending', created_at: 'x', updated_at: 'x' } },
    ]);
    await applyPulled(db, [{ tbl: 'tasks', id: 't1', deleted: true, data: {} }]);
    expect(await db.getAllAsync('SELECT * FROM tasks')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM plan_items')).toEqual([]);
  });

  test('the latest version of a row wins within one pull', async () => {
    const db = await fresh();
    await applyPulled(db, [
      { tbl: 'areas', id: 'a1', deleted: false, data: area },
      { tbl: 'areas', id: 'a1', deleted: false, data: { ...area, name: 'Later' } },
    ]);
    expect((await db.getFirstAsync('SELECT name FROM areas')).name).toBe('Later');
  });
});
