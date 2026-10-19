// Product-specific building blocks: progress, rings, task rows, sheets.

import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Check, ChevronDown, ChevronUp, Clock, Repeat, X } from 'lucide-react-native';

import { colors, fonts, radius, space, type } from '../core/theme';
import { formatClock, formatDuration, parseTime } from '../core/dates';
import { Icon, NATIVE_DRIVER, Press, T, haptic } from './ui';

// F6.4 — the Focus Goal bar. The loudest element on screen.
export function ProgressBar({ pct, height = 16, color = colors.sunbeam, track = colors.elevated }) {
  const w = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(w, { toValue: Math.max(0, Math.min(100, pct)), useNativeDriver: false, friction: 6, tension: 60 }).start();
  }, [pct, w]);
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height,
          borderRadius: radius.pill,
          backgroundColor: color,
          width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

// F6.5 — small completion ring per Area.
export function Ring({ pct, size = 44, stroke = 6, color = colors.lagoon, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.elevated} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

// The check circle. Lagoon when done; it pops on the way in.
export function CheckDot({ done, missed, onPress, color = colors.lagoon, size = 28 }) {
  const s = useState(() => new Animated.Value(1))[0];
  const prev = useRef(done);
  useEffect(() => {
    if (done && !prev.current) {
      s.setValue(0.6);
      Animated.spring(s, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 3, tension: 200 }).start();
    }
    prev.current = done;
  }, [done, s]);
  const bg = done ? color : missed ? colors.blush : 'transparent';
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: !!done }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: done || missed ? 0 : 2.5,
          borderColor: colors.muted,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: s }],
        }}
      >
        {done ? <Icon as={Check} size={size * 0.6} color={colors.ink} /> : null}
        {missed ? <Icon as={X} size={size * 0.55} color={colors.ink} /> : null}
      </Animated.View>
    </Pressable>
  );
}

export function AreaDot({ area, size = 10 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: area?.color || colors.muted }} />;
}

// One row in a day plan.
export function PlanRow({ item, showTime, onToggle, onPress, onMove, onRemove, mode = 'day', outcome }) {
  const done = (outcome ?? item.outcome) === 'done';
  const missed = (outcome ?? item.outcome) === 'missed';
  const isRitual = !!item.ritual_id;
  const time = parseTime(item.start_time);
  return (
    <Pressable onPress={onPress} style={rowStyles.row}>
      {mode !== 'plan' ? (
        <CheckDot done={done} missed={mode === 'close' && missed} onPress={onToggle} />
      ) : (
        <AreaDot area={item.area} size={12} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[type.emphasis, done && mode === 'day' && { color: colors.muted, textDecorationLine: 'line-through' }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {mode !== 'plan' && item.area ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <AreaDot area={item.area} size={8} />
              <T v="caption">{item.area.name}</T>
            </View>
          ) : null}
          {isRitual ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon as={Repeat} size={12} color={colors.violet} />
              <T v="caption" style={{ color: colors.violet }}>Ritual</T>
            </View>
          ) : null}
          {showTime && time != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon as={Clock} size={12} color={colors.muted} />
              <Text style={[type.data, { fontSize: 12, color: colors.muted }]}>{formatClock(time)}</Text>
            </View>
          ) : null}
          {item.task?.deferral_count >= 3 ? <T v="caption" style={{ color: colors.blush }}>pushed {item.task.deferral_count}×</T> : null}
        </View>
      </View>
      <Text style={[type.data, { fontSize: 13 }]}>{formatDuration(item.minutes)}</Text>
      {onMove ? (
        <View style={{ gap: 2 }}>
          <Pressable hitSlop={6} onPress={() => onMove(-1)}><Icon as={ChevronUp} size={18} color={colors.muted} /></Pressable>
          <Pressable hitSlop={6} onPress={() => onMove(1)}><Icon as={ChevronDown} size={18} color={colors.muted} /></Pressable>
        </View>
      ) : null}
      {onRemove ? (
        <Pressable hitSlop={8} onPress={onRemove} accessibilityLabel="Remove from plan">
          <Icon as={X} size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: space.sm,
  },
});

// Bottom sheet built on Modal — works the same on web and native.
export function Sheet({ visible, onClose, title, children }) {
  const insets = useSafeAreaInsets();
  const y = useState(() => new Animated.Value(400))[0];
  useEffect(() => {
    if (visible) {
      y.setValue(400);
      Animated.spring(y, { toValue: 0, useNativeDriver: NATIVE_DRIVER, friction: 9, tension: 80 }).start();
    }
  }, [visible, y]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={sheetStyles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + space.lg, transform: [{ translateY: y }] }]}>
          <View style={sheetStyles.grab} />
          {title ? <T v="h2" style={{ marginBottom: space.md }}>{title}</T> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,8,30,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg + 2,
    paddingTop: space.md,
    maxHeight: '90%',
  },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: space.md },
});

// Short toast for milestones and nudges.
export function Toast({ message, onDone }) {
  const o = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!message) return;
    haptic('success');
    o.setValue(0);
    Animated.sequence([
      Animated.spring(o, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 5 }),
      Animated.delay(2600),
      Animated.timing(o, { toValue: 0, duration: 220, useNativeDriver: NATIVE_DRIVER }),
    ]).start(() => onDone && onDone());
  }, [message, o, onDone]);
  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 60,
        left: space.lg,
        right: space.lg,
        alignItems: 'center',
        opacity: o,
        transform: [{ scale: o.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        zIndex: 50,
      }}
    >
      <View style={{ backgroundColor: colors.sunbeam, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 20, maxWidth: 520 }}>
        <Text style={{ fontFamily: fonts.bodyHeavy, color: colors.ink, fontSize: 15, textAlign: 'center' }}>{message}</Text>
      </View>
    </Animated.View>
  );
}

export function EmptyNote({ children }) {
  return (
    <View style={{ paddingVertical: space.xl, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed' }}>
      <T style={{ color: colors.muted, textAlign: 'center' }}>{children}</T>
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.md }}>
      <T v="h2">{children}</T>
      {right}
    </View>
  );
}

export { Press };
