// F3.2 — the evening ritual. This is the app.
//   1. Close today   (F3.6)  each planned item → done / not done
//   2. Review        (F5.1–5.3) one line + mood, two taps to skip
//   3. Plan tomorrow (F3.4/3.5/3.7/3.8) backlog → tomorrow, soft overcommit warning
//   4. Light it up   (F6.1) the payoff: dots light in sequence, streak pops

import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Clock, Plus, Sparkles, X } from 'lucide-react-native';

import { useStore } from '../core/store';
import { useDayPlan } from '../core/useDayPlan';
import { useTasks } from '../core/useTasks';
import { useGoals } from '../core/useGoals';
import { colors, radius, space } from '../core/theme';
import { formatClock, formatDuration, formatTime, parseTime, prettyDate, shortDay } from '../core/dates';
import { MOODS, dayCloseLine, fmtNum, numWord, overcommitLine, reviewPrompt } from '../core/copy';
import { weekDots } from '../core/logic/streak';
import { WeekDots } from '../components/WeekMark';
import { Button, Card, Chip, Field, Icon, Kicker, NATIVE_DRIVER, Press, Screen, Segmented, Stepper, T, haptic } from '../components/ui';
import { AreaDot, EmptyNote, PlanRow, ProgressBar, Sheet, TaskMeta, Toast, rowStyles } from '../components/parts';

const STEPS = ['Close', 'Review', 'Plan', 'Light'];

export default function Ritual() {
  const { today, system, plansByDate } = useStore();
  // Freeze the date for the whole ritual so a 4am rollover mid-flow can't
  // switch which day is being closed.
  const [date] = useState(today);
  const day = useDayPlan(date);
  const [step, setStep] = useState(0);
  // Seeded once from what was ticked during the day.
  const [outcomes, setOutcomes] = useState(() =>
    Object.fromEntries(day.items.map((i) => [i.id, i.outcome === 'done' ? 'done' : 'missed'])),
  );
  const [unfinished, setUnfinished] = useState(system.unfinished);
  const [review, setReview] = useState(plansByDate[date]?.review_note || '');
  const [mood, setMood] = useState(plansByDate[date]?.mood ?? null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (step === 0) await day.closeToday(outcomes, unfinished);
      if (step === 2) {
        await day.commit(review.trim(), mood);
        haptic('success');
      }
      setStep((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  const footerTitle = ['Next', review.trim() || mood ? 'Next' : 'Skip', 'Light it up', 'Done'][step];

  return (
    <Screen
      footer={
        <View style={{ padding: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', gap: space.sm }}>
          {step > 0 && step < 3 ? <Button kind="ghost" title="Back" onPress={() => setStep(step - 1)} /> : null}
          <Button
            title={footerTitle}
            icon={step === 2 ? Sparkles : undefined}
            onPress={step === 3 ? () => router.back() : next}
            disabled={busy}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      {step < 3 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xl, gap: space.sm }}>
          {STEPS.slice(0, 3).map((s, i) => (
            <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.sunbeam : colors.elevated }} />
          ))}
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={{ marginLeft: space.sm }}>
            <Icon as={X} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      {step === 0 ? (
        <CloseStep day={day} date={date} outcomes={outcomes} setOutcomes={setOutcomes} unfinished={unfinished} setUnfinished={setUnfinished} />
      ) : null}
      {step === 1 ? <ReviewStep date={date} review={review} setReview={setReview} mood={mood} setMood={setMood} /> : null}
      {step === 2 ? <PlanStep date={day.tomorrow} /> : null}
      {step === 3 ? <LightStep date={date} /> : null}
    </Screen>
  );
}

function CloseStep({ day, date, outcomes, setOutcomes, unfinished, setUnfinished }) {
  const done = day.items.filter((i) => outcomes[i.id] === 'done').length;
  const left = day.items.filter((i) => i.task && outcomes[i.id] !== 'done').length;
  return (
    <View>
      <Kicker>{prettyDate(date)}</Kicker>
      <T v="h1">Close the day.</T>
      <T style={{ color: colors.muted, marginTop: space.sm, marginBottom: space.xl }}>
        Tap what got done. Everything else is just a fact — no judgement.
      </T>
      {day.items.length ? (
        day.items.map((item) => {
          const isDone = outcomes[item.id] === 'done';
          const flip = () => {
            if (!isDone) haptic();
            setOutcomes((o) => ({ ...o, [item.id]: isDone ? 'missed' : 'done' }));
          };
          return <PlanRow key={item.id} item={item} mode="close" outcome={isDone ? 'done' : 'pending'} onToggle={flip} onPress={flip} />;
        })
      ) : (
        <EmptyNote>Nothing was planned today. That's fine — let's set up tomorrow.</EmptyNote>
      )}
      {day.items.length ? (
        <T v="h2" style={{ marginTop: space.lg, color: done === day.items.length ? colors.lagoon : colors.cloud }}>
          {numWord(done)} of {numWord(day.items.length).toLowerCase()}.
        </T>
      ) : null}
      {left > 0 ? (
        <Card tone="elevated" style={{ marginTop: space.lg }}>
          <T style={{ marginBottom: space.md }}>
            {left === 1 ? 'One task left.' : `${numWord(left)} tasks left.`} Push the rest to tomorrow, or let them go?
          </T>
          <Segmented
            value={unfinished}
            onChange={setUnfinished}
            options={[
              { value: 'tomorrow', label: 'Tomorrow' },
              { value: 'backlog', label: 'Backlog' },
              { value: 'drop', label: 'Let go' },
            ]}
          />
        </Card>
      ) : null}
    </View>
  );
}

function ReviewStep({ date, review, setReview, mood, setMood }) {
  return (
    <View>
      <Kicker>Review</Kicker>
      <T v="h1">{reviewPrompt(date)}</T>
      <T style={{ color: colors.muted, marginTop: space.sm, marginBottom: space.xl }}>One line is plenty.</T>
      <Field
        value={review}
        onChangeText={setReview}
        placeholder="Lab report took forever. Gym was good."
        multiline
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />
      <Kicker style={{ marginTop: space.xl }}>Energy today</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {MOODS.map((m, i) => (
          <Chip key={m} label={`${i + 1} · ${m}`} selected={mood === i + 1} onPress={() => setMood(mood === i + 1 ? null : i + 1)} color={colors.violet} />
        ))}
      </View>
    </View>
  );
}

function PlanStep({ date }) {
  const plan = useDayPlan(date);
  const { groups, lastAreaId, add } = useTasks();
  const [title, setTitle] = useState('');
  const [toast, setToast] = useState(null);
  const [timing, setTiming] = useState(null);

  useEffect(() => {
    plan.ensure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const addFromBacklog = async (taskId) => {
    const res = await plan.add(taskId);
    if (res && res.ok === false) setToast(`${plan.system.dailyCap} is the day. Swap one out first.`);
    else haptic();
  };

  const addNew = async () => {
    const t = title.trim();
    if (!t || !lastAreaId) return;
    if (plan.capReached) {
      await add({ title: t, area_id: lastAreaId });
      setToast('Saved to backlog — tomorrow is full.');
    } else {
      await plan.addNew({ title: t, area_id: lastAreaId });
    }
    setTitle('');
  };

  return (
    <View>
      <Toast message={toast} onDone={() => setToast(null)} />
      <Kicker>{prettyDate(date)}</Kicker>
      <T v="h1">Plan tomorrow.</T>
      <T style={{ color: colors.muted, marginTop: space.sm, marginBottom: space.lg }}>
        {plan.system.dailyCap
          ? `Pick your top ${plan.system.dailyCap}, in order.`
          : 'Pull from your backlog. Leave room for real life.'}
      </T>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm }}>
        <T v="h2">Tomorrow</T>
        <T v="data" style={{ color: plan.warning ? colors.blush : colors.lagoon }}>
          {formatDuration(plan.load)} / {formatDuration(plan.available)}
        </T>
      </View>
      {plan.warning ? (
        <Card tone="elevated" style={{ marginBottom: space.md, paddingVertical: space.md }}>
          <T>{overcommitLine(plan.warning.total, plan.warning.available)}</T>
        </Card>
      ) : null}
      {plan.items.length ? (
        plan.items.map((item) => (
          <PlanRow
            key={item.id}
            item={item}
            mode="plan"
            showTime={plan.system.timeBlocking}
            onPress={plan.system.timeBlocking ? () => setTiming(item) : undefined}
            onMove={plan.system.sortBy === 'manual' ? (d) => plan.move(item.id, d) : undefined}
            onRemove={() => plan.remove(item.id)}
          />
        ))
      ) : (
        <EmptyNote>Empty so far. Tap + on anything below.</EmptyNote>
      )}
      {plan.system.timeBlocking && plan.items.length ? (
        <Button small kind="secondary" icon={Clock} title="Lay out times" onPress={plan.autoTime} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Field value={title} onChangeText={setTitle} placeholder="Something new for tomorrow" style={{ flex: 1 }} onSubmitEditing={addNew} returnKeyType="done" />
        <Button title="Add" kind="secondary" onPress={addNew} disabled={!title.trim()} />
      </View>

      <T v="h2" style={{ marginTop: space.xl, marginBottom: space.md }}>Backlog</T>
      {groups.length ? (
        groups.map((g) => (
          <View key={g.area.id} style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.sm }}>
              <AreaDot area={g.area} />
              <T v="kicker" style={{ color: g.area.color }}>{g.area.name}</T>
            </View>
            {g.tasks.map((t) => (
              <Press key={t.id} onPress={() => addFromBacklog(t.id)} scaleTo={0.98} style={[rowStyles.row, { paddingVertical: 11 }]}>
                <View style={{ flex: 1 }}>
                  <T v="emphasis" numberOfLines={2}>{t.title}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TaskMeta task={t} />
                  </View>
                  {t.deferral_count >= 3 ? (
                    <T v="caption" style={{ color: colors.blush }}>Pushed {t.deferral_count} times — reschedule, shrink, or drop it?</T>
                  ) : null}
                </View>
                <T v="data" style={{ fontSize: 13 }}>{formatDuration(t.estimated_minutes)}</T>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon as={Plus} size={18} color="#FFFFFF" />
                </View>
              </Press>
            ))}
          </View>
        ))
      ) : (
        <EmptyNote>Backlog's empty. Add something above.</EmptyNote>
      )}

      {timing ? (
        <TimeSheet key={timing.id} item={timing} onClose={() => setTiming(null)} onSave={(t) => plan.setTime(timing.id, t)} />
      ) : null}
    </View>
  );
}

function TimeSheet({ item, onClose, onSave }) {
  const [mins, setMins] = useState(() => parseTime(item.start_time) ?? 9 * 60);
  return (
    <Sheet visible onClose={onClose} title={item.title}>
      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Stepper value={mins} step={15} onChange={(v) => setMins(Math.max(0, Math.min(23 * 60 + 45, v)))} format={formatClock} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button kind="ghost" title="No time" onPress={() => { onSave(null); onClose(); }} />
        <Button title="Set" style={{ flex: 1 }} onPress={() => { onSave(formatTime(mins)); onClose(); }} />
      </View>
    </Sheet>
  );
}

// The payoff. Dots light left to right ~90ms apart with overshoot, the
// streak number pops, the Focus Goal bar shows where it stands. < 1s.
function LightStep({ date }) {
  const { streak, litDates, settings, focusGoal } = useStore();
  const { statsOf } = useGoals();
  const focus = statsOf(focusGoal)?.progress;
  const day = useDayPlan(date);
  const tomorrow = useDayPlan(day.tomorrow);
  const dots = useMemo(() => weekDots(streak, litDates, date, settings.first_day), [streak, litDates, date, settings.first_day]);
  const [go, setGo] = useState(0);
  const pop = useState(() => new Animated.Value(0))[0];
  const line = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const t = setTimeout(() => setGo(1), 150);
    return () => clearTimeout(t);
  }, []);

  const afterDots = () => {
    haptic('success');
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 3.5, tension: 180 }),
      Animated.timing(line, { toValue: 1, duration: 260, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  };

  return (
    <View style={{ alignItems: 'center', paddingTop: space.xxl }}>
      <Kicker>{shortDay(date)} · closed</Kicker>
      <View style={{ marginTop: space.xl }}>
        <WeekDots dots={dots} width={300} celebrate={go} onCelebrated={afterDots} hidden />
      </View>
      <Animated.View style={{ alignItems: 'center', marginTop: space.lg, transform: [{ scale: pop }], opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }) }}>
        <T v="celebration" style={{ fontSize: 84, lineHeight: 92 }}>{streak.current}</T>
        <T v="emphasis" style={{ color: colors.muted, marginTop: -6 }}>{streak.current === 1 ? 'day lit' : 'days lit'}</T>
      </Animated.View>
      <Animated.View style={{ opacity: line, width: '100%', alignItems: 'center' }}>
        <T v="h2" style={{ textAlign: 'center', marginTop: space.xl, maxWidth: 420 }}>
          {dayCloseLine(day.tally.done, day.tally.total)}
        </T>
        <T style={{ color: colors.muted, marginTop: space.sm }}>
          {tomorrow.items.length} on tomorrow · {formatDuration(tomorrow.load)}
        </T>
        {focusGoal ? (
          <Card style={{ marginTop: space.xl, width: '100%', borderRadius: radius.lg }}>
            <Kicker style={{ color: colors.sunbeam }}>Focus goal</Kicker>
            <T v="emphasis">{focusGoal.title}</T>
            <View style={{ marginTop: space.md }}>
              <ProgressBar pct={focus.pct} />
            </View>
            <T v="data" style={{ marginTop: space.sm, color: colors.cloud }}>
              {fmtNum(focus.current)} / {fmtNum(focus.target)} {focus.unit}
            </T>
          </Card>
        ) : null}
      </Animated.View>
    </View>
  );
}

