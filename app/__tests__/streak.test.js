import { computeStreak, weekDots, showBrokenNote } from '../src/core/logic/streak';
import { addDays, range } from '../src/core/dates';

const T = '2026-10-19';
const days = (from, to) => range(from, to);

describe('computeStreak', () => {
  test('empty history', () => {
    const s = computeStreak([], T);
    expect(s.current).toBe(0);
    expect(s.freezesLeft).toBe(2);
  });

  test('today not closed yet does not break the streak', () => {
    const s = computeStreak(days('2026-10-10', '2026-10-18'), T);
    expect(s.current).toBe(9);
    expect(s.todayLit).toBe(false);
  });

  test('closing today adds one', () => {
    const s = computeStreak(days('2026-10-10', T), T);
    expect(s.current).toBe(10);
    expect(s.best).toBe(10);
  });

  test('a missed day spends a freeze and keeps the run, without counting', () => {
    const lit = days('2026-10-10', '2026-10-18').filter((d) => d !== '2026-10-15');
    const s = computeStreak(lit, T);
    expect(s.current).toBe(8);
    expect(s.frozen.has('2026-10-15')).toBe(true);
    expect(s.freezesLeft).toBe(1);
  });

  test('third miss in a month resets to zero and reports the run', () => {
    const misses = ['2026-10-05', '2026-10-08', '2026-10-12'];
    const lit = days('2026-10-01', '2026-10-18').filter((d) => !misses.includes(d));
    const s = computeStreak(lit, T);
    expect(s.missed.has('2026-10-12')).toBe(true);
    expect(s.brokenRun).toBe(9);
    expect(s.current).toBe(6); // 13th..18th
    expect(s.best).toBe(9);
    expect(s.freezesLeft).toBe(0);
  });

  test('freezes refill each calendar month', () => {
    const misses = ['2026-09-25', '2026-09-27', '2026-10-02'];
    const lit = days('2026-09-20', '2026-10-18').filter((d) => !misses.includes(d));
    const s = computeStreak(lit, T);
    expect(s.missed.size).toBe(0);
    expect(s.current).toBe(lit.length);
    expect(s.freezesLeft).toBe(1);
  });

  test('no freeze is spent when there is no run to protect', () => {
    const s = computeStreak(['2026-10-01', '2026-10-18'], T);
    // 10-02 and 10-03 freeze, 10-04 breaks; later gaps are plain misses.
    expect(s.frozen.size).toBe(2);
    expect(s.current).toBe(1);
  });

  test('broken note only shows for a recent real run', () => {
    const lit = days('2026-10-01', '2026-10-14');
    const s = computeStreak(lit, T); // 15,16 frozen, 17 breaks
    expect(s.current).toBe(0);
    expect(s.brokenRun).toBe(14);
    expect(showBrokenNote(s, T)).toBe(true);
    expect(showBrokenNote(s, addDays(T, 10))).toBe(false);
  });
});

describe('weekDots', () => {
  test('seven dots ending with today as the open ring', () => {
    const lit = days('2026-10-14', '2026-10-18');
    const s = computeStreak(lit, T);
    const dots = weekDots(s, lit, T, '2026-10-14');
    expect(dots).toHaveLength(7);
    expect(dots[6]).toEqual({ date: T, status: 'today' });
    expect(dots[0].status).toBe('empty');
    expect(dots[5].status).toBe('lit');
  });
});
