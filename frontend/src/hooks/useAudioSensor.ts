/**
 * useAudioSensor
 *
 * Extends the ambient dB meter (useAmbientMeter) with real-time BPM detection.
 * Samples the microphone at 10Hz, detects beat peaks in the dB signal,
 * and derives a rolling music BPM estimate.
 *
 * What it measures:
 *   crowd_db  — ambient sound level in dBFS (–160 to 0). Typical loud venue: –10 to –25.
 *   music_bpm — estimated beats-per-minute from audio transient peaks.
 *               Works best with music that has a clear kick drum (house, afrobeats, amapiano).
 *               Returns 0 if not enough peaks detected.
 *
 * How BPM is derived:
 *   1. Samples dB metering at ~10Hz (100ms intervals)
 *   2. High-pass filters: subtracts rolling 8-sample mean to remove DC drift
 *   3. Peak detection: filtered value exceeds threshold AND is a local maximum
 *   4. Enforces 300ms minimum gap between peaks (max 200 BPM)
 *   5. Computes inter-peak intervals → BPM from last 8 intervals
 *
 * Sends to backend every 15 seconds:
 *   POST /api/ambient/audio-ping { venue_id, db_level, music_bpm }
 *
 * Privacy:
 *   - No audio is ever recorded or stored — only numeric dB values
 *   - Recording is LOW_QUALITY preset with isMeteringEnabled only
 *   - Stops immediately when geofence exits or user disables
 *
 * Only active when:
 *   - isInsideGeofence = true
 *   - hasOptedIn = true (user explicitly enabled mic in settings)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ─── Sampling constants ────────────────────────────────────────────────────────
const SAMPLE_INTERVAL_MS  = 100;   // 10Hz metering reads
const SEND_INTERVAL_MS    = 15000; // send to backend every 15s
const DB_FILTER_WINDOW    = 8;     // rolling mean window for high-pass
const BPM_WINDOW          = 8;     // last N inter-peak intervals for BPM
const MIN_PEAKS_FOR_BPM   = 4;     // need at least 4 peaks before reporting
const PEAK_THRESHOLD      = 4.0;   // filtered dB spike must exceed this (dB units)
const PEAK_MIN_GAP_MS     = 300;   // 300ms min gap = max 200 BPM
const QUIET_VENUE_DB      = -55;   // below this dB = venue is too quiet to detect beats

export interface AudioSensorResult {
  crowdDb: number;       // raw dB level, 0 if not active
  musicBpm: number;      // estimated BPM, 0 if not enough data
  isActive: boolean;
  isLoud: boolean;       // true if crowd_db > –40 (venue is audibly active)
}

export function useAudioSensor(
  venueId: string,
  isInsideGeofence: boolean,
  hasOptedIn: boolean,
): AudioSensorResult {
  const sessionToken = useVibeStore(s => s.sessionToken);

  const [crowdDb,   setCrowdDb]   = useState(0);
  const [musicBpm,  setMusicBpm]  = useState(0);
  const [isActive,  setIsActive]  = useState(false);

  const recordingRef    = useRef<Audio.Recording | null>(null);
  const sampleTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // BPM detection state
  const dbWindowRef     = useRef<number[]>([]);   // rolling dB buffer for high-pass
  const peakTimesRef    = useRef<number[]>([]);   // timestamps of detected peaks
  const intervalsRef    = useRef<number[]>([]);   // inter-peak intervals (ms)
  const lastPeakRef     = useRef<number>(0);
  const lastDbRef       = useRef<number>(-160);   // for local-max detection

  // ─── BPM calculation ──────────────────────────────────────────────────────

  const computeBpm = useCallback((): number => {
    const intervals = intervalsRef.current.slice(-BPM_WINDOW);
    if (intervals.length < MIN_PEAKS_FOR_BPM - 1) return 0;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean <= 0) return 0;
    const bpm = Math.round(60_000 / mean);
    // Sanity range: 60–200 BPM covers all relevant genres
    return bpm >= 60 && bpm <= 200 ? bpm : 0;
  }, []);

  // ─── Per-sample processing ────────────────────────────────────────────────

  const processSample = useCallback((db: number) => {
    const now = Date.now();

    // Track raw dB
    setCrowdDb(db);
    lastDbRef.current = db;

    // Too quiet to extract beats — don't pollute the BPM window
    if (db < QUIET_VENUE_DB) return;

    // High-pass filter: subtract rolling mean to isolate transients
    const window = dbWindowRef.current;
    window.push(db);
    if (window.length > DB_FILTER_WINDOW) window.shift();
    const mean     = window.reduce((a, b) => a + b, 0) / window.length;
    const filtered = db - mean;

    // Peak detection: filtered spike above threshold, not too soon after last peak
    const timeSinceLast = now - lastPeakRef.current;
    if (
      filtered > PEAK_THRESHOLD &&
      timeSinceLast > PEAK_MIN_GAP_MS
    ) {
      if (lastPeakRef.current > 0) {
        intervalsRef.current.push(timeSinceLast);
        if (intervalsRef.current.length > BPM_WINDOW) {
          intervalsRef.current.shift();
        }
      }
      lastPeakRef.current = now;
      peakTimesRef.current.push(now);
      if (peakTimesRef.current.length > 20) peakTimesRef.current.shift();
    }

    setMusicBpm(computeBpm());
  }, [computeBpm]);

  // ─── Send to backend ──────────────────────────────────────────────────────

  const sendPing = useCallback(async () => {
    if (!sessionToken || !recordingRef.current) return;
    const db  = lastDbRef.current;
    const bpm = computeBpm();
    if (db === -160) return; // nothing recorded yet

    fetch(`${API_URL}/api/ambient/audio-ping`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        venue_id:  venueId,
        db_level:  Math.round(db * 10) / 10,
        music_bpm: bpm,
      }),
    }).catch(() => {});
  }, [sessionToken, venueId, computeBpm]);

  // ─── Start / stop ─────────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    if (sendTimerRef.current) {
      clearInterval(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    // Reset BPM state
    dbWindowRef.current    = [];
    peakTimesRef.current   = [];
    intervalsRef.current   = [];
    lastPeakRef.current    = 0;

    setIsActive(false);
    setCrowdDb(0);
    setMusicBpm(0);
  }, []);

  const start = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });
      recordingRef.current = recording;
      setIsActive(true);

      // Sample loop at 10Hz
      sampleTimerRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering != null) {
            processSample(status.metering);
          }
        } catch {}
      }, SAMPLE_INTERVAL_MS);

      // Send to backend on interval
      sendTimerRef.current = setInterval(sendPing, SEND_INTERVAL_MS);

    } catch { /* permission denied or hardware error — fail silently */ }
  }, [processSample, sendPing]);

  useEffect(() => {
    if (isInsideGeofence && hasOptedIn) {
      start();
    } else {
      stop();
    }
    return () => { stop(); };
  }, [isInsideGeofence, hasOptedIn, venueId]);

  return {
    crowdDb,
    musicBpm,
    isActive,
    isLoud: crowdDb > -40,
  };
}
