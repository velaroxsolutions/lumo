// F12.3 — evening planning reminder + morning plan. Scheduled locally on the
// device, so they work fully offline and need no server. Web has no
// background scheduling, so every call is a no-op there.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { NOTIFY } from './copy';
import { parseTime } from './dates';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
export const notificationsSupported = supported;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestPermission() {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return !!res.granted;
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Planning reminders',
    importance: AndroidImportance.DEFAULT,
  });
}

// Replace both daily reminders with the current settings.
export async function syncReminders(settings) {
  if (!supported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (settings.reminders_enabled !== '1') return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureChannel();
    const plan = [
      [settings.evening_reminder, NOTIFY.evening, '/ritual'],
      [settings.morning_reminder, NOTIFY.morning, '/'],
    ];
    for (const [time, copy, url] of plan) {
      const mins = parseTime(time);
      if (mins == null) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: copy.title, body: copy.body, data: { url } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(mins / 60),
          minute: mins % 60,
          channelId: 'reminders',
        },
      });
    }
  } catch (e) {
    // Reminders are a nicety; never let them break the app.
    console.warn('lumo: could not schedule reminders', e);
  }
}

export function addResponseListener(cb) {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r?.notification?.request?.content?.data?.url;
    if (typeof url === 'string') cb(url);
  });
  return () => sub.remove();
}
