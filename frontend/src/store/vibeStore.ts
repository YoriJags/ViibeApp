import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { DEMO_USER, DEMO_VENUES, DEMO_STREAK, DEMO_CREW, DEMO_ACTIVE_CAMPAIGNS } from '../data/demoData';

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
  venue_type: 'club' | 'lounge' | 'restaurant' | 'bar' | 'church' | 'concert' | 'rave' | 'block_party' | 'festival' | 'event' | 'other';
  coordinates: Coordinates;
  current_vibe_score: number;
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
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
  ratings_last_30m?: number;
  geofence_radius_m?: number;
  vibe_certified?: boolean;
  certified_since?: string;
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
  // Vibe+ subscription
  is_vibe_plus: boolean;
  vibe_plus_expires_at?: string;  // ISO date string
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

// ===== New Feature Interfaces =====

interface StreakData {
  current_streak: number;
  longest_streak: number;
  multiplier: number;
  last_activity_date: string | null;
  milestones_claimed: number[];
  next_milestone: number | null;
  next_milestone_clout: number | null;
}

export interface ActiveCheckin {
  user_id: string;
  venue_id: string;
  venue_name: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface StoryListItem {
  id: string;
  username: string;
  scout_status: string;
  venue_id: string;
  venue_name: string;
  caption: string;
  views: number;
  created_at: string;
}

interface TimelinePoint {
  hour: string;
  hour_label: string;
  avg_vibe_score: number;
  peak_score: number;
  energy_level: string;
  rating_count: number;
  checkin_count: number;
}

interface Crew {
  id: string;
  name: string;
  captain_id: string;
  members: string[];
  member_details: {
    user_id: string;
    username: string;
    scout_status: string;
    checked_in?: boolean;
    venue_name?: string;
  }[];
  invite_code: string;
  is_captain: boolean;
  active_vote: CrewVote | null;
}

interface CrewMemberLocation {
  user_id: string;
  username: string;
  venue_name: string;
  venue_id: string;
  lat: number;
  lng: number;
  avatar_config?: { emoji: string; bgColor: string; accentColor: string } | null;
  checked_in_at?: string;
  is_out: boolean;
  battery_level?: number; // 0.0–1.0
}

interface CrewVote {
  id: string;
  crew_id: string;
  options: {
    id: string;
    name: string;
    area: string;
    current_vibe_score: number;
    energy_level: string;
    votes: number;
    voters: string[];
  }[];
  status: string;
  total_votes: number;
  has_voted?: boolean;
  winner?: any;
}

interface AlertPrefs {
  lobby_alerts: boolean;
  streak_reminders: boolean;
  crew_alerts: boolean;
  nearby_alerts: boolean;
  registered: boolean;
}

interface ActiveCampaign {
  id: string;
  venue_id: string;
  venue_name: string;
  multiplier: number;
  expires_at: string;
}

// Separate persisted state from transient state
interface PersistedState {
  user: User | null;
  sessionToken: string | null;
  selectedCity: string;
  isAuthenticated: boolean;
  pendingRatings: PendingRating[];
  hasSeenOnboarding: boolean;
  hasSeenMerchantOnboarding: boolean;
  isDemoMode: boolean;
  hasSeenDemoTutorial: boolean;
  avatarConfig: { emoji: string; bgColor: string; accentColor: string } | null;
  locationSharingEnabled: boolean;
  vibePersona: 'turn_up' | 'grown_sexy' | 'culture' | 'chill_set' | null;
  userMode: 'scout' | 'insider' | null;
  sceneMood: 'easy_flow' | 'high_energy' | 'mixed_scene' | 'low_key' | null;
  sceneMoodSetAt: string | null; // ISO date — set once per session (time-gated)
}

interface LobbyVenue extends Venue {
  lobby_added_at: string;
  lobby_entry_id: string;
}

interface LobbyNudge {
  type: 'go_here' | 'quiet_night';
  venue_id: string | null;
  venue_name?: string;
  score?: number;
  message: string;
  energy?: string;
  margin?: number;
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
  lobbyVenues: LobbyVenue[];
  lobbyNudge: LobbyNudge | null;
  lobbyLoading: boolean;
  // New features
  streak: StreakData | null;
  activeCheckin: ActiveCheckin | null;
  venueStories: StoryListItem[];
  venueTimeline: TimelinePoint[];
  timelinePeakHour: string | null;
  crew: Crew | null;
  activeVote: CrewVote | null;
  alertPrefs: AlertPrefs | null;
  venueCheckinCount: number;
  activeCampaigns: ActiveCampaign[];
  crewLocations: CrewMemberLocation[];
  ghostMode: boolean;
  tabBarHidden: boolean;
  demoRatedVenues: Record<string, number>; // venueId → timestamp of last demo rating
  demoPulsedVenues: Record<string, number>; // venueId → timestamp of last quick pulse (demo)
  vibeDNA: VibeDNA | null;
  cityPulse: CityPulseData | null;
  featureFlags: Record<string, boolean>;
  // Venue Live
  followedVenues: any[];
  livePushFeed: LivePush[];
}

export interface LivePush {
  venue_id: string;
  venue_name: string;
  venue_category: string;
  message: string;
  push_id: string;
  sent_at: string;
  heading_count?: number;
}

export type CityPulseLabel = 'QUIET' | 'CHILL' | 'WARMING' | 'LIT' | 'PEAK';

export interface CityPulseData {
  city: string;
  pulse_score: number;
  pulse_label: CityPulseLabel;
  trend: 'heating_up' | 'cooling_down' | 'stable';
  active_scouts: number;
  live_venues: number;
  hot_venues: number;
  pulses_tonight: number;
  trending_venue?: { name: string; score: number };
  sparkline: number[];   // 6 values oldest→newest, 5-min buckets, 30-min window
  updated_at?: string;
}

export interface VenueAffinity { venue_type: string; score: number; rating_count: number; label: string; }
export interface VibeDNA {
  user_id: string;
  affinities: VenueAffinity[];
  tap_affinities?: { venue_type: string; tap_count: number; share: number }[];
  dominant_type: string;
  night_style: 'early_bird' | 'night_owl' | 'midnight_crew';
  night_style_label: string;
  total_ratings_analyzed: number;
  computed_at: string;
  insufficient_data?: boolean;
}

interface VibeStoreActions {
  getAuthHeaders: () => Record<string, string>;
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
  loginUser: (phone: string) => Promise<{ success: boolean; error?: string }>;
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
  fetchLobby: () => Promise<void>;
  addToLobby: (venueId: string) => Promise<boolean>;
  removeFromLobby: (venueId: string) => Promise<boolean>;
  isInLobby: (venueId: string) => boolean;
  // Ghost Check-ins
  ghostCheckIn: (venueId: string, lat: number, lng: number) => Promise<any>;
  ghostCheckOut: (venueId: string) => Promise<void>;
  fetchActiveCheckin: () => Promise<void>;
  fetchVenueCheckins: (venueId: string) => Promise<void>;
  // Streaks
  fetchStreak: () => Promise<void>;
  // Stories
  fetchStories: (venueId: string) => Promise<void>;
  postStory: (venueId: string, mediaUrl: string, caption: string, lat: number, lng: number) => Promise<any>;
  viewStory: (storyId: string) => Promise<void>;
  // Timeline
  fetchTimeline: (venueId: string) => Promise<void>;
  // Crews
  createCrew: (name: string) => Promise<any>;
  joinCrew: (inviteCode: string) => Promise<any>;
  fetchCrew: () => Promise<void>;
  leaveCrew: (crewId: string) => Promise<void>;
  startVote: (crewId: string, venueIds: string[]) => Promise<any>;
  castVote: (crewId: string, voteId: string, venueId: string) => Promise<void>;
  // Alerts
  registerPushToken: (token: string) => Promise<void>;
  updateAlertPrefs: (prefs: Partial<AlertPrefs>) => Promise<void>;
  fetchAlertPrefs: () => Promise<void>;
  // Onboarding
  completeOnboarding: () => void;
  completeMerchantOnboarding: () => void;
  // Campaigns
  fetchActiveCampaigns: (city?: string) => Promise<void>;
  // Demo Mode
  toggleDemoMode: () => void;
  completeDemoTutorial: () => void;
  restartDemoTutorial: () => void;
  // Avatar & Privacy
  updateAvatar: (config: { emoji: string; bgColor: string; accentColor: string }) => void;
  toggleLocationSharing: () => void;
  setVibePersona: (persona: 'turn_up' | 'grown_sexy' | 'culture' | 'chill_set') => void;
  setUserMode: (mode: 'scout' | 'insider') => void;
  setSceneMood: (mood: 'easy_flow' | 'high_energy' | 'mixed_scene' | 'low_key') => void;
  setTabBarHidden: (hidden: boolean) => void;
  // Cooldown
  cooldownSkip: (venueId: string, method: 'clout' | 'payment') => Promise<{ success: boolean; clout_remaining?: number; error?: string }>;
  // Crew Tracker
  fetchCrewLocations: (crewId: string) => Promise<void>;
  toggleGhostMode: () => void;
  // Vibe DNA
  fetchVibeDNA: (userId: string) => Promise<void>;
  // City Pulse
  fetchCityPulse: (city: string) => Promise<void>;
  dropQuickPulse: (venueId: string, lat: number, lng: number) => Promise<{ success: boolean; clout_earned?: number }>;
  // Feature Flags
  fetchFeatureFlags: () => Promise<void>;
  isFeatureEnabled: (flag: string) => boolean;
  // Vibe+ Subscription
  isVibePlus: () => boolean;
  initializeVibePlus: () => Promise<{ authorization_url: string; reference: string }>;
  verifyVibePlus: (reference: string) => Promise<{ success: boolean; is_vibe_plus: boolean; expires_at?: string }>;
  refreshSubscriptionStatus: () => Promise<void>;
  // Venue Live — Follow, I Dey Road, Live Push
  followVenue: (venueId: string) => Promise<boolean>;
  unfollowVenue: (venueId: string) => Promise<void>;
  fetchFollowing: () => Promise<void>;
  fetchFollowingFeed: () => Promise<void>;
  setDeyRoad: (venueId: string, status?: 'enroute' | 'maybe' | 'pass') => Promise<number>;
  cancelDeyRoad: (venueId: string) => Promise<void>;
  sendLivePush: (venueId: string, message: string) => Promise<{ success: boolean; notifications_sent: number }>;
}

type VibeStore = PersistedState & TransientState & VibeStoreActions;

export const useVibeStore = create<VibeStore>()(
  persist(
    (set, get) => ({
      // Persisted state
      user: null,
      sessionToken: null,
      selectedCity: 'lagos',
      isAuthenticated: false,
      pendingRatings: [],
      hasSeenOnboarding: false,
      hasSeenMerchantOnboarding: false,
      isDemoMode: false,
      hasSeenDemoTutorial: false,
      avatarConfig: null,
      locationSharingEnabled: true,
      vibePersona: null,
      userMode: null,
      sceneMood: null,
      sceneMoodSetAt: null,

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
      lobbyVenues: [],
      lobbyNudge: null,
      lobbyLoading: false,
      streak: null,
      activeCheckin: null,
      venueStories: [],
      venueTimeline: [],
      timelinePeakHour: null,
      crew: null,
      activeVote: null,
      alertPrefs: null,
      venueCheckinCount: 0,
      activeCampaigns: [],
      crewLocations: [],
      ghostMode: false,
      tabBarHidden: false,
      demoRatedVenues: {},
      demoPulsedVenues: {},
      vibeDNA: null,
      cityPulse: null,
      featureFlags: {},
      followedVenues: [],
      livePushFeed: [],

      // Hydration tracker
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      // Auth helper - returns headers with Bearer token for authenticated requests
      getAuthHeaders: () => {
        const { sessionToken } = get();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }
        return headers;
      },

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
          const { sessionToken } = get();
          // If we have a session token, use it to fetch the authenticated user
          if (sessionToken) {
            const response = await fetch(`${API_URL}/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${sessionToken}` },
            });
            if (response.ok) {
              const userData = await response.json();
              set({ user: userData, isAuthenticated: true });
            } else {
              // Session expired or invalid - clear auth state
              set({ user: null, sessionToken: null, isAuthenticated: false });
            }
            return;
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      },

      // Fetch authenticated user via session
      fetchAuthUser: async () => {
        try {
          const { sessionToken } = get();
          const headers: Record<string, string> = {};
          if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
          }
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers,
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
            const data = await response.json();
            const { session_token, ...user } = data;
            set({ user, sessionToken: session_token, loading: false, isAuthenticated: true });
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

      // Login existing user by phone number
      loginUser: async (phone) => {
        set({ loading: true });
        try {
          const response = await fetch(`${API_URL}/api/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });

          if (response.ok) {
            const data = await response.json();
            const { session_token, ...user } = data;
            set({ user, sessionToken: session_token, loading: false, isAuthenticated: true });
            return { success: true };
          }

          const errorData = await response.json().catch(() => ({}));
          set({ loading: false });
          return { success: false, error: errorData.detail || 'User not found. Please sign up first.' };
        } catch (error) {
          console.error('Error logging in:', error);
          set({ loading: false });
          return { success: false, error: 'Connection error' };
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
            const data = await response.json();
            const { session_token, ...user } = data;
            set({ user, sessionToken: session_token, loading: false, isAuthenticated: true });
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
        // Capture token before clearing state
        const { sessionToken } = get();
        // Clear state immediately — UI updates at once, no waiting for network
        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
          isDemoMode: false,
          activeCheckin: null,
          crew: null,
          lobby: [],
        });
        // Fire-and-forget server-side session deletion
        if (sessionToken) {
          fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
          }).catch(() => {});
        }
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
          console.warn('fetchCities: network unavailable', error);
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
        // Demo mode: return venue from local demo data
        if (get().isDemoMode) {
          const demoVenue = get().venues.find((v: any) => v.id === id);
          return demoVenue || null;
        }
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
        const { user, isOnline, isDemoMode } = get();
        if (!user) {
          throw new Error('User not logged in');
        }

        // Demo mode: simulate successful rating + start cooldown
        if (isDemoMode) {
          set((state) => ({
            demoRatedVenues: { ...state.demoRatedVenues, [venueId]: Date.now() },
          }));
          return {
            success: true,
            clout_earned: 15,
            new_clout_total: (user as any).clout_points + 15,
            message: 'Demo rating submitted!',
          };
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
        const { user, isDemoMode, demoRatedVenues } = get();
        if (!user) {
          return { can_rate: false, ratings_count: 0, cooldown_remaining_seconds: 0 };
        }
        // Demo mode: simulate cooldown after first rating
        if (isDemoMode) {
          const lastRated = demoRatedVenues[venueId];
          if (lastRated) {
            const elapsed = (Date.now() - lastRated) / 1000;
            const remaining = Math.max(0, 1800 - elapsed);
            if (remaining > 0) {
              return { can_rate: false, ratings_count: 1, cooldown_remaining_seconds: Math.floor(remaining), can_skip: true, clout_cost: 50 };
            }
          }
          return { can_rate: true, ratings_count: 0, cooldown_remaining_seconds: 0 };
        }

        try {
          const response = await fetch(
            `${API_URL}/api/ratings/status/${user.id}/${venueId}`
          );
          return await response.json();
        } catch (error) {
          console.error('Error getting rating status:', error);
          return { can_rate: true, ratings_count: 0, cooldown_remaining_seconds: 0 };
        }
      },

      // Skip rating cooldown (spend Clout or pay)
      cooldownSkip: async (venueId, method) => {
        const { user, getAuthHeaders, isDemoMode } = get();
        if (!user) return { success: false, error: 'Not authenticated' };
        if (isDemoMode) {
          // Clear demo cooldown for this venue
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
          // Update local clout if method was clout
          if (method === 'clout' && data.clout_remaining !== undefined) {
            set((state) => ({
              user: state.user ? { ...state.user, clout_points: data.clout_remaining } : state.user,
            }));
          }
          return { success: true, clout_remaining: data.clout_remaining };
        } catch (error) {
          console.error('Error skipping cooldown:', error);
          return { success: false, error: 'Network error' };
        }
      },

      // Record direction click for ROI tracking
      recordDirectionClick: async (venueId) => {
        if (get().isDemoMode) return;
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

      // Lobby actions
      fetchLobby: async () => {
        const { getAuthHeaders, isAuthenticated, isDemoMode } = get();

        // Demo mode: use local mock lobby data
        if (isDemoMode) {
          const { DEMO_LOBBY } = require('../data/demoData');
          set({
            lobbyVenues: DEMO_LOBBY.venues,
            lobbyNudge: DEMO_LOBBY.nudge,
            lobbyLoading: false,
          });
          return;
        }

        if (!isAuthenticated) return;
        set({ lobbyLoading: true });
        try {
          const response = await fetch(`${API_URL}/api/lobby`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            set({
              lobbyVenues: data.venues || [],
              lobbyNudge: data.nudge || null,
              lobbyLoading: false,
            });
          } else {
            set({ lobbyLoading: false });
          }
        } catch (error) {
          console.error('Error fetching lobby:', error);
          set({ lobbyLoading: false });
        }
      },

      addToLobby: async (venueId: string) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/lobby`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ venue_id: venueId }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.added) {
              get().fetchLobby();
            }
            return data.added;
          }
          return false;
        } catch (error) {
          console.error('Error adding to lobby:', error);
          return false;
        }
      },

      removeFromLobby: async (venueId: string) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/lobby/${venueId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            set((state) => ({
              lobbyVenues: state.lobbyVenues.filter((v) => v.id !== venueId),
            }));
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error removing from lobby:', error);
          return false;
        }
      },

      isInLobby: (venueId: string) => {
        return get().lobbyVenues.some((v) => v.id === venueId);
      },

      // ===== Ghost Check-in Actions =====
      ghostCheckIn: async (venueId: string, lat: number, lng: number) => {
        const { getAuthHeaders, isDemoMode, venues } = get();
        if (isDemoMode) {
          const venue = venues.find((v: any) => v.id === venueId);
          const checkin = {
            user_id: 'demo_user_001',
            venue_id: venueId,
            venue_name: venue?.name || 'Demo Venue',
            status: 'active',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          };
          set({ activeCheckin: checkin });
          return { success: true, checkin };
        }
        try {
          let batteryLevel: number | undefined;
          try {
            const Battery = require('expo-battery');
            batteryLevel = await Battery.getBatteryLevelAsync();
          } catch {}
          const response = await fetch(`${API_URL}/api/checkins`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ venue_id: venueId, lat, lng, latitude: lat, longitude: lng, battery_level: batteryLevel }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || 'Check-in failed');
          get().fetchActiveCheckin();
          return data;
        } catch (error) {
          console.error('Error checking in:', error);
          throw error;
        }
      },

      ghostCheckOut: async (venueId: string) => {
        const { getAuthHeaders, isDemoMode } = get();
        if (isDemoMode) {
          set({ activeCheckin: null });
          return;
        }
        try {
          await fetch(`${API_URL}/api/checkins/${venueId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          set({ activeCheckin: null });
        } catch (error) {
          console.error('Error checking out:', error);
        }
      },

      fetchActiveCheckin: async () => {
        const { getAuthHeaders, isAuthenticated, isDemoMode } = get();
        if (!isAuthenticated) return;
        if (isDemoMode) {
          set({ activeCheckin: null });
          return;
        }
        try {
          const response = await fetch(`${API_URL}/api/checkins/me`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            set({ activeCheckin: data.checkin || null });
          }
        } catch (error) {
          console.error('Error fetching checkin:', error);
        }
      },

      fetchVenueCheckins: async (venueId: string) => {
        if (get().isDemoMode) {
          set({ venueCheckinCount: Math.floor(Math.random() * 30) + 5 });
          return;
        }
        try {
          const response = await fetch(`${API_URL}/api/checkins/venue/${venueId}`);
          if (response.ok) {
            const data = await response.json();
            set({ venueCheckinCount: data.active_count || 0 });
          }
        } catch (error) {
          console.error('Error fetching venue checkins:', error);
        }
      },

      // ===== Crew Location Tracker =====
      fetchCrewLocations: async (crewId: string) => {
        const { getAuthHeaders, isDemoMode } = get();
        if (isDemoMode) {
          const { DEMO_CREW_LOCATIONS } = require('../data/demoData');
          set({ crewLocations: DEMO_CREW_LOCATIONS });
          return;
        }
        try {
          const response = await fetch(`${API_URL}/api/crews/${crewId}/locations`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            set({ crewLocations: Array.isArray(data) ? data : [] });
          }
        } catch (error) {
          console.error('Error fetching crew locations:', error);
        }
      },

      toggleGhostMode: () => set((state) => ({ ghostMode: !state.ghostMode })),

      // ===== Vibe DNA =====
      fetchVibeDNA: async (userId: string) => {
        const { isDemoMode, getAuthHeaders } = get();
        if (isDemoMode) {
          const { DEMO_VIBE_DNA } = require('../data/demoData');
          set({ vibeDNA: DEMO_VIBE_DNA });
          return;
        }
        try {
          const res = await fetch(`${API_URL}/api/users/${userId}/dna`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.affinities)) {
              set({ vibeDNA: data });
            }
          }
        } catch (e) {
          console.error('fetchVibeDNA error:', e);
        }
      },

      // ===== City Pulse =====
      fetchCityPulse: async (city: string) => {
        const { isDemoMode } = get();
        if (isDemoMode) {
          const { DEMO_CITY_PULSE } = require('../data/demoData');
          set({ cityPulse: { ...DEMO_CITY_PULSE, city } });
          return;
        }
        try {
          const res = await fetch(`${API_URL}/api/city-pulse/${city}`);
          if (res.ok) {
            const data = await res.json();
            set({ cityPulse: data });
          }
        } catch (e) {
          console.error('fetchCityPulse error:', e);
        }
      },

      dropQuickPulse: async (venueId: string, lat: number, lng: number) => {
        const { user, getAuthHeaders, isDemoMode, demoPulsedVenues } = get();
        if (!user) return { success: false };

        if (isDemoMode) {
          const lastPulsed = demoPulsedVenues[venueId];
          if (lastPulsed && Date.now() - lastPulsed < 15 * 60 * 1000) {
            return { success: false };
          }
          set((state) => ({
            demoPulsedVenues: { ...state.demoPulsedVenues, [venueId]: Date.now() },
            user: state.user
              ? { ...state.user, clout_points: (state.user.clout_points || 0) + 3 }
              : state.user,
          }));
          // Also refresh city pulse to simulate updated count
          const { DEMO_CITY_PULSE } = require('../data/demoData');
          set((state) => ({
            cityPulse: state.cityPulse
              ? { ...state.cityPulse, pulses_tonight: state.cityPulse.pulses_tonight + 1 }
              : { ...DEMO_CITY_PULSE, pulses_tonight: DEMO_CITY_PULSE.pulses_tonight + 1 },
          }));
          return { success: true, clout_earned: 3 };
        }

        try {
          const res = await fetch(`${API_URL}/api/pulse`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ user_id: user.id, venue_id: venueId, lat, lng }),
          });
          const data = await res.json();
          if (!res.ok) return { success: false };
          if (data.clout_earned) {
            set((state) => ({
              user: state.user
                ? { ...state.user, clout_points: (state.user.clout_points || 0) + data.clout_earned }
                : state.user,
            }));
          }
          // Refresh city pulse after drop
          get().fetchCityPulse(get().selectedCity);
          return { success: true, clout_earned: data.clout_earned };
        } catch (e) {
          console.error('dropQuickPulse error:', e);
          return { success: false };
        }
      },

      // ===== Feature Flags =====
      fetchFeatureFlags: async () => {
        try {
          const res = await fetch(`${API_URL}/api/feature-flags`);
          if (res.ok) {
            const data = await res.json();
            set({ featureFlags: data.flags || {} });
          }
        } catch (e) {
          // silently fail — all features default to enabled
        }
      },

      isFeatureEnabled: (flag: string) => {
        const { featureFlags, isDemoMode } = get();
        // Demo mode: all features on so demos look complete
        if (isDemoMode) return true;
        // If flags not loaded yet, default to enabled
        if (Object.keys(featureFlags).length === 0) return true;
        return featureFlags[flag] !== false;
      },

      // ===== Vibe+ Subscription =====
      isVibePlus: () => {
        const { user, isDemoMode } = get();
        // Demo mode: always show premium features
        if (isDemoMode) return true;
        if (!user || !user.is_vibe_plus) return false;
        // Client-side expiry check (backend is authoritative, this prevents stale UI)
        if (user.vibe_plus_expires_at) {
          const expires = new Date(user.vibe_plus_expires_at);
          if (expires < new Date()) return false;
        }
        return true;
      },

      initializeVibePlus: async () => {
        const { getAuthHeaders, user } = get();
        const res = await fetch(`${API_URL}/api/subscription/initialize`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ email: user?.email }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Could not start payment. Please try again.');
        }
        return await res.json();
      },

      verifyVibePlus: async (reference: string) => {
        const { getAuthHeaders } = get();
        const res = await fetch(`${API_URL}/api/subscription/verify/${reference}`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Verification failed');
        }
        const data = await res.json();
        if (data.success && data.is_vibe_plus) {
          const { user } = get();
          if (user) {
            set({ user: { ...user, is_vibe_plus: true, vibe_plus_expires_at: data.expires_at } });
          }
        }
        return data;
      },

      refreshSubscriptionStatus: async () => {
        const { getAuthHeaders, user } = get();
        if (!user) return;
        try {
          const res = await fetch(`${API_URL}/api/subscription/status`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            set({ user: { ...user, is_vibe_plus: data.is_vibe_plus, vibe_plus_expires_at: data.expires_at } });
          }
        } catch {
          // Non-critical — fail silently
        }
      },

      // ===== Streak Actions =====
      fetchStreak: async () => {
        const { getAuthHeaders, isAuthenticated } = get();
        if (!isAuthenticated) return;
        try {
          const response = await fetch(`${API_URL}/api/streaks/me`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            set({ streak: data });
          }
        } catch (error) {
          console.error('Error fetching streak:', error);
        }
      },

      // ===== Story Actions =====
      fetchStories: async (venueId: string) => {
        if (get().isDemoMode) {
          const { DEMO_STORIES } = require('../data/demoData');
          const stories = DEMO_STORIES.filter((s: any) => s.venue_id === venueId);
          set({ venueStories: stories });
          return;
        }
        try {
          const response = await fetch(`${API_URL}/api/stories/venue/${venueId}`);
          if (response.ok) {
            const data = await response.json();
            set({ venueStories: data.stories || [] });
          }
        } catch (error) {
          console.error('Error fetching stories:', error);
        }
      },

      postStory: async (venueId: string, mediaUrl: string, caption: string, lat: number, lng: number) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/stories`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              venue_id: venueId,
              media_url: mediaUrl,
              caption,
              latitude: lat,
              longitude: lng,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || 'Failed to post story');
          return data;
        } catch (error) {
          console.error('Error posting story:', error);
          throw error;
        }
      },

      viewStory: async (storyId: string) => {
        const { getAuthHeaders } = get();
        try {
          await fetch(`${API_URL}/api/stories/${storyId}/view`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });
        } catch (error) {
          console.error('Error viewing story:', error);
        }
      },

      // ===== Timeline Actions =====
      fetchTimeline: async (venueId: string) => {
        if (get().isDemoMode) {
          // Generate realistic hourly timeline for demo
          const hours = ['6PM', '7PM', '8PM', '9PM', '10PM', '11PM', '12AM', '1AM', '2AM'];
          const scores = [25, 38, 52, 68, 82, 91, 88, 75, 45];
          const energies = ['chill', 'chill', 'popping', 'popping', 'electric', 'electric', 'electric', 'popping', 'chill'];
          set({
            venueTimeline: hours.map((hour, i) => ({
              hour,
              hour_label: hour,
              avg_vibe_score: scores[i],
              peak_score: scores[i] + 5,
              energy_level: energies[i],
              rating_count: Math.floor(Math.random() * 15) + 3,
              checkin_count: Math.floor(Math.random() * 20) + 2,
            })),
            timelinePeakHour: '11PM',
          });
          return;
        }
        try {
          const response = await fetch(`${API_URL}/api/timeline/${venueId}`);
          if (response.ok) {
            const data = await response.json();
            set({
              venueTimeline: data.timeline || [],
              timelinePeakHour: data.peak_hour || null,
            });
          }
        } catch (error) {
          console.error('Error fetching timeline:', error);
        }
      },

      // ===== Crew Actions =====
      createCrew: async (name: string) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/crews`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || 'Failed to create crew');
          get().fetchCrew();
          return data;
        } catch (error) {
          console.error('Error creating crew:', error);
          throw error;
        }
      },

      joinCrew: async (inviteCode: string) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/crews/join`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ invite_code: inviteCode }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || 'Failed to join crew');
          get().fetchCrew();
          return data;
        } catch (error) {
          console.error('Error joining crew:', error);
          throw error;
        }
      },

      fetchCrew: async () => {
        const { getAuthHeaders, isAuthenticated } = get();
        if (!isAuthenticated) return;
        try {
          const response = await fetch(`${API_URL}/api/crews/me`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            set({
              crew: data.crew || null,
              activeVote: data.crew?.active_vote || null,
            });
          }
        } catch (error) {
          console.error('Error fetching crew:', error);
        }
      },

      leaveCrew: async (crewId: string) => {
        const { getAuthHeaders } = get();
        try {
          await fetch(`${API_URL}/api/crews/${crewId}/leave`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          set({ crew: null, activeVote: null });
        } catch (error) {
          console.error('Error leaving crew:', error);
        }
      },

      startVote: async (crewId: string, venueIds: string[]) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/crews/${crewId}/vote`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ venue_ids: venueIds }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || 'Failed to start vote');
          get().fetchCrew();
          return data;
        } catch (error) {
          console.error('Error starting vote:', error);
          throw error;
        }
      },

      castVote: async (crewId: string, voteId: string, venueId: string) => {
        const { getAuthHeaders } = get();
        try {
          const response = await fetch(`${API_URL}/api/crews/${crewId}/vote/${voteId}/cast`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ venue_id: venueId }),
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to cast vote');
          }
          get().fetchCrew();
        } catch (error) {
          console.error('Error casting vote:', error);
          throw error;
        }
      },

      // ===== Alert Actions =====
      registerPushToken: async (token: string) => {
        const { getAuthHeaders, isAuthenticated } = get();
        if (!isAuthenticated) return;
        try {
          await fetch(`${API_URL}/api/alerts/register`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ expo_push_token: token }),
          });
        } catch (error) {
          console.error('Error registering push token:', error);
        }
      },

      updateAlertPrefs: async (prefs: Partial<AlertPrefs>) => {
        const { getAuthHeaders, alertPrefs } = get();
        const merged = { ...alertPrefs, ...prefs };
        try {
          await fetch(`${API_URL}/api/alerts/preferences`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(merged),
          });
          set({ alertPrefs: merged as AlertPrefs });
        } catch (error) {
          console.error('Error updating alert prefs:', error);
        }
      },

      fetchAlertPrefs: async () => {
        const { getAuthHeaders, isAuthenticated } = get();
        if (!isAuthenticated) return;
        try {
          const response = await fetch(`${API_URL}/api/alerts/preferences`, {
            headers: getAuthHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            set({ alertPrefs: data });
          }
        } catch (error) {
          console.error('Error fetching alert prefs:', error);
        }
      },

      // ===== Onboarding =====
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      completeMerchantOnboarding: () => set({ hasSeenMerchantOnboarding: true }),

      // ===== Demo Mode =====
      toggleDemoMode: () => {
        const { isDemoMode, user, sessionToken } = get();
        if (!isDemoMode) {
          // Entering demo mode - save real user, set demo user
          set({
            isDemoMode: true,
            user: DEMO_USER as any,
            isAuthenticated: true,
            venues: DEMO_VENUES as any[],
            streak: DEMO_STREAK as any,
            crew: DEMO_CREW as any,
            activeCampaigns: DEMO_ACTIVE_CAMPAIGNS as any[],
          });
        } else {
          // Exiting demo mode - clear demo data then fetch live venues
          set({
            isDemoMode: false,
            user: null,
            sessionToken: null,
            isAuthenticated: false,
            venues: [],
            streak: null,
            crew: null,
            activeCampaigns: [],
            vibeDNA: null,
          });
          get().fetchVenues(get().selectedCity);
        }
      },

      // ===== Demo Tutorial =====
      completeDemoTutorial: () => set({ hasSeenDemoTutorial: true }),
      restartDemoTutorial: () => set({ hasSeenDemoTutorial: false }),

      // ===== Avatar & Privacy =====
      updateAvatar: (config) => {
        set({ avatarConfig: config });
      },
      toggleLocationSharing: () => {
        set({ locationSharingEnabled: !get().locationSharingEnabled });
      },
      setVibePersona: (persona) => set({ vibePersona: persona }),
      setUserMode: (mode) => set({ userMode: mode }),
      setSceneMood: (mood) => set({ sceneMood: mood, sceneMoodSetAt: new Date().toISOString() }),
      setTabBarHidden: (hidden) => set({ tabBarHidden: hidden }),

      // ===== Campaign Actions =====
      fetchActiveCampaigns: async (city?: string) => {
        const cityParam = city || get().selectedCity;
        try {
          const response = await fetch(`${API_URL}/api/campaigns/active?city=${cityParam}`);
          if (response.ok) {
            const data = await response.json();
            set({ activeCampaigns: data.campaigns || [] });
          }
        } catch (error) {
          console.error('Error fetching campaigns:', error);
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

        newSocket.on('city_pulse_update', (data: CityPulseData) => {
          set({ cityPulse: data });
        });

        newSocket.on('venue_live_push', (push: LivePush) => {
          set((state) => ({
            livePushFeed: [push, ...state.livePushFeed].slice(0, 50),
          }));
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        set({ socket: newSocket });
      },

      // ── Venue Live ──────────────────────────────────────────────────────────

      followVenue: async (venueId: string) => {
        const { getAuthHeaders, isDemoMode } = get();
        if (isDemoMode) return true;
        try {
          const res = await fetch(`${API_URL}/api/venues/${venueId}/follow`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });
          if (!res.ok) return false;
          await get().fetchFollowing();
          return true;
        } catch { return false; }
      },

      unfollowVenue: async (venueId: string) => {
        const { getAuthHeaders, isDemoMode } = get();
        if (isDemoMode) return;
        try {
          await fetch(`${API_URL}/api/venues/${venueId}/follow`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          await get().fetchFollowing();
        } catch { /* ignore */ }
      },

      fetchFollowing: async () => {
        const { getAuthHeaders, isDemoMode, isAuthenticated } = get();
        if (!isAuthenticated || isDemoMode) return;
        try {
          const res = await fetch(`${API_URL}/api/venues/me/following`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            set({ followedVenues: data.following || [] });
          }
        } catch { /* ignore */ }
      },

      fetchFollowingFeed: async () => {
        const { getAuthHeaders, isDemoMode, isAuthenticated } = get();
        if (!isAuthenticated || isDemoMode) return;
        try {
          const res = await fetch(`${API_URL}/api/venues/following/feed`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            set({ livePushFeed: data.pushes || [] });
          }
        } catch { /* ignore */ }
      },

      setDeyRoad: async (venueId: string, status: 'enroute' | 'maybe' | 'pass' = 'enroute') => {
        const { getAuthHeaders, isDemoMode } = get();
        if (isDemoMode) return 0;
        try {
          const res = await fetch(`${API_URL}/api/venues/${venueId}/heading`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });
          if (res.ok) {
            const data = await res.json();
            return data.enroute ?? 0;
          }
          return 0;
        } catch { return 0; }
      },

      cancelDeyRoad: async (venueId: string) => {
        const { getAuthHeaders, isDemoMode } = get();
        if (isDemoMode) return;
        try {
          await fetch(`${API_URL}/api/venues/${venueId}/heading`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
        } catch { /* ignore */ }
      },

      sendLivePush: async (venueId: string, message: string) => {
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
          return { success: false, notifications_sent: 0, error: e.message };
        }
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
        sessionToken: state.sessionToken,
        selectedCity: state.selectedCity,
        isAuthenticated: state.isAuthenticated,
        pendingRatings: state.pendingRatings,
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

// ===== NIGHT PHASE DETECTION =====
export type NightPhase = 'planning' | 'locked_in' | 'recap';

/**
 * Derives the current night phase from store state.
 * - 'locked_in': user has an active check-in
 * - 'planning': evening hours (6PM-4AM) with no check-in
 * - 'recap': daytime / morning after
 * In demo mode, always returns 'planning' unless checked in.
 */
export function getNightPhase(activeCheckin: ActiveCheckin | null, isDemoMode: boolean): NightPhase {
  if (activeCheckin) return 'locked_in';
  const hour = new Date().getHours();
  if (hour >= 18 || hour < 4) return 'planning';
  if (isDemoMode) return 'planning';
  return 'recap';
}
