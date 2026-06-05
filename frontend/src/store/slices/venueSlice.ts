import { StateCreator } from 'zustand';
import {
  Venue, City, LobbyVenue, LobbyNudge,
  StoryListItem, TimelinePoint, ActiveCampaign, LivePush,
} from '../types';
import type { VibeStore } from '../vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface VenueSlice {
  // ── State ────────────────────────────────────────────────────────────────────
  venues: Venue[];
  cities: City[];
  selectedCity: string;
  lobbyVenues: LobbyVenue[];
  lobbyNudge: LobbyNudge | null;
  lobbyLoading: boolean;
  venueStories: StoryListItem[];
  venueTimeline: TimelinePoint[];
  timelinePeakHour: string | null;
  activeCampaigns: ActiveCampaign[];
  followedVenues: any[];
  livePushFeed: LivePush[];
  featureFlags: Record<string, boolean>;
  cityPickerOpen: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────────
  openCityPicker: () => void;
  closeCityPicker: () => void;
  setVenues: (venues: Venue[]) => void;
  updateVenue: (venue: Venue) => void;
  setSelectedCity: (city: string) => void;
  fetchVenues: (city?: string) => Promise<void>;
  fetchVenue: (id: string) => Promise<Venue | null>;
  fetchCities: () => Promise<void>;
  submitRating: (venueId: string, energy: string, capacity: string, gate: string, coordinates: { lat: number; lng: number }, photoBase64?: string) => Promise<any>;
  getUserRatingStatus: (venueId: string) => Promise<any>;
  recordDirectionClick: (venueId: string) => Promise<void>;
  fetchLobby: () => Promise<void>;
  addToLobby: (venueId: string) => Promise<boolean>;
  removeFromLobby: (venueId: string) => Promise<boolean>;
  isInLobby: (venueId: string) => boolean;
  fetchStories: (venueId: string) => Promise<void>;
  postStory: (venueId: string, mediaUrl: string, caption: string, lat: number, lng: number) => Promise<any>;
  viewStory: (storyId: string) => Promise<void>;
  fetchTimeline: (venueId: string) => Promise<void>;
  fetchActiveCampaigns: (city?: string) => Promise<void>;
  fetchFeatureFlags: () => Promise<void>;
  isFeatureEnabled: (flag: string) => boolean;
  followVenue: (venueId: string) => Promise<boolean>;
  unfollowVenue: (venueId: string) => Promise<void>;
  fetchFollowing: () => Promise<void>;
  fetchFollowingFeed: () => Promise<void>;
  setDeyRoad: (venueId: string, status?: 'enroute' | 'maybe' | 'pass') => Promise<number>;
  cancelDeyRoad: (venueId: string) => Promise<void>;
  sendLivePush: (venueId: string, message: string) => Promise<{ success: boolean; notifications_sent: number }>;
}

export const createVenueSlice: StateCreator<
  VibeStore,
  [['zustand/persist', unknown]],
  [],
  VenueSlice
> = (set, get) => ({
  venues: [],
  cities: [],
  selectedCity: 'lagos',
  lobbyVenues: [],
  lobbyNudge: null,
  lobbyLoading: false,
  venueStories: [],
  venueTimeline: [],
  timelinePeakHour: null,
  activeCampaigns: [],
  followedVenues: [],
  livePushFeed: [],
  featureFlags: {},
  cityPickerOpen: false,

  openCityPicker: () => set({ cityPickerOpen: true }),
  closeCityPicker: () => set({ cityPickerOpen: false }),

  setVenues: (venues) => set({ venues }),

  updateVenue: (updatedVenue) =>
    set((state) => ({
      venues: state.venues.map((v) => (v.id === updatedVenue.id ? updatedVenue : v)),
    })),

  setSelectedCity: (city) => {
    set({ selectedCity: city });
    get().fetchVenues(city);
    const { socket } = get();
    if (socket) {
      socket.emit('join_city', { city });
      socket.emit('subscribe_leaderboard', { city });
    }
  },

  fetchCities: async () => {
    try {
      const response = await fetch(`${API_URL}/api/cities`);
      if (response.ok) set({ cities: await response.json() });
    } catch (error) {
      console.warn('fetchCities: network unavailable', error);
    }
  },

  fetchVenues: async (city) => {
    set({ loading: true });
    try {
      const cityParam = city || get().selectedCity;
      const url = cityParam ? `${API_URL}/api/venues?city=${cityParam}` : `${API_URL}/api/venues`;
      const response = await fetch(url);
      if (response.ok) {
        set({ venues: await response.json(), loading: false });
      } else {
        set({ loading: false, error: 'Failed to fetch venues' });
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
      set({ loading: false, error: 'Network error' });
    }
  },

  fetchVenue: async (id) => {
    if (get().isDemoMode) return get().venues.find((v) => v.id === id) || null;
    try {
      const response = await fetch(`${API_URL}/api/venues/${id}`);
      return response.ok ? await response.json() : null;
    } catch { return null; }
  },

  submitRating: async (venueId, energy, capacity, gate, coordinates, photoBase64) => {
    const { user, isOnline, isDemoMode, addPendingRating } = get();
    if (!user) throw new Error('User not logged in');

    if (isDemoMode) {
      set((state) => ({ demoRatedVenues: { ...state.demoRatedVenues, [venueId]: Date.now() } }));
      return { success: true, clout_earned: 15, new_clout_total: (user as any).clout_points + 15, message: 'Demo rating submitted!' };
    }

    if (!isOnline) {
      addPendingRating({ id: `pending_${Date.now()}`, venue_id: venueId, energy, capacity, gate, coordinates, photo_base64: photoBase64, timestamp: Date.now() });
      return { offline: true, message: 'Rating saved. Will sync when online.' };
    }

    try {
      const response = await fetch(`${API_URL}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, venue_id: venueId, energy, capacity, gate, coordinates, photo_base64: photoBase64 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to submit rating');
      get().fetchUser();
      get().fetchVenues();
      return data;
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw error;
    }
  },

  getUserRatingStatus: async (venueId) => {
    const { user, isDemoMode, demoRatedVenues } = get();
    if (!user) return { can_rate: false, ratings_count: 0, cooldown_remaining_seconds: 0 };
    if (isDemoMode) {
      const lastRated = demoRatedVenues[venueId];
      if (lastRated) {
        const remaining = Math.max(0, 1800 - (Date.now() - lastRated) / 1000);
        if (remaining > 0) return { can_rate: false, ratings_count: 1, cooldown_remaining_seconds: Math.floor(remaining), can_skip: true, clout_cost: 50 };
      }
      return { can_rate: true, ratings_count: 0, cooldown_remaining_seconds: 0 };
    }
    try {
      const response = await fetch(`${API_URL}/api/ratings/status/${user.id}/${venueId}`);
      return await response.json();
    } catch { return { can_rate: true, ratings_count: 0, cooldown_remaining_seconds: 0 }; }
  },

  recordDirectionClick: async (venueId) => {
    if (get().isDemoMode) return;
    // Send auth headers when available so attribution can match this tap to the
    // scout who later arrives (per-user matched conversion). Endpoint stays
    // anonymous-friendly — headers are best-effort, never required.
    try {
      await fetch(`${API_URL}/api/venues/${venueId}/direction-click`, {
        method: 'POST', headers: get().getAuthHeaders(),
      });
    } catch {}
  },

  fetchLobby: async () => {
    const { getAuthHeaders, isAuthenticated, isDemoMode } = get();
    if (isDemoMode) {
      const { DEMO_LOBBY } = require('../../data/demoData');
      set({ lobbyVenues: DEMO_LOBBY.venues, lobbyNudge: DEMO_LOBBY.nudge, lobbyLoading: false });
      return;
    }
    if (!isAuthenticated) return;
    set({ lobbyLoading: true });
    try {
      const response = await fetch(`${API_URL}/api/lobby`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        set({ lobbyVenues: data.venues || [], lobbyNudge: data.nudge || null, lobbyLoading: false });
      } else {
        set({ lobbyLoading: false });
      }
    } catch { set({ lobbyLoading: false }); }
  },

  addToLobby: async (venueId) => {
    const { getAuthHeaders } = get();
    try {
      const response = await fetch(`${API_URL}/api/lobby`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ venue_id: venueId }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.added) get().fetchLobby();
        return data.added;
      }
      return false;
    } catch { return false; }
  },

  removeFromLobby: async (venueId) => {
    const { getAuthHeaders } = get();
    try {
      const response = await fetch(`${API_URL}/api/lobby/${venueId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (response.ok) {
        set((state) => ({ lobbyVenues: state.lobbyVenues.filter((v) => v.id !== venueId) }));
        return true;
      }
      return false;
    } catch { return false; }
  },

  isInLobby: (venueId) => get().lobbyVenues.some((v) => v.id === venueId),

  fetchStories: async (venueId) => {
    if (get().isDemoMode) {
      const { DEMO_STORIES } = require('../../data/demoData');
      set({ venueStories: DEMO_STORIES.filter((s: any) => s.venue_id === venueId) });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/stories/venue/${venueId}`);
      if (response.ok) set({ venueStories: (await response.json()).stories || [] });
    } catch {}
  },

  postStory: async (venueId, mediaUrl, caption, lat, lng) => {
    const { getAuthHeaders } = get();
    const response = await fetch(`${API_URL}/api/stories`, {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ venue_id: venueId, media_url: mediaUrl, caption, latitude: lat, longitude: lng }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Failed to post story');
    return data;
  },

  viewStory: async (storyId) => {
    try {
      await fetch(`${API_URL}/api/stories/${storyId}/view`, { method: 'POST', headers: get().getAuthHeaders() });
    } catch {}
  },

  fetchTimeline: async (venueId) => {
    if (get().isDemoMode) {
      const hours = ['6PM', '7PM', '8PM', '9PM', '10PM', '11PM', '12AM', '1AM', '2AM'];
      const scores = [25, 38, 52, 68, 82, 91, 88, 75, 45];
      const energies = ['chill', 'chill', 'popping', 'popping', 'electric', 'electric', 'electric', 'popping', 'chill'];
      set({
        venueTimeline: hours.map((hour, i) => ({ hour, hour_label: hour, avg_vibe_score: scores[i], peak_score: scores[i] + 5, energy_level: energies[i], rating_count: Math.floor(Math.random() * 15) + 3, checkin_count: Math.floor(Math.random() * 20) + 2 })),
        timelinePeakHour: '11PM',
      });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/timeline/${venueId}`);
      if (response.ok) {
        const data = await response.json();
        set({ venueTimeline: data.timeline || [], timelinePeakHour: data.peak_hour || null });
      }
    } catch {}
  },

  fetchActiveCampaigns: async (city) => {
    const cityParam = city || get().selectedCity;
    try {
      const response = await fetch(`${API_URL}/api/campaigns/active?city=${cityParam}`);
      if (response.ok) set({ activeCampaigns: (await response.json()).campaigns || [] });
    } catch {}
  },

  fetchFeatureFlags: async () => {
    try {
      const res = await fetch(`${API_URL}/api/feature-flags`);
      if (res.ok) set({ featureFlags: (await res.json()).flags || {} });
    } catch { /* default: all enabled */ }
  },

  isFeatureEnabled: (flag) => {
    const { featureFlags, isDemoMode } = get();
    if (isDemoMode) return true;
    if (Object.keys(featureFlags).length === 0) return true;
    return featureFlags[flag] !== false;
  },

  followVenue: async (venueId) => {
    const { getAuthHeaders, isDemoMode } = get();
    if (isDemoMode) return true;
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/follow`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) return false;
      await get().fetchFollowing();
      return true;
    } catch { return false; }
  },

  unfollowVenue: async (venueId) => {
    const { getAuthHeaders, isDemoMode } = get();
    if (isDemoMode) return;
    try {
      await fetch(`${API_URL}/api/venues/${venueId}/follow`, { method: 'DELETE', headers: getAuthHeaders() });
      await get().fetchFollowing();
    } catch {}
  },

  fetchFollowing: async () => {
    const { getAuthHeaders, isDemoMode, isAuthenticated } = get();
    if (!isAuthenticated || isDemoMode) return;
    try {
      const res = await fetch(`${API_URL}/api/venues/me/following`, { headers: getAuthHeaders() });
      if (res.ok) set({ followedVenues: (await res.json()).following || [] });
    } catch {}
  },

  fetchFollowingFeed: async () => {
    const { getAuthHeaders, isDemoMode, isAuthenticated } = get();
    if (!isAuthenticated || isDemoMode) return;
    try {
      const res = await fetch(`${API_URL}/api/venues/following/feed`, { headers: getAuthHeaders() });
      if (res.ok) set({ livePushFeed: (await res.json()).pushes || [] });
    } catch {}
  },

  setDeyRoad: async (venueId, status = 'enroute') => {
    const { getAuthHeaders, isDemoMode } = get();
    if (isDemoMode) return 0;
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/heading`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return res.ok ? (await res.json()).enroute ?? 0 : 0;
    } catch { return 0; }
  },

  cancelDeyRoad: async (venueId) => {
    const { getAuthHeaders, isDemoMode } = get();
    if (isDemoMode) return;
    try { await fetch(`${API_URL}/api/venues/${venueId}/heading`, { method: 'DELETE', headers: getAuthHeaders() }); } catch {}
  },

  sendLivePush: async (venueId, message) => {
    const { getAuthHeaders } = get();
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/live-push`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send');
      return { success: true, notifications_sent: data.notifications_sent ?? 0 };
    } catch (e: any) {
      return { success: false, notifications_sent: 0 };
    }
  },
});
