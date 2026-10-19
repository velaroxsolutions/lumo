// Local-first storage (F12.1). Every write lands here first; a server, when it
// exists, is a backup and a bridge between devices — never a blocker.
//
// Migrations are additive and versioned with PRAGMA user_version. Never drop
// a table or delete the database to get past a migration error.
//
// IDs are random text and every row carries updated_at, so v2 sync can do
// last-write-wins per row without reshaping anything.

export const SCHEMA_VERSION = 4;

export const MIGRATIONS = {
  1: `
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'circle',
      sort_order INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY NOT NULL,
      area_id TEXT NOT NULL REFERENCES areas(id),
      title TEXT NOT NULL,
      target_value REAL NOT NULL DEFAULT 1,
      current_value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      deadline TEXT,
      is_focus INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rituals (
      id TEXT PRIMARY KEY NOT NULL,
      area_id TEXT NOT NULL REFERENCES areas(id),
      name TEXT NOT NULL,
      weekday_mask INTEGER NOT NULL DEFAULT 62,
      start_time TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      area_id TEXT NOT NULL REFERENCES areas(id),
      goal_id TEXT REFERENCES goals(id),
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      actual_minutes INTEGER,
      priority TEXT NOT NULL DEFAULT 'med',
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      deferral_count INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE TABLE IF NOT EXISTS day_plans (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      system_preset TEXT NOT NULL,
      review_note TEXT NOT NULL DEFAULT '',
      mood INTEGER,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_items (
      id TEXT PRIMARY KEY NOT NULL,
      day_plan_id TEXT NOT NULL REFERENCES day_plans(id),
      task_id TEXT REFERENCES tasks(id),
      ritual_id TEXT REFERENCES rituals(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      start_time TEXT,
      duration_minutes INTEGER,
      outcome TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_plan ON plan_items(day_plan_id);
    CREATE INDEX IF NOT EXISTS idx_items_task ON plan_items(task_id);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `,
  // v2 — sync. An outbox of local changes to push, device-local state that
  // never syncs (session token, cursor), and date-based day-plan ids so two
  // devices planning the same day write the same row instead of colliding.
  2: `
    CREATE TABLE IF NOT EXISTS sync_outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      tbl TEXT NOT NULL,
      row_id TEXT NOT NULL,
      op TEXT NOT NULL,
      fields TEXT NOT NULL DEFAULT '[]',
      full INTEGER NOT NULL DEFAULT 0,
      ts TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
    PRAGMA defer_foreign_keys = ON;
    UPDATE plan_items SET day_plan_id = 'dp-' || (SELECT date FROM day_plans WHERE id = plan_items.day_plan_id)
      WHERE day_plan_id NOT LIKE 'dp-%';
    UPDATE day_plans SET id = 'dp-' || date WHERE id NOT LIKE 'dp-%';
  `,
  // v3 — goals & tasks v2: recurring tasks (F2.8), subtasks (F2.7), goal
  // progress from linked tasks (F1.5), milestones (F1.6), and a progress log
  // that goal pace (F7.7) projects from.
  3: `
    ALTER TABLE tasks ADD COLUMN repeat TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE tasks ADD COLUMN series_id TEXT;
    ALTER TABLE goals ADD COLUMN progress_mode TEXT NOT NULL DEFAULT 'manual';
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY NOT NULL,
      goal_id TEXT NOT NULL REFERENCES goals(id),
      title TEXT NOT NULL,
      target_value REAL,
      done INTEGER NOT NULL DEFAULT 0,
      done_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goal_logs (
      id TEXT PRIMARY KEY NOT NULL,
      goal_id TEXT NOT NULL REFERENCES goals(id),
      value REAL NOT NULL,
      logged_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
  // v4 — the weekly loop (F3.10/F5.4): one line about the week that ended.
  // Keyed 'wk-<monday>' so two devices write the same row.
  4: `
    CREATE TABLE IF NOT EXISTS week_reviews (
      id TEXT PRIMARY KEY NOT NULL,
      week_start TEXT NOT NULL UNIQUE,
      note TEXT NOT NULL DEFAULT '',
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};

export async function initDb(db) {
  // Connection settings sit outside the migration transaction.
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch {
    // Not every backend (wa-sqlite on web) supports WAL; the default is fine.
  }
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version > SCHEMA_VERSION) {
    throw new Error('This database was written by a newer version of lumo.');
  }
  if (version === SCHEMA_VERSION) return;

  await db.withTransactionAsync(async () => {
    for (let v = version + 1; v <= SCHEMA_VERSION; v += 1) {
      await db.execAsync(MIGRATIONS[v]);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

export const TABLES = [
  'areas', 'goals', 'rituals', 'tasks', 'day_plans', 'plan_items', 'settings', 'subtasks', 'milestones', 'goal_logs',
  'week_reviews',
];

// Deterministic ids for rows two devices might both create for the same day.
export const planId = (date) => `dp-${date}`;
export const weekReviewId = (weekStartKey) => `wk-${weekStartKey}`;
export const planItemId = (date, { taskId, ritualId }) => (taskId ? `pi-${date}-${taskId}` : `pr-${date}-${ritualId}`);

// ---- change tracking ---------------------------------------------------------
// While signed in, every tracked write also lands in sync_outbox. Signed out,
// nothing is recorded (signing in snapshots everything instead).
let tracking = false;
export const setTracking = (on) => {
  tracking = !!on;
};

async function enqueue(db, tbl, rowId, op, fields = [], full = false) {
  if (!tracking) return;
  await db.runAsync('INSERT INTO sync_outbox (tbl, row_id, op, fields, full, ts) VALUES (?, ?, ?, ?, ?, ?)', [
    tbl,
    rowId,
    op,
    JSON.stringify(fields),
    full ? 1 : 0,
    nowIso(),
  ]);
}

export async function getLocal(db, key) {
  const row = await db.getFirstAsync('SELECT value FROM local_kv WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setLocal(db, key, value) {
  if (value == null) await db.runAsync('DELETE FROM local_kv WHERE key = ?', [key]);
  else await db.runAsync(
    'INSERT INTO local_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)],
  );
}

const ORDER = {
  areas: 'sort_order, created_at',
  goals: 'created_at',
  rituals: 'start_time, created_at',
  tasks: 'created_at',
  day_plans: 'date',
  plan_items: 'sort_order, created_at',
  settings: 'key',
  subtasks: 'sort_order, created_at',
  milestones: 'sort_order, created_at',
  goal_logs: 'logged_at',
  week_reviews: 'week_start',
};

export async function loadTable(db, table) {
  if (!TABLES.includes(table)) throw new Error(`Unknown table ${table}`);
  return db.getAllAsync(`SELECT * FROM ${table} ORDER BY ${ORDER[table]}`);
}

export function uid() {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${rnd}`;
}

export const nowIso = () => new Date().toISOString();

// Allow-listed column writes. Column names never come from user input, but
// keep them checked anyway: bindings carry values, not identifiers.
const COLUMNS = {
  areas: ['name', 'color', 'icon', 'sort_order', 'archived'],
  goals: ['area_id', 'title', 'target_value', 'current_value', 'unit', 'deadline', 'is_focus', 'status', 'completed_at', 'progress_mode'],
  rituals: ['area_id', 'name', 'weekday_mask', 'start_time', 'duration_minutes', 'active'],
  tasks: ['area_id', 'goal_id', 'title', 'notes', 'estimated_minutes', 'actual_minutes', 'priority', 'deadline', 'status', 'deferral_count', 'completed_at', 'repeat', 'series_id'],
  day_plans: ['date', 'system_preset', 'review_note', 'mood', 'closed_at'],
  plan_items: ['day_plan_id', 'task_id', 'ritual_id', 'sort_order', 'start_time', 'duration_minutes', 'outcome'],
  subtasks: ['task_id', 'title', 'done', 'sort_order'],
  milestones: ['goal_id', 'title', 'target_value', 'done', 'done_at', 'sort_order'],
  goal_logs: ['goal_id', 'value', 'logged_at'],
  week_reviews: ['week_start', 'note', 'closed_at'],
};

function checkCols(table, obj) {
  const allowed = COLUMNS[table];
  const keys = Object.keys(obj);
  for (const k of keys) if (!allowed.includes(k)) throw new Error(`Column ${table}.${k} not writable`);
  return keys;
}

export async function insert(db, table, values) {
  const id = values.id || uid();
  const now = nowIso();
  const { id: _ignored, ...rest } = values;
  const keys = checkCols(table, rest);
  const cols = ['id', ...keys, 'created_at', 'updated_at'];
  const params = [id, ...keys.map((k) => rest[k]), now, now];
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params,
  );
  await enqueue(db, table, id, 'upsert', cols.slice(1), true);
  return id;
}

export async function update(db, table, id, patch) {
  const keys = checkCols(table, patch);
  if (!keys.length) return;
  const sets = [...keys.map((k) => `${k} = ?`), 'updated_at = ?'];
  await db.runAsync(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [
    ...keys.map((k) => patch[k]),
    nowIso(),
    id,
  ]);
  await enqueue(db, table, id, 'upsert', [...keys, 'updated_at']);
}

export async function remove(db, table, id) {
  if (!COLUMNS[table]) throw new Error(`Unknown table ${table}`);
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  await enqueue(db, table, id, 'delete');
}

// Delete every row matching a fixed WHERE clause, tracking each one.
export async function removeWhere(db, table, where, params) {
  if (!COLUMNS[table]) throw new Error(`Unknown table ${table}`);
  const rows = await db.getAllAsync(`SELECT id FROM ${table} WHERE ${where}`, params);
  for (const r of rows) await remove(db, table, r.id);
  return rows.length;
}

export async function setSetting(db, key, value) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value == null ? null : String(value)],
  );
  await enqueue(db, 'settings', key, 'upsert', ['value'], true);
}

// Columns a pulled row may write locally (everything the app owns).
export function syncColumns(table) {
  if (table === 'settings') return ['value'];
  return [...COLUMNS[table], 'created_at', 'updated_at'];
}

// Parents a row needs before it can be stored (foreign keys).
export const PARENTS = {
  goals: [['area_id', 'areas']],
  rituals: [['area_id', 'areas']],
  tasks: [['area_id', 'areas'], ['goal_id', 'goals']],
  plan_items: [['day_plan_id', 'day_plans'], ['task_id', 'tasks'], ['ritual_id', 'rituals']],
  subtasks: [['task_id', 'tasks']],
  milestones: [['goal_id', 'goals']],
  goal_logs: [['goal_id', 'goals']],
};
