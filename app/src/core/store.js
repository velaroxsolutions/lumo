// The in-memory mirror of the local database plus every write action.
// Screens never import this directly — they go through the hooks
// (useDayPlan, useTasks, useAreas, useGoals, useSettings), which are the seam.
//
// A student's data is small (hundreds to low thousands of rows), so the whole
// database is held in memory and only the touched tables are re-read after a
// write. Writes are serialized through one queue so web and native behave alike.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { TABLES, insert, loadTable, nowIso, planId as planIdFor, planItemId, remove, removeWhere, setSetting, update } from './db';
import { createSync } from './sync';
import { addDays, todayKey } from './dates';
import { getSystem, DEFAULT_SYSTEM } from './systems';
import { autoTimes, ritualsForDate } from './logic/plan';
import { computeStreak } from './logic/streak';

export const DEFAULT_SETTINGS = {
  onboarded: '0',
  system_preset: DEFAULT_SYSTEM,
  reminders_enabled: '1',
  evening_reminder: '21:00',
  morning_reminder: '08:00',
  available_minutes: '360',
  day_start: '09:00',
  last_area_id: '',
  first_day: '',
};

export const MILESTONES = [25, 50, 75, 100];

// A task's still-pending slots on days after `date` (used to undo a carry-forward).
const LATER_PENDING = `task_id = ? AND outcome = 'pending'
  AND day_plan_id IN (SELECT id FROM day_plans WHERE date > ?)`;

const StoreContext = createContext(null);

// Serialize every write; each caller still gets its own result or error.
function createWriteQueue() {
  let tail = Promise.resolve();
  return (fn) => {
    const p = tail.then(fn);
    tail = p.catch(() => {});
    return p;
  };
}

function useToday() {
  const [today, setToday] = useState(() => todayKey());
  useEffect(() => {
    const tick = () => setToday((prev) => {
      const now = todayKey();
      return now === prev ? prev : now;
    });
    const timer = setInterval(tick, 60 * 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}

export function StoreProvider({ children }) {
  const db = useSQLiteContext();
  const [data, setData] = useState(null);
  const [staleNote, setStaleNote] = useState(null);
  const [account, setAccount] = useState({ ready: false, signedIn: false, state: 'idle', error: null });
  const today = useToday();
  // One serial write queue per provider.
  const [run] = useState(createWriteQueue);

  const reload = useCallback(
    async (tables = TABLES) => {
      const next = {};
      for (const t of tables) next[t] = await loadTable(db, t);
      setData((prev) => ({ ...(prev || {}), ...next }));
    },
    [db],
  );

  // Account + background sync (Phase 2). Never in the way of a local write.
  const [engine] = useState(() => createSync({ db, run, reload, onStatus: setAccount }));

  // ---- internal helpers (run inside the queue) -----------------------------

  const getSettingRaw = async (key) => {
    const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? DEFAULT_SETTINGS[key];
  };

  const clearFocus = async () => {
    const rows = await db.getAllAsync('SELECT id FROM goals WHERE is_focus = 1');
    for (const r of rows) await update(db, 'goals', r.id, { is_focus: 0 });
  };

  const ensurePlan = async (date) => {
    const existing = await db.getFirstAsync('SELECT * FROM day_plans WHERE date = ?', [date]);
    if (existing) return existing.id;
    const preset = await getSettingRaw('system_preset');
    const planId = await insert(db, 'day_plans', { id: planIdFor(date), date, system_preset: preset });
    // F3.8 — rituals appear pre-placed on matching weekdays.
    const rituals = await db.getAllAsync('SELECT * FROM rituals WHERE active = 1');
    let order = 0;
    for (const r of ritualsForDate(rituals, date)) {
      await insert(db, 'plan_items', {
        id: planItemId(date, { ritualId: r.id }),
        day_plan_id: planId,
        ritual_id: r.id,
        sort_order: order++,
        start_time: r.start_time,
        duration_minutes: r.duration_minutes,
      });
    }
    return planId;
  };

  const nextOrder = async (planId) => {
    const row = await db.getFirstAsync(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM plan_items WHERE day_plan_id = ?',
      [planId],
    );
    return row?.n ?? 0;
  };

  const addTaskToPlan = async (date, taskId) => {
    const planId = await ensurePlan(date);
    const dup = await db.getFirstAsync(
      'SELECT id FROM plan_items WHERE day_plan_id = ? AND task_id = ?',
      [planId, taskId],
    );
    if (dup) return dup.id;
    const itemId = await insert(db, 'plan_items', {
      id: planItemId(date, { taskId }),
      day_plan_id: planId,
      task_id: taskId,
      sort_order: await nextOrder(planId),
    });
    await update(db, 'tasks', taskId, { status: 'planned', completed_at: null });
    return itemId;
  };

  // Past days that were never closed: their pending tasks go back to the
  // backlog quietly. Never flood today's plan with a week of leftovers.
  const sweepStale = async (day) => {
    const rows = await db.getAllAsync(
      `SELECT pi.id AS item_id, pi.task_id, dp.date FROM plan_items pi
       JOIN day_plans dp ON dp.id = pi.day_plan_id
       WHERE dp.date < ? AND dp.closed_at IS NULL AND pi.outcome = 'pending'`,
      [day],
    );
    if (!rows.length) return null;
    let returned = 0;
    let latest = null;
    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        await update(db, 'plan_items', r.item_id, { outcome: 'missed' });
        if (!r.task_id) continue;
        const live = await db.getFirstAsync(
          `SELECT pi.id FROM plan_items pi JOIN day_plans dp ON dp.id = pi.day_plan_id
           WHERE pi.task_id = ? AND dp.date >= ? LIMIT 1`,
          [r.task_id, day],
        );
        const task = await db.getFirstAsync('SELECT status FROM tasks WHERE id = ?', [r.task_id]);
        if (!live && task?.status === 'planned') {
          await update(db, 'tasks', r.task_id, { status: 'backlog' });
          returned += 1;
          if (!latest || r.date > latest) latest = r.date;
        }
      }
    });
    return returned ? { count: returned, date: latest } : null;
  };

  // ---- boot + day rollover --------------------------------------------------

  // Declared first so it takes the queue before any boot-time write, which
  // means change tracking is already on when the stale sweep runs.
  useEffect(() => {
    engine.init().then((signedIn) => signedIn && engine.syncNow());
    const timer = setInterval(() => engine.syncNow(), 60 * 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && engine.syncNow());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [engine]);

  useEffect(() => {
    let alive = true;
    run(async () => {
      const note = await sweepStale(today);
      if (alive && note) setStaleNote(note);
      await reload();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // ---- actions --------------------------------------------------------------

  const actions = useMemo(() => {
    const act = (tables, fn) => (...args) =>
      run(async () => {
        const result = await fn(...args);
        await reload(tables);
        engine.poke();
        return result;
      });

    return {
      reload: () => run(() => reload()),

      // Account (F12.2) and your data (F12.9).
      signIn: (mode, email, password) => engine.signIn(mode, email, password),
      signOut: () => engine.signOut(),
      deleteAccount: (password) => engine.deleteAccount(password),
      syncNow: () => engine.syncNow(),
      exportData: () => run(async () => {
        const out = { app: 'lumo', exported_at: nowIso(), data: {} };
        for (const t of TABLES) out.data[t] = await loadTable(db, t);
        return out;
      }),
      dismissStaleNote: () => setStaleNote(null),

      updateSettings: act(['settings'], async (patch) => {
        for (const [k, v] of Object.entries(patch)) await setSetting(db, k, v);
      }),

      completeOnboarding: act(TABLES, async ({ areas, goal, system, eveningReminder, remindersEnabled }) => {
        const ids = [];
        await db.withTransactionAsync(async () => {
          let order = 0;
          for (const a of areas) {
            ids.push(await insert(db, 'areas', { name: a.name, color: a.color, icon: a.icon || 'circle', sort_order: order++ }));
          }
          if (goal && goal.title) {
            const areaId = ids[goal.areaIndex ?? 0] ?? ids[0];
            await insert(db, 'goals', {
              area_id: areaId,
              title: goal.title,
              target_value: goal.target_value || 1,
              current_value: 0,
              unit: goal.unit || '',
              deadline: goal.deadline || null,
              is_focus: 1,
            });
          }
          await setSetting(db, 'system_preset', system);
          await setSetting(db, 'evening_reminder', eveningReminder || DEFAULT_SETTINGS.evening_reminder);
          await setSetting(db, 'reminders_enabled', remindersEnabled ? '1' : '0');
          await setSetting(db, 'last_area_id', ids[0] || '');
          await setSetting(db, 'first_day', todayKey());
          await setSetting(db, 'onboarded', '1');
        });
      }),

      // Areas (F1.1) — archivable, never deleted, so history keeps its colour.
      addArea: act(['areas'], (a) =>
        insert(db, 'areas', { name: a.name, color: a.color, icon: a.icon || 'circle', sort_order: a.sort_order ?? 99 }),
      ),
      updateArea: act(['areas'], (id, patch) => update(db, 'areas', id, patch)),
      archiveArea: act(['areas'], (id, archived = true) => update(db, 'areas', id, { archived: archived ? 1 : 0 })),

      // Goals (F1.2/F1.3) — exactly one Focus Goal at a time.
      addGoal: act(['goals'], async (g) => {
        let id;
        await db.withTransactionAsync(async () => {
          if (g.is_focus) await clearFocus();
          id = await insert(db, 'goals', {
            area_id: g.area_id,
            title: g.title,
            target_value: g.target_value || 1,
            current_value: g.current_value || 0,
            unit: g.unit || '',
            deadline: g.deadline || null,
            is_focus: g.is_focus ? 1 : 0,
          });
        });
        return id;
      }),
      updateGoal: act(['goals'], (id, patch) => update(db, 'goals', id, patch)),
      setFocus: act(['goals'], async (id) => {
        await db.withTransactionAsync(async () => {
          await clearFocus();
          if (id) await update(db, 'goals', id, { is_focus: 1 });
        });
      }),
      // Returns the highest milestone crossed (F6.6), or null.
      setGoalProgress: act(['goals'], async (id, value) => {
        const g = await db.getFirstAsync('SELECT * FROM goals WHERE id = ?', [id]);
        if (!g) return null;
        const v = Math.max(0, Number(value) || 0);
        const before = (g.current_value / g.target_value) * 100;
        const after = (v / g.target_value) * 100;
        const patch = { current_value: v };
        if (after >= 100 && g.status === 'active') {
          patch.status = 'done';
          patch.completed_at = nowIso();
        }
        await update(db, 'goals', id, patch);
        const crossed = MILESTONES.filter((m) => before < m && after >= m);
        return crossed.length ? crossed[crossed.length - 1] : null;
      }),
      setGoalStatus: act(['goals'], (id, status) =>
        update(db, 'goals', id, {
          status,
          completed_at: status === 'done' ? nowIso() : null,
          ...(status !== 'active' ? { is_focus: 0 } : {}),
        }),
      ),

      // Rituals (F1.4) — named recurring blocks, not tasks.
      addRitual: act(['rituals'], (r) => insert(db, 'rituals', { ...r, active: 1 })),
      updateRitual: act(['rituals'], (id, patch) => update(db, 'rituals', id, patch)),

      // Tasks (F2.1/F2.2).
      addTask: act(['tasks', 'day_plans', 'plan_items', 'settings'], async (t, opts = {}) => {
        const id = await insert(db, 'tasks', {
          area_id: t.area_id,
          goal_id: t.goal_id || null,
          title: t.title.trim(),
          notes: t.notes || '',
          estimated_minutes: t.estimated_minutes || 30,
          priority: t.priority || 'med',
          deadline: t.deadline || null,
          status: 'backlog',
        });
        await setSetting(db, 'last_area_id', t.area_id);
        if (opts.planDate) await addTaskToPlan(opts.planDate, id);
        return id;
      }),
      updateTask: act(['tasks'], (id, patch) => update(db, 'tasks', id, patch)),
      deleteTask: act(['tasks', 'plan_items'], async (id) => {
        await db.withTransactionAsync(async () => {
          await removeWhere(db, 'plan_items', 'task_id = ?', [id]);
          await remove(db, 'tasks', id);
        });
      }),
      setActual: act(['tasks'], (taskId, minutes) =>
        update(db, 'tasks', taskId, { actual_minutes: minutes == null ? null : Math.round(minutes) }),
      ),

      // Day plans (F3).
      ensurePlan: act(['day_plans', 'plan_items'], (date) => ensurePlan(date)),
      planTask: act(['day_plans', 'plan_items', 'tasks'], async (date, taskId) => {
        const preset = getSystem(await getSettingRaw('system_preset'));
        if (preset.dailyCap) {
          const planId = await ensurePlan(date);
          const row = await db.getFirstAsync(
            'SELECT COUNT(*) AS n FROM plan_items WHERE day_plan_id = ? AND task_id IS NOT NULL',
            [planId],
          );
          if ((row?.n ?? 0) >= preset.dailyCap) return { ok: false, reason: 'cap' };
        }
        await addTaskToPlan(date, taskId);
        return { ok: true };
      }),
      unplanItem: act(['plan_items', 'tasks'], async (itemId) => {
        const it = await db.getFirstAsync('SELECT * FROM plan_items WHERE id = ?', [itemId]);
        if (!it) return;
        await remove(db, 'plan_items', itemId);
        if (it.task_id) await update(db, 'tasks', it.task_id, { status: 'backlog', completed_at: null });
      }),
      moveItem: act(['plan_items'], async (itemId, delta) => {
        const it = await db.getFirstAsync('SELECT * FROM plan_items WHERE id = ?', [itemId]);
        if (!it) return;
        const siblings = await db.getAllAsync(
          'SELECT id, sort_order FROM plan_items WHERE day_plan_id = ? ORDER BY sort_order, created_at',
          [it.day_plan_id],
        );
        const idx = siblings.findIndex((s) => s.id === itemId);
        const swap = siblings[idx + delta];
        if (!swap) return;
        await db.withTransactionAsync(async () => {
          // Renumber densely, then swap — tolerates duplicate sort_order values.
          for (let i = 0; i < siblings.length; i += 1) {
            const order = i === idx ? idx + delta : i === idx + delta ? idx : i;
            await update(db, 'plan_items', siblings[i].id, { sort_order: order });
          }
        });
      }),
      setItemTime: act(['plan_items'], (itemId, time) => update(db, 'plan_items', itemId, { start_time: time || null })),
      applyAutoTimes: act(['plan_items'], async (date) => {
        const plan = await db.getFirstAsync('SELECT id FROM day_plans WHERE date = ?', [date]);
        if (!plan) return;
        const items = await db.getAllAsync('SELECT * FROM plan_items WHERE day_plan_id = ? ORDER BY sort_order', [plan.id]);
        const tasks = await db.getAllAsync('SELECT id, estimated_minutes FROM tasks');
        const rituals = await db.getAllAsync('SELECT id, duration_minutes FROM rituals');
        const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
        const start = (await getSettingRaw('day_start')) || '09:00';
        const [h, m] = start.split(':').map(Number);
        const timed = autoTimes(items, h * 60 + m, byId(tasks), byId(rituals));
        for (let i = 0; i < items.length; i += 1) {
          if (timed[i].start_time !== items[i].start_time) {
            await update(db, 'plan_items', items[i].id, { start_time: timed[i].start_time });
          }
        }
      }),

      // Ticking a task off during the day.
      setItemOutcome: act(['plan_items', 'tasks'], async (itemId, outcome) => {
        const it = await db.getFirstAsync('SELECT * FROM plan_items WHERE id = ?', [itemId]);
        if (!it) return;
        await update(db, 'plan_items', itemId, { outcome });
        if (it.task_id) {
          await update(db, 'tasks', it.task_id,
            outcome === 'done'
              ? { status: 'done', completed_at: nowIso() }
              : { status: 'planned', completed_at: null });
        }
      }),

      // Evening ritual, step 1: record outcomes and handle what's unfinished.
      // Idempotent, so going back and changing an answer is safe.
      closeToday: act(['day_plans', 'plan_items', 'tasks'], async ({ date, outcomes, unfinished }) => {
        const tomorrow = addDays(date, 1);
        await db.withTransactionAsync(async () => {
          const planId = await ensurePlan(date);
          const items = await db.getAllAsync('SELECT * FROM plan_items WHERE day_plan_id = ?', [planId]);
          for (const it of items) {
            const outcome = outcomes[it.id] === 'done' ? 'done' : 'missed';
            const was = it.outcome;
            await update(db, 'plan_items', it.id, { outcome });
            if (!it.task_id) continue;
            if (outcome === 'done') {
              const task = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', [it.task_id]);
              await update(db, 'tasks', it.task_id, {
                status: 'done',
                completed_at: task?.completed_at || nowIso(),
              });
              // Undo a carry-forward made by an earlier pass.
              await removeWhere(db, 'plan_items', LATER_PENDING, [it.task_id, date]);
              continue;
            }
            const task = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', [it.task_id]);
            const deferrals = (task?.deferral_count || 0) + (was === 'missed' ? 0 : 1);
            if (unfinished === 'tomorrow') {
              await addTaskToPlan(tomorrow, it.task_id);
              await update(db, 'tasks', it.task_id, { status: 'planned', completed_at: null, deferral_count: deferrals });
            } else {
              await removeWhere(db, 'plan_items', LATER_PENDING, [it.task_id, date]);
              await update(db, 'tasks', it.task_id, {
                status: unfinished === 'drop' ? 'dropped' : 'backlog',
                completed_at: null,
                deferral_count: deferrals,
              });
            }
          }
          await ensurePlan(tomorrow);
        });
      }),

      // Evening ritual, final step: this is what lights the dot.
      commitDay: act(['day_plans'], async ({ date, review, mood }) => {
        const planId = await ensurePlan(date);
        const preset = await getSettingRaw('system_preset');
        await update(db, 'day_plans', planId, {
          review_note: review || '',
          mood: mood ?? null,
          closed_at: nowIso(),
          system_preset: preset,
        });
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, reload, run, engine]);

  // ---- derived --------------------------------------------------------------

  const value = useMemo(() => {
    if (!data) return null;
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of data.settings) settings[row.key] = row.value;

    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const itemsByPlan = {};
    for (const it of data.plan_items) (itemsByPlan[it.day_plan_id] ||= []).push(it);
    const litDates = data.day_plans.filter((p) => p.closed_at).map((p) => p.date);

    return {
      today,
      settings,
      system: getSystem(settings.system_preset),
      areas: data.areas,
      activeAreas: data.areas.filter((a) => !a.archived),
      areasById: byId(data.areas),
      goals: data.goals,
      goalsById: byId(data.goals),
      focusGoal: data.goals.find((g) => g.is_focus && g.status === 'active') || null,
      rituals: data.rituals,
      ritualsById: byId(data.rituals),
      tasks: data.tasks,
      tasksById: byId(data.tasks),
      plans: data.day_plans,
      plansByDate: Object.fromEntries(data.day_plans.map((p) => [p.date, p])),
      itemsByPlan,
      litDates,
      streak: computeStreak(litDates, today),
      staleNote,
      account,
      actions,
    };
  }, [data, today, staleNote, account, actions]);

  if (!value) return null;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
