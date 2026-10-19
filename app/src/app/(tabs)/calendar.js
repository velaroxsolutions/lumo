// F4.1 day timeline, F4.2 week view, F4.3 month heatmap.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useStore } from '../../core/store';
import { useDayPlan } from '../../core/useDayPlan';
import { colors, radius, space, type } from '../../core/theme';
import { addDays, formatClock, formatDuration, fromKey, parseTime, prettyDate, range, shortDate, shortDay, toKey, weekStart } from '../../core/dates';
import { Button, Icon, Kicker, Screen, Segmented, T } from '../../components/ui';
import { AreaDot, EmptyNote } from '../../components/parts';

const HOUR = 56;
const FIRST_HOUR = 6;
const LAST_HOUR = 24;

export default function Calendar() {
  const { today } = useStore();
  const [mode, setMode] = useState('day');
  const [anchor, setAnchor] = useState(today);
  const step = mode === 'day' ? 1 : 7;
  const go = (dir) => setAnchor(mode === 'month' ? shiftMonth(anchor, dir) : addDays(anchor, dir * step));
  const title = mode === 'day' ? prettyDate(anchor) : mode === 'week' ? `Week of ${shortDate(weekStart(anchor))}` : monthTitle(anchor);

  return (
    <Screen>
      <Kicker>Calendar</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="h1" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <NavBtn icon={ChevronLeft} onPress={() => go(-1)} label="Previous" />
          <NavBtn icon={ChevronRight} onPress={() => go(1)} label="Next" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        </View>
        {anchor !== today ? (
          <Pressable onPress={() => setAnchor(today)} hitSlop={8}>
            <T v="emphasis" style={{ color: colors.sunbeam }}>Today</T>
          </Pressable>
        ) : null}
      </View>
      {mode === 'day' ? <DayView date={anchor} /> : null}
      {mode === 'week' ? (
        <>
          <Button small kind="secondary" icon={CalendarRange} title="Plan the week" onPress={() => router.push('/week')} style={{ alignSelf: 'flex-start', marginBottom: space.md }} />
          <WeekView anchor={anchor} onPick={(d) => { setAnchor(d); setMode('day'); }} />
        </>
      ) : null}
      {mode === 'month' ? <MonthView anchor={anchor} onPick={(d) => { setAnchor(d); setMode('day'); }} /> : null}
    </Screen>
  );
}

function NavBtn({ icon, onPress, label }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Icon as={icon} color={colors.cloud} />
    </Pressable>
  );
}

function blockColor(item) {
  if (item.outcome === 'done') return colors.lagoon;
  if (item.outcome === 'missed') return colors.blush;
  return item.area?.color || colors.violet;
}

function DayView({ date }) {
  const day = useDayPlan(date);
  const timed = day.items.filter((i) => parseTime(i.start_time) != null);
  const loose = day.items.filter((i) => parseTime(i.start_time) == null);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, h) => h);

  return (
    <View>
      {loose.length ? (
        <View style={{ marginBottom: space.lg }}>
          <T v="kicker" style={{ marginBottom: space.sm }}>Any time</T>
          {loose.map((i) => (
            <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, paddingHorizontal: space.md, backgroundColor: colors.surface, borderRadius: radius.sm, marginBottom: 6 }}>
              <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: blockColor(i) }} />
              <T style={{ flex: 1 }} numberOfLines={1}>{i.title}</T>
              <T v="data" style={{ fontSize: 12 }}>{formatDuration(i.minutes)}</T>
            </View>
          ))}
        </View>
      ) : null}
      {!day.items.length ? <EmptyNote>Nothing planned on this day.</EmptyNote> : null}
      <View style={{ height: HOUR * (LAST_HOUR - FIRST_HOUR), marginTop: space.md }}>
        {hours.map((h) => (
          <View key={h} style={{ position: 'absolute', top: h * HOUR, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start' }}>
            <T style={[type.data, { fontSize: 11, color: colors.muted, width: 62 }]}>{formatClock((h + FIRST_HOUR) * 60)}</T>
            <View style={{ flex: 1, height: 2, backgroundColor: colors.surface, marginTop: 7 }} />
          </View>
        ))}
        {timed.map((i) => {
          const start = parseTime(i.start_time);
          const top = ((start - FIRST_HOUR * 60) / 60) * HOUR + 8;
          const height = Math.max(26, (i.minutes / 60) * HOUR - 4);
          return (
            <View
              key={i.id}
              style={{
                position: 'absolute',
                top: Math.max(0, top),
                left: 66,
                right: 0,
                height,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                borderLeftWidth: 5,
                borderLeftColor: blockColor(i),
                paddingHorizontal: space.sm,
                paddingVertical: 4,
                overflow: 'hidden',
              }}
            >
              <T v="emphasis" style={{ fontSize: 14 }} numberOfLines={1}>{i.title}</T>
              {height > 40 ? <T v="caption">{formatClock(start)} · {formatDuration(i.minutes)}</T> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WeekDay({ date, onPick }) {
  const { today, plansByDate } = useStore();
  const day = useDayPlan(date);
  const lit = !!plansByDate[date]?.closed_at;
  return (
    <Pressable onPress={() => onPick(date)} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, borderWidth: 2, borderColor: date === today ? colors.sunbeam : 'transparent' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: day.items.length ? space.sm : 0 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: lit ? colors.sunbeam : 'transparent', borderWidth: lit ? 0 : 2, borderColor: colors.line }} />
        <T v="emphasis" style={{ flex: 1 }}>{shortDay(date)} · {shortDate(date)}</T>
        <T v="data" style={{ fontSize: 12, color: colors.muted }}>
          {day.items.length ? `${day.tally.done}/${day.items.length} · ${formatDuration(day.load)}` : '—'}
        </T>
      </View>
      {day.items.slice(0, 6).map((i) => (
        <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
          <AreaDot area={i.area} size={8} />
          <T v="caption" style={{ flex: 1, color: i.outcome === 'done' ? colors.muted : colors.cloud, fontSize: 13 }} numberOfLines={1}>{i.title}</T>
          {i.outcome !== 'pending' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.outcome === 'done' ? colors.lagoon : colors.blush }} /> : null}
        </View>
      ))}
      {day.items.length > 6 ? <T v="caption">+{day.items.length - 6} more</T> : null}
    </Pressable>
  );
}

function WeekView({ anchor, onPick }) {
  const start = weekStart(anchor);
  return (
    <View>
      {range(start, addDays(start, 6)).map((d) => (
        <WeekDay key={d} date={d} onPick={onPick} />
      ))}
    </View>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shiftMonth(key, n) {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
}

function monthTitle(key) {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// One hue (Lagoon), light → full by share of the plan that got done.
const STEPS = [0.2, 0.38, 0.56, 0.78, 1];
const step = (rate) => STEPS[Math.min(STEPS.length - 1, Math.floor(rate * STEPS.length))];

function MonthView({ anchor, onPick }) {
  const { today, plansByDate, itemsByPlan } = useStore();
  const d = fromKey(anchor);
  const first = toKey(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const last = toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  const cells = range(weekStart(first), addDays(weekStart(last), 6)).map((k) => {
    const plan = plansByDate[k];
    const items = plan ? itemsByPlan[plan.id] || [] : [];
    return { k, plan, items, n: items.filter((i) => i.outcome === 'done').length, inMonth: k >= first && k <= last };
  });
  const month = cells.filter((c) => c.inMonth);
  const planned = month.reduce((a, c) => a + c.items.length, 0);
  const done = month.reduce((a, c) => a + c.n, 0);
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => (
          <T key={i} v="caption" style={{ flex: 1, textAlign: 'center' }}>{x}</T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map(({ k, plan, items, n, inMonth }) => {
          const future = k > today;
          const rate = items.length && !future ? n / items.length : null;
          const bg = rate == null ? colors.surface : colors.lagoon;
          const strong = rate != null && step(rate) >= 0.78;
          return (
            <View key={k} style={{ width: `${100 / 7}%`, padding: 3 }}>
              <Pressable
                onPress={() => onPick(k)}
                accessibilityLabel={`${prettyDate(k)}: ${items.length ? `${n} of ${items.length} done` : 'nothing planned'}`}
                style={{ aspectRatio: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', opacity: inMonth ? 1 : 0.25, borderWidth: k === today || (future && items.length) ? 2 : 0, borderColor: k === today ? colors.sunbeam : colors.violet, overflow: 'hidden' }}
              >
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg, opacity: rate == null ? 1 : step(rate) }} />
                <Text style={[type.data, { fontSize: 12, color: strong ? colors.ink : colors.cloud }]}>{Number(k.slice(8))}</Text>
                {plan?.closed_at ? <View style={{ position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: strong ? colors.ink : colors.sunbeam }} /> : null}
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md }}>
        <T v="caption">Less done</T>
        {STEPS.map((o) => (
          <View key={o} style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: colors.lagoon, opacity: o }} />
        ))}
        <T v="caption">More</T>
        <View style={{ flex: 1 }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sunbeam }} />
        <T v="caption">lit</T>
        <View style={{ width: 12, height: 12, borderRadius: 3, borderWidth: 2, borderColor: colors.violet }} />
        <T v="caption">planned</T>
      </View>
      <T v="data" style={{ marginTop: space.md, color: colors.muted }}>
        {planned ? `${done} of ${planned} planned items done this month` : 'Nothing planned this month yet.'}
      </T>
    </View>
  );
}
