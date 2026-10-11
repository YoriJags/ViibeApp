/**
 * Auto presence — the phone notices when you walk into a venue.
 *
 * Once a scout opts in, the operating system's own geofencing watches the
 * nearest venues and wakes this task when they walk in or out, with the app
 * closed. That makes every installed phone a presence sensor without anyone
 * tapping anything, which is the closest VIIBE gets to how Maps learns about
 * traffic.
 *
 * What it records, and the promise in the permission prompt: arriving at and
 * leaving listed venues. Never where someone goes in between. Presence is
 * evidence of a crowd, not a reading of the room; Energy still comes from
 * people answering. See backend/app/services/presence.py.
 *
 * This module defines the task at import time. It is imported from index.js,
 * before the router, because a geofence event can wake the app with no UI
 * at all, and a task defined inside a screen would never be registered.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { loadSessionToken } from '../store/vibeStore';

export const AUTO_PRESENCE_TASK = 'viibe-auto-presence';

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://vibeapp-production-1835.up.railway.app';

const PREF_KEY = 'viibe_auto_presence';

// iOS allows an app to watch 20 places at once. Android allows 100; we stay
// under it so the OS never silently drops regions.
const MAX_REGIONS = Platform.OS === 'ios' ? 20 : 90;

// Geofences much smaller than this are unreliable on Android, so a tiny
// venue radius is widened rather than producing missed arrivals.
const MIN_RADIUS_M = 100;

// Re-registering regions costs battery. Only re-sync after real movement or
// enough time for the venue list to have changed.
const RESYNC_AFTER_METRES = 1000;
const RESYNC_AFTER_MS = 30 * 60 * 1000;

type Venue = {
  id: string;
  coordinates?: { lat: number; lng: number } | null;
  geofence_radius_m?: number | null;
};

let lastSync: { lat: number; lng: number; at: number } | null = null;

// ─── The task ────────────────────────────────────────────────────────────────

TaskManager.defineTask(AUTO_PRESENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
    region?: Location.LocationRegion;
  };
  const venueId = region?.identifier;
  if (!venueId) return;

  if (eventType === Location.GeofencingEventType.Enter) {
    await report('enter', venueId);
  } else if (eventType === Location.GeofencingEventType.Exit) {
    await report('exit', venueId);
  }
});

async function report(kind: 'enter' | 'exit', venueId: string): Promise<void> {
  try {
    const token = await loadSessionToken();
    if (!token) return; // signed out: nothing to attribute the visit to

    const body: Record<string, unknown> = { venue_id: venueId };
    if (kind === 'enter') {
      // The server only COUNTS an arrival that comes with a position near the
      // venue; without one it is logged as unverified, because a request with
      // no position could have come from anywhere. So try properly: a recent
      // cached fix first, then a fresh one, bounded so a background wake never
      // hangs waiting for GPS.
      const pos = await positionForArrival();
      if (pos) {
        body.lat = pos.coords.latitude;
        body.lng = pos.coords.longitude;
      }
    }

    await fetch(`${API_URL}/api/presence/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    // Best effort. A lost event self-heals: auto check-ins expire on their own.
  }
}

const FRESH_FIX_TIMEOUT_MS = 15 * 1000;

async function positionForArrival(): Promise<Location.LocationObject | null> {
  try {
    const cached = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });
    if (cached) return cached;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FRESH_FIX_TIMEOUT_MS));
    const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return await Promise.race([fresh, timeout]);
  } catch {
    return null;
  }
}

// ─── Choosing which venues to watch ──────────────────────────────────────────

function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** The venues worth watching from here: the nearest ones, within the OS limit. */
export function nearestRegions(
  venues: Venue[],
  lat: number,
  lng: number,
  max: number = MAX_REGIONS,
): Location.LocationRegion[] {
  return venues
    .filter((v) => v.id && v.coordinates && Number.isFinite(v.coordinates.lat))
    .map((v) => ({
      v,
      d: metresBetween(lat, lng, v.coordinates!.lat, v.coordinates!.lng),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ v }) => ({
      identifier: v.id,
      latitude: v.coordinates!.lat,
      longitude: v.coordinates!.lng,
      radius: Math.max(MIN_RADIUS_M, v.geofence_radius_m ?? MIN_RADIUS_M),
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function isAutoPresenceEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === '1';
  } catch {
    return false;
  }
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'foreground' | 'background' | 'error' };

/**
 * Ask for permission and switch it on. Background location is requested only
 * after the person has read why, on our own screen, and chosen to continue.
 */
export async function enableAutoPresence(): Promise<EnableResult> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { ok: false, reason: 'foreground' };

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return { ok: false, reason: 'background' };

    await AsyncStorage.setItem(PREF_KEY, '1');
    lastSync = null; // force the next sync to register regions immediately
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Switch it off and stop watching every venue, immediately. */
export async function disableAutoPresence(): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, '0');
    if (await TaskManager.isTaskRegisteredAsync(AUTO_PRESENCE_TASK)) {
      await Location.stopGeofencingAsync(AUTO_PRESENCE_TASK);
    }
  } catch {
    // Already stopped, or never started.
  }
  lastSync = null;
}

/**
 * Point the geofences at the venues nearest to where the scout is now.
 * Safe to call often: it does nothing unless enabled, permitted, and the scout
 * has moved or enough time has passed.
 */
export async function syncWatchedVenues(venues: Venue[]): Promise<number> {
  try {
    if (!venues?.length || !(await isAutoPresenceEnabled())) return 0;

    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return 0;

    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const { latitude: lat, longitude: lng } = pos.coords;

    const now = Date.now();
    if (
      lastSync &&
      metresBetween(lat, lng, lastSync.lat, lastSync.lng) < RESYNC_AFTER_METRES &&
      now - lastSync.at < RESYNC_AFTER_MS
    ) {
      return 0;
    }

    const regions = nearestRegions(venues, lat, lng);
    if (!regions.length) return 0;

    await Location.startGeofencingAsync(AUTO_PRESENCE_TASK, regions);
    lastSync = { lat, lng, at: now };
    return regions.length;
  } catch {
    return 0;
  }
}
