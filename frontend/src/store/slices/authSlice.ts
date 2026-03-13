import { StateCreator } from 'zustand';
import { User } from '../types';
import { DEMO_USER, DEMO_VENUES, DEMO_STREAK, DEMO_CREW, DEMO_ACTIVE_CAMPAIGNS } from '../../data/demoData';
import type { VibeStore } from '../vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface AuthSlice {
  // ── State ────────────────────────────────────────────────────────────────────
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  hasSeenMerchantOnboarding: boolean;
  isDemoMode: boolean;
  hasSeenDemoTutorial: boolean;
  avatarConfig: { emoji: string; bgColor: string; accentColor: string } | null;
  locationSharingEnabled: boolean;
  vibePersona: 'turn_up' | 'grown_sexy' | 'culture' | 'chill_set' | null;
  userMode: 'scout' | 'insider' | null;
  sceneMood: 'easy_flow' | 'high_energy' | 'mixed_scene' | 'low_key' | null;
  sceneMoodSetAt: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────────
  getAuthHeaders: () => Record<string, string>;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  updateUserClout: (cloutEarned: number) => void;
  fetchUser: () => Promise<void>;
  fetchAuthUser: () => Promise<User | null>;
  createUser: (username: string, phone: string) => Promise<boolean>;
  loginUser: (phone: string) => Promise<{ success: boolean; error?: string }>;
  processGoogleAuth: (sessionId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  completeOnboarding: () => void;
  completeMerchantOnboarding: () => void;
  toggleDemoMode: () => void;
  completeDemoTutorial: () => void;
  restartDemoTutorial: () => void;
  updateAvatar: (config: { emoji: string; bgColor: string; accentColor: string }) => void;
  toggleLocationSharing: () => void;
  setVibePersona: (persona: 'turn_up' | 'grown_sexy' | 'culture' | 'chill_set') => void;
  setUserMode: (mode: 'scout' | 'insider') => void;
  setSceneMood: (mood: 'easy_flow' | 'high_energy' | 'mixed_scene' | 'low_key') => void;
  isVibePlus: () => boolean;
  initializeVibePlus: () => Promise<{ authorization_url: string; reference: string }>;
  verifyVibePlus: (reference: string) => Promise<{ success: boolean; is_vibe_plus: boolean; expires_at?: string }>;
  refreshSubscriptionStatus: () => Promise<void>;
}

export const createAuthSlice: StateCreator<
  VibeStore,
  [['zustand/persist', unknown]],
  [],
  AuthSlice
> = (set, get) => ({
  user: null,
  sessionToken: null,
  isAuthenticated: false,
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

  getAuthHeaders: () => {
    const { sessionToken } = get();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
    return headers;
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),

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

  fetchUser: async () => {
    try {
      const { sessionToken } = get();
      if (sessionToken) {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (response.ok) {
          const userData = await response.json();
          set({ user: userData, isAuthenticated: true });
        } else {
          set({ user: null, sessionToken: null, isAuthenticated: false });
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  },

  fetchAuthUser: async () => {
    try {
      const { sessionToken } = get();
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
      const response = await fetch(`${API_URL}/api/auth/me`, { headers, credentials: 'include' });
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

  logout: async () => {
    const { sessionToken } = get();
    set({
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      isDemoMode: false,
      activeCheckin: null,
      crew: null,
      lobbyVenues: [],
    });
    if (sessionToken) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => {});
    }
  },

  completeOnboarding: () => set({ hasSeenOnboarding: true }),
  completeMerchantOnboarding: () => set({ hasSeenMerchantOnboarding: true }),

  toggleDemoMode: () => {
    const { isDemoMode } = get();
    if (!isDemoMode) {
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

  completeDemoTutorial: () => set({ hasSeenDemoTutorial: true }),
  restartDemoTutorial: () => set({ hasSeenDemoTutorial: false }),
  updateAvatar: (config) => set({ avatarConfig: config }),
  toggleLocationSharing: () => set({ locationSharingEnabled: !get().locationSharingEnabled }),
  setVibePersona: (persona) => set({ vibePersona: persona }),
  setUserMode: (mode) => set({ userMode: mode }),
  setSceneMood: (mood) => set({ sceneMood: mood, sceneMoodSetAt: new Date().toISOString() }),

  isVibePlus: () => {
    const { user, isDemoMode } = get();
    if (isDemoMode) return true;
    if (!user?.is_vibe_plus) return false;
    if (user.vibe_plus_expires_at) {
      return new Date(user.vibe_plus_expires_at) >= new Date();
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

  verifyVibePlus: async (reference) => {
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
      if (user) set({ user: { ...user, is_vibe_plus: true, vibe_plus_expires_at: data.expires_at } });
    }
    return data;
  },

  refreshSubscriptionStatus: async () => {
    const { getAuthHeaders, user } = get();
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/subscription/status`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ user: { ...user, is_vibe_plus: data.is_vibe_plus, vibe_plus_expires_at: data.expires_at } });
      }
    } catch { /* non-critical */ }
  },
});
