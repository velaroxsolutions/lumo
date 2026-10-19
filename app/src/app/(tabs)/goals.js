// F1.2 / F1.3 / F6.4 / F6.6 — goals, the single Focus Goal, and milestone
// celebrations at 25/50/75/100%.
// F1.5 progress from linked tasks · F1.6 checkpoints inside a goal ·
// F7.7 pace and projected finish.

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Plus, Star, X } from 'lucide-react-native';

import { useGoals } from '../../core/useGoals';
import { useAreas } from '../../core/useAreas';
import { colors, space } from '../../core/theme';
import { fmtNum, milestoneLine, paceLine } from '../../core/copy';
import { Button, Card, Chip, Field, Icon, Kicker, Press, Screen, Segmented, Stepper, T } from '../../components/ui';
import { AreaDot, CheckDot, EmptyNote, ProgressBar, SectionTitle, Sheet, Toast } from '../../components/parts';
import { DatePick } from '../../components/sheets';

export default function Goals() {
  const { active, finished, focusGoal, areasById, setProgress, statsOf } = useGoals();
  const [editing, setEditing] = useState(null); // goal | 'new'
  const [toast, setToast] = useState(null);
  const others = active.filter((g) => g.id !== focusGoal?.id);
  const focus = statsOf(focusGoal);

  const bump = async (g, delta) => {
    const r = await setProgress(g.id, g.current_value + delta);
    if (r?.reached?.length) setToast(`Checkpoint: ${r.reached[r.reached.length - 1]}. Nice.`);
    else if (r?.pct) setToast(milestoneLine(r.pct, g.title));
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
              <ProgressBar pct={focus.progress.pct} height={20} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, gap: space.sm }}>
              <T v="data" style={{ color: colors.cloud, flexShrink: 1 }}>
                {fmtNum(focus.progress.current)} / {fmtNum(focus.progress.target)} {focus.progress.unit}
              </T>
              {focus.progress.mode === 'manual' ? (
                <Stepper value={focusGoal.current_value} onChange={(v) => bump(focusGoal, v - focusGoal.current_value)} format={() => `${focus.progress.pct}%`} />
              ) : (
                <T v="data" style={{ color: colors.sunbeam }}>{focus.progress.pct}%</T>
              )}
            </View>
            {focus.progress.mode === 'tasks' && !focus.progress.target ? (
              <T v="caption" style={{ marginTop: space.sm }}>Link tasks to this goal (open a task → "Moves a goal") and it fills itself.</T>
            ) : null}
            {focus.nextMilestone ? <T v="caption" style={{ marginTop: space.sm }}>Next checkpoint: {focus.nextMilestone.title}</T> : null}
            {focus.pace ? <T v="caption" style={{ marginTop: 2 }}>{paceLine(focusGoal, focus.progress, focus.pace)}</T> : null}
            {focusGoal.deadline ? <T v="caption" style={{ marginTop: 2 }}>By {focusGoal.deadline}</T> : null}
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
          others.map((g) => (
            <GoalRow key={g.id} goal={g} stats={statsOf(g)} area={areasById[g.area_id]} onPress={() => setEditing(g)} onBump={(d) => bump(g, d)} />
          ))
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
      <GoalSheet goal={editing} onClose={() => setEditing(null)} onToast={setToast} />
    </View>
  );
}

function GoalRow({ goal, stats, area, onPress, onBump }) {
  const p = stats.progress;
  // The card opens the goal; "+1" is a sibling, never a button inside a button.
  return (
    <Card style={{ paddingVertical: space.md, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Press onPress={onPress} scaleTo={0.98} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AreaDot area={area} />
          <T v="emphasis" style={{ flex: 1 }}>{goal.title}</T>
          <T v="data" style={{ fontSize: 13 }}>{p.pct}%</T>
        </View>
        <View style={{ marginTop: space.sm }}>
          <ProgressBar pct={p.pct} height={8} color={area?.color || colors.violet} />
        </View>
        <T v="caption" style={{ marginTop: space.sm }}>{fmtNum(p.current)} / {fmtNum(p.target)} {p.unit}</T>
      </Press>
      {p.mode === 'manual' ? <Button small kind="secondary" title="+1" onPress={() => onBump(1)} /> : null}
    </Card>
  );
}

function GoalSheet({ goal, onClose, onToast }) {
  if (!goal) return null;
  return (
    <Sheet visible onClose={onClose} title={goal === 'new' ? 'New goal' : 'Goal'}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 600 }}>
        <GoalForm key={goal === 'new' ? 'new' : goal.id} goal={goal} onClose={onClose} onToast={onToast} />
      </ScrollView>
    </Sheet>
  );
}

function GoalForm({ goal, onClose, onToast }) {
  const { add, update, setFocus, setStatus, setProgress, focusGoal } = useGoals();
  const { activeAreas } = useAreas();
  const isNew = goal === 'new';
  const [d, setD] = useState(() =>
    isNew
      ? { title: '', target: '', current: '0', unit: '', deadline: null, area_id: activeAreas[0]?.id, focus: !focusGoal, mode: 'manual' }
      : {
          title: goal.title,
          target: String(goal.target_value),
          current: String(goal.current_value),
          unit: goal.unit,
          deadline: goal.deadline || null,
          area_id: goal.area_id,
          mode: goal.progress_mode || 'manual',
        },
  );

  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const num = (v) => v.replace(/[^0-9.]/g, '');
  const manual = d.mode === 'manual';

  const save = async () => {
    if (!d.title.trim()) return;
    const target = Number(d.target) > 0 ? Number(d.target) : 1;
    const fields = { title: d.title.trim(), target_value: target, unit: d.unit.trim(), deadline: d.deadline || null, area_id: d.area_id, progress_mode: d.mode };
    if (isNew) {
      await add({ ...fields, is_focus: d.focus });
    } else {
      await update(goal.id, fields);
      if (manual && Number(d.current) !== goal.current_value) await setProgress(goal.id, Number(d.current) || 0);
    }
    onClose();
  };

  return (
    <>
      <Field value={d.title} onChangeText={set('title')} placeholder="100 followers, 3.7 GPA, 20 applications…" />
      <Kicker style={{ marginTop: space.lg }}>Measure progress by</Kicker>
      <Segmented value={d.mode} onChange={set('mode')} options={[{ value: 'manual', label: 'A number' }, { value: 'tasks', label: 'Linked tasks' }]} />
      {manual ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          {!isNew ? <Field value={d.current} onChangeText={(v) => set('current')(num(v))} placeholder="Now" keyboardType="decimal-pad" style={{ flex: 1 }} /> : null}
          <Field value={d.target} onChangeText={(v) => set('target')(num(v))} placeholder="Target" keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field value={d.unit} onChangeText={set('unit')} placeholder="Unit" style={{ flex: 1.3 }} />
        </View>
      ) : (
        <T v="caption" style={{ marginTop: space.sm }}>Progress = how many of the tasks linked to this goal are done.</T>
      )}
      <Kicker style={{ marginTop: space.lg }}>Deadline</Kicker>
      <DatePick value={d.deadline} onChange={set('deadline')} />
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
      ) : (
        <Checkpoints goal={goal} manual={manual} onToast={onToast} />
      )}
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
      <Button title="Save" onPress={save} style={{ marginTop: space.lg }} disabled={!d.title.trim()} />
    </>
  );
}

// F1.6 — checkpoints so a long goal still produces wins along the way.
// With a number, a checkpoint ticks itself when progress reaches it.
function Checkpoints({ goal, manual, onToast }) {
  const { statsOf, addMilestone, toggleMilestone, removeMilestone } = useGoals();
  const [title, setTitle] = useState('');
  const [at, setAt] = useState('');
  const list = statsOf(goal)?.milestones || [];

  const add = async () => {
    if (!title.trim()) return;
    await addMilestone(goal.id, { title, target_value: manual && at ? Number(at) : null });
    setTitle('');
    setAt('');
  };

  return (
    <View style={{ marginTop: space.lg }}>
      <Kicker>Checkpoints</Kicker>
      {list.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 }}>
          <CheckDot
            done={!!m.done}
            size={24}
            onPress={async () => {
              const t = await toggleMilestone(m.id);
              if (t && onToast) onToast(`Checkpoint: ${t}. Nice.`);
            }}
          />
          <T style={[{ flex: 1 }, m.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>
            {m.title}
            {m.target_value != null ? <T v="caption">{`  at ${fmtNum(m.target_value)}`}</T> : null}
          </T>
          <Press onPress={() => removeMilestone(m.id)} accessibilityLabel="Remove checkpoint">
            <Icon as={X} size={16} color={colors.muted} />
          </Press>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
        <Field value={title} onChangeText={setTitle} placeholder="e.g. First interview" style={{ flex: 2 }} onSubmitEditing={add} />
        {manual ? <Field value={at} onChangeText={(v) => setAt(v.replace(/[^0-9.]/g, ''))} placeholder="at #" keyboardType="decimal-pad" style={{ flex: 1 }} /> : null}
        <Button small kind="secondary" title="Add" onPress={add} disabled={!title.trim()} />
      </View>
    </View>
  );
}
