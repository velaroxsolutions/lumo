// The Week — seven dots on a smile. Two forms:
//  • <BrandMark/>: the static logo (6 lit, 7th always open). Never closed.
//  • <WeekDots/>: the in-app version driven by real days. Today's open ring
//    is the button that starts the evening ritual; closing the day fills it.
// Violet then Sunbeam as a hard step, never a gradient.

import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { colors } from '../core/theme';
import { NATIVE_DRIVER } from './ui';

// Construction from Brand §3.5, in the 100×100 viewBox.
const DOTS = [
  [7.45, 14.65, 5.6],
  [16.91, 30.5, 6.23],
  [31.94, 41.22, 6.87],
  [50.0, 45.0, 7.5],
  [68.06, 41.22, 8.13],
  [83.09, 30.5, 8.77],
  [92.55, 14.65, 7.43],
];
const TX = 5.409;
const TY = 25.191;
const SC = 0.85917;
const TOP = 29; // crop: the smile lives between y≈30 and y≈71
const HEIGHT = 44;

const posColor = (i) => (i < 3 ? colors.violet : colors.sunbeam);

export function BrandMark({ size = 120, mono }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform={`translate(${TX},${TY}) scale(${SC})`}>
        {DOTS.map(([cx, cy, r], i) =>
          i < 6 ? (
            <Circle key={i} cx={cx} cy={cy} r={r} fill={mono || posColor(i)} />
          ) : (
            <Circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={mono ? `${mono}88` : colors.muted} strokeWidth={3.95} />
          ),
        )}
      </G>
    </Svg>
  );
}

// Micro mark (4 dots, no ring) for anything under 40px.
export function MicroMark({ size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="translate(8.007,31.265) scale(0.80370)">
        <Circle cx={9.25} cy={10.16} r={10.5} fill={colors.violet} />
        <Circle cx={32.03} cy={37.96} r={12} fill={colors.violet} />
        <Circle cx={67.97} cy={37.96} r={13.5} fill={colors.sunbeam} />
        <Circle cx={90.75} cy={10.16} r={15} fill={colors.sunbeam} />
      </G>
    </Svg>
  );
}

function geometry(width) {
  const k = width / 100;
  return DOTS.map(([cx, cy, r]) => ({
    x: (TX + SC * cx) * k,
    y: (TY + SC * cy - TOP) * k,
    r: SC * r * k,
  }));
}

// dots: [{ date, status }] × 7 from logic/streak.weekDots.
// celebrate: bump this number to replay the day-close sequence.
export function WeekDots({ dots, width = 260, onPressToday, celebrate = 0, onCelebrated, hidden = false }) {
  const geo = useMemo(() => geometry(width), [width]);
  const scales = useState(() => DOTS.map(() => new Animated.Value(hidden ? 0 : 1)))[0];

  useEffect(() => {
    if (!celebrate) return;
    // Light in sequence, left to right, ~90ms apart, each overshooting.
    scales.forEach((s) => s.setValue(0));
    Animated.stagger(
      90,
      scales.map((s) =>
        Animated.spring(s, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 4, tension: 160 }),
      ),
    ).start(() => onCelebrated && onCelebrated());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  // Gentle breathing on today's open ring so it reads as tappable.
  const pulse = useState(() => new Animated.Value(1))[0];
  const todayOpen = dots[6]?.status === 'today';
  useEffect(() => {
    if (!todayOpen) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [todayOpen, pulse]);

  return (
    <View style={{ width, height: (HEIGHT * width) / 100 }}>
      {dots.map((d, i) => {
        const g = geo[i];
        const size = g.r * 2;
        const style = dotStyle(d.status, i, g.r);
        const scale = i === 6 && todayOpen ? Animated.multiply(scales[i], pulse) : scales[i];
        const node = (
          <Animated.View
            style={[
              { position: 'absolute', left: g.x - g.r, top: g.y - g.r, width: size, height: size, borderRadius: g.r },
              style,
              { transform: [{ scale }] },
            ]}
          />
        );
        if (i === 6 && onPressToday) {
          const hit = Math.max(44, size + 16);
          return (
            <Pressable
              key={d.date}
              onPress={onPressToday}
              accessibilityRole="button"
              accessibilityLabel={todayOpen ? 'Close the day' : 'Today is lit'}
              style={{ position: 'absolute', left: g.x - hit / 2, top: g.y - hit / 2, width: hit, height: hit }}
            >
              <View style={{ position: 'absolute', left: hit / 2 - g.x, top: hit / 2 - g.y }}>{node}</View>
            </Pressable>
          );
        }
        return <View key={d.date} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>{node}</View>;
      })}
    </View>
  );
}

function dotStyle(status, i, r) {
  const ring = Math.max(2, r * 0.42);
  switch (status) {
    case 'lit':
      return { backgroundColor: i === 6 ? colors.sunbeam : posColor(i) };
    case 'today':
      return { borderWidth: ring, borderColor: colors.muted, backgroundColor: 'transparent' };
    case 'frozen':
      return { backgroundColor: colors.muted, opacity: 0.55 };
    case 'missed':
      return { backgroundColor: colors.blush, opacity: 0.45 };
    default:
      return { backgroundColor: colors.line, opacity: 0.6 }; // before you started
  }
}
