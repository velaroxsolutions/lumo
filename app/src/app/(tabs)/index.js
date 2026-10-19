// F3.3 — Morning view / Today. Opens to a plan that already exists, Focus
// Goal on top, no decisions required before coffee. Today's open ring is the
// button that starts the evening ritual.

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Moon, Plus, Settings2, Snowflake } from 'lucide-react-native';

import { useStore } from '../../core/store';
import { useDayPlan } from '../../core/useDayPlan';
import { goalPct } from '../../core/useGoals';
import { colors, space } from '../../core/theme';
import { prettyDate, shortDate } from '../../core/dates';
import { brokenLine, fmtNum, overcommitLine, tasksLeftLine } from '../../core/copy';
import { showBrokenNote, weekDots } from '../../core/logic/streak';
import { areaWeek } from '../../core/logic/insights';
import { WeekDots } from '../../components/WeekMark';
import { Button, Card, Icon, Kicker, Press, Screen, T, haptic } from '../../components/ui';
import { EmptyNote, PlanRow, ProgressBar, Ring, SectionTitle } from '../../components/parts';
import { ActualSheet, CaptureFab, QuickCapture, TaskSheet } from '../../components/sheets';

export default function Today() {
  const s = useStore();
  const { today, streak, litDates, settings, focusGoal, staleNote, actions } = s;
  const day = useDayPlan(today);
  const tomorrow = useDayPlan(day.tomorrow);
  const [capture, setCapture] = useState(null); // null | 'backlog' | 'today'
  const [actualFor, setActualFor] = useState(null);
  const [editing, setEditing] = useState(null);

  const dots = useMemo(() => weekDots(streak, litDates, today, settings.first_day), [streak, litDates, today, settings.first_day]);
  const rings = useMemo(
    () => areaWeek(s.activeAreas, s.plans, s.itemsByPlan, s.tasksById, s.ritualsById, today).filter((r) => r.planned > 0),
    [s.activeAreas, s.plans, s.itemsByPlan, s.tasksById, s.ritualsById, today],
  );

  const evening = new Date().getHours() >= 17 || new Date().getHours() < 4;
  const openRitual = () => router.push('/ritual');

  const toggle = async (item) => {
    const next = item.outcome === 'done' ? 'pending' : 'done';
    if (next === 'done') haptic();
    await day.setOutcome(item.id, next);
    if (next === 'done' && item.task) setActualFor(item.task);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Kicker>{prettyDate(today)}</Kicker>
            <T v="h1">{day.closed ? "Today's lit." : evening ? 'Evening.' : 'Today'}</T>
          </View>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Settings" style={{ padding: 6 }}>
            <Icon as={Settings2} color={colors.muted} size={24} />
          </Pressable>
        </View>

        {/* The Week */}
        <Card style={{ marginTop: space.lg, alignItems: 'center', paddingTop: space.xl }}>
          <WeekDots dots={dots} width={280} onPressToday={openRitual} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: space.md }}>
            <T v="celebration" style={{ fontSize: 40, lineHeight: 46 }}>{streak.current}</T>
            <T v="emphasis" style={{ color: colors.muted }}>{streak.current === 1 ? 'day' : 'days'} planned</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Icon as={Snowflake} size={14} color={colors.muted} />
            <T v="caption">{streak.freezesLeft} freeze{streak.freezesLeft === 1 ? '' : 's'} left this month · auto-applied</T>
          </View>
          {day.closed ? (
            <T style={{ color: colors.muted, marginTop: space.lg, textAlign: 'center' }}>
              Tomorrow's sorted — {tomorrow.items.length} {tomorrow.items.length === 1 ? 'thing' : 'things'} on {shortDate(day.tomorrow)}.
            </T>
          ) : (
            <Button
              title="Close the day"
              icon={Moon}
              kind={evening ? 'primary' : 'ghost'}
              onPress={openRitual}
              style={{ marginTop: space.lg, alignSelf: 'stretch' }}
            />
          )}
        </Card>

        {showBrokenNote(streak, today) ? (
          <Card tone="elevated" style={{ marginTop: space.md }}>
            <T>{brokenLine(streak.brokenRun)}</T>
          </Card>
        ) : null}

        {staleNote ? (
          <Card tone="elevated" style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <T style={{ flex: 1 }}>
              {staleNote.count} unfinished {staleNote.count === 1 ? 'task' : 'tasks'} from {shortDate(staleNote.date)} went back to your backlog. Nothing lost.
            </T>
            <Button small kind="secondary" title="OK" onPress={actions.dismissStaleNote} />
          </Card>
        ) : null}

        {/* Focus Goal — the loudest thing on screen */}
        <Press onPress={() => router.push('/goals')} scaleTo={0.98} style={{ marginTop: space.md }}>
          {focusGoal ? (
            <Card style={{ borderWidth: 2, borderColor: colors.sunbeam }}>
              <Kicker style={{ color: colors.sunbeam }}>Focus goal</Kicker>
              <T v="h2" style={{ fontSize: 22, lineHeight: 28 }}>{focusGoal.title}</T>
              <View style={{ marginTop: space.md }}>
                <ProgressBar pct={goalPct(focusGoal)} height={18} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
                <T v="data" style={{ color: colors.cloud }}>
                  {fmtNum(focusGoal.current_value)} / {fmtNum(focusGoal.target_value)} {focusGoal.unit}
                </T>
                <T v="data" style={{ color: colors.sunbeam }}>{goalPct(focusGoal)}%</T>
              </View>
            </Card>
          ) : (
            <Card style={{ borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed' }}>
              <Kicker>Focus goal</Kicker>
              <T style={{ color: colors.muted }}>Pick the one goal you're chasing right now.</T>
            </Card>
          )}
        </Press>

        <SectionTitle
          right={
            <Button small kind="secondary" title="Add" icon={Plus} onPress={() => setCapture('today')} />
          }
        >
          Today's plan
        </SectionTitle>
        {day.items.length ? (
          <>
            <T v="caption" style={{ marginBottom: space.md, fontSize: 13 }}>{tasksLeftLine(day.remaining.count, day.remaining.minutes)}</T>
            {day.warning && !day.closed ? (
              <Card tone="elevated" style={{ marginBottom: space.md, paddingVertical: space.md }}>
                <T>{overcommitLine(day.warning.total, day.warning.available)}</T>
              </Card>
            ) : null}
            {day.items.map((item) => (
              <PlanRow
                key={item.id}
                item={item}
                showTime={day.system.timeBlocking}
                onToggle={() => toggle(item)}
                onPress={() => item.task && setEditing(item.task)}
              />
            ))}
          </>
        ) : (
          <EmptyNote>Nothing planned for today. Add a thing or two now, or plan tomorrow tonight.</EmptyNote>
        )}

        {rings.length ? (
          <>
            <SectionTitle>This week</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
              {rings.map((r) => (
                <View key={r.area.id} style={{ alignItems: 'center', width: 70 }}>
                  <Ring pct={r.done / r.planned} color={r.area.color} size={50}>
                    <T v="data" style={{ fontSize: 11, color: colors.cloud }}>{r.done}/{r.planned}</T>
                  </Ring>
                  <T v="caption" style={{ marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{r.area.name}</T>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Screen>

      <CaptureFab onPress={() => setCapture('backlog')} />
      <QuickCapture
        visible={!!capture}
        planDate={capture === 'today' ? today : null}
        onClose={() => setCapture(null)}
      />
      <ActualSheet task={actualFor} visible={!!actualFor} onClose={() => setActualFor(null)} />
      <TaskSheet task={editing} visible={!!editing} onClose={() => setEditing(null)} />
    </View>
  );
}
