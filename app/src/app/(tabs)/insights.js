// F7 — you against you. Completion over time (F7.1), where the week went
// (F7.2), and estimate accuracy (F7.4, pulled forward). Numbers here are
// measurements, so they're Mono; streaks are trophies only on Today/day close.

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useStore } from '../../core/store';
import { colors, radius, space, type } from '../../core/theme';
import { formatDuration, shortDate, shortDay } from '../../core/dates';
import { MOODS, numWord } from '../../core/copy';
import { MIN_ACCURACY_SAMPLES, TIME_BLOCKS, areaWeek, completionSeries, estimateAccuracy, finishTimes, moodAverage, moodVsCompletion, personalBests } from '../../core/logic/insights';
import { Button, Card, Kicker, Screen, Segmented, T } from '../../components/ui';
import { ShareSheet } from '../../components/ShareCard';
import { Share2 } from 'lucide-react-native';
import { SectionTitle } from '../../components/parts';

const CHART_H = 120;

export default function Insights() {
  const s = useStore();
  const { today, streak } = s;
  const [days, setDays] = useState(28);
  const [sharing, setSharing] = useState(false);

  const series = useMemo(() => completionSeries(s.plans, s.itemsByPlan, today, days), [s.plans, s.itemsByPlan, today, days]);
  const week = useMemo(
    () => areaWeek(s.activeAreas, s.plans, s.itemsByPlan, s.tasksById, s.ritualsById, today),
    [s.activeAreas, s.plans, s.itemsByPlan, s.tasksById, s.ritualsById, today],
  );
  const acc = useMemo(() => estimateAccuracy(s.tasks), [s.tasks]);
  const planned = series.reduce((n, d) => n + d.planned, 0);
  const done = series.reduce((n, d) => n + d.done, 0);
  const mood = moodAverage(series);
  const long = useMemo(() => completionSeries(s.plans, s.itemsByPlan, today, 90), [s.plans, s.itemsByPlan, today]);
  const energy = moodVsCompletion(long);
  const times = useMemo(() => finishTimes(s.tasks), [s.tasks]);
  const bests = useMemo(
    () => personalBests({ streak, plans: s.plans, itemsByPlan: s.itemsByPlan, tasks: s.tasks }),
    [streak, s.plans, s.itemsByPlan, s.tasks],
  );

  return (
    <Screen>
      <Kicker>You vs. you</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="h1">Insights</T>
        <Button small kind="secondary" icon={Share2} title="Share streak" onPress={() => setSharing(true)} />
      </View>
      <ShareSheet visible={sharing} onClose={() => setSharing(false)} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
        <Stat label="Current streak" value={`${streak.current}d`} />
        <Stat label="Best streak" value={`${streak.best}d`} />
        <Stat label="Days lit" value={String(streak.totalLit)} />
        <Stat label="Avg energy" value={mood ? `${mood.toFixed(1)}/5` : '—'} sub={mood ? MOODS[Math.round(mood) - 1] : null} />
      </View>

      <SectionTitle>Planned vs. closed</SectionTitle>
      <Segmented value={days} onChange={setDays} options={[{ value: 7, label: '7 days' }, { value: 28, label: '4 weeks' }]} />
      <Card style={{ marginTop: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T v="data" style={{ fontSize: 26, color: colors.cloud }}>{planned ? Math.round((done / planned) * 100) : 0}%</T>
          <T v="caption">{done} of {planned} planned items done</T>
        </View>
        <CompletionChart series={series} />
      </Card>

      <SectionTitle>Where this week went</SectionTitle>
      <Card>
        {week.some((w) => w.planned) ? (
          week.filter((w) => w.planned).map((w) => <AreaBar key={w.area.id} w={w} max={Math.max(...week.map((x) => x.plannedMin), 1)} />)
        ) : (
          <T style={{ color: colors.muted }}>Plan a day this week and this fills in.</T>
        )}
      </Card>

      <SectionTitle>Estimate accuracy</SectionTitle>
      <Card>
        {acc.ready ? (
          <>
            <T v="h2" style={{ fontSize: 22, lineHeight: 30 }}>
              You estimate {formatDuration(Math.round(acc.avgEstimate))}, you take {formatDuration(Math.round(acc.avgActual))}.
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: space.md }}>
              <T v="data" style={{ fontSize: 26, color: acc.ratio > 1.15 ? colors.sunbeam : colors.lagoon }}>{acc.ratio.toFixed(2)}×</T>
              <T v="caption">your estimates, last {acc.samples} tasks</T>
            </View>
            <T style={{ color: colors.muted, marginTop: space.sm }}>
              {acc.ratio > 1.15
                ? `Try budgeting ${Math.round((acc.ratio - 1) * 100)}% more than your gut says. Tomorrow gets easier to finish.`
                : acc.ratio < 0.85
                  ? 'You finish faster than you think. Room for one more thing a day.'
                  : 'Your estimates are honest. Plans you can actually finish.'}
            </T>
          </>
        ) : (
          <>
            <T>Log how long tasks really take and lumo learns your pace.</T>
            <T v="data" style={{ marginTop: space.sm }}>
              {acc.samples} / {MIN_ACCURACY_SAMPLES} tasks logged
            </T>
          </>
        )}
      </Card>

      <SectionTitle>Personal bests</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Stat label="Longest streak" value={`${bests.longestStreak}d`} />
        <Stat label="Best week" value={bests.bestWeek ? `${bests.bestWeek.done} done` : '—'} sub={bests.bestWeek ? `week of ${shortDate(bests.bestWeek.start)}` : null} />
        <Stat
          label="Sharpest estimates"
          value={bests.bestAccuracy ? `${bests.bestAccuracy.ratio.toFixed(2)}×` : '—'}
          sub={bests.bestAccuracy ? `week of ${shortDate(bests.bestAccuracy.start)}` : 'log a few actual times'}
        />
      </View>

      <SectionTitle>When you get things done</SectionTitle>
      <Card>
        {times ? (
          <>
            <T>
              Most of your finishing happens in the <T v="emphasis" style={{ color: colors.sunbeam }}>{times.peak.label.toLowerCase()}</T>. Put the hard stuff there.
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90, marginTop: space.md }}>
              {TIME_BLOCKS.map((b) => {
                const max = Math.max(...Object.values(times.counts), 1);
                const n = times.counts[b.key];
                return (
                  <View key={b.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <T style={[type.data, { fontSize: 11, color: colors.muted }]}>{n || ''}</T>
                    <View style={{ width: '70%', height: Math.max(3, (n / max) * 60), borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: b.key === times.peak.key ? colors.sunbeam : colors.violet }} />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {TIME_BLOCKS.map((b) => (
                <T key={b.key} v="caption" style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>{b.label}</T>
              ))}
            </View>
          </>
        ) : (
          <T style={{ color: colors.muted }}>Finish a handful of tasks and this shows when you're sharpest.</T>
        )}
      </Card>

      <SectionTitle>Energy and follow-through</SectionTitle>
      <Card>
        {energy ? (
          <T>
            On good-energy days you finish {Math.round(energy.high * 100)}% of the plan; on low days, {Math.round(energy.low * 100)}%.
            {energy.low < energy.high - 0.15 ? ' On a low day, plan lighter — it still counts.' : ' Your plans hold up either way.'}
          </T>
        ) : (
          <T style={{ color: colors.muted }}>Rate your energy when you close the day. After a few highs and lows, this compares them.</T>
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value, sub }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }}>
      <T v="caption">{label}</T>
      <T v="data" style={{ fontSize: 22, color: colors.cloud, marginTop: 2 }}>{value}</T>
      {sub ? <T v="caption">{sub}</T> : null}
    </View>
  );
}

// Single series → no legend; the title names it. Tap a bar for its value.
function CompletionChart({ series }) {
  const [sel, setSel] = useState(null);
  const pick = sel != null ? series[sel] : null;
  const gap = series.length > 10 ? 3 : 6;
  return (
    <View style={{ marginTop: space.md }}>
      <View style={{ height: 22, justifyContent: 'center' }}>
        {pick ? (
          <T v="caption" style={{ color: colors.cloud }}>
            {shortDay(pick.date)} {shortDate(pick.date)} · {pick.planned ? `${numWord(pick.done).toLowerCase()} of ${numWord(pick.planned).toLowerCase()}` : 'nothing planned'}{pick.closed ? ' · closed' : ''}
          </T>
        ) : (
          <T v="caption">Tap a day</T>
        )}
      </View>
      <View style={{ height: CHART_H, marginTop: space.sm }}>
        {[0, 0.5, 1].map((g) => (
          <View key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: g * CHART_H, height: 1, backgroundColor: colors.line, opacity: 0.6 }} />
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap }}>
          {series.map((d, i) => {
            const pct = d.planned ? d.done / d.planned : 0;
            const h = d.planned ? Math.max(4, pct * CHART_H) : 3;
            const on = sel === i;
            return (
              <Pressable
                key={d.date}
                onPress={() => setSel(on ? null : i)}
                accessibilityLabel={`${shortDate(d.date)}: ${d.done} of ${d.planned}`}
                style={{ flex: 1, height: CHART_H, justifyContent: 'flex-end' }}
              >
                <View
                  style={{
                    height: h,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: d.planned ? colors.lagoon : colors.line,
                    opacity: sel == null || on ? 1 : 0.45,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <T style={[type.data, { fontSize: 11, color: colors.muted }]}>{shortDate(series[0].date)}</T>
        <T style={[type.data, { fontSize: 11, color: colors.muted }]}>% of plan done</T>
        <T style={[type.data, { fontSize: 11, color: colors.muted }]}>Today</T>
      </View>
    </View>
  );
}

// Bullet bar: track = planned minutes, fill = done minutes, area colour as
// identity with the name always printed beside it (never colour alone).
function AreaBar({ w, max }) {
  const trackPct = (w.plannedMin / max) * 100;
  const fillPct = w.plannedMin ? Math.min(1, w.doneMin / w.plannedMin) * 100 : 0;
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <T v="emphasis" style={{ fontSize: 14 }}>{w.area.name}</T>
        <T style={[type.data, { fontSize: 12, color: colors.muted }]}>
          {formatDuration(w.doneMin)} done · {formatDuration(w.plannedMin)} planned
        </T>
      </View>
      <View style={{ height: 12, width: `${Math.max(trackPct, 2)}%`, backgroundColor: colors.elevated, borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ height: 12, width: `${fillPct}%`, backgroundColor: w.area.color, borderRadius: 6 }} />
      </View>
    </View>
  );
}
