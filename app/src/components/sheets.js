// Task sheets: quick capture (F2.2), task editing (F2.1/F2.4/F2.6), and the
// "how long did that really take?" prompt (F2.5 — the moat).

import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';

import { colors, fonts, radius, space, type } from '../core/theme';
import { addDays, formatDuration, prettyDate, shortDate, weekStart } from '../core/dates';
import { REPEATS } from '../core/logic/recurrence';
import { corrected, ratioFor } from '../core/logic/estimates';
import { useTasks } from '../core/useTasks';
import { useAreas } from '../core/useAreas';
import { useGoals } from '../core/useGoals';
import { useStore } from '../core/store';
import { Button, Chip, Field, Icon, Kicker, Press, Segmented, T } from './ui';
import { CheckDot, Sheet } from './parts';

const ESTIMATES = [15, 30, 45, 60, 90, 120];

function AreaPicker({ value, onChange }) {
  const { activeAreas } = useAreas();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {activeAreas.map((a) => (
        <Chip key={a.id} label={a.name} dot={a.color} color={a.color} selected={value === a.id} onPress={() => onChange(a.id)} />
      ))}
    </ScrollView>
  );
}

function EstimatePicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {ESTIMATES.map((m) => (
        <Chip key={m} label={formatDuration(m)} selected={value === m} onPress={() => onChange(m)} color={colors.lagoon} />
      ))}
    </View>
  );
}

// A date as quick chips, with a typed date for anything else.
export function DatePick({ value, onChange, allowNone = true }) {
  const { today } = useStore();
  const presets = [
    ...(allowNone ? [{ label: 'None', v: null }] : []),
    { label: 'Today', v: today },
    { label: 'Tomorrow', v: addDays(today, 1) },
    { label: 'Next Mon', v: addDays(weekStart(today), 7) },
    { label: 'In a week', v: addDays(today, 7) },
  ];
  const custom = value && !presets.some((p) => p.v === value);
  const [typing, setTyping] = useState(custom ? value : '');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(typing);
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {presets.map((p) => (
          <Chip key={p.label} label={p.label} selected={value === p.v} onPress={() => onChange(p.v)} color={colors.violet} />
        ))}
        {custom ? <Chip label={shortDate(value)} selected color={colors.violet} onPress={() => {}} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Field value={typing} onChangeText={setTyping} placeholder="Or type YYYY-MM-DD" style={{ flex: 1 }} />
        <Button small kind="secondary" title="Set" disabled={!valid} onPress={() => onChange(typing)} />
      </View>
    </View>
  );
}

// Floating capture button. Title-only is enough; Area defaults to last used.
export function CaptureFab({ onPress }) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Quick capture"
      style={{
        position: 'absolute',
        right: space.lg + 2,
        bottom: space.lg + 4,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.sunbeam,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Icon as={Plus} size={28} color={colors.ink} />
    </Press>
  );
}

export function QuickCapture({ visible, onClose, planDate, onAdded }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={planDate ? `Add to ${prettyDate(planDate)}` : 'Capture'}>
      {visible ? <CaptureForm planDate={planDate} onAdded={onAdded} onClose={onClose} /> : null}
    </Sheet>
  );
}

// Mounted fresh on every open, so it always starts empty and focused.
function CaptureForm({ planDate, onAdded, onClose }) {
  const { add, lastAreaId } = useTasks();
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState(lastAreaId);
  const [estimate, setEstimate] = useState(30);
  const [more, setMore] = useState(false);
  const input = useRef(null);

  const save = async (keepOpen) => {
    const t = title.trim();
    if (!t || !areaId) return;
    await add({ title: t, area_id: areaId, estimated_minutes: estimate }, planDate ? { planDate } : {});
    if (onAdded) onAdded(t);
    if (keepOpen) {
      setTitle('');
      input.current?.focus();
    } else onClose();
  };

  return (
    <>
      <Field
        inputRef={input}
        autoFocus
        value={title}
        onChangeText={setTitle}
        placeholder="What's rattling around?"
        returnKeyType="done"
        onSubmitEditing={() => save(false)}
        blurOnSubmit={false}
      />
      <View style={{ marginTop: space.md }}>
        <AreaPicker value={areaId} onChange={setAreaId} />
      </View>
      {more ? (
        <View style={{ marginTop: space.md }}>
          <Kicker>Estimate</Kicker>
          <EstimatePicker value={estimate} onChange={setEstimate} />
        </View>
      ) : (
        <Press onPress={() => setMore(true)} style={{ marginTop: space.md, alignSelf: 'flex-start' }}>
          <T v="caption" style={{ color: colors.lagoon }}>Estimate: {formatDuration(estimate)} · change</T>
        </Press>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Button title="Add another" kind="secondary" onPress={() => save(true)} style={{ flex: 1 }} disabled={!title.trim()} />
        <Button title="Add" onPress={() => save(false)} style={{ flex: 1 }} disabled={!title.trim()} />
      </View>
    </>
  );
}

export function TaskSheet({ task, visible, onClose }) {
  if (!task) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Task">
      {visible ? <TaskForm key={task.id} task={task} onClose={onClose} /> : null}
    </Sheet>
  );
}

function TaskForm({ task, onClose }) {
  const { update, remove } = useTasks();
  const { active: goals } = useGoals();
  const { today, actions } = useStore();
  const [draft, setDraft] = useState(() => ({ ...task }));
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  // Any active goal can be moved by any task; the task's own area comes first.
  const linkable = [...goals].sort((a, b) => (b.area_id === draft.area_id) - (a.area_id === draft.area_id));

  const save = async () => {
    await update(task.id, {
      title: draft.title.trim() || task.title,
      area_id: draft.area_id,
      goal_id: linkable.some((g) => g.id === draft.goal_id) ? draft.goal_id : null,
      estimated_minutes: draft.estimated_minutes,
      priority: draft.priority,
      notes: draft.notes,
      deadline: draft.deadline || null,
      repeat: draft.repeat || 'none',
    });
    onClose();
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
        <Field value={draft.title} onChangeText={set('title')} placeholder="Title" />
        <Kicker style={{ marginTop: space.lg }}>Area</Kicker>
        <AreaPicker value={draft.area_id} onChange={set('area_id')} />
        {linkable.length ? (
          <>
            <Kicker style={{ marginTop: space.lg }}>Moves a goal</Kicker>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Chip label="None" selected={!draft.goal_id} onPress={() => set('goal_id')(null)} />
              {linkable.map((g) => (
                <Chip key={g.id} label={g.title} selected={draft.goal_id === g.id} onPress={() => set('goal_id')(g.id)} color={colors.violet} />
              ))}
            </View>
          </>
        ) : null}
        <Kicker style={{ marginTop: space.lg }}>Estimate</Kicker>
        <EstimatePicker value={draft.estimated_minutes} onChange={set('estimated_minutes')} />
        <EstimateHint areaId={draft.area_id} minutes={draft.estimated_minutes} onApply={set('estimated_minutes')} />
        <Kicker style={{ marginTop: space.lg }}>{draft.repeat && draft.repeat !== 'none' ? 'Next due' : 'Due'}</Kicker>
        <DatePick value={draft.deadline} onChange={set('deadline')} allowNone={!draft.repeat || draft.repeat === 'none'} />
        <Kicker style={{ marginTop: space.lg }}>Repeats</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {REPEATS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              selected={(draft.repeat || 'none') === r.value}
              onPress={() => setDraft((d) => ({ ...d, repeat: r.value, deadline: r.value !== 'none' && !d.deadline ? today : d.deadline }))}
              color={colors.lagoon}
            />
          ))}
        </View>
        <Subtasks taskId={task.id} />
        <Kicker style={{ marginTop: space.lg }}>Energy</Kicker>
        <Segmented
          value={draft.priority}
          onChange={set('priority')}
          options={[{ value: 'low', label: 'Low' }, { value: 'med', label: 'Medium' }, { value: 'high', label: 'High' }]}
        />
        <Field
          value={draft.notes}
          onChangeText={set('notes')}
          placeholder="Notes (optional)"
          multiline
          style={{ marginTop: space.lg, minHeight: 70, textAlignVertical: 'top' }}
        />
        {task.status === 'backlog' ? (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
            <Button small kind="ghost" title="Do today" style={{ flex: 1 }} onPress={async () => { await save(); await actions.planTask(today, task.id); }} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <Button kind="quiet" title="Delete" onPress={async () => { await remove(task.id); onClose(); }} />
          <Button title="Save" onPress={save} style={{ flex: 1 }} />
        </View>
    </ScrollView>
  );
}

// F10.2 — "You say 30m; tasks like this take you about 45m."
function EstimateHint({ areaId, minutes, onApply }) {
  const { estimates, areasById } = useStore();
  const r = ratioFor(estimates, areaId);
  const better = corrected(minutes, r);
  if (!better) return null;
  const where = estimates.byArea[areaId] != null ? `${areasById[areaId]?.name} tasks` : 'Your tasks';
  return (
    <Press onPress={() => onApply(better)} style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
      <T v="caption" style={{ color: colors.lagoon }}>
        {where} take you about {r.toFixed(1)}× your guess — budget {formatDuration(better)}? Tap to use it.
      </T>
    </Press>
  );
}

// F2.7 — one level of checklist. Writes immediately; no Save needed.
function Subtasks({ taskId }) {
  const { subtasksOf, addSubtask, toggleSubtask, removeSubtask } = useTasks();
  const [title, setTitle] = useState('');
  const subs = subtasksOf(taskId);
  const add = async () => {
    if (!title.trim()) return;
    await addSubtask(taskId, title);
    setTitle('');
  };
  return (
    <View style={{ marginTop: space.lg }}>
      <Kicker>Steps {subs.length ? `· ${subs.filter((x) => x.done).length}/${subs.length}` : ''}</Kicker>
      {subs.map((st) => (
        <View key={st.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 }}>
          <CheckDot done={!!st.done} onPress={() => toggleSubtask(st.id)} size={24} />
          <T style={[{ flex: 1 }, st.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>{st.title}</T>
          <Press onPress={() => removeSubtask(st.id)} accessibilityLabel="Remove step">
            <Icon as={X} size={16} color={colors.muted} />
          </Press>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
        <Field value={title} onChangeText={setTitle} placeholder="Add a step" style={{ flex: 1 }} onSubmitEditing={add} returnKeyType="done" />
        <Button small kind="secondary" title="Add" onPress={add} disabled={!title.trim()} />
      </View>
    </View>
  );
}

// One tap, skippable. Chips are built around the estimate so the honest
// answer is usually a single tap away.
export function ActualSheet({ task, visible, onClose }) {
  const { setActual } = useTasks();
  if (!task) return null;
  const est = task.estimated_minutes || 30;
  const options = [...new Set([Math.round(est * 0.5), est, Math.round(est * 1.5), est * 2, est * 3].map((m) => Math.max(5, Math.round(m / 5) * 5)))];
  const pick = async (m) => {
    await setActual(task.id, m);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="How long did that really take?">
      <T v="caption" style={{ marginBottom: space.md }}>
        You guessed {formatDuration(est)} for “{task.title}”. Honest numbers make tomorrow's plan realistic.
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map((m) => (
          <Press
            key={m}
            onPress={() => pick(m)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: radius.pill,
              backgroundColor: m === est ? colors.lagoon : colors.surface,
            }}
          >
            <Text style={[type.data, { color: m === est ? colors.ink : colors.cloud, fontFamily: fonts.mono }]}>
              {m === est ? `About ${formatDuration(m)}` : formatDuration(m)}
            </Text>
          </Press>
        ))}
      </View>
      <Button kind="quiet" title="Skip" onPress={onClose} style={{ marginTop: space.md }} />
    </Sheet>
  );
}
