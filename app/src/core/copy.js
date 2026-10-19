// Voice: encouraging, never babying. Specific numbers over adjectives.
// No "Yay", no guilt, no comparison to other users, at most one emoji (we use none).

import { formatDuration, shortDate } from './dates';

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
export const numWord = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const lower = (n) => numWord(n).toLowerCase();

export function dayCloseLine(done, total) {
  if (total === 0) return "Nothing on the list today. Tomorrow's sorted, and that counts.";
  const head = `${numWord(done)} of ${lower(total)}.`;
  const r = done / total;
  if (done === total) return `${head} Clean sweep. Tomorrow's already sorted.`;
  if (r >= 0.66) return `${head} That's a good day. Tomorrow's already sorted.`;
  if (r >= 0.34) return `${head} Solid ground. Tomorrow's already sorted.`;
  return `${head} Some days are like that. Tomorrow's a fresh one.`;
}

export function roughDayQuestion(done, total) {
  return `${numWord(done)} of ${lower(total)}. Some days are like that. Push the rest to tomorrow, or let them go?`;
}

export function overcommitLine(total, available) {
  const t = Math.round(total / 60);
  const a = Math.round(available / 60);
  if (t === a) return `That's ${lower(t)} hours of work in a ${lower(a)}-hour day. Want to cut something?`;
  return `That's ${formatDuration(total)} of work in a ${formatDuration(available)} day. Want to cut something?`;
}

export const brokenLine = (n) => `Back to zero. You still stacked ${n} days — that happened. Light one up tonight.`;

export const EMPTY_BACKLOG = "Nothing here yet. Chuck in whatever's rattling around — one line is fine.";

export const NOTIFY = {
  evening: { title: 'lumo', body: 'Ready to light up today?' },
  morning: { title: 'lumo', body: "Today's plan is ready. Nothing to decide before coffee." },
};

export const REVIEW_PROMPTS = [
  'What worked today?',
  'What slowed you down?',
  'What would you do differently tomorrow?',
  'What are you glad you got done?',
  'Where did the time actually go?',
];

export function reviewPrompt(dateKey) {
  const n = dateKey.split('-').reduce((a, b) => a + Number(b), 0);
  return REVIEW_PROMPTS[n % REVIEW_PROMPTS.length];
}

export function tasksLeftLine(left, minutes) {
  if (left === 0) return 'Everything on today is done.';
  const t = left === 1 ? 'task' : 'tasks';
  return `${numWord(left)} ${t} left. About ${formatDuration(minutes)}.`;
}

export function milestoneLine(pct, goalTitle) {
  if (pct >= 100) return `${goalTitle} — done. That one's yours.`;
  return `${pct}% of the way to ${goalTitle}. Keep stacking.`;
}

// F7.7 — pace is an estimate; say so, and never scold.
export function paceLine(goal, progress, p) {
  const when = shortDate(p.finish);
  const what = `${fmtNum(progress.target)} ${progress.unit}`.trim();
  if (p.onTrack === false) return `At this pace you hit ${what} around ${when} — after your ${shortDate(goal.deadline)} date. Pick up the pace or move the date?`;
  return `At this pace you hit ${what} around ${when}.`;
}

export const MOODS = ['Drained', 'Low', 'Okay', 'Good', 'Great'];

export function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}
