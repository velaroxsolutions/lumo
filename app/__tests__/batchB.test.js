import { corrected, estimateRatios, realisticLoad } from '../src/core/logic/estimates';
import { suggestFor } from '../src/core/logic/suggest';
import { weekSummary } from '../src/core/logic/weekly';
import { finishTimes, moodVsCompletion, personalBests } from '../src/core/logic/insights';

const done = (area, est, act, at = '2026-10-15T15:00:00') => ({ status: 'done', area_id: area, estimated_minutes: est, actual_minutes: act, completed_at: at });

describe('estimate correction', () => {
  const tasks = [
    ...Array.from({ length: 5 }, () => done('acad', 30, 45)),
    ...Array.from({ length: 2 }, () => done('fit', 60, 60)),
  ];
  test('area ratio when it has history, overall otherwise', () => {
    const r = estimateRatios(tasks);
    expect(r.byArea.acad).toBeCloseTo(1.5);
    expect(r.byArea.fit).toBeUndefined();
    expect(r.overall).toBeCloseTo((225 + 120) / (150 + 120));
  });
  test('only speaks up when off by more than 15%', () => {
    expect(corrected(30, 1.5)).toBe(45);
    expect(corrected(30, 1.1)).toBeNull();
  });
  test('realistic load scales by area', () => {
    const r = estimateRatios(tasks);
    expect(realisticLoad([{ minutes: 60, areaId: 'acad' }], r)).toBe(90);
  });
});

describe('suggested tomorrow', () => {
  const base = { date: '2026-10-20', focusGoalId: 'g1', quietAreaIds: ['fit'], ratios: { overall: null, byArea: {} } };
  const t = (id, extra) => ({ id, area_id: 'acad', estimated_minutes: 60, priority: 'med', ...extra });
  test('deadlines and the focus goal rank first, each with a reason', () => {
    const backlog = [t('plain'), t('goal', { goal_id: 'g1' }), t('due', { deadline: '2026-10-21' }), t('gym', { area_id: 'fit' })];
    const picks = suggestFor({ ...base, backlog, room: 600 });
    expect(picks.map((p) => p.task.id)).toEqual(['due', 'goal', 'gym']);
    expect(picks[0].reasons).toEqual(['due Wed']);
  });
  test('fits the room left, but always offers one', () => {
    const backlog = [t('a', { deadline: '2026-10-20' }), t('b', { deadline: '2026-10-20' })];
    expect(suggestFor({ ...base, backlog, room: 90 }).length).toBe(1);
    expect(suggestFor({ ...base, backlog, room: 10 }).length).toBe(1);
  });
  test('respects a daily cap', () => {
    const backlog = [t('a', { goal_id: 'g1' }), t('b', { goal_id: 'g1' })];
    expect(suggestFor({ ...base, backlog, room: 600, cap: 3, alreadyPlanned: 2 }).length).toBe(1);
  });
});

describe('weekly summary', () => {
  test('assembles the week from plans', () => {
    const plans = [
      { id: 'p1', date: '2026-10-12', closed_at: 'x', review_note: 'Good start', mood: 4 },
      { id: 'p2', date: '2026-10-13', closed_at: null, review_note: '', mood: 2 },
    ];
    const itemsByPlan = { p1: [{ task_id: 't1', outcome: 'done' }, { task_id: 't2', outcome: 'missed' }], p2: [{ ritual_id: 'r1', outcome: 'done' }] };
    const s = weekSummary({
      start: '2026-10-12',
      plans,
      itemsByPlan,
      tasksById: { t1: { area_id: 'a', estimated_minutes: 30, actual_minutes: 40 }, t2: { area_id: 'a' } },
      ritualsById: { r1: { area_id: 'b', duration_minutes: 60 } },
      areasById: { a: { name: 'A' }, b: { name: 'B' } },
    });
    expect([s.lit, s.planned, s.done]).toEqual([1, 3, 2]);
    expect(s.areas.map((a) => [a.area.name, a.minutes])).toEqual([['B', 60], ['A', 40]]);
    expect(s.notes).toEqual([{ date: '2026-10-12', text: 'Good start' }]);
    expect(s.mood).toBe(3);
  });
});

describe('insights v2', () => {
  test('energy vs completion needs enough days on each side', () => {
    const day = (mood, done, planned) => ({ mood, done, planned });
    const series = [day(5, 4, 4), day(4, 3, 4), day(4, 4, 4), day(1, 1, 4), day(2, 2, 4), day(2, 1, 4)];
    const m = moodVsCompletion(series);
    expect(m.high).toBeCloseTo(11 / 12);
    expect(m.low).toBeCloseTo(4 / 12);
    expect(moodVsCompletion(series.slice(0, 4))).toBeNull();
  });
  test('finish times bucket by local hour', () => {
    const tasks = ['09:30', '10:15', '11:00', '10:45', '20:00'].map((h) => ({ status: 'done', completed_at: new Date(`2026-10-15T${h}:00`).toISOString() }));
    const f = finishTimes(tasks);
    expect(f.peak.key).toBe('morning');
    expect(f.counts.morning).toBe(4);
  });
  test('personal bests come from your own history', () => {
    const plans = [{ id: 'p1', date: '2026-10-13' }, { id: 'p2', date: '2026-10-20' }];
    const itemsByPlan = { p1: [{ outcome: 'done' }, { outcome: 'done' }], p2: [{ outcome: 'done' }] };
    const b = personalBests({ streak: { best: 9 }, plans, itemsByPlan, tasks: [] });
    expect(b).toEqual({ longestStreak: 9, bestWeek: { start: '2026-10-12', done: 2 }, bestAccuracy: null });
  });
});
