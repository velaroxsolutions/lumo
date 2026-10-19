// F11.2 — a streak card worth posting. Free marketing, and it only ever
// shows what the user chose to share: the streak and this week's dots.
// No goal titles, no task names.

import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Share2 } from 'lucide-react-native';

import { useStore } from '../core/store';
import { colors, fonts, radius, space } from '../core/theme';
import { weekDots } from '../core/logic/streak';
import { Button, T } from './ui';
import { Sheet } from './parts';
import { WeekDots } from './WeekMark';

const W = 320;
const H = 400; // 4:5, the shape feeds like best

export function ShareCard({ cardRef }) {
  const { streak, litDates, today, settings } = useStore();
  const dots = useMemo(() => weekDots(streak, litDates, today, settings.first_day), [streak, litDates, today, settings.first_day]);
  // Square corners on the image itself; the preview rounds them for display.
  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={{ width: W, height: H, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 26 }}
    >
      <View style={{ alignItems: 'center' }}>
        <WeekDots dots={dots} width={220} />
        <T v="celebration" style={{ fontSize: 92, lineHeight: 98, marginTop: space.md }}>{streak.current}</T>
        <T v="h2" style={{ marginTop: -4 }}>{streak.current === 1 ? 'day planned' : 'days planned'}</T>
        <T v="caption" style={{ marginTop: 2 }}>{streak.totalLit} days lit in total</T>
      </View>
      <View style={{ alignItems: 'center' }}>
        <T style={{ fontFamily: fonts.wordmark, fontSize: 24, lineHeight: 28, color: colors.cloud }}>lumo</T>
        <T style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.sunbeam }}>Light up the day.</T>
      </View>
    </View>
  );
}

export function ShareSheet({ visible, onClose }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const web = Platform.OS === 'web';
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1350, result: web ? 'data-uri' : 'tmpfile' });
      if (web) {
        const a = document.createElement('a');
        a.href = uri;
        a.download = 'lumo-streak.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const Sharing = await import('expo-sharing');
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your streak' });
      }
    } catch (e) {
      setError("Couldn't make the image. Try again?");
      console.warn('lumo share card', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Share your streak">
      {visible ? (
        <View style={{ alignItems: 'center' }}>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: colors.line }}>
            <ShareCard cardRef={ref} />
          </View>
          <T v="caption" style={{ marginTop: space.md, textAlign: 'center' }}>Just the streak and this week's dots — nothing else from your plans.</T>
          {error ? <T style={{ color: colors.blush, marginTop: space.sm }}>{error}</T> : null}
          <Button
            title={busy ? 'Making it…' : Platform.OS === 'web' ? 'Download image' : 'Share'}
            icon={Share2}
            onPress={share}
            disabled={busy}
            style={{ marginTop: space.md, alignSelf: 'stretch' }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
