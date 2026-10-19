// F3.10 — the week ritual. Same shape as the evening one, one level up:
//   1. Look back   (F5.4) the week, assembled from what already happened
//   2. One line    about the week
//   3. Lay it out  tap a task, tap a day — spread next week before it starts

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';

import { useStore } from '../core/store';
import { useTasks } from '../core/useTasks';
import { colors, radius, space, type } from '../core/theme';
import { addDays, formatDuration, prettyDate, range, shortDate, shortDay } from '../core/dates';
import { MOODS, numWord } from '../core/copy';
import { weekSummary, weekToReview } from '../core/logic/weekly';
import { itemMinutes } from '../core/logic/plan';
import { Button, Card, Field, Icon, Kicker, Screen, T, haptic } from '../components/ui';
import { AreaDot, EmptyNote, TaskMeta, Toast, rowStyles } from '../components/parts';

export default function WeekRitual() {
  const s = useStore();
  const [reviewStart] = useState(() => weekToReview(s.today));
  const planStart = addDays(reviewStart, 7);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState(s.weekReviews[reviewStart]?.note || '');

  const finish = async () => {
    await s.actions.saveWeekReview(reviewStart, note.trim());
    haptic('success');
    router.back();
  };

  return (
    <Screen
      footer={
        <View style={{ padding: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', gap: space.sm }}>
          {step > 0 ? <Button kind="ghost" title="Back" onPress={() => setStep(step - 1)} /> : null}
          <Button title={step === 2 ? 'Set the week' : step === 1 && !note.trim() ? 'Skip' : 'Next'} onPress={step === 2 ? finish : () => setStep(step + 1)} style={{ flex: 1 }} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xl, gap: space.sm }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.violet : colors.elevated }} />
        ))}
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={{ marginLeft: space.sm }}>
          <Icon as={X} color={colors.muted} />
        </Pressable>
      </View>
      {step === 0 ? <LookBack start={reviewStart} /> : null}
      {step === 1 ? (
        <View>
          <Kicker>Week of {shortDate(reviewStart)}</Kicker>
          <T v="h1">One line about the week.</T>
          <T style={{ color: colors.muted, marginTop: space.sm, marginBottom: space.xl }}>What would you tell yourself next Sunday?</T>
          <Field value={note} onChangeText={setNote} placeholder="Too many evenings on the lab. Gym held up." multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
        </View>
      ) : null}
      {step === 2 ? <LayOut start={planStart} /> : null}
    </Screen>
  );
}

function LookBack({ start }) {
  const s = useStore();
  const w = useMemo(
    () => weekSummary({ start, plans: s.plans, itemsByPlan: s.itemsByPlan, tasksById: s.tasksById, ritualsById: s.ritualsById, areasById: s.areasById }),
    [start, s.plans, s.itemsByPlan, s.tasksById, s.ritualsById, s.areasById],
  );
  const lit = new Set(s.litDates);
  const maxMin = Math.max(1, ...w.areas.map((a) => a.minutes));
  return (
    <View>
      <Kicker>Week of {shortDate(start)}</Kicker>
      <T v="h1">Your week.</T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl }}>
        {w.days.map((d, i) => (
          <View key={d} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: lit.has(d) ? (i < 3 ? colors.violet : colors.sunbeam) : 'transparent', borderWidth: lit.has(d) ? 0 : 2, borderColor: colors.line }} />
            <T v="caption">{shortDay(d).slice(0, 2)}</T>
          </View>
        ))}
      </View>
      <T v="h2" style={{ marginTop: space.lg, textAlign: 'center' }}>
        {numWord(w.lit)} of seven days lit · {w.done} of {w.planned} done.
      </T>

      {w.areas.length ? (
        <Card style={{ marginTop: space.xl }}>
          <Kicker>Where it went</Kicker>
          {w.areas.map((a) => (
            <View key={a.area.id} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T v="emphasis" style={{ fontSize: 14 }}>{a.area.name}</T>
                <T style={[type.data, { fontSize: 12, color: colors.muted }]}>{formatDuration(a.minutes)}</T>
              </View>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.elevated, marginTop: 4 }}>
                <View style={{ height: 10, borderRadius: 5, width: `${(a.minutes / maxMin) * 100}%`, backgroundColor: a.area.color }} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
        {w.best ? <Fact label="Best day" value={`${shortDay(w.best.date)} · ${w.best.done}/${w.best.planned}`} /> : null}
        {w.accuracy ? <Fact label="Your estimates" value={`${w.accuracy.toFixed(2)}×`} /> : null}
        {w.mood ? <Fact label="Avg energy" value={`${w.mood.toFixed(1)} · ${MOODS[Math.round(w.mood) - 1]}`} /> : null}
      </View>

      {w.notes.length ? (
        <Card style={{ marginTop: space.md }}>
          <Kicker>What you wrote</Kicker>
          {w.notes.map((n) => (
            <View key={n.date} style={{ marginBottom: space.sm }}>
              <T v="caption">{shortDay(n.date)}</T>
              <T>{n.text}</T>
            </View>
          ))}
        </Card>
      ) : null}
      {!w.planned ? <EmptyNote>A quiet week on paper. This one's a fresh start.</EmptyNote> : null}
    </View>
  );
}

function Fact({ label, value }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '30%', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }}>
      <T v="caption">{label}</T>
      <T v="data" style={{ color: colors.cloud, marginTop: 2 }}>{value}</T>
    </View>
  );
}

function LayOut({ start }) {
  const s = useStore();
  const { groups } = useTasks();
  const [picked, setPicked] = useState(null);
  const [toast, setToast] = useState(null);
  const days = range(start, addDays(start, 6));

  const place = async (date) => {
    if (!picked) return;
    const res = await s.actions.planTask(date, picked);
    if (res && res.ok === false) setToast(`${s.system.dailyCap} is the day on ${shortDay(date)}. Try another.`);
    else {
      haptic();
      setPicked(null);
    }
  };

  return (
    <View>
      <Toast message={toast} onDone={() => setToast(null)} />
      <Kicker>Week of {shortDate(start)}</Kicker>
      <T v="h1">Lay out next week.</T>
      <T style={{ color: colors.muted, marginTop: space.sm, marginBottom: space.lg }}>
        {picked ? 'Now tap a day.' : 'Tap a task, then the day it belongs to. Leave room — the evenings will fill the rest.'}
      </T>
      {days.map((d) => {
        const plan = s.plansByDate[d];
        const items = plan ? s.itemsByPlan[plan.id] || [] : [];
        const mins = items.reduce((n, it) => n + itemMinutes(it, s.tasksById, s.ritualsById), 0);
        return (
          <Pressable
            key={d}
            onPress={() => place(d)}
            accessibilityLabel={`Plan on ${prettyDate(d)}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginBottom: 6, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 2, borderColor: picked ? colors.violet : 'transparent' }}
          >
            <T v="emphasis" style={{ width: 92 }}>{shortDay(d)} {shortDate(d).split(' ')[1]}</T>
            <T v="caption" style={{ flex: 1 }} numberOfLines={1}>
              {items.length ? items.map((it) => s.tasksById[it.task_id]?.title || s.ritualsById[it.ritual_id]?.name).filter(Boolean).join(' · ') : 'Open'}
            </T>
            <T style={[type.data, { fontSize: 12, color: colors.muted }]}>{mins ? formatDuration(mins) : ''}</T>
          </Pressable>
        );
      })}
      <T v="h2" style={{ marginTop: space.xl, marginBottom: space.md }}>Backlog</T>
      {groups.length ? (
        groups.map((g) => (
          <View key={g.area.id} style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.sm }}>
              <AreaDot area={g.area} />
              <T v="kicker" style={{ color: g.area.color }}>{g.area.name}</T>
            </View>
            {g.tasks.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setPicked(picked === t.id ? null : t.id)}
                style={[rowStyles.row, { paddingVertical: 11 }, picked === t.id && { backgroundColor: colors.violet }]}
              >
                <View style={{ flex: 1 }}>
                  <T v="emphasis" numberOfLines={2} style={picked === t.id ? { color: '#FFFFFF' } : null}>{t.title}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TaskMeta task={t} />
                  </View>
                </View>
                <T v="data" style={{ fontSize: 13, color: picked === t.id ? '#FFFFFF' : colors.lagoon }}>{formatDuration(t.estimated_minutes)}</T>
              </Pressable>
            ))}
          </View>
        ))
      ) : (
        <EmptyNote>Backlog's empty — the week is wide open.</EmptyNote>
      )}
    </View>
  );
}
