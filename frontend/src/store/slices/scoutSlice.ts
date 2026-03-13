import { StateCreator } from 'zustand';
import {
  PendingRating, PulseDrop, StreakData, ActiveCheckin,
  Crew, CrewMemberLocation, CrewVote, VibeDNA, CityPulseData,
} from '../types';
import type { VibeStore } from '../vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface ScoutSlice {
  // ── State ────────────────────────────────────────────────────────────────────
  pendingRatings: PendingRating[];
  pulseDrops: PulseDrop[];
  streak: StreakData | null;
  activeCheckin: ActiveCheckin | null;
  venueCheckinCount: number;
  crew: Crew | null;
  activeVote: CrewVote | null;
  crewLocations: CrewMemberLocation[];
  ghostMode: boolean;
  vibeDNA: VibeDNA | null;
  cityPulse: CityPulseData | null;
  demoRatedVenues: Record<string, number>;
  demoPulsedVenues: Record<string, number>;

  // ── Actions ──────────────────────────────────────────────────────────────────
  addPendingRating: (rating: PendingRating) => void;
  syncPendingRatings: () => Promise<void>;
  cooldownSkip: (venueId: string, method: 'clout' | 'payment') => Promise<{ success: boolean; clout_remaining?: number; error?: string }>;
  fetchStreak: () => Promise<void>;
  ghostCheckIn: (venueId: string, lat: number, lng: number) => Promise<any>;
  ghostCheckOut: (venueId: string) => Promise<void>;
  fetchActiveCheckin: () => Promise<void>;
  fetchVenueCheckins: (venueId: string) => Promise<void>;
  createCrew: (name: string) => Promise<any>;
  joinCrew: (inviteCode: string) => Promise<any>;
  fetchCrew: () => Promise<void>;
  leaveCrew: (crewId: string) => Promise<void>;
  startVote: (crewId: string, venueIds: string[]) => Promise<any>;
  castVote: (crewId: string, voteId: string, venueId: string) => Promise<void>;
  fetchCrewLocations: (crewId: string) => Promise<void>;
  toggleGhostMode: () => void;
  fetchVibeDNA: (userId: string) => Promise<void>;
  fetchCityPulse: (city: string) => Promise<void>;
  dropQuickPulse: (venueId: string, lat: number, lng: number) => Promise<{ success: boolean; clout_earned?: number }>;
}

export const createScoutSlice: StateCreator<
  VibeStore,
  [['zustand/persist', unknown]],
  [],
  ScoutSlice
> = (set, get) => ({
  pendingRatings: [],
  pulseDrops: [],
  streak: null,
  activeCheckin: null,
  venueCheckinCount: 0,
  crew: null,
  activeVote: null,
  crewLocations: [],
  ghostMode: false,
  vibeDNA: null,
  cityPulse: null,
  demoRatedVenues: {},
  demoPulsedVenues: {},

  addPendingRating: (rating) =>
    set((state) => ({ pendingRatings: [...state.pendingRatings, rating] })),

  syncPendingRatings: async () => {
    const { pendingRatings, user } = get();
    if (!user || pendingRatings.length === 0) return;
    try {
      const response = await fetch(`${API_URL}/api/ratings/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings: pendingRatings.map((r) => ({ ...r, user_id: user.id, offline_id: r.id })) }),
      });
      if (response.ok) {
        set({ pendingRatings: [] });
        get().fetchVenues();
      }
    } catch {}
  },

  cooldownSkip: async (venueId, method) => {
    const { user, getAuthHeaders, isDemoMode } = get();
    if (!user) return { success: false, error: 'Not authenticated' };
    if (isDemoMode) {
      set((state) => {
        const updated = { ...state.demoRatedVenues };
        delete updated[venueId];
        return { demoRatedVenues: updated };
      });
      return { success: true, clout_remaining: user.clout_points - (method === 'clout' ? 50 : 0) };
    }
    try {
      const response = await fetch(`${API_URL}/api/ratings/skip-cooldown`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: user.id, venue_id: venueId, method }),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.detail };
      if (method === 'clout' && data.clout_remaining !== undefined) {
        set((state) => ({ user: state.user ? { ...state.user, clout_points: data.clout_remaining } : state.user }));
      }
      return { success: true, clout_remaining: data.clout_remaining };
    } catch { return { success: false, error: 'Network error' }; }
  },

  fetchStreak: async () => {
    const { getAuthHeaders, isAuthenticated } = get();
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/api/streaks/me`, { headers: getAuthHeaders() });
      if (response.ok) set({ streak: await response.json() });
    } catch {}
  },

  ghostCheckIn: async (venueId, lat, lng) => {
    const { getAuthHeaders, isDemoMode, venues } = get();
    if (isDemoMode) {
      const venue = venues.find((v) => v.id === venueId);
      const checkin = { user_id: 'demo_user_001', venue_id: venueId, venue_name: venue?.name || 'Demo Venue', status: 'active', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() };
      set({ activeCheckin: checkin });
      return { success: true, checkin };
    }
    try {
      let batteryLevel: number | undefined;
      try { const Battery = require('expo-battery'); batteryLevel = await Battery.getBatteryLevelAsync(); } catch {}
      const response = await fetch(`${API_URL}/api/checkins`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ venue_id: venueId, lat, lng, latitude: lat, longitude: lng, battery_level: batteryLevel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Check-in failed');
      get().fetchActiveCheckin();
      return data;
    } catch (error) { console.error('Error checking in:', error); throw error; }
  },

  ghostCheckOut: async (venueId) => {
    const { getAuthHeaders, isDemoMode } = get();
    if (isDemoMode) { set({ activeCheckin: null }); return; }
    try {
      await fetch(`${API_URL}/api/checkins/${venueId}`, { method: 'DELETE', headers: getAuthHeaders() });
      set({ activeCheckin: null });
    } catch {}
  },

  fetchActiveCheckin: async () => {
    const { getAuthHeaders, isAuthenticated, isDemoMode } = get();
    if (!isAuthenticated || isDemoMode) { set({ activeCheckin: null }); return; }
    try {
      const response = await fetch(`${API_URL}/api/checkins/me`, { headers: getAuthHeaders() });
      if (response.ok) set({ activeCheckin: (await response.json()).checkin || null });
    } catch {}
  },

  fetchVenueCheckins: async (venueId) => {
    if (get().isDemoMode) { set({ venueCheckinCount: Math.floor(Math.random() * 30) + 5 }); return; }
    try {
      const response = await fetch(`${API_URL}/api/checkins/venue/${venueId}`);
      if (response.ok) set({ venueCheckinCount: (await response.json()).active_count || 0 });
    } catch {}
  },

  createCrew: async (name) => {
    const { getAuthHeaders } = get();
    const response = await fetch(`${API_URL}/api/crews`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to create crew');
    get().fetchCrew();
    return data;
  },

  joinCrew: async (inviteCode) => {
    const { getAuthHeaders } = get();
    const response = await fetch(`${API_URL}/api/crews/join`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ invite_code: inviteCode }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to join crew');
    get().fetchCrew();
    return data;
  },

  fetchCrew: async () => {
    const { getAuthHeaders, isAuthenticated } = get();
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/api/crews/me`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        set({ crew: data.crew || null, activeVote: data.crew?.active_vote || null });
      }
    } catch {}
  },

  leaveCrew: async (crewId) => {
    const { getAuthHeaders } = get();
    try {
      await fetch(`${API_URL}/api/crews/${crewId}/leave`, { method: 'DELETE', headers: getAuthHeaders() });
      set({ crew: null, activeVote: null });
    } catch {}
  },

  startVote: async (crewId, venueIds) => {
    const { getAuthHeaders } = get();
    const response = await fetch(`${API_URL}/api/crews/${crewId}/vote`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ venue_ids: venueIds }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to start vote');
    get().fetchCrew();
    return data;
  },

  castVote: async (crewId, voteId, venueId) => {
    const { getAuthHeaders } = get();
    const response = await fetch(`${API_URL}/api/crews/${crewId}/vote/${voteId}/cast`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ venue_id: venueId }) });
    if (!response.ok) { const data = await response.json(); throw new Error(data.detail || 'Failed to cast vote'); }
    get().fetchCrew();
  },

  fetchCrewLocations: async (crewId) => {
    const { getAuthHeaders, isDemoMode } = get();
    if (isDemoMode) {
      const { DEMO_CREW_LOCATIONS } = require('../../data/demoData');
      set({ crewLocations: DEMO_CREW_LOCATIONS });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/crews/${crewId}/locations`, { headers: getAuthHeaders() });
      if (response.ok) set({ crewLocations: (await response.json()) || [] });
    } catch {}
  },

  toggleGhostMode: () => set((state) => ({ ghostMode: !state.ghostMode })),

  fetchVibeDNA: async (userId) => {
    const { isDemoMode, getAuthHeaders } = get();
    if (isDemoMode) {
      const { DEMO_VIBE_DNA } = require('../../data/demoData');
      set({ vibeDNA: DEMO_VIBE_DNA });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/dna`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.affinities)) set({ vibeDNA: data });
      }
    } catch {}
  },

  fetchCityPulse: async (city) => {
    const { isDemoMode } = get();
    if (isDemoMode) {
      const { DEMO_CITY_PULSE } = require('../../data/demoData');
      set({ cityPulse: { ...DEMO_CITY_PULSE, city } });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/city-pulse/${city}`);
      if (res.ok) {
        const data = await res.json();
        set({ cityPulse: data });
        // Trigger city charge flag when pulse crosses 70%
        if (data.pulse_score > 70) {
          set({ cityChargeActive: true });
        } else {
          set({ cityChargeActive: false });
        }
      }
    } catch {}
  },

  dropQuickPulse: async (venueId, lat, lng) => {
    const { user, getAuthHeaders, isDemoMode, demoPulsedVenues } = get();
    if (!user) return { success: false };

    if (isDemoMode) {
      if (demoPulsedVenues[venueId] && Date.now() - demoPulsedVenues[venueId] < 15 * 60 * 1000) return { success: false };
      set((state) => ({
        demoPulsedVenues: { ...state.demoPulsedVenues, [venueId]: Date.now() },
        user: state.user ? { ...state.user, clout_points: (state.user.clout_points || 0) + 3 } : state.user,
      }));
      const { DEMO_CITY_PULSE } = require('../../data/demoData');
      set((state) => ({ cityPulse: state.cityPulse ? { ...state.cityPulse, pulses_tonight: state.cityPulse.pulses_tonight + 1 } : { ...DEMO_CITY_PULSE, pulses_tonight: DEMO_CITY_PULSE.pulses_tonight + 1 } }));
      return { success: true, clout_earned: 3 };
    }

    try {
      const res = await fetch(`${API_URL}/api/pulse`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: user.id, venue_id: venueId, lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false };
      if (data.clout_earned) {
        set((state) => ({ user: state.user ? { ...state.user, clout_points: (state.user.clout_points || 0) + data.clout_earned } : state.user }));
      }
      get().fetchCityPulse(get().selectedCity);
      return { success: true, clout_earned: data.clout_earned };
    } catch { return { success: false }; }
  },
});
