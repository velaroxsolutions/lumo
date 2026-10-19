// expo-sqlite's async API over Node's built-in node:sqlite, so the real
// schema, migrations and sync code run against a real SQLite in tests.
const { DatabaseSync } = require('node:sqlite');

function bind(params) {
  if (params == null) return [];
  return Array.isArray(params) ? params : [params];
}

function openTestDb() {
  const raw = new DatabaseSync(':memory:');
  const db = {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params) {
      const r = raw.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync(sql, params) {
      return raw.prepare(sql).get(...bind(params)) ?? null;
    },
    async getAllAsync(sql, params) {
      return raw.prepare(sql).all(...bind(params));
    },
    async withTransactionAsync(fn) {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db;
}

module.exports = { openTestDb };
