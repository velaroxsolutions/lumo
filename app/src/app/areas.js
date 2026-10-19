// F1.1 Areas (archivable, never deleted) and F1.4 Rituals (named recurring
// time blocks that pre-fill the plan on matching weekdays).

import { useState } from 'react';
import { View } from 'react-native';
import { Plus, Repeat } from 'lucide-react-native';

import { useAreas } from '../core/useAreas';
import { areaColors, colors, radius, space } from '../core/theme';
import { WEEKDAYS_MASK, formatClock, formatDuration, formatTime, parseTime } from '../core/dates';
import { Button, Card, Chip, Field, Icon, Kicker, Press, Screen, Stepper, T } from '../components/ui';
import { AreaDot, EmptyNote, SectionTitle, Sheet } from '../components/parts';
import { BackHeader } from '../components/BackHeader';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function maskLabel(mask) {
  if (mask === 0b1111111) return 'Every day';
  if (mask === WEEKDAYS_MASK) return 'Weekdays';
  if (mask === 0b1000001) return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names.filter((_, i) => (mask >> i) & 1).join(' ');
}

export default function Areas() {
  const { areas, areasById, rituals } = useAreas();
  const [areaEdit, setAreaEdit] = useState(null);
  const [ritualEdit, setRitualEdit] = useState(null);
  const live = areas.filter((a) => !a.archived);
  const archived = areas.filter((a) => a.archived);
  const activeRituals = rituals.filter((r) => r.active);

  return (
    <Screen>
      <BackHeader title="Areas & rituals" />

      <SectionTitle right={<Button small icon={Plus} title="Area" kind="secondary" onPress={() => setAreaEdit('new')} />}>Areas</SectionTitle>
      {live.map((a) => (
        <Press key={a.id} onPress={() => setAreaEdit(a)} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.sm }}>
          <AreaDot area={a} size={14} />
          <T v="emphasis" style={{ flex: 1 }}>{a.name}</T>
        </Press>
      ))}
      {archived.length ? (
        <>
          <Kicker style={{ marginTop: space.md }}>Archived</Kicker>
          {archived.map((a) => (
            <Press key={a.id} onPress={() => setAreaEdit(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
              <AreaDot area={a} />
              <T style={{ color: colors.muted }}>{a.name}</T>
            </Press>
          ))}
        </>
      ) : null}

      <SectionTitle right={<Button small icon={Plus} title="Ritual" kind="secondary" onPress={() => setRitualEdit('new')} disabled={!live.length} />}>Rituals</SectionTitle>
      <T v="caption" style={{ marginTop: -space.sm, marginBottom: space.md }}>
        Recurring blocks like “Lunch skill block”. They appear on matching days automatically.
      </T>
      {activeRituals.length ? (
        activeRituals.map((r) => (
          <Press key={r.id} onPress={() => setRitualEdit(r)} scaleTo={0.98} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon as={Repeat} size={16} color={colors.violet} />
              <T v="emphasis" style={{ flex: 1 }}>{r.name}</T>
              <AreaDot area={areasById[r.area_id]} />
            </View>
            <T v="caption" style={{ marginTop: 4 }}>
              {maskLabel(r.weekday_mask)} · {r.start_time ? formatClock(parseTime(r.start_time)) : 'any time'} · {formatDuration(r.duration_minutes)}
            </T>
          </Press>
        ))
      ) : (
        <EmptyNote>No rituals yet.</EmptyNote>
      )}

      {areaEdit ? (
        <AreaSheet key={areaEdit === 'new' ? 'new' : areaEdit.id} area={areaEdit} count={areas.length} onClose={() => setAreaEdit(null)} />
      ) : null}
      {ritualEdit ? (
        <RitualSheet key={ritualEdit === 'new' ? 'new' : ritualEdit.id} ritual={ritualEdit} onClose={() => setRitualEdit(null)} />
      ) : null}
    </Screen>
  );
}

function AreaSheet({ area, count, onClose }) {
  const { add, update, archive } = useAreas();
  const isNew = area === 'new';
  const [name, setName] = useState(isNew ? '' : area.name);
  const [color, setColor] = useState(isNew ? areaColors[count % areaColors.length] : area.color);
  const save = async () => {
    if (!name.trim()) return;
    if (isNew) await add({ name: name.trim(), color, sort_order: count });
    else await update(area.id, { name: name.trim(), color });
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={isNew ? 'New area' : 'Area'}>
      <Field value={name} onChangeText={setName} placeholder="Job search, Fitness…" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
        {areaColors.map((c) => (
          <Press key={c} onPress={() => setColor(c)} accessibilityLabel={`Colour ${c}`}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: color === c ? 4 : 0, borderColor: colors.cloud }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        {!isNew ? (
          <Button kind="quiet" title={area.archived ? 'Unarchive' : 'Archive'} onPress={async () => { await archive(area.id, !area.archived); onClose(); }} />
        ) : null}
        <Button title="Save" onPress={save} style={{ flex: 1 }} disabled={!name.trim()} />
      </View>
    </Sheet>
  );
}

function RitualSheet({ ritual, onClose }) {
  const { activeAreas, addRitual, updateRitual } = useAreas();
  const isNew = ritual === 'new';
  const [d, setD] = useState(() => (isNew
    ? { name: '', area_id: activeAreas[0]?.id, weekday_mask: WEEKDAYS_MASK, start: 12 * 60, timed: true, duration_minutes: 60 }
    : { name: ritual.name, area_id: ritual.area_id, weekday_mask: ritual.weekday_mask, start: parseTime(ritual.start_time) ?? 12 * 60, timed: !!ritual.start_time, duration_minutes: ritual.duration_minutes }));
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!d.name.trim() || !d.weekday_mask) return;
    const row = {
      name: d.name.trim(),
      area_id: d.area_id,
      weekday_mask: d.weekday_mask,
      start_time: d.timed ? formatTime(d.start) : null,
      duration_minutes: d.duration_minutes,
    };
    if (isNew) await addRitual(row);
    else await updateRitual(ritual.id, row);
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={isNew ? 'New ritual' : 'Ritual'}>
      <Field value={d.name} onChangeText={set('name')} placeholder="Lunch skill block" />
      <Kicker style={{ marginTop: space.lg }}>Days</Kicker>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAYS.map((label, i) => {
          const on = ((d.weekday_mask >> i) & 1) === 1;
          return (
            <Press key={i} onPress={() => set('weekday_mask')(d.weekday_mask ^ (1 << i))}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.violet : colors.surface }}>
              <T v="emphasis" style={{ color: on ? '#FFFFFF' : colors.muted }}>{label}</T>
            </Press>
          );
        })}
      </View>
      <Kicker style={{ marginTop: space.lg }}>Area</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {activeAreas.map((a) => (
          <Chip key={a.id} label={a.name} dot={a.color} color={a.color} selected={d.area_id === a.id} onPress={() => set('area_id')(a.id)} />
        ))}
      </View>
      <Card tone="surface" style={{ marginTop: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Chip label={d.timed ? 'At a set time' : 'Any time'} selected={d.timed} onPress={() => set('timed')(!d.timed)} color={colors.violet} />
          {d.timed ? <Stepper value={d.start} step={15} onChange={(v) => set('start')(Math.max(0, Math.min(23 * 60 + 45, v)))} format={formatClock} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T>Length</T>
          <Stepper value={d.duration_minutes} step={15} min={15} onChange={set('duration_minutes')} format={formatDuration} />
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        {!isNew ? <Button kind="quiet" title="Remove" onPress={async () => { await updateRitual(ritual.id, { active: 0 }); onClose(); }} /> : null}
        <Button title="Save" onPress={save} style={{ flex: 1 }} disabled={!d.name.trim() || !d.weekday_mask} />
      </View>
    </Sheet>
  );
}
