import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';

import { initDb } from '../core/db';
import { StoreProvider, useStore } from '../core/store';
import { addResponseListener, syncReminders } from '../core/notifications';
import { colors, navTheme } from '../core/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Reminders() {
  const { settings } = useStore();
  const { reminders_enabled, evening_reminder, morning_reminder, onboarded } = settings;
  useEffect(() => {
    if (onboarded === '1') syncReminders({ reminders_enabled, evening_reminder, morning_reminder });
  }, [reminders_enabled, evening_reminder, morning_reminder, onboarded]);
  useEffect(() => addResponseListener((url) => router.push(url)), []);
  return null;
}

function Ready() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    JetBrainsMono_500Medium,
  });

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.midnight }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.midnight }}>
          <SQLiteProvider databaseName="lumo.db" onInit={initDb}>
            <StoreProvider>
              <Ready />
              <Reminders />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.midnight } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
                <Stack.Screen name="ritual" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
                <Stack.Screen name="week" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
                <Stack.Screen name="settings" />
                <Stack.Screen name="areas" />
                <Stack.Screen name="journal" />
              </Stack>
            </StoreProvider>
          </SQLiteProvider>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
