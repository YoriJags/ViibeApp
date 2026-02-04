import { create } from 'zustand';
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
  fast_pass_enabled: boolean;
  fast_pass_price: number;
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
  fast_lane_passes: number;
  fast_passes_purchased: string[];
  home_city: string;
  is_admin: boolean;
  is_super_admin: boolean;
}

interface FastPass {
  id: string;
  venue_id: string;
  venue_name: string;
  price: number;
  qr_code: string;
  valid_date: string;
  is_used: boolean;
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

interface VibeStore {
  // State
  user: User | null;
  venues: Venue[];
  cities: City[];
  selectedCity: string;
  loading: boolean;
  error: string | null;
  socket: Socket | null;
  fastPasses: FastPass[];
  pulseDrops: PulseDrop[];
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setVenues: (venues: Venue[]) => void;
  updateVenue: (venue: Venue) => void;
  setSelectedCity: (city: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsAuthenticated: (auth: boolean) => void;

  // API Actions
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
  checkIn: (venueId: string, coordinates: Coordinates) => Promise<any>;
  getUserRatingStatus: (venueId: string) => Promise<any>;
  purchaseFastPass: (venueId: string) => Promise<any>;
  fetchUserFastPasses: () => Promise<void>;

  // Socket Actions
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useVibeStore = create<VibeStore>((set, get) => ({
  // Initial state
  user: null,
  venues: [],
  cities: [],
  selectedCity: 'lagos',
  loading: false,
  error: null,
  socket: null,
  fastPasses: [],
  pulseDrops: [],
  isAuthenticated: false,

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
    // Reconnect socket to new city room
    const { socket } = get();
    if (socket) {
      socket.emit('join_city', { city });
      socket.emit('subscribe_leaderboard', { city });
    }
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),

  // Fetch user from storage or API
  fetchUser: async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('vibe_user_id');
      if (storedUserId) {
        const response = await fetch(`${API_URL}/api/users/${storedUserId}`);
        if (response.ok) {
          const user = await response.json();
          set({ user, isAuthenticated: true });
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
        await AsyncStorage.setItem('vibe_user_id', user.id);
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
        await AsyncStorage.setItem('vibe_user_id', user.id);
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
        await AsyncStorage.setItem('vibe_user_id', user.id);
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
    await AsyncStorage.removeItem('vibe_user_id');
    set({ user: null, isAuthenticated: false, fastPasses: [] });
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
    const { user } = get();
    if (!user) {
      throw new Error('User not logged in');
    }

    try {
      const response = await fetch(`${API_URL}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          venue_id: venueId,
          energy,
          capacity,
          gate,
          coordinates,
          photo_base64: photoBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit rating');
      }

      // Refresh user data after rating
      get().fetchUser();
      get().fetchVenues();

      return data;
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw error;
    }
  },

  // Check in at venue
  checkIn: async (venueId, coordinates) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not logged in');
    }

    try {
      const response = await fetch(`${API_URL}/api/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          venue_id: venueId,
          coordinates,
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error checking in:', error);
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

  // Purchase fast pass
  purchaseFastPass: async (venueId) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not logged in');
    }

    try {
      const response = await fetch(`${API_URL}/api/fast-pass/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          venue_id: venueId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to purchase fast pass');
      }

      // Refresh fast passes
      get().fetchUserFastPasses();
      return data;
    } catch (error) {
      console.error('Error purchasing fast pass:', error);
      throw error;
    }
  },

  // Fetch user's fast passes
  fetchUserFastPasses: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/api/fast-pass/user/${user.id}`);
      if (response.ok) {
        const passes = await response.json();
        set({ fastPasses: passes });
      }
    } catch (error) {
      console.error('Error fetching fast passes:', error);
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
      // Could trigger a notification here
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
}));
