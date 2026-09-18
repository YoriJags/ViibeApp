/**
 * VIIBE Store — Nervous System Architecture
 *
 * Combined Zustand store composed from domain slices:
 *   authSlice   — user identity, subscriptions, demo mode
 *   venueSlice  — venues, lobby, stories, campaigns, following
 *   scoutSlice  — gamification: checkins, crews, streaks, city energy
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
import type { SensorPrefs } from './types';
// ─── Combined store type ──────────────────────────────────────────────────────
type SensorPrefsSlice = {
  sensorPrefs: SensorPrefs;
  setSensorPrefs: (prefs: Partial<SensorPrefs>) => void;
};
export type VibeStore = AuthSlice & VenueSlice & ScoutSlice & SocketSlice & SensorPrefsSlice;

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

      // Bump this whenever a persisted value's MEANING changes, not just its
      // shape. Installing a new build over an old one keeps everything in
      // `partialize` below, so a renamed enum (an energy state, a surge level,
      // a heat level) can arrive from last month's storage and miss every
      // lookup written against the new names. Version 2 is the vocabulary
      // rename: Signal Density, City Energy, Room-meter levels, Tonight's Heat.
      version: 2,
      migrate: (persisted: any, fromVersion: number) => {
        if (!persisted) return persisted;
        if (fromVersion >= 2) return persisted;

        // Keep only what is safe across the rename: identity and the flags that
        // decide which screen opens. Everything else is cheap to refetch and
        // was written in a vocabulary this build no longer understands.
        return {
          user: persisted.user,
          isAuthenticated: persisted.isAuthenticated,
          hasSeenOnboarding: persisted.hasSeenOnboarding,
          hasSeenMerchantOnboarding: persisted.hasSeenMerchantOnboarding,
          hasSeenDemoTutorial: persisted.hasSeenDemoTutorial,
          hasSeenAppTutorial: persisted.hasSeenAppTutorial,
          avatarConfig: persisted.avatarConfig,
          locationSharingEnabled: persisted.locationSharingEnabled,
          userMode: persisted.userMode,
          selectedCity: persisted.selectedCity,
          sensorPrefs: persisted.sensorPrefs,
          // Deliberately dropped: isDemoMode, vibePersona, sceneMood,
          // sceneMoodSetAt, pendingRatings. Each either carries an old
          // vocabulary value or is safely rebuilt on next launch.
          isDemoMode: false,
          pendingRatings: [],
        };
      },
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
  CityEnergyData, CityEnergyLabel, VibeSignature,
  VenueAffinity, VibeDNA,
  NightPhase,
} from './types';

export { getNightPhase } from './types';
