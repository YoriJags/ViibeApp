/**
 * useHapticVelocity
 *
 * Samples accelerometer data continuously and exposes:
 *   - `getIntensity()` — call on tap, returns 'chill' | 'lit' | 'peak' based on G-force
 *   - `fireHaptic(intensity)` — fires the appropriate haptic feedback
 *
 * Accelerometer listener only starts when `enabled` is true (battery-safe).
 * The latest reading is kept in a ref (no re-renders on sensor update).
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

export type TapIntensity = 'chill' | 'lit' | 'peak';

const CHILL_THRESHOLD = 1.5;  // G-force
const PEAK_THRESHOLD  = 2.5;  // G-force
const SAMPLE_RATE_MS  = 16;   // ~60 Hz

interface UseHapticVelocityOptions {
  enabled: boolean;
}

export function useHapticVelocity({ enabled }: UseHapticVelocityOptions) {
  const latestAccel = useRef({ x: 0, y: 0, z: 1 });

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    Accelerometer.setUpdateInterval(SAMPLE_RATE_MS);
    const sub = Accelerometer.addListener(data => {
      latestAccel.current = data;
    });
    return () => sub.remove();
  }, [enabled]);

  const getIntensity = useCallback((): TapIntensity => {
    const { x, y, z } = latestAccel.current;
    const g = Math.sqrt(x * x + y * y + z * z);
    if (g > PEAK_THRESHOLD)  return 'peak';
    if (g > CHILL_THRESHOLD) return 'lit';
    return 'chill';
  }, []);

  const getGForce = useCallback((): number => {
    const { x, y, z } = latestAccel.current;
    return Math.round(Math.sqrt(x * x + y * y + z * z) * 100) / 100;
  }, []);

  const fireHaptic = useCallback((intensity: TapIntensity) => {
    if (Platform.OS === 'web') return;
    switch (intensity) {
      case 'peak': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);  break;
      case 'lit':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      default:     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  break;
    }
  }, []);

  return { getIntensity, getGForce, fireHaptic };
}
