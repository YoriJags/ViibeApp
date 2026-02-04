import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Coordinates {
  lat: number;
  lng: number;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  coordinates: Coordinates;
  current_vibe_score: number;
  energy_level: 'chill' | 'popping' | 'electric';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  total_ratings_24h: number;
  owner_id?: string;
  is_featured: boolean;
  photo_url?: string;
}

interface User {
  id: string;
  username: string;
  phone: string;
  clout_points: number;
  scout_status: 'newbie' | 'regular' | 'scout' | 'elite';
  rating_accuracy_score: number;
  total_ratings: number;
  fast_lane_passes: number;
}

interface Rating {
  id: string;
  user_id: string;
  venue_id: string;
  energy: 'chill' | 'popping' | 'electric';
  capacity: 'sparse' | 'vibrant' | 'full';
  gate: 'clear' | 'slow' | 'blocked';
  photo_base64?: string;
  timestamp: string;
  is_correction: boolean;
  vibe_score: number;
}

interface VibeStore {
  // State
  user: User | null;
  venues: Venue[];
  loading: boolean;
  error: string | null;
  socket: Socket | null;

  // Actions
  setUser: (user: User | null) => void;
  setVenues: (venues: Venue[]) => void;
  updateVenue: (venue: Venue) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // API Actions
  fetchUser: () => Promise<void>;
  createUser: (username: string, phone: string) => Promise<boolean>;
  fetchVenues: () => Promise<void>;
  fetchVenue: (id: string) => Promise<Venue | null>;
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

  // Socket Actions
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useVibeStore = create<VibeStore>((set, get) => ({
  // Initial state
  user: null,
  venues: [],
  loading: false,
  error: null,
  socket: null,

  // Setters
  setUser: (user) => set({ user }),
  setVenues: (venues) => set({ venues }),
  updateVenue: (updatedVenue) =>
    set((state) => ({
      venues: state.venues.map((v) =>
        v.id === updatedVenue.id ? updatedVenue : v
      ),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Fetch user from storage or API
  fetchUser: async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('vibe_user_id');
      if (storedUserId) {
        const response = await fetch(`${API_URL}/api/users/${storedUserId}`);
        if (response.ok) {
          const user = await response.json();
          set({ user });
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  },

  // Create new user
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
        set({ user, loading: false });
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

  // Fetch all venues
  fetchVenues: async () => {
    set({ loading: true });
    try {
      const response = await fetch(`${API_URL}/api/venues`);
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

  // Socket connection
  connectSocket: () => {
    const { socket } = get();
    if (socket?.connected) return;

    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      // Subscribe to leaderboard updates
      newSocket.emit('subscribe_leaderboard');
    });

    newSocket.on('venue_update', (venue: Venue) => {
      get().updateVenue(venue);
    });

    newSocket.on('leaderboard_update', (leaderboard: any[]) => {
      const venues = leaderboard.map((entry) => entry.venue);
      set({ venues });
    });

    newSocket.on('pulse_drop', (data: any) => {
      // Handle pulse drop notification
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
}));
