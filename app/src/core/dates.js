// Local-date helpers. Plans are keyed by 'YYYY-MM-DD' in the user's local time.
// The logical day rolls over at 4am, so closing the day at 12:40am still
// closes "today" rather than a day that has barely started.

export const DAY_ROLLOVER_HOUR = 4;

const pad = (n) => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function todayKey(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return toKey(d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}

export function weekday(key) {
  return fromKey(key).getDay(); // 0 = Sunday
}

export const monthKey = (key) => key.slice(0, 7);

// Monday-start week containing `key`.
export function weekStart(key) {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function range(fromKeyInclusive, toKeyInclusive) {
  const out = [];
  for (let k = fromKeyInclusive; k <= toKeyInclusive; k = addDays(k, 1)) out.push(k);
  return out;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayName = (key) => DAY_NAMES[weekday(key)];
export const shortDay = (key) => DAY_NAMES[weekday(key)].slice(0, 3);

export function prettyDate(key) {
  const d = fromKey(key);
  return `${DAY_NAMES[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function shortDate(key) {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Weekday masks: bit 0 = Sunday … bit 6 = Saturday.
export const WEEKDAYS_MASK = 0b0111110;
export const EVERY_DAY_MASK = 0b1111111;
export const maskHas = (mask, key) => ((mask >> weekday(key)) & 1) === 1;

// 'HH:MM' <-> minutes since midnight.
export function parseTime(t) {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function formatClock(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m % 60)} ${suffix}`;
}

export function formatDuration(mins) {
  if (mins == null) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
