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
// Every push type that should open a venue when tapped. 'electric_alert' is
// the pre-rename name of 'max_alert', kept for notifications already sent.
// 'energy_transition' (a room going lit, or cooling off) and 'score_alert'
// were missing, so tapping them did nothing.
const VENUE_TYPES = [
  'max_alert', 'electric_alert', 'energy_transition', 'score_alert',
  'moment_locked', 'lobby_hot', 'vibe_spike', 'campaign_active', 'crew_checkin',
];

let lastHandledKey: string | null = null;

/**
 * Navigate, retrying until the router is mounted. A tap that launches the app
 * arrives during the splash, before any navigator exists, and router.push
 * throws then; without the retry that tap was lost.
 */
function pushWhenReady(target: any, attempt = 0): void {
  try {
    router.push(target);
  } catch {
    if (attempt < 40) setTimeout(() => pushWhenReady(target, attempt + 1), 250);
  }
}

function handleResponse(response: Notifications.NotificationResponse): void {
  // A tap can arrive twice: once through the listener and again through the
  // cold-start check below. Route it only once. Arrival prompts reuse their
  // identifier per venue, so the delivery time is part of the key.
  const key = `${response.notification.request.identifier}@${response.notification.date}`;
  if (key === lastHandledKey) return;
  lastHandledKey = key;

  const data = response.notification.request.content.data as Record<string, string> | undefined;
  if (!data?.venue_id) return;

  // The arrival prompt: open the reading straight away, and let the venue
  // screen take its one ten-second sound sample (see arrivalSample.ts).
  if (data.type === 'arrival_prompt') {
    pushWhenReady({
      pathname: '/venue/[id]',
      params: { id: data.venue_id, openRateModal: 'true', arrival: '1' },
    } as any);
    return;
  }

  if (VENUE_TYPES.includes(data.type)) {
    pushWhenReady(`/venue/${data.venue_id}`);
  }
}

export function attachNotificationTapHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);

  // A tap that launched the app from closed never reaches the listener above,
  // because it fired before the listener existed. Without this, tapping any
  // notification on a phone that had closed VIIBE opened the home screen and
  // nothing else.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => { if (response) handleResponse(response); })
    .catch(() => { /* none pending */ });

  return () => sub.remove();
}
