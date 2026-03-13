import { StateCreator } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Venue, CityPulseData, AlertPrefs } from '../types';
import type { LivePush } from '../types';
import type { VibeStore } from '../vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// City pulse threshold that activates the global charge HUD
const CITY_CHARGE_THRESHOLD = 70;

export interface SocketSlice {
  // ── State ────────────────────────────────────────────────────────────────────
  socket: Socket | null;
  isOnline: boolean;
  gpsLocked: boolean;
  loading: boolean;
  error: string | null;
  hasHydrated: boolean;
  lastRatedVenueId: string | null;
  isInsideVenue: boolean;
  activeVenueId: string | null;
  activeVenueName: string | null;
  activeVenueCoords: { lat: number; lng: number } | null;
  tabBarHidden: boolean;
  alertPrefs: AlertPrefs | null;
  /** True when city-wide pulse_score crosses CITY_CHARGE_THRESHOLD — drives GlobalVibePill pulse animation */
  cityChargeActive: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────────
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsOnline: (online: boolean) => void;
  setGpsLocked: (locked: boolean) => void;
  setVenueGeofence: (venueId: string | null, venueName: string | null, coords: { lat: number; lng: number } | null, inside: boolean) => void;
  setLastRatedVenueId: (venueId: string | null) => void;
  setHasHydrated: (hydrated: boolean) => void;
  setTabBarHidden: (hidden: boolean) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
  registerPushToken: (token: string) => Promise<void>;
  updateAlertPrefs: (prefs: Partial<AlertPrefs>) => Promise<void>;
  fetchAlertPrefs: () => Promise<void>;
}

export const createSocketSlice: StateCreator<
  VibeStore,
  [['zustand/persist', unknown]],
  [],
  SocketSlice
> = (set, get) => ({
  socket: null,
  isOnline: true,
  gpsLocked: false,
  loading: false,
  error: null,
  hasHydrated: false,
  lastRatedVenueId: null,
  isInsideVenue: false,
  activeVenueId: null,
  activeVenueName: null,
  activeVenueCoords: null,
  tabBarHidden: false,
  alertPrefs: null,
  cityChargeActive: false,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setIsOnline: (online) => {
    set({ isOnline: online });
    if (online) get().syncPendingRatings();
  },
  setGpsLocked: (locked) => set({ gpsLocked: locked }),
  setVenueGeofence: (venueId, venueName, coords, inside) => set({
    isInsideVenue: inside,
    activeVenueId: inside ? venueId : null,
    activeVenueName: inside ? venueName : null,
    activeVenueCoords: inside ? coords : null,
  }),
  setLastRatedVenueId: (venueId) => set({ lastRatedVenueId: venueId }),
  setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
  setTabBarHidden: (hidden) => set({ tabBarHidden: hidden }),

  connectSocket: () => {
    const { socket, selectedCity } = get();
    if (socket?.connected) return;

    const newSocket = io(API_URL, { transports: ['websocket', 'polling'], autoConnect: true });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('join_city', { city: selectedCity });
      newSocket.emit('subscribe_leaderboard', { city: selectedCity });
    });

    newSocket.on('venue_update', (venue: Venue) => {
      get().updateVenue(venue);
    });

    newSocket.on('leaderboard_update', (leaderboard: any[]) => {
      set({ venues: leaderboard.map((entry) => entry.venue) });
    });

    newSocket.on('city_pulse_update', (data: CityPulseData) => {
      // Update city pulse + derive cityChargeActive flag
      const cityChargeActive = data.pulse_score > CITY_CHARGE_THRESHOLD;
      set({ cityPulse: data, cityChargeActive });
    });

    newSocket.on('venue_live_push', (push: LivePush) => {
      set((state) => ({ livePushFeed: [push, ...state.livePushFeed].slice(0, 50) }));
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) { socket.disconnect(); set({ socket: null }); }
  },

  registerPushToken: async (token) => {
    const { getAuthHeaders, isAuthenticated } = get();
    if (!isAuthenticated) return;
    try {
      await fetch(`${API_URL}/api/alerts/register`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ expo_push_token: token }) });
    } catch {}
  },

  updateAlertPrefs: async (prefs) => {
    const { getAuthHeaders, alertPrefs } = get();
    const merged = { ...alertPrefs, ...prefs };
    try {
      await fetch(`${API_URL}/api/alerts/preferences`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(merged) });
      set({ alertPrefs: merged as AlertPrefs });
    } catch {}
  },

  fetchAlertPrefs: async () => {
    const { getAuthHeaders, isAuthenticated } = get();
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_URL}/api/alerts/preferences`, { headers: getAuthHeaders() });
      if (response.ok) set({ alertPrefs: await response.json() });
    } catch {}
  },
});
