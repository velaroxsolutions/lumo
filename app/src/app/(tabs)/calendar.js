// F4.1 day timeline and F4.2 week view.

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useStore } from '../../core/store';
import { useDayPlan } from '../../core/useDayPlan';
import { colors, radius, space, type } from '../../core/theme';
import { addDays, formatClock, formatDuration, parseTime, prettyDate, range, shortDate, shortDay, weekStart } from '../../core/dates';
import { Icon, Kicker, Screen, Segmented, T } from '../../components/ui';
import { AreaDot, EmptyNote } from '../../components/parts';

const HOUR = 56;
const FIRST_HOUR = 6;
const LAST_HOUR = 24;

export default function Calendar() {
  const { today } = useStore();
  const [mode, setMode] = useState('day');
  const [anchor, setAnchor] = useState(today);
  const step = mode === 'day' ? 1 : 7;

  return (
    <Screen>
      <Kicker>Calendar</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="h1" style={{ flex: 1 }} numberOfLines={1}>
          {mode === 'day' ? prettyDate(anchor) : `Week of ${shortDate(weekStart(anchor))}`}
        </T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <NavBtn icon={ChevronLeft} onPress={() => setAnchor(addDays(anchor, -step))} label="Previous" />
          <NavBtn icon={ChevronRight} onPress={() => setAnchor(addDays(anchor, step))} label="Next" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
        </View>
        {anchor !== today ? (
          <Pressable onPress={() => setAnchor(today)} hitSlop={8}>
            <T v="emphasis" style={{ color: colors.sunbeam }}>Today</T>
          </Pressable>
        ) : null}
      </View>
      {mode === 'day' ? <DayView date={anchor} /> : <WeekView anchor={anchor} onPick={(d) => { setAnchor(d); setMode('day'); }} />}
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
