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
    }),
    {
      name: 'vibe-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Auth
        user: state.user,
        sessionToken: state.sessionToken,
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
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
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
