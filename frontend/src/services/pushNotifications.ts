/**
 * Push Notification Service
 *
 * Registers the device for Expo push notifications, saves the token to the
 * backend, and provides a handler for notification taps (deep link to venue).
 *
 * Call registerForPushNotifications(sessionToken) once after the user is
 * authenticated. It is idempotent — safe to call on every app launch.
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// How the app handles a notification while foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

/**
 * Request permission, get the Expo push token, and save it to the backend.
 * No-ops on simulators or web (physical device required for push).
 */
export async function registerForPushNotifications(sessionToken: string): Promise<void> {
  if (!Constants.isDevice || Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'VIIBE Alerts',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#FF3366',
    });
    await Notifications.setNotificationChannelAsync('moments', {
      name:             'Moments',
      description:      'When a Moment Locks at a venue near you',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 80, 80, 180, 80, 400],
      lightColor:       '#6655FF',
      sound:            'default',
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await fetch(`${API_URL}/api/users/me/push-token`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body:    JSON.stringify({ push_token: token }),
    });
  } catch {
    // Non-fatal — push is a nice-to-have, not a blocker
  }
}

/**
 * Call once from _layout.tsx to attach a tap handler.
 * When a user taps an ELECTRIC notification, they're routed to the venue.
 * Returns a cleanup function — call it on unmount.
 */
export function attachNotificationTapHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    if (!data?.venue_id) return;

    // All venue-linked notification types route to the venue screen
    const venueTypes = ['electric_alert', 'moment_locked', 'lobby_hot', 'vibe_spike'];
    if (venueTypes.includes(data.type)) {
      router.push(`/venue/${data.venue_id}`);
    }
  });
  return () => sub.remove();
}
