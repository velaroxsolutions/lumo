// F1.2 / F1.3 / F6.4 / F6.6 — goals, the single Focus Goal, and milestone
// celebrations at 25/50/75/100%.

import { useState } from 'react';
import { View } from 'react-native';
import { Plus, Star } from 'lucide-react-native';

import { useGoals, goalPct } from '../../core/useGoals';
import { useAreas } from '../../core/useAreas';
import { colors, space } from '../../core/theme';
import { fmtNum, milestoneLine } from '../../core/copy';
import { Button, Card, Chip, Field, Kicker, Press, Screen, Stepper, T } from '../../components/ui';
import { AreaDot, EmptyNote, ProgressBar, SectionTitle, Sheet, Toast } from '../../components/parts';

export default function Goals() {
  const { active, finished, focusGoal, areasById, setProgress } = useGoals();
  const [editing, setEditing] = useState(null); // goal | 'new'
  const [toast, setToast] = useState(null);
  const others = active.filter((g) => g.id !== focusGoal?.id);

  const bump = async (g, delta) => {
    const m = await setProgress(g.id, g.current_value + delta);
    if (m) setToast(milestoneLine(m, g.title));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <Toast message={toast} onDone={() => setToast(null)} />
      <Screen>
        <Kicker>What you're chasing</Kicker>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="h1">Goals</T>
          <Button small icon={Plus} title="New goal" onPress={() => setEditing('new')} />
        </View>

        {focusGoal ? (
          <Card style={{ marginTop: space.lg, borderWidth: 2, borderColor: colors.sunbeam }}>
            <Kicker style={{ color: colors.sunbeam }}>Focus goal · the only one</Kicker>
            <Press onPress={() => setEditing(focusGoal)} scaleTo={0.99}>
              <T v="h2" style={{ fontSize: 24, lineHeight: 30 }}>{focusGoal.title}</T>
            </Press>
            <View style={{ marginTop: space.md }}>
              <ProgressBar pct={goalPct(focusGoal)} height={20} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
              <T v="data" style={{ color: colors.cloud }}>
                {fmtNum(focusGoal.current_value)} / {fmtNum(focusGoal.target_value)} {focusGoal.unit}
              </T>
              <Stepper value={focusGoal.current_value} onChange={(v) => bump(focusGoal, v - focusGoal.current_value)} format={() => `${goalPct(focusGoal)}%`} />
            </View>
            {focusGoal.deadline ? <T v="caption" style={{ marginTop: space.sm }}>By {focusGoal.deadline}</T> : null}
          </Card>
        ) : (
          <Card style={{ marginTop: space.lg }}>
            <T style={{ color: colors.muted }}>
              No Focus Goal right now. Star one below — just one. That's the point.
            </T>
          </Card>
        )}

        <SectionTitle>Also active</SectionTitle>
        {others.length ? (
          others.map((g) => <GoalRow key={g.id} goal={g} area={areasById[g.area_id]} onPress={() => setEditing(g)} onBump={(d) => bump(g, d)} />)
        ) : (
          <EmptyNote>Nothing else on the go. Fine by us.</EmptyNote>
        )}

        {finished.length ? (
          <>
            <SectionTitle>Finished</SectionTitle>
            {finished.map((g) => (
              <Press key={g.id} onPress={() => setEditing(g)} style={{ marginBottom: space.sm }}>
                <Card style={{ paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <AreaDot area={areasById[g.area_id]} />
                  <T style={{ flex: 1, color: colors.muted }}>{g.title}</T>
                  <T v="caption" style={{ color: g.status === 'done' ? colors.lagoon : colors.muted }}>
                    {g.status === 'done' ? 'Done' : 'Set aside'}
                  </T>
                </Card>
              </Press>
            ))}
          </>
        ) : null}
      </Screen>
      <GoalSheet goal={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function GoalRow({ goal, area, onPress, onBump }) {
  return (
    <Press onPress={onPress} scaleTo={0.98} style={{ marginBottom: space.sm }}>
      <Card style={{ paddingVertical: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AreaDot area={area} />
          <T v="emphasis" style={{ flex: 1 }}>{goal.title}</T>
          <T v="data" style={{ fontSize: 13 }}>{goalPct(goal)}%</T>
        </View>
        <View style={{ marginTop: space.sm }}>
          <ProgressBar pct={goalPct(goal)} height={8} color={area?.color || colors.violet} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm }}>
          <T v="caption">{fmtNum(goal.current_value)} / {fmtNum(goal.target_value)} {goal.unit}</T>
          <Button small kind="secondary" title="+1" onPress={() => onBump(1)} />
        </View>
      </Card>
    </Press>
  );
}

function GoalSheet({ goal, onClose }) {
  if (!goal) return null;
  return (
    <Sheet visible onClose={onClose} title={goal === 'new' ? 'New goal' : 'Goal'}>
      <GoalForm key={goal === 'new' ? 'new' : goal.id} goal={goal} onClose={onClose} />
    </Sheet>
  );
}

function GoalForm({ goal, onClose }) {
  const { add, update, setFocus, setStatus, setProgress, focusGoal } = useGoals();
  const { activeAreas } = useAreas();
  const isNew = goal === 'new';
  const [d, setD] = useState(() =>
    isNew
      ? { title: '', target: '', current: '0', unit: '', deadline: '', area_id: activeAreas[0]?.id, focus: !focusGoal }
      : {
          title: goal.title,
          target: String(goal.target_value),
          current: String(goal.current_value),
          unit: goal.unit,
          deadline: goal.deadline || '',
          area_id: goal.area_id,
        },
  );

  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const num = (v) => v.replace(/[^0-9.]/g, '');
  const deadlineOk = !d.deadline || /^\d{4}-\d{2}-\d{2}$/.test(d.deadline);

  const save = async () => {
    if (!d.title.trim() || !deadlineOk) return;
    const target = Number(d.target) > 0 ? Number(d.target) : 1;
    if (isNew) {
      await add({ title: d.title.trim(), target_value: target, unit: d.unit.trim(), deadline: d.deadline || null, area_id: d.area_id, is_focus: d.focus });
    } else {
      await update(goal.id, { title: d.title.trim(), target_value: target, unit: d.unit.trim(), deadline: d.deadline || null, area_id: d.area_id });
      if (Number(d.current) !== goal.current_value) await setProgress(goal.id, Number(d.current) || 0);
    }
    onClose();
  };

  return (
    <>
      <Field value={d.title} onChangeText={set('title')} placeholder="100 followers, 3.7 GPA, 20 applications…" />
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        {!isNew ? <Field value={d.current} onChangeText={(v) => set('current')(num(v))} placeholder="Now" keyboardType="decimal-pad" style={{ flex: 1 }} /> : null}
        <Field value={d.target} onChangeText={(v) => set('target')(num(v))} placeholder="Target" keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field value={d.unit} onChangeText={set('unit')} placeholder="Unit" style={{ flex: 1.3 }} />
      </View>
      <Field
        value={d.deadline}
        onChangeText={set('deadline')}
        placeholder="Deadline YYYY-MM-DD (optional)"
        style={[{ marginTop: space.sm }, !deadlineOk && { borderColor: colors.blush }]}
      />
      <Kicker style={{ marginTop: space.lg }}>Area</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {activeAreas.map((a) => (
          <Chip key={a.id} label={a.name} dot={a.color} color={a.color} selected={d.area_id === a.id} onPress={() => set('area_id')(a.id)} />
        ))}
      </View>
      {isNew ? (
        <Chip
          label={d.focus ? 'Make this my Focus Goal ✓' : 'Make this my Focus Goal'}
          selected={d.focus}
          onPress={() => set('focus')(!d.focus)}
          style={{ marginTop: space.lg, alignSelf: 'flex-start' }}
        />
      ) : null}
      {!isNew && goal.status === 'active' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
          {!goal.is_focus ? (
            <Button small kind="secondary" icon={Star} title="Make Focus Goal" onPress={async () => { await setFocus(goal.id); onClose(); }} />
          ) : null}
          <Button small kind="ghost" title="Mark done" onPress={async () => { await setStatus(goal.id, 'done'); onClose(); }} />
          <Button small kind="quiet" title="Set aside" onPress={async () => { await setStatus(goal.id, 'abandoned'); onClose(); }} />
        </View>
      ) : null}
      {!isNew && goal.status !== 'active' ? (
        <Button small kind="ghost" title="Reopen" style={{ marginTop: space.lg, alignSelf: 'flex-start' }} onPress={async () => { await setStatus(goal.id, 'active'); onClose(); }} />
      ) : null}
      <Button title="Save" onPress={save} style={{ marginTop: space.lg }} disabled={!d.title.trim() || !deadlineOk} />
    </>
  );
}
