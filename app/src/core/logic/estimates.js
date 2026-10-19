// F10.2 — estimate correction. Learns how long *this user's* tasks really
// take (from F2.4 estimates and F2.5 actuals) and offers a realistic number.
// An area needs its own history before it gets its own ratio; until then
// the user's overall ratio stands in.

export const MIN_SAMPLES = 5;
export const NOTABLE = 0.15; // only speak up when off by more than 15%

const samplesOf = (tasks) =>
  tasks.filter((t) => t.status === 'done' && t.actual_minutes > 0 && t.estimated_minutes > 0);

function ratio(samples) {
  if (samples.length < MIN_SAMPLES) return null;
  const est = samples.reduce((s, t) => s + t.estimated_minutes, 0);
  const act = samples.reduce((s, t) => s + t.actual_minutes, 0);
  return act / est;
}

// { overall, byArea: { areaId: ratio } } — null where there isn't enough data.
export function estimateRatios(tasks) {
  const all = samplesOf(tasks);
  const byArea = {};
  for (const id of new Set(all.map((t) => t.area_id))) {
    const r = ratio(all.filter((t) => t.area_id === id));
    if (r != null) byArea[id] = r;
  }
  return { overall: ratio(all), byArea, samples: all.length };
}

export function ratioFor(ratios, areaId) {
  return ratios.byArea[areaId] ?? ratios.overall ?? null;
}

const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);

// "You say 30m; tasks like this take you about 45m." Null if close enough.
export function corrected(estimate, r) {
  if (!r || Math.abs(r - 1) <= NOTABLE) return null;
  return round5(estimate * r);
}

// Realistic load for a list of { minutes, areaId } — what the day will
// actually take, given the user's history.
export function realisticLoad(items, ratios) {
  let total = 0;
  for (const it of items) total += it.minutes * (ratioFor(ratios, it.areaId) ?? 1);
  return Math.round(total);
}
