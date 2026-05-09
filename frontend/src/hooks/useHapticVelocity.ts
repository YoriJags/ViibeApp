/**
 * useHapticVelocity — VIIBE kinetic signal processor
 *
 * Samples the accelerometer at ~60Hz and outputs a stabilised G-force impulse
 * (the user's actual motion, with gravity removed and jitter smoothed).
 *
 * Pipeline per sample (every ~16ms):
 *   1. raw magnitude       = ‖(x,y,z)‖
 *   2. gravity baseline    = slow EMA (α_g = 0.02 → ~0.8s settle)
 *   3. impulse             = |raw - baseline|
 *   4. fast EMA            = α_f = 0.35  (kills single-frame spikes)
 *   5. weighted MA (N=4)   = recency-biased for classification stability
 *
 * Consumers call `getIntensity()` on tap (reads latest smoothed impulse),
 * and `getGForce()` for the same number in gs. `getRawSignal()` exposes the
 * live-updating ref for the Skia/Reanimated visualiser (no re-renders).
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

export type TapIntensity = 'chill' | 'lit' | 'peak';

// Thresholds are now on the *impulse* (gravity-removed), not raw magnitude.
// Empirically: a firm wrist flick ≈ 0.6g impulse, a fist-pump ≈ 1.4g.
const CHILL_THRESHOLD = 0.35;
const PEAK_THRESHOLD  = 1.10;
const SAMPLE_RATE_MS  = 16;

const ALPHA_GRAVITY = 0.02;   // slow — tracks orientation, ignores motion
const ALPHA_FAST    = 0.35;   // fast — smooths per-frame jitter
const WMA_WINDOW    = 4;      // ~64ms trailing window
const WMA_WEIGHTS   = [1, 2, 3, 4];  // recency-biased, sum = 10

interface SignalState {
  raw: number;        // latest raw magnitude (includes gravity)
  baseline: number;   // slow EMA — gravity estimate
  impulse: number;    // |raw - baseline|, fast-EMA smoothed
  peakImpulse: number; // sliding-window max (for Oscillator visual drive)
}

interface UseHapticVelocityOptions {
  enabled: boolean;
}

export function useHapticVelocity({ enabled }: UseHapticVelocityOptions) {
  const signal = useRef<SignalState>({ raw: 1, baseline: 1, impulse: 0, peakImpulse: 0 });
  const window = useRef<number[]>([]);
  const peakDecay = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    Accelerometer.setUpdateInterval(SAMPLE_RATE_MS);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const raw = Math.sqrt(x * x + y * y + z * z);

      // Gravity baseline (slow EMA)
      const baseline = signal.current.baseline + ALPHA_GRAVITY * (raw - signal.current.baseline);

      // Raw impulse, then fast EMA to remove single-frame jitter
      const rawImpulse = Math.abs(raw - baseline);
      const smoothed   = signal.current.impulse + ALPHA_FAST * (rawImpulse - signal.current.impulse);

      // Sliding peak with gradual decay (drives Oscillator amplitude)
      peakDecay.current = Math.max(smoothed, peakDecay.current * 0.92);

      // Trailing weighted window — what getIntensity reads
      const win = window.current;
      win.push(smoothed);
      if (win.length > WMA_WINDOW) win.shift();

      signal.current = {
        raw,
        baseline,
        impulse: smoothed,
        peakImpulse: peakDecay.current,
      };
    });
    return () => sub.remove();
  }, [enabled]);

  // Weighted moving average of the trailing impulse window
  const getSmoothedImpulse = useCallback((): number => {
    const win = window.current;
    if (win.length === 0) return 0;
    let sum = 0, wsum = 0;
    for (let i = 0; i < win.length; i++) {
      const w = WMA_WEIGHTS[WMA_WEIGHTS.length - win.length + i] ?? 1;
      sum  += win[i] * w;
      wsum += w;
    }
    return sum / wsum;
  }, []);

  const getIntensity = useCallback((): TapIntensity => {
    const g = getSmoothedImpulse();
    if (g > PEAK_THRESHOLD)  return 'peak';
    if (g > CHILL_THRESHOLD) return 'lit';
    return 'chill';
  }, [getSmoothedImpulse]);

  // Returned in gs (gravity removed). Backend fraud guard still uses this.
  const getGForce = useCallback((): number => {
    return Math.round(getSmoothedImpulse() * 100) / 100;
  }, [getSmoothedImpulse]);

  // Live ref for Skia/Reanimated consumers — read in worklets via runOnUI.
  // Do NOT put this into React state; it ticks at 60Hz.
  const getRawSignal = useCallback(() => signal.current, []);

  const fireHaptic = useCallback((intensity: TapIntensity) => {
    if (Platform.OS === 'web') return;
    switch (intensity) {
      case 'peak':
        // Pro-level: layered haptic sequence tied to Reactor output.
        // Heavy impact → 60ms gap → notification success = "felt" peak lock.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 60);
        break;
      case 'lit':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      default:
        Haptics.selectionAsync(); // tighter than Light — less battery
        break;
    }
  }, []);

  return { getIntensity, getGForce, getRawSignal, fireHaptic };
}
