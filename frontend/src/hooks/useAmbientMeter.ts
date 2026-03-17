/**
 * useAmbientMeter
 *
 * Opt-in ambient sound metering. Measures dB level every 30 seconds
 * while a scout is inside a venue. Never records or stores audio —
 * only a numeric sound level is sent to the backend.
 *
 * Only active when:
 *   - isInsideGeofence = true
 *   - hasOptedIn = true (user explicitly enabled in settings)
 */
import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { useVibeStore } from '../store/vibeStore';

const API_URL        = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const SAMPLE_INTERVAL_MS = 30 * 1000; // 30 seconds

export function useAmbientMeter(
  venueId: string,
  isInsideGeofence: boolean,
  hasOptedIn: boolean,
) {
  const sessionToken = useVibeStore(s => s.sessionToken);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMeter = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch { /* already stopped */ }
      recordingRef.current = null;
    }
  };

  const sampleAndSend = async () => {
    if (!recordingRef.current || !sessionToken) return;
    try {
      const status = await recordingRef.current.getStatusAsync();
      if (!status.isRecording) return;
      const db = status.metering ?? -160;
      await fetch(`${API_URL}/api/ambient/ping`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ venue_id: venueId, db_level: db }),
      });
    } catch { /* silent — non-critical */ }
  };

  const startMeter = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.LOW_QUALITY,
          isMeteringEnabled: true,
        },
      );
      recordingRef.current = recording;

      // Sample immediately then on interval
      await sampleAndSend();
      intervalRef.current = setInterval(sampleAndSend, SAMPLE_INTERVAL_MS);
    } catch { /* permission denied or device error */ }
  };

  useEffect(() => {
    if (isInsideGeofence && hasOptedIn) {
      startMeter();
    } else {
      stopMeter();
    }
    return () => { stopMeter(); };
  }, [isInsideGeofence, hasOptedIn, venueId]);
}
