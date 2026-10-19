import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, ChevronRight, Layers } from 'lucide-react-native';

import { useSettings } from '../core/useSettings';
import { colors, radius, space } from '../core/theme';
import { formatClock, formatDuration, formatTime, parseTime } from '../core/dates';
import { systemList } from '../core/systems';
import { notificationsSupported, requestPermission } from '../core/notifications';
import { Card, Icon, Press, Screen, Segmented, Stepper, T } from '../components/ui';
import { SectionTitle } from '../components/parts';
import { BrandMark } from '../components/WeekMark';
import { BackHeader } from '../components/BackHeader';

function TimeRow({ label, value, onChange }) {
  const mins = parseTime(value) ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm }}>
      <T>{label}</T>
      <Stepper value={mins} step={15} onChange={(v) => onChange(formatTime(Math.max(0, Math.min(23 * 60 + 45, v))))} format={formatClock} />
    </View>
  );
}

function LinkRow({ icon, label, onPress }) {
  return (
    <Press onPress={onPress} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.sm }}>
      <Icon as={icon} color={colors.violet} />
      <T v="emphasis" style={{ flex: 1 }}>{label}</T>
      <Icon as={ChevronRight} color={colors.muted} />
    </Press>
  );
}

export default function Settings() {
  const { settings, system, update } = useSettings();
  const avail = Number(settings.available_minutes) || 360;

  const toggleReminders = async (on) => {
    if (on && notificationsSupported) {
      const ok = await requestPermission();
      if (!ok) return;
    }
    update({ reminders_enabled: on ? '1' : '0' });
  };

  return (
    <Screen>
      <BackHeader title="Settings" />

      <SectionTitle>Your system</SectionTitle>
      <View style={{ gap: space.sm }}>
        {systemList().map((s) => {
          const on = s.id === system.id;
          return (
            <Press key={s.id} onPress={() => update({ system_preset: s.id })} scaleTo={0.98}
              style={{ borderRadius: radius.md, padding: space.lg, backgroundColor: on ? colors.sunbeam : colors.surface }}>
              <T v="emphasis" style={{ color: on ? colors.ink : colors.cloud }}>{s.name}</T>
              <T v="caption" style={{ color: on ? colors.ink : colors.muted }}>{s.tagline}</T>
            </Press>
          );
        })}
      </View>

      <SectionTitle>Your day</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm }}>
          <View style={{ flex: 1 }}>
            <T>Hours you can really work</T>
            <T v="caption">Used for the overcommit warning</T>
          </View>
          <Stepper value={avail} step={30} min={60} onChange={(v) => update({ available_minutes: String(Math.min(16 * 60, v)) })} format={formatDuration} />
        </View>
        {system.timeBlocking ? (
          <TimeRow label="Day starts" value={settings.day_start} onChange={(v) => update({ day_start: v })} />
        ) : null}
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        <Segmented
          value={settings.reminders_enabled === '1'}
          onChange={toggleReminders}
          options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]}
        />
        {settings.reminders_enabled === '1' ? (
          <View style={{ marginTop: space.md }}>
            <TimeRow label="Evening — close the day" value={settings.evening_reminder} onChange={(v) => update({ evening_reminder: v })} />
            <TimeRow label="Morning — today's plan" value={settings.morning_reminder} onChange={(v) => update({ morning_reminder: v })} />
          </View>
        ) : null}
        {Platform.OS === 'web' ? (
          <T v="caption" style={{ marginTop: space.md }}>Reminders are delivered by the phone app; the web version can't schedule them.</T>
        ) : null}
      </Card>

      <SectionTitle>Structure</SectionTitle>
      <LinkRow icon={Layers} label="Areas & rituals" onPress={() => router.push('/areas')} />
      <LinkRow icon={BookOpen} label="Review journal" onPress={() => router.push('/journal')} />

      <View style={{ alignItems: 'center', marginTop: space.xxl }}>
        <BrandMark size={72} />
        <T v="caption">lumo 0.1 · Velarox Solutions</T>
        <T v="caption">Everything is stored on this device.</T>
      </View>
    </Screen>
  );
}
