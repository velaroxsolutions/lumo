import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { colors, space } from '../core/theme';
import { Icon, Kicker, T } from './ui';

export function BackHeader({ title, kicker }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: space.md }}>
        <Icon as={ChevronLeft} color={colors.muted} size={20} />
        <T v="emphasis" style={{ color: colors.muted }}>Back</T>
      </Pressable>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <T v="h1">{title}</T>
    </View>
  );
}
