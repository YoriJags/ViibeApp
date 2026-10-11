/**
 * useAutoPresenceSync — keeps the phone watching the venues nearest to you.
 *
 * The operating system can only watch a limited number of places (20 on iOS),
 * so the set has to follow the scout around the city. This re-points the
 * geofences whenever the venue list loads and whenever the app comes back to
 * the foreground. `syncWatchedVenues` itself skips the work unless the scout
 * has moved or enough time has passed, so calling it often is cheap.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncWatchedVenues } from '../services/autoPresence';

export function useAutoPresenceSync(venues: any[]) {
  useEffect(() => {
    if (venues?.length) syncWatchedVenues(venues);
  }, [venues?.length]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && venues?.length) syncWatchedVenues(venues);
    });
    return () => sub.remove();
  }, [venues]);
}
