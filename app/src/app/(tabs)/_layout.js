import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { BarChart3, CalendarDays, Inbox, Sun, Target } from 'lucide-react-native';

import { useStore } from '../../core/store';
import { colors, fonts } from '../../core/theme';
import { Icon } from '../../components/ui';

const tab = (title, icon) => ({
  title,
  tabBarIcon: ({ color }) => <Icon as={icon} size={22} color={color} />,
});

export default function TabsLayout() {
  const { settings } = useStore();
  if (settings.onboarded !== '1') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.sunbeam,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 2, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11.5, paddingBottom: 4 },
        sceneStyle: { backgroundColor: colors.midnight },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', Sun)} />
      <Tabs.Screen name="backlog" options={tab('Backlog', Inbox)} />
      <Tabs.Screen name="goals" options={tab('Goals', Target)} />
      <Tabs.Screen name="calendar" options={tab('Calendar', CalendarDays)} />
      <Tabs.Screen name="insights" options={tab('Insights', BarChart3)} />
    </Tabs>
  );
}
