/**
 * useKineticSensor
 *
 * Passively detects physical movement BPM from the phone's accelerometer.
 * No tap required. No permissions required.
 *
 * How it works:
 *   1. Samples accelerometer at 60Hz (16ms interval)
 *   2. Computes magnitude: g = sqrt(x² + y² + z²)
 *   3. High-pass filters to remove gravity (subtracts rolling 40-sample mean)
 *   4. Peak detection on filtered signal — identifies rhythmic body bounces
 *   5. Inter-peak intervals → BPM
 *   6. Sends movementBpm + movementEnergy to backend every 30 seconds
 *
 * Only active when:
 *   - isInsideGeofence = true
 *   - enabled = true (user opted in from ScoutSensorsScreen)
 *
 * Battery notes (shown to user):
 *   - Accelerometer at 60Hz: ~2–4% battery per hour (same as most fitness apps)
 *   - Auto-pauses outside geofence
 *   - No GPS. No network during sampling — only the 30s ping uses data.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';
import { useVibeStore } from '../store/vibeStore';

const API_URL          = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const SAMPLE_RATE_MS   = 16;          // ~60Hz
const GRAVITY_WINDOW   = 40;          // samples for rolling mean (high-pass filter)
const PEAK_MIN_GAP_MS  = 250;         // minimum 250ms between peaks (max 240 BPM)
const PEAK_THRESHOLD   = 0.18;        // filtered magnitude must exceed this to count as peak
const BPM_WINDOW       = 8;           // last 8 inter-peak intervals for BPM calculation
const SEND_INTERVAL_MS = 30 * 1000;   // send to backend every 30 seconds
const MIN_PEAKS        = 4;           // need at least 4 peaks before reporting BPM

export interface KineticSensorResult {
  movementBpm: number;          // 0 if not enough data
  movementEnergy: number;       // 0–100 magnitude of movement intensity
  isActive: boolean;            // true when sensor is running
  isDancing: boolean;           // true when BPM in 80–180 range and energy > 30
}

export function useKineticSensor(
  venueId: string,
  isInsideGeofence: boolean,
  enabled: boolean,
): KineticSensorResult {
  const sessionToken = useVibeStore(s => s.sessionToken);

  const [movementBpm,    setMovementBpm]    = useState(0);
  const [movementEnergy, setMovementEnergy] = useState(0);
  const [isActive,       setIsActive]       = useState(false);
  const [isDancing,      setIsDancing]      = useState(false);

  // Rolling buffer for high-pass filter
  const gravityBufRef   = useRef<number[]>([]);
  // Filtered magnitude history for peak detection
  const filteredBufRef  = useRef<number[]>([]);
  // Timestamps of detected peaks
  const peakTimesRef    = useRef<number[]>([]);
  // Inter-peak intervals (ms)
  const intervalsRef    = useRef<number[]>([]);
  // Last peak timestamp
  const lastPeakRef     = useRef<number>(0);

  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef          = useRef<any>(null);

  // Compute BPM from recent inter-peak intervals
  const computeBpm = useCallback((): number => {
    const intervals = intervalsRef.current.slice(-BPM_WINDOW);
    if (intervals.length < MIN_PEAKS - 1) return 0;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean <= 0) return 0;
    return Math.round(60_000 / mean);
  }, []);

  const sendPing = useCallback(async (bpm: number, energy: number) => {
    if (!sessionToken || bpm === 0) return;
    try {
      await fetch(`${API_URL}/api/kinetic/ping`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          venue_id:        venueId,
          movement_bpm:    bpm,
          movement_energy: energy,
        }),
      });
    } catch { /* silent — non-critical */ }
  }, [sessionToken, venueId]);

  const startSensor = useCallback(() => {
    if (subRef.current) return; // already running

    gravityBufRef.current  = [];
    filteredBufRef.current = [];
    peakTimesRef.current   = [];
    intervalsRef.current   = [];
    lastPeakRef.current    = 0;

    Accelerometer.setUpdateInterval(SAMPLE_RATE_MS);

    subRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      const raw = Math.sqrt(x * x + y * y + z * z);

      // Rolling mean for gravity removal (high-pass)
      const buf = gravityBufRef.current;
      buf.push(raw);
      if (buf.length > GRAVITY_WINDOW) buf.shift();
      const mean     = buf.reduce((a, b) => a + b, 0) / buf.length;
      const filtered = Math.abs(raw - mean);

      // Keep a short window of filtered values for peak detection
      const fbuf = filteredBufRef.current;
      fbuf.push(filtered);
      if (fbuf.length > 5) fbuf.shift();

      // Peak detection — local maxima above threshold with minimum gap
      if (
        filtered > PEAK_THRESHOLD &&
        filtered === Math.max(...fbuf) &&
        now - lastPeakRef.current > PEAK_MIN_GAP_MS
      ) {
        if (lastPeakRef.current > 0) {
          const interval = now - lastPeakRef.current;
          intervalsRef.current.push(interval);
          if (intervalsRef.current.length > BPM_WINDOW) {
            intervalsRef.current.shift();
          }
        }
        lastPeakRef.current = now;
      }

      // Compute energy (rolling RMS of filtered magnitude, 0–100)
      const energy = Math.min(100, Math.round(filtered * 200));

      const bpm = computeBpm();
      setMovementBpm(bpm);
      setMovementEnergy(energy);
      setIsDancing(bpm >= 80 && bpm <= 180 && energy > 30);
    });

    setIsActive(true);

    // Periodic send
    sendIntervalRef.current = setInterval(() => {
      const bpm    = computeBpm();
      const energy = movementEnergy;
      sendPing(bpm, energy);
    }, SEND_INTERVAL_MS);

  }, [computeBpm, sendPing, movementEnergy]);

  const stopSensor = useCallback(() => {
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    setIsActive(false);
    setMovementBpm(0);
    setMovementEnergy(0);
    setIsDancing(false);
  }, []);

  useEffect(() => {
    if (isInsideGeofence && enabled) {
      startSensor();
    } else {
      stopSensor();
    }
    return stopSensor;
  }, [isInsideGeofence, enabled]);

  return { movementBpm, movementEnergy, isActive, isDancing };
}
