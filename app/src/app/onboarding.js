// F12.5 — Areas → first Goal → pick a system → reminder. Under 90 seconds.

import { useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';

import { useStore } from '../core/store';
import { areaColors, colors, radius, space } from '../core/theme';
import { formatClock, formatTime } from '../core/dates';
import { systemList, DEFAULT_SYSTEM } from '../core/systems';
import { notificationsSupported, requestPermission } from '../core/notifications';
import { BrandMark } from '../components/WeekMark';
import { Button, Chip, Field, Icon, Kicker, Press, Screen, Stepper, T } from '../components/ui';
import { AccountSheet } from '../components/AccountSheet';

const STARTERS = ['Academics', 'Career', 'Fitness', 'Projects', 'Personal'];

export default function Onboarding() {
  const { actions } = useStore();
  const [step, setStep] = useState(0);
  const [areas, setAreas] = useState(STARTERS.map((name, i) => ({ name, color: areaColors[i], on: true })));
  const [custom, setCustom] = useState('');
  const [goal, setGoal] = useState({ title: '', target: '', unit: '', areaIndex: 0 });
  const [system, setSystem] = useState(DEFAULT_SYSTEM);
  const [evening, setEvening] = useState(21 * 60);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const chosen = areas.filter((a) => a.on);

  const addCustom = () => {
    const name = custom.trim();
    if (!name || areas.some((a) => a.name.toLowerCase() === name.toLowerCase())) return;
    setAreas((xs) => [...xs, { name, color: areaColors[xs.length % areaColors.length], on: true }]);
    setCustom('');
  };

  const finish = async () => {
    setBusy(true);
    let reminders = false;
    if (notificationsSupported) reminders = await requestPermission();
    const target = Number(goal.target);
    await actions.completeOnboarding({
      areas: chosen.map(({ name, color }) => ({ name, color })),
      goal: goal.title.trim()
        ? {
            title: goal.title.trim(),
            target_value: target > 0 ? target : 1,
            unit: goal.unit.trim(),
            areaIndex: Math.min(goal.areaIndex, chosen.length - 1),
          }
        : null,
      system,
      eveningReminder: formatTime(evening),
      remindersEnabled: reminders,
    });
    router.replace('/');
  };

  const steps = [
    // 0 — welcome
    <View key="w" style={{ alignItems: 'center', paddingTop: 60 }}>
      <BrandMark size={210} />
      <T v="wordmark" style={{ fontSize: 64, lineHeight: 70, marginTop: -40 }}>lumo</T>
      <T v="h2" style={{ color: colors.sunbeam, marginTop: 2 }}>Light up the day.</T>
      <T style={{ color: colors.muted, textAlign: 'center', marginTop: space.xl, maxWidth: 360 }}>
        Two minutes each evening: close today, plan tomorrow. Every day you show up lights a dot.
      </T>
      <Press onPress={() => setSigningIn(true)} style={{ marginTop: space.xl, padding: space.sm }}>
        <T v="emphasis" style={{ color: colors.sunbeam }}>I already have an account</T>
      </Press>
      <AccountSheet visible={signingIn} initialMode="login" onClose={() => setSigningIn(false)} onDone={() => router.replace('/')} />
    </View>,

    // 1 — areas
    <View key="a">
      <Kicker>Step 1 of 4</Kicker>
      <T v="h1">What does your life run on?</T>
      <T style={{ color: colors.muted, marginTop: space.sm }}>
        Areas are the permanent buckets. Keep the ones that fit, add your own.
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl }}>
        {areas.map((a, i) => (
          <Chip
            key={a.name}
            label={a.name}
            dot={a.color}
            color={a.color}
            selected={a.on}
            onPress={() => setAreas((xs) => xs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Field value={custom} onChangeText={setCustom} placeholder="Add an area" style={{ flex: 1 }} onSubmitEditing={addCustom} />
        <Button title="Add" kind="secondary" onPress={addCustom} />
      </View>
    </View>,

    // 2 — first goal (becomes the Focus Goal)
    <View key="g">
      <Kicker>Step 2 of 4</Kicker>
      <T v="h1">One goal you're chasing right now.</T>
      <T style={{ color: colors.muted, marginTop: space.sm }}>
        This becomes your Focus Goal — just one, pinned to the top. Make it measurable.
      </T>
      <Field
        value={goal.title}
        onChangeText={(title) => setGoal((g) => ({ ...g, title }))}
        placeholder="Land a summer internship"
        style={{ marginTop: space.xl }}
      />
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Field
          value={goal.target}
          onChangeText={(target) => setGoal((g) => ({ ...g, target: target.replace(/[^0-9.]/g, '') }))}
          placeholder="Target, e.g. 20"
          keyboardType="decimal-pad"
          style={{ flex: 1 }}
        />
        <Field
          value={goal.unit}
          onChangeText={(unit) => setGoal((g) => ({ ...g, unit }))}
          placeholder="Unit, e.g. applications"
          style={{ flex: 1.4 }}
        />
      </View>
      <Kicker style={{ marginTop: space.lg }}>Which area?</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {chosen.map((a, i) => (
          <Chip key={a.name} label={a.name} dot={a.color} color={a.color} selected={goal.areaIndex === i} onPress={() => setGoal((g) => ({ ...g, areaIndex: i }))} />
        ))}
      </View>
    </View>,

    // 3 — system
    <View key="s">
      <Kicker>Step 3 of 4</Kicker>
      <T v="h1">Pick how you plan.</T>
      <T style={{ color: colors.muted, marginTop: space.sm }}>One tap. You can switch any time in Settings.</T>
      <View style={{ gap: space.md, marginTop: space.xl }}>
        {systemList().map((s) => {
          const on = s.id === system;
          return (
            <Press
              key={s.id}
              onPress={() => setSystem(s.id)}
              style={{
                borderRadius: radius.lg,
                padding: space.lg + 2,
                backgroundColor: on ? colors.sunbeam : colors.surface,
                flexDirection: 'row',
                gap: space.md,
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <T v="h2" style={{ color: on ? colors.ink : colors.cloud }}>{s.name}</T>
                <T style={{ color: on ? colors.ink : colors.muted, marginTop: 2 }}>{s.tagline}</T>
              </View>
              {on ? <Icon as={Check} color={colors.ink} size={24} /> : null}
            </Press>
          );
        })}
      </View>
    </View>,

    // 4 — reminder
    <View key="r">
      <Kicker>Step 4 of 4</Kicker>
      <T v="h1">When do you wind down?</T>
      <T style={{ color: colors.muted, marginTop: space.sm }}>
        lumo will nudge you once a day to close today and plan tomorrow. That's the whole habit.
      </T>
      <View style={{ alignItems: 'center', marginTop: space.xxl }}>
        <Stepper value={evening} step={15} onChange={(v) => setEvening(Math.min(23 * 60 + 45, Math.max(17 * 60, v)))} format={formatClock} />
      </View>
      {Platform.OS === 'web' ? (
        <T v="caption" style={{ textAlign: 'center', marginTop: space.lg }}>
          Reminders arrive on the phone app. On the web, just open lumo in the evening.
        </T>
      ) : null}
    </View>,
  ];

  const canNext = step !== 1 || chosen.length > 0;
  const last = step === steps.length - 1;

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          {step > 0 ? <Button title="Back" kind="ghost" onPress={() => setStep(step - 1)} /> : null}
          {step === 2 && !goal.title.trim() ? (
            <Button title="Skip for now" kind="secondary" onPress={() => setStep(3)} style={{ flex: 1 }} />
          ) : (
            <Button
              title={step === 0 ? "Let's set up" : last ? 'Start' : 'Next'}
              onPress={() => (last ? finish() : setStep(step + 1))}
              disabled={!canNext || busy}
              style={{ flex: 1 }}
            />
          )}
        </View>
      }
    >
      {steps[step]}
    </Screen>
  );
}

