// Shared primitives. Nothing has a sharp corner; colour is used generously.

import { useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, fonts, iconStroke, radius, space, type } from '../core/theme';

export const NATIVE_DRIVER = Platform.OS !== 'web';

export function haptic(kind = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function T({ v = 'body', style, children, ...rest }) {
  return (
    <Text style={[type[v], style]} {...rest}>
      {children}
    </Text>
  );
}

export function Icon({ as: Cmp, size = 20, color = colors.cloud, ...rest }) {
  return <Cmp size={size} color={color} strokeWidth={iconStroke} {...rest} />;
}

// Springy press feedback — motion should overshoot.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Press({ onPress, style, children, disabled, scaleTo = 0.96, ...rest }) {
  const s = useState(() => new Animated.Value(1))[0];
  const to = (v) => Animated.spring(s, { toValue: v, useNativeDriver: NATIVE_DRIVER, speed: 40, bounciness: 12 }).start();
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      style={[style, { transform: [{ scale: s }] }, disabled && { opacity: 0.45 }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, style, small }) {
  const k = BTN[kind];
  return (
    <Press onPress={onPress} disabled={disabled} style={[styles.btn, small && styles.btnSmall, { backgroundColor: k.bg }, k.border && { borderWidth: 2, borderColor: k.border }, style]}>
      {icon ? <Icon as={icon} size={small ? 16 : 18} color={k.fg} /> : null}
      <Text style={[styles.btnText, small && { fontSize: 14 }, { color: k.fg }]}>{title}</Text>
    </Press>
  );
}

const BTN = {
  primary: { bg: colors.sunbeam, fg: colors.ink },
  violet: { bg: colors.violet, fg: '#FFFFFF' },
  secondary: { bg: colors.elevated, fg: colors.cloud },
  ghost: { bg: 'transparent', fg: colors.cloud, border: colors.line },
  quiet: { bg: 'transparent', fg: colors.muted },
};

export function Card({ style, children, tone = 'surface' }) {
  return <View style={[styles.card, { backgroundColor: colors[tone] }, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress, color = colors.sunbeam, dot, style }) {
  return (
    <Press
      onPress={onPress}
      style={[
        styles.chip,
        selected ? { backgroundColor: color } : { backgroundColor: colors.elevated },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: selected ? colors.ink : dot }]} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.ink : colors.cloud }]}>{label}</Text>
    </Press>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segItem, on && { backgroundColor: colors.violet }]}>
            <Text style={[styles.segText, on && { color: '#FFFFFF' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ style, inputRef, ...rest }) {
  return (
    <TextInput
      ref={inputRef}
      placeholderTextColor={colors.muted}
      selectionColor={colors.sunbeam}
      style={[styles.field, style]}
      {...rest}
    />
  );
}

export function Kicker({ children, style }) {
  return <T v="kicker" style={[{ marginBottom: space.sm }, style]}>{children}</T>;
}

export function Screen({ children, scroll = true, padded = true, footer, contentStyle, edges = ['top'] }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.pad, { paddingBottom: 120 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.pad, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <View style={styles.inner}>{body}</View>
      {footer}
    </SafeAreaView>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, format = (v) => String(v), style }) {
  return (
    <View style={[styles.stepper, style]}>
      <Press onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn}>
        <Text style={styles.stepSign}>−</Text>
      </Press>
      <Text style={[type.data, { color: colors.cloud, minWidth: 70, textAlign: 'center' }]}>{format(value)}</Text>
      <Press onPress={() => onChange(value + step)} style={styles.stepBtn}>
        <Text style={styles.stepSign}>+</Text>
      </Press>
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 2, backgroundColor: colors.line, borderRadius: 2 }, style]} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.midnight },
  inner: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  pad: { paddingHorizontal: space.lg + 2, paddingTop: space.lg },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    minHeight: 50,
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: space.lg, minHeight: 38 },
  btnText: { fontFamily: fonts.bodyHeavy, fontSize: 16 },
  card: { borderRadius: radius.lg, padding: space.lg + 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.muted },
  field: {
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    color: colors.cloud,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { color: colors.cloud, fontFamily: fonts.bodyHeavy, fontSize: 20, lineHeight: 22 },
});
