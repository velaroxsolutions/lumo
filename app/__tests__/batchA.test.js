import { nextDue, occurrenceId } from '../src/core/logic/recurrence';
import { byUrgency, dueBadge, isOverdue } from '../src/core/logic/deadlines';
import { historyOf, pace, progressOf } from '../src/core/logic/goals';

const T = '2026-10-19'; // Monday

describe('recurrence', () => {
  test('daily, weekly, monthly step from the due date', () => {
    expect(nextDue('daily', '2026-10-19', T)).toBe('2026-10-20');
    expect(nextDue('weekly', '2026-10-19', T)).toBe('2026-10-26');
    expect(nextDue('monthly', '2026-01-31', '2026-01-31')).toBe('2026-02-28');
  });
  test('weekdays skip the weekend', () => {
    expect(nextDue('weekdays', '2026-10-23', '2026-10-23')).toBe('2026-10-26'); // Fri → Mon
  });
  test('finishing late never schedules into the past', () => {
    expect(nextDue('daily', '2026-10-10', T)).toBe('2026-10-20');
    expect(nextDue('weekly', '2026-10-01', T)).toBe('2026-10-22');
  });
  test('one-off tasks have no next', () => {
    expect(nextDue('none', T, T)).toBeNull();
    expect(occurrenceId('abc', '2026-10-20')).toBe('abc-2026-10-20');
  });
});

describe('deadlines', () => {
  const task = (deadline, status = 'backlog', extra = {}) => ({ deadline, status, priority: 'med', created_at: 'x', ...extra });
  test('badges read as facts', () => {
    expect(dueBadge(task('2026-10-17'), T)).toEqual({ text: '2 days over', tone: 'over' });
    expect(dueBadge(task('2026-10-19'), T).text).toBe('Due today');
    expect(dueBadge(task('2026-10-20'), T).text).toBe('Due tomorrow');
    expect(dueBadge(task('2026-10-23'), T).text).toBe('Due Fri');
    expect(dueBadge(task('2026-11-30'), T).text).toBe('Due Nov 30');
    expect(dueBadge(task('2026-10-17', 'done'), T)).toBeNull();
  });
  test('overdue only counts open tasks', () => {
    expect(isOverdue(task('2026-10-18'), T)).toBe(true);
    expect(isOverdue(task('2026-10-18', 'dropped'), T)).toBe(false);
  });
  test('urgency order: overdue, soonest, then energy', () => {
    const list = [task(null, 'backlog', { priority: 'high' }), task('2026-10-25'), task('2026-10-17'), task(null, 'backlog', { priority: 'low' })];
    expect(list.sort(byUrgency).map((t) => t.deadline || t.priority)).toEqual(['2026-10-17', '2026-10-25', 'high', 'low']);
  });
});

describe('goals', () => {
  const linked = [
    { status: 'done', completed_at: '2026-10-10T12:00:00Z' },
    { status: 'done', completed_at: '2026-10-15T12:00:00Z' },
    { status: 'backlog' },
    { status: 'dropped' },
  ];
  test('task-driven progress ignores dropped tasks', () => {
    expect(progressOf({ progress_mode: 'tasks' }, linked)).toMatchObject({ current: 2, target: 3, pct: 67 });
  });
  test('manual progress is clamped', () => {
    expect(progressOf({ progress_mode: 'manual', current_value: 25, target_value: 20 }).pct).toBe(100);
  });
  test('pace projects a finish from the last two weeks', () => {
    const goal = { progress_mode: 'manual', target_value: 20, current_value: 8, deadline: '2026-11-30' };
    const logs = [
      { value: 0, logged_at: '2026-10-01T12:00:00Z' },
      { value: 2, logged_at: '2026-10-08T12:00:00Z' },
      { value: 8, logged_at: '2026-10-18T12:00:00Z' },
    ];
    const p = pace(goal, progressOf(goal), historyOf(goal, logs), T);
    // From Oct 5 (window start, value 0 before it) to Oct 19: +8 in 14 days.
    expect(p.perDay).toBeCloseTo(8 / 14);
    expect(p.finish).toBe('2026-11-09');
    expect(p.onTrack).toBe(true);
  });
  test('no pace without movement', () => {
    const goal = { progress_mode: 'manual', target_value: 20, current_value: 0 };
    expect(pace(goal, progressOf(goal), historyOf(goal, [{ value: 0, logged_at: '2026-10-01T00:00:00Z' }]), T)).toBeNull();
  });
});
