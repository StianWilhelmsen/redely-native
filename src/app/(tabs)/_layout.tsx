import { Tabs } from 'expo-router';

import { MagnetenTabBar } from '@/components/magneten/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <MagnetenTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="week" />
      <Tabs.Screen name="lists" />
      <Tabs.Screen name="family" />
    </Tabs>
  );
}
