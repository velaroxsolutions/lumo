import { autoTimes, capReached, closeTally, overcommit, planLoad, ritualsForDate, sortItems } from '../src/core/logic/plan';
import { SYSTEMS } from '../src/core/systems';
import { dayCloseLine, overcommitLine } from '../src/core/copy';
import { todayKey, weekStart, parseTime, formatDuration } from '../src/core/dates';
import { estimateAccuracy } from '../src/core/logic/insights';

const tasks = { a: { estimated_minutes: 60 }, b: { estimated_minutes: 90 }, c: {} };
const rituals = { r: { duration_minutes: 45 } };

test('plan load sums estimates, rituals and defaults', () => {
  const items = [{ task_id: 'a' }, { task_id: 'b' }, { task_id: 'c' }, { ritual_id: 'r' }];
  expect(planLoad(items, tasks, rituals)).toBe(60 + 90 + 30 + 45);
});

test('overcommit is a soft warning above available time only', () => {
  expect(overcommit(300, 360)).toBeNull();
  expect(overcommit(540, 360)).toEqual({ total: 540, available: 360, over: 180 });
  expect(overcommitLine(540, 540)).toBe("That's nine hours of work in a nine-hour day. Want to cut something?");
});

test('rituals land on matching weekdays', () => {
  const list = [
    { id: 'wk', active: 1, weekday_mask: 0b0111110 },
    { id: 'off', active: 0, weekday_mask: 0b1111111 },
  ];
  expect(ritualsForDate(list, '2026-10-19').map((r) => r.id)).toEqual(['wk']); // Monday
  expect(ritualsForDate(list, '2026-10-18')).toEqual([]); // Sunday
});

test('time blocker fills free slots after fixed blocks', () => {
  const items = [{ task_id: 'a' }, { ritual_id: 'r', start_time: '12:00' }, { task_id: 'b' }];
  const out = autoTimes(items, 9 * 60, tasks, rituals);
  expect(out.map((i) => i.start_time)).toEqual(['09:00', '12:00', '12:45']);
});

test('sort by time puts untimed items last', () => {
  const items = [{ sort_order: 0 }, { sort_order: 1, start_time: '14:00' }, { sort_order: 2, start_time: '09:30' }];
  expect(sortItems(items, SYSTEMS.time_blocker).map((i) => i.sort_order)).toEqual([2, 1, 0]);
  expect(sortItems(items, SYSTEMS.backlog_tomorrow).map((i) => i.sort_order)).toEqual([0, 1, 2]);
});

test('Top 3 caps tasks, not rituals', () => {
  const three = [{ task_id: 1 }, { task_id: 2 }, { ritual_id: 'r' }];
  expect(capReached(three, SYSTEMS.top_three)).toBe(false);
  expect(capReached([...three, { task_id: 3 }], SYSTEMS.top_three)).toBe(true);
  expect(capReached([...three, { task_id: 3 }], SYSTEMS.backlog_tomorrow)).toBe(false);
});

test('day close copy follows the brand voice', () => {
  expect(closeTally([{ outcome: 'done' }, { outcome: 'missed' }])).toEqual({ done: 1, total: 2 });
  expect(dayCloseLine(5, 6)).toBe("Five of six. That's a good day. Tomorrow's already sorted.");
  expect(dayCloseLine(0, 0)).toMatch(/Tomorrow's sorted/);
});

test('logical day rolls over at 4am', () => {
  expect(todayKey(new Date(2026, 9, 20, 1, 30))).toBe('2026-10-19');
  expect(todayKey(new Date(2026, 9, 20, 4, 0))).toBe('2026-10-20');
  expect(weekStart('2026-10-19')).toBe('2026-10-19');
  expect(weekStart('2026-10-25')).toBe('2026-10-19');
});

test('time helpers', () => {
  expect(parseTime('9:05')).toBe(545);
  expect(parseTime('25:00')).toBeNull();
  expect(formatDuration(80)).toBe('1h 20m');
});

test('estimate accuracy needs enough samples', () => {
  const done = (e, a, i) => ({ status: 'done', estimated_minutes: e, actual_minutes: a, completed_at: `2026-10-${10 + i}` });
  expect(estimateAccuracy([done(30, 45, 1)]).ready).toBe(false);
  const five = [1, 2, 3, 4, 5].map((i) => done(30, 48, i));
  const acc = estimateAccuracy(five);
  expect(acc.ready).toBe(true);
  expect(acc.ratio).toBeCloseTo(1.6);
});
