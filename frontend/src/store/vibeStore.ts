import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Coordinates {
  lat: number;
  lng: number;
}

interface City {
  name: string;
  code: string;
  center: Coordinates;
  radius_km: number;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  city: string;
  venue_type: 'club' | 'lounge' | 'restaurant' | 'bar';
  coordinates: Coordinates;
  current_vibe_score: number;
  energy_level: 'chill' | 'popping' | 'electric';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  total_ratings_24h: number;
  is_featured: boolean;
  is_verified: boolean;
  profile_views: number;
  direction_clicks: number;
  active_pulse_tier?: string;
  glow_boost: number;
  custom_icon?: string;
}

interface User {
  id: string;
  username: string;
  phone: string;
  email?: string;
  name?: string;
  picture?: string;
  auth_provider: 'local' | 'google' | 'apple';
  clout_points: number;
  scout_status: 'newbie' | 'regular' | 'scout' | 'elite';
  rating_accuracy_score: number;
  total_ratings: number;
  home_city: string;
  is_admin: boolean;
  is_super_admin: boolean;
  is_merchant: boolean;
  merchant_venue_id?: string;
  wallet_balance?: number;
}

interface PendingRating {
  id: string;
  venue_id: string;
  energy: string;
  capacity: string;
  gate: string;
  coordinates: Coordinates;
  photo_base64?: string;
  timestamp: number;
}

interface PulseDrop {
  id: string;
  venue_id: string;
  venue_name: string;
  tier: 'spark' | 'flare' | 'supernova';
  message: string;
  radius_km: number;
  expires_at: string;
}

// Separate persisted state from transient state
interface PersistedState {
  user: User | null;
  selectedCity: string;
  isAuthenticated: boolean;
  pendingRatings: PendingRating[];
}

interface TransientState {
  venues: Venue[];
  cities: City[];
  loading: boolean;
  error: string | null;
  socket: Socket | null;
  pulseDrops: PulseDrop[];
  isOnline: boolean;
  gpsLocked: boolean;
  lastRatedVenueId: string | null;
  hasHydrated: boolean;
}

interface VibeStoreActions {
  setUser: (user: User | null) => void;
  setVenues: (venues: Venue[]) => void;
  updateVenue: (venue: Venue) => void;
  setSelectedCity: (city: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setGpsLocked: (locked: boolean) => void;
  setLastRatedVenueId: (venueId: string | null) => void;
  updateUserClout: (cloutEarned: number) => void;
  setHasHydrated: (hydrated: boolean) => void;
  fetchUser: () => Promise<void>;
  fetchAuthUser: () => Promise<User | null>;
  createUser: (username: string, phone: string) => Promise<boolean>;
  processGoogleAuth: (sessionId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchVenues: (city?: string) => Promise<void>;
  fetchVenue: (id: string) => Promise<Venue | null>;
  fetchCities: () => Promise<void>;
  submitRating: (
    venueId: string,
    energy: string,
    capacity: string,
    gate: string,
    coordinates: Coordinates,
    photoBase64?: string
  ) => Promise<any>;
  getUserRatingStatus: (venueId: string) => Promise<any>;
  recordDirectionClick: (venueId: string) => Promise<void>;
  addPendingRating: (rating: PendingRating) => void;
  syncPendingRatings: () => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

type VibeStore = PersistedState & TransientState & VibeStoreActions;

export const useVibeStore = create<VibeStore>()(
  persist(
    (set, get) => ({
      // Persisted state
      user: null,
      selectedCity: 'lagos',
      isAuthenticated: false,
      pendingRatings: [],
      
      // Transient state (not persisted)
      venues: [],
      cities: [],
      loading: false,
      error: null,
      socket: null,
      pulseDrops: [],
      isOnline: true,
      gpsLocked: false,
      lastRatedVenueId: null,
      hasHydrated: false,

      // Hydration tracker
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      // Setters
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setVenues: (venues) => set({ venues }),
      updateVenue: (updatedVenue) =>
        set((state) => ({
          venues: state.venues.map((v) =>
            v.id === updatedVenue.id ? updatedVenue : v
          ),
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
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
      setIsOnline: (online) => {
        set({ isOnline: online });
        if (online) {
          get().syncPendingRatings();
        }
      },
      setGpsLocked: (locked) => set({ gpsLocked: locked }),
      setLastRatedVenueId: (venueId) => set({ lastRatedVenueId: venueId }),
      updateUserClout: (cloutEarned) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              clout_points: (user.clout_points || 0) + cloutEarned,
              total_ratings: (user.total_ratings || 0) + 1,
            },
          });
        }
      },

      // Fetch user from storage (used at app start)
      fetchUser: async () => {
        try {
          const { user, isAuthenticated } = get();
          // If already have user from persistence, just refresh from API
          if (user?.id) {
            const response = await fetch(`${API_URL}/api/users/${user.id}`);
            if (response.ok) {
              const userData = await response.json();
              set({ user: userData, isAuthenticated: true });
            }
            return;
          }
          
          // Fallback to legacy storage check
          const storedUserId = await AsyncStorage.getItem('vibe_user_id');
          if (storedUserId) {
            const response = await fetch(`${API_URL}/api/users/${storedUserId}`);
            if (response.ok) {
              const userData = await response.json();
              set({ user: userData, isAuthenticated: true });
            }
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      },

      // Fetch authenticated user via session
      fetchAuthUser: async () => {
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            credentials: 'include',
          });
          if (response.ok) {
            const user = await response.json();
            set({ user, isAuthenticated: true });
            return user;
          }
          return null;
        } catch (error) {
          console.error('Error fetching auth user:', error);
          return null;
        }
      },

      // Create new user (local auth)
      createUser: async (username, phone) => {
        set({ loading: true });
        try {
          const response = await fetch(`${API_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, phone }),
          });

          if (response.ok) {
            const user = await response.json();
            // Store persists automatically via zustand persist
            set({ user, loading: false, isAuthenticated: true });
            return true;
          }
          set({ loading: false });
          return false;
        } catch (error) {
          console.error('Error creating user:', error);
          set({ loading: false });
          return false;
        }
      },

      // Process Google OAuth callback
      processGoogleAuth: async (sessionId) => {
        set({ loading: true });
        try {
          const response = await fetch(`${API_URL}/api/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
            credentials: 'include',
          });

          if (response.ok) {
            const user = await response.json();
            // Store persists automatically via zustand persist
            set({ user, loading: false, isAuthenticated: true });
            return true;
          }
          set({ loading: false });
          return false;
        } catch (error) {
          console.error('Error processing Google auth:', error);
          set({ loading: false });
          return false;
        }
      },

      // Logout
      logout: async () => {
        try {
          await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Error logging out:', error);
        }
        // Clear persisted state
        set({ user: null, isAuthenticated: false });
      },

      // Fetch cities
      fetchCities: async () => {
        try {
          const response = await fetch(`${API_URL}/api/cities`);
          if (response.ok) {
            const cities = await response.json();
            set({ cities });
          }
        } catch (error) {
          console.error('Error fetching cities:', error);
        }
      },

      // Fetch all venues
      fetchVenues: async (city?: string) => {
        set({ loading: true });
        try {
          const cityParam = city || get().selectedCity;
          const url = cityParam ? `${API_URL}/api/venues?city=${cityParam}` : `${API_URL}/api/venues`;
          const response = await fetch(url);
          if (response.ok) {
            const venues = await response.json();
            set({ venues, loading: false });
          } else {
            set({ loading: false, error: 'Failed to fetch venues' });
          }
        } catch (error) {
          console.error('Error fetching venues:', error);
          set({ loading: false, error: 'Network error' });
        }
      },

      // Fetch single venue
      fetchVenue: async (id) => {
        try {
          const response = await fetch(`${API_URL}/api/venues/${id}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error('Error fetching venue:', error);
          return null;
        }
      },

      // Submit a rating
      submitRating: async (venueId, energy, capacity, gate, coordinates, photoBase64) => {
        const { user, isOnline } = get();
        if (!user) {
          throw new Error('User not logged in');
        }

        const ratingData = {
          user_id: user.id,
          venue_id: venueId,
          energy,
          capacity,
          gate,
          coordinates,
          photo_base64: photoBase64,
        };

        // If offline, store locally
        if (!isOnline) {
          const pendingRating: PendingRating = {
            id: `pending_${Date.now()}`,
            venue_id: venueId,
            energy,
            capacity,
            gate,
            coordinates,
            photo_base64: photoBase64,
            timestamp: Date.now(),
          };
          get().addPendingRating(pendingRating);
          return { offline: true, message: 'Rating saved. Will sync when online.' };
        }

        try {
          const response = await fetch(`${API_URL}/api/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ratingData),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.detail || 'Failed to submit rating');
          }

          get().fetchUser();
          get().fetchVenues();

          return data;
        } catch (error) {
          console.error('Error submitting rating:', error);
          throw error;
        }
      },

      // Get user's rating status for a venue
      getUserRatingStatus: async (venueId) => {
        const { user } = get();
        if (!user) {
          return { can_rate: false, ratings_count: 0 };
        }

        try {
          const response = await fetch(
            `${API_URL}/api/ratings/user/${user.id}/venue/${venueId}`
          );
          return await response.json();
        } catch (error) {
          console.error('Error getting rating status:', error);
          return { can_rate: false, ratings_count: 0 };
        }
      },

      // Record direction click for ROI tracking
      recordDirectionClick: async (venueId) => {
        try {
          await fetch(`${API_URL}/api/venues/${venueId}/direction-click`, {
            method: 'POST',
          });
        } catch (error) {
          console.error('Error recording direction click:', error);
        }
      },

      // Offline-first: Add pending rating
      addPendingRating: (rating) => {
        set((state) => ({
          pendingRatings: [...state.pendingRatings, rating],
        }));
      },

      // Sync pending ratings when back online
      syncPendingRatings: async () => {
        const { pendingRatings, user } = get();
        if (!user || pendingRatings.length === 0) return;

        try {
          const response = await fetch(`${API_URL}/api/ratings/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ratings: pendingRatings.map((r) => ({
                ...r,
                user_id: user.id,
                offline_id: r.id,
              })),
            }),
          });

          if (response.ok) {
            set({ pendingRatings: [] });
            get().fetchVenues();
          }
        } catch (error) {
          console.error('Error syncing ratings:', error);
        }
      },

      // Socket connection
      connectSocket: () => {
        const { socket, selectedCity } = get();
        if (socket?.connected) return;

        const newSocket = io(API_URL, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
        });

        newSocket.on('connect', () => {
          console.log('Socket connected');
          newSocket.emit('join_city', { city: selectedCity });
          newSocket.emit('subscribe_leaderboard', { city: selectedCity });
        });

        newSocket.on('venue_update', (venue: Venue) => {
          get().updateVenue(venue);
        });

        newSocket.on('leaderboard_update', (leaderboard: any[]) => {
          const venues = leaderboard.map((entry) => entry.venue);
          set({ venues });
        });

        newSocket.on('pulse_drop', (data: any) => {
          console.log('Pulse drop received:', data);
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        set({ socket: newSocket });
      },

      disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null });
        }
      },
    }),
    {
      name: 'vibe-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these specific fields
      partialize: (state) => ({
        user: state.user,
        selectedCity: state.selectedCity,
        isAuthenticated: state.isAuthenticated,
        pendingRatings: state.pendingRatings,
      }),
      onRehydrateStorage: () => (state) => {
        // Called when store is rehydrated from storage
        if (state) {
          state.setHasHydrated(true);
          // Refresh user data from server if authenticated
          if (state.user?.id) {
            state.fetchUser();
          }
        }
      },
    }
  )
);
