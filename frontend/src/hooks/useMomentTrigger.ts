/**
 * useMomentTrigger
 *
 * Detects three instinctive gestures and fires a unified MomentTrigger event.
 * Each gesture represents a different state of presence — all produce identical output.
 *
 * Gestures:
 *   shake         — sharp wrist-flick detected via accelerometer spike < 300ms
 *                   works on iOS + Android. Distinguishable from dancing via impulse pattern.
 *   raise_to_face — Z-axis rotation (phone horizontal → vertical) within 500ms
 *                   works on iOS + Android. Hijacks the natural "check the time" motion.
 *   back_tap      — iOS only. Native accessibility shortcut fires a custom URL scheme.
 *                   Requires one-time user setup (guided in onboarding).
 *
 * On trigger:
 *   1. Haptic feedback (Heavy)
 *   2. POSTs to /api/venues/:id/moment with full sensor snapshot
 *   3. Calls onMomentFired() so the UI can react
 *
 * Gated: only active inside geofence + enabled flag.
 * Cooldown: 8 seconds between triggers to prevent accidental double-fires.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ─── Shake detection constants ─────────────────────────────────────────────────
// A deliberate wrist-flick produces a high-amplitude spike across multiple axes
// within a very short window. Dancing produces rhythmic, lower-amplitude patterns.
const SHAKE_THRESHOLD     = 2.8;   // g-force magnitude above this = intentional shake
const SHAKE_WINDOW_MS     = 300;   // spike must resolve within 300ms
const SHAKE_CONFIRM_MS    = 80;    // must stay above threshold for at least 80ms
const SHAKE_AXIS_MIN      = 1.2;   // at least one axis must exceed this (multi-axis check)

// ─── Raise to face constants ───────────────────────────────────────────────────
// Phone goes from roughly horizontal (pocket/hand at side) to vertical (face level).
// We track Z-axis transition: negative Z = face-up horizontal, ~0 = vertical.
const RAISE_Z_START_MAX   = -0.5;  // Z must start below this (phone horizontal/tilted)
const RAISE_Z_END_MIN     =  0.7;  // Z must reach above this (phone raised vertical)
const RAISE_WINDOW_MS     = 600;   // transition must complete within 600ms
const RAISE_SPEED_MIN     = 1.4;   // minimum magnitude change rate (g/s) during raise

// ─── Cooldown ─────────────────────────────────────────────────────────────────
const COOLDOWN_MS = 8000; // 8s between triggers — prevents accidental doubles

export type MomentGesture = 'shake' | 'raise_to_face' | 'back_tap';

export interface MomentTriggerEvent {
  gesture: MomentGesture;
  timestamp: number;
  venue_id: string;
  sensor_snapshot: {
    g_force: number;
    accel_x: number;
    accel_y: number;
    accel_z: number;
  };
}

interface Props {
  venueId: string;
  isInsideGeofence: boolean;
  enabled: boolean;
  onMomentFired: (event: MomentTriggerEvent) => void;
}

export function useMomentTrigger({
  venueId,
  isInsideGeofence,
  enabled,
  onMomentFired,
}: Props) {
  const sessionToken = useVibeStore(s => s.sessionToken);

  const isActive          = isInsideGeofence && enabled;
  const lastTriggerRef    = useRef<number>(0);
  const latestAccelRef    = useRef({ x: 0, y: 0, z: 1 });
  const subRef            = useRef<any>(null);

  // ─── Shake detection state ─────────────────────────────────────────────────
  const shakeStartRef     = useRef<number>(0);
  const shakeActiveRef    = useRef<boolean>(false);

  // ─── Raise to face detection state ────────────────────────────────────────
  const raiseStartRef     = useRef<number>(0);
  const raiseStartZRef    = useRef<number>(0);
  const raiseWatchingRef  = useRef<boolean>(false);

  // ─── Fire the moment ──────────────────────────────────────────────────────

  const fireMoment = useCallback(async (gesture: MomentGesture) => {
    const now = Date.now();
    if (now - lastTriggerRef.current < COOLDOWN_MS) return;
    lastTriggerRef.current = now;

    const { x, y, z } = latestAccelRef.current;
    const g = Math.sqrt(x * x + y * y + z * z);

    // Haptic
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const event: MomentTriggerEvent = {
      gesture,
      timestamp: now,
      venue_id: venueId,
      sensor_snapshot: {
        g_force: Math.round(g * 100) / 100,
        accel_x: Math.round(x * 100) / 100,
        accel_y: Math.round(y * 100) / 100,
        accel_z: Math.round(z * 100) / 100,
      },
    };

    onMomentFired(event);

    // Non-blocking POST to backend
    if (sessionToken) {
      fetch(`${API_URL}/api/venues/${venueId}/moment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(event),
      }).catch(() => {});
    }
  }, [venueId, sessionToken, onMomentFired]);

  // ─── Accelerometer listener ────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) {
      subRef.current?.remove();
      subRef.current = null;
      return;
    }

    Accelerometer.setUpdateInterval(16); // 60Hz

    subRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      latestAccelRef.current = { x, y, z };
      const g = Math.sqrt(x * x + y * y + z * z);

      // ── Shake detection ──────────────────────────────────────────────────
      // High G-force spike: at least one axis must be high (multi-axis check),
      // must sustain for SHAKE_CONFIRM_MS but resolve within SHAKE_WINDOW_MS.
      const isHighG = g > SHAKE_THRESHOLD;
      const isMultiAxis = Math.abs(x) > SHAKE_AXIS_MIN || Math.abs(y) > SHAKE_AXIS_MIN;

      if (isHighG && isMultiAxis && !shakeActiveRef.current) {
        shakeActiveRef.current = true;
        shakeStartRef.current  = now;
      } else if (shakeActiveRef.current) {
        const duration = now - shakeStartRef.current;
        if (!isHighG) {
          // Spike ended — check it was deliberate (not just noise)
          if (duration >= SHAKE_CONFIRM_MS && duration <= SHAKE_WINDOW_MS) {
            fireMoment('shake');
          }
          shakeActiveRef.current = false;
        } else if (duration > SHAKE_WINDOW_MS) {
          // Too long — sustained motion, not a flick (e.g. walking fast)
          shakeActiveRef.current = false;
        }
      }

      // ── Raise to face detection ──────────────────────────────────────────
      // Watch for phone transitioning from horizontal to vertical rapidly.
      // In pocket/side: Z is near -1 (gravity along Z). Raised to face: Z near 0.
      if (!raiseWatchingRef.current && z < RAISE_Z_START_MAX) {
        raiseWatchingRef.current = true;
        raiseStartRef.current    = now;
        raiseStartZRef.current   = z;
      } else if (raiseWatchingRef.current) {
        const elapsed   = now - raiseStartRef.current;
        const zDelta    = z - raiseStartZRef.current;
        const zSpeed    = Math.abs(zDelta) / (elapsed / 1000); // g/s

        if (z > RAISE_Z_END_MIN && zSpeed >= RAISE_SPEED_MIN && elapsed <= RAISE_WINDOW_MS) {
          fireMoment('raise_to_face');
          raiseWatchingRef.current = false;
        } else if (elapsed > RAISE_WINDOW_MS || z < RAISE_Z_START_MAX) {
          // Too slow, too long, or Z went back down — reset
          raiseWatchingRef.current = false;
        }
      }
    });

    return () => {
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [isActive, fireMoment]);

  // ─── Back Tap (iOS) — URL scheme listener ─────────────────────────────────
  // User configures iOS Settings > Accessibility > Touch > Back Tap → Open URL
  // pointing to viibe://moment. We listen for that URL here.

  useEffect(() => {
    if (Platform.OS !== 'ios' || !isActive) return;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url === 'viibe://moment') {
        fireMoment('back_tap');
      }
    });

    return () => subscription.remove();
  }, [isActive, fireMoment]);
}
