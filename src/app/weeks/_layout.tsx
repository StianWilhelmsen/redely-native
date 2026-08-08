import { Stack } from 'expo-router';

export default function WeeksLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[weekStart]" />
    </Stack>
  );
}
