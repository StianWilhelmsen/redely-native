import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

/** Whether the OS has ever been asked, and what the current answer is. */
export async function getPermissionStatus() {
  return Notifications.getPermissionsAsync();
}

/**
 * Asks the OS for notification permission and, if granted, fetches an Expo push
 * token and registers it with the backend. Safe to call even without an EAS
 * project linked (getExpoPushTokenAsync throws in that case) - it just skips
 * token registration and returns whatever permission status the OS gave back.
 */
export async function requestAndRegisterPushToken(): Promise<Notifications.PermissionStatus> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (!Device.isDevice) {
    // Push tokens aren't available on simulators/emulators.
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return status;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await api.registerPushToken(token);
  } catch (err) {
    // No EAS project linked yet, or push token retrieval failed - permission is
    // still granted, we just can't deliver to this device until that's set up.
    console.warn('Could not register push token', err);
  }

  return status;
}

export async function clearPushToken() {
  try {
    await api.registerPushToken(null);
  } catch {
    // Best-effort - not worth surfacing to the user.
  }
}
