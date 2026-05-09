/**
 * VIIBE Store — Nervous System Architecture
 *
 * Combined Zustand store composed from domain slices:
 *   authSlice   — user identity, subscriptions, demo mode
 *   venueSlice  — venues, lobby, stories, campaigns, following
 *   scoutSlice  — gamification: checkins, crews, streaks, city pulse
 *   socketSlice — real-time socket, geofence HUD, online state
 *
 * All existing imports (useVibeStore, types, helpers) remain unchanged.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Session token must never be stored in AsyncStorage (unencrypted, accessible on rooted devices).
// Use SecureStore for the token; AsyncStorage is fine for non-sensitive preferences.
const SESSION_TOKEN_KEY = 'viibe_session_token';
export const saveSessionToken = (token: string) => SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
export const loadSessionToken = () => SecureStore.getItemAsync(SESSION_TOKEN_KEY);
export const deleteSessionToken = () => SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);

import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createVenueSlice, VenueSlice } from './slices/venueSlice';
import { createScoutSlice, ScoutSlice } from './slices/scoutSlice';
import { createSocketSlice, SocketSlice } from './slices/socketSlice';
// ─── Combined store type ──────────────────────────────────────────────────────
export type VibeStore = AuthSlice & VenueSlice & ScoutSlice & SocketSlice;

// ─── Store ────────────────────────────────────────────────────────────────────
export const useVibeStore = create<VibeStore>()(
  persist(
    (set, get, api) => ({
      ...createAuthSlice(set, get, api),
      ...createVenueSlice(set, get, api),
      ...createScoutSlice(set, get, api),
      ...createSocketSlice(set, get, api),

      // Sensor preferences
      sensorPrefs: { ambientSound: false, kineticMovement: false, bleDensity: false } as import('./types').SensorPrefs,
      setSensorPrefs: (prefs: Partial<import('./types').SensorPrefs>) =>
        set(state => ({ sensorPrefs: { ...(state as any).sensorPrefs, ...prefs } })),
    }),
    {
      name: 'vibe-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Auth
        user: state.user,
        // sessionToken intentionally excluded — stored in SecureStore, not AsyncStorage
        isAuthenticated: state.isAuthenticated,
        hasSeenOnboarding: state.hasSeenOnboarding,
        hasSeenMerchantOnboarding: state.hasSeenMerchantOnboarding,
        isDemoMode: state.isDemoMode,
        hasSeenDemoTutorial: state.hasSeenDemoTutorial,
        avatarConfig: state.avatarConfig,
        locationSharingEnabled: state.locationSharingEnabled,
        vibePersona: state.vibePersona,
        userMode: state.userMode,
        sceneMood: state.sceneMood,
        sceneMoodSetAt: state.sceneMoodSetAt,
        // Venue
        selectedCity: state.selectedCity,
        // Scout
        pendingRatings: state.pendingRatings,
        // Tutorial
        hasSeenAppTutorial: state.hasSeenAppTutorial,
        sensorPrefs: state.sensorPrefs,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          // Restore session token from SecureStore on app launch
          loadSessionToken().then(token => {
            if (token) state.setSessionToken(token);
          });
          if (state.user?.id) state.fetchUser();
        }
      },
    }
  )
);

// ─── Re-exports for backwards compatibility ───────────────────────────────────
export type { AuthSlice, VenueSlice, ScoutSlice, SocketSlice };

// Types used directly by components
export type {
  Venue, User, City, Coordinates,
  PendingRating, PulseDrop, StreakData, ActiveCheckin,
  StoryListItem, TimelinePoint, Crew, CrewMember,
  CrewMemberLocation, CrewVote, AlertPrefs, ActiveCampaign,
  LobbyVenue, LobbyNudge, LivePush,
  CityPulseData, CityPulseLabel, VibeSignature,
  VenueAffinity, VibeDNA,
  NightPhase,
} from './types';

export { getNightPhase } from './types';
