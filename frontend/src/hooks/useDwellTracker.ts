/**
 * useDwellTracker
 *
 * Sends a heartbeat ping to the backend every 5 minutes while a scout
 * is inside a venue's geofence. The backend uses these pings to compute
 * dwell time (how long scouts actually stay at the venue).
 *
 * Starts automatically when isInsideGeofence = true.
 * Stops and cleans up when the component unmounts or geofence exits.
 */
import { useEffect, useRef } from 'react';
import { useVibeStore } from '../store/vibeStore';

const API_URL     = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDwellTracker(venueId: string, isInsideGeofence: boolean) {
  const sessionToken = useVibeStore(s => s.sessionToken);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendPing = async () => {
    if (!sessionToken || !venueId) return;
    try {
      await fetch(`${API_URL}/api/dwell/ping`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ venue_id: venueId }),
      });
    } catch {
      // Silent — network failure on ping is non-critical
    }
  };

  useEffect(() => {
    if (!isInsideGeofence) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send immediately on entry, then every 5 minutes
    sendPing();
    intervalRef.current = setInterval(sendPing, PING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isInsideGeofence, venueId]);
}
