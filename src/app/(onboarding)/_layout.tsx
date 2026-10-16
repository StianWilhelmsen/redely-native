import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* From step 4 the household exists - swiping back into steps 1-3 would only confuse. */}
      <Stack.Screen name="onboarding/invite" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
