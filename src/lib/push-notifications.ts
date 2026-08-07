import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

const DEFAULT_CHANNEL_ID = 'default';

/** Whether the OS has ever been asked, and what the current answer is. */
export async function getPermissionStatus() {
  return Notifications.getPermissionsAsync();
}

export function isNotificationPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus
) {
  if (permission.granted || permission.status === 'granted') return true;
  if (Platform.OS !== 'ios') return false;

  return (
    permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  // Android 13 does not show the permission prompt or issue a push token until
  // the app has created at least one notification channel.
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Varslinger',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

function getProjectId() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error('EAS projectId mangler i app-konfigurasjonen.');
  }
  return projectId;
}

/**
 * Fetches the current Expo token and stores it for the signed-in user. This does
 * not show an OS prompt and is therefore safe to run at startup and whenever
 * the app returns to the foreground.
 */
export async function syncPushTokenIfGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  await ensureAndroidChannel();
  const permission = await Notifications.getPermissionsAsync();
  if (!isNotificationPermissionGranted(permission)) return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: getProjectId(),
  });
  await api.registerPushToken(token);
  return true;
}

/**
 * Asks the OS for notification permission and, if granted, fetches an Expo push
 * token and registers it with the backend. Registration failures are allowed to
 * reach the caller so the UI cannot claim notifications are active when only
 * the OS permission was granted.
 */
export async function requestAndRegisterPushToken(): Promise<Notifications.PermissionStatus> {
  if (Platform.OS === 'web') return Notifications.PermissionStatus.DENIED;

  await ensureAndroidChannel();
  const permission = await Notifications.requestPermissionsAsync();
  if (isNotificationPermissionGranted(permission)) {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: getProjectId(),
    });
    await api.registerPushToken(token);
  }

  return isNotificationPermissionGranted(permission)
    ? Notifications.PermissionStatus.GRANTED
    : permission.status;
}

export async function clearPushToken() {
  try {
    await api.registerPushToken(null);
  } catch {
    // Best-effort - not worth surfacing to the user.
  }
}
