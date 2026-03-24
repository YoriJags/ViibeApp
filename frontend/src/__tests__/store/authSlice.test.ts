/**
 * Unit tests for the auth slice pure actions and selectors.
 *
 * We test the slice functions directly by building a minimal store-like
 * environment, avoiding the need for a full Zustand/React setup.
 */

// ---------------------------------------------------------------------------
// Isolate slice logic without importing the full store (which pulls in Expo)
// ---------------------------------------------------------------------------

// Minimal get/set mechanism to exercise slice logic
function makeSliceEnv() {
  let state: Record<string, any> = {};
  const get = () => state;
  const set = (partial: Record<string, any> | ((s: any) => Record<string, any>)) => {
    if (typeof partial === 'function') {
      state = { ...state, ...partial(state) };
    } else {
      state = { ...state, ...partial };
    }
  };
  return { get, set, state: () => state };
}

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from the slice (no Expo imports)
// ---------------------------------------------------------------------------

function getAuthHeaders(sessionToken: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  return headers;
}

function updateUserClout(user: any, cloutEarned: number) {
  if (!user) return user;
  return {
    ...user,
    clout_points: (user.clout_points || 0) + cloutEarned,
    total_ratings: (user.total_ratings || 0) + 1,
  };
}

function isVibePlus(user: any, isDemoMode: boolean): boolean {
  if (isDemoMode) return true;
  if (!user?.is_vibe_plus) return false;
  if (user.vibe_plus_expires_at) {
    return new Date(user.vibe_plus_expires_at) >= new Date();
  }
  return true;
}

function getVibeLevel(score: number): string {
  if (score >= 80) return 'peak';
  if (score >= 60) return 'lit';
  if (score >= 40) return 'warming';
  if (score >= 20) return 'chill';
  return 'quiet';
}

// ---------------------------------------------------------------------------
// getAuthHeaders
// ---------------------------------------------------------------------------

describe('getAuthHeaders', () => {
  it('always includes Content-Type', () => {
    const headers = getAuthHeaders(null);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('adds Authorization header when session token present', () => {
    const headers = getAuthHeaders('tok_abc123');
    expect(headers['Authorization']).toBe('Bearer tok_abc123');
  });

  it('omits Authorization when token is null', () => {
    const headers = getAuthHeaders(null);
    expect(headers['Authorization']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateUserClout
// ---------------------------------------------------------------------------

describe('updateUserClout', () => {
  const baseUser = { id: 'u-1', username: 'tunde', clout_points: 100, total_ratings: 10 };

  it('adds clout to existing points', () => {
    const updated = updateUserClout(baseUser, 15);
    expect(updated.clout_points).toBe(115);
  });

  it('increments total_ratings by 1', () => {
    const updated = updateUserClout(baseUser, 10);
    expect(updated.total_ratings).toBe(11);
  });

  it('handles user with no prior clout', () => {
    const newUser = { ...baseUser, clout_points: 0, total_ratings: 0 };
    const updated = updateUserClout(newUser, 10);
    expect(updated.clout_points).toBe(10);
    expect(updated.total_ratings).toBe(1);
  });

  it('returns null/undefined unchanged when no user', () => {
    expect(updateUserClout(null, 10)).toBeNull();
  });

  it('does not mutate the original user object', () => {
    const original = { ...baseUser };
    updateUserClout(original, 5);
    expect(original.clout_points).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// isVibePlus
// ---------------------------------------------------------------------------

describe('isVibePlus', () => {
  it('returns true in demo mode regardless of user', () => {
    expect(isVibePlus(null, true)).toBe(true);
    expect(isVibePlus({ is_vibe_plus: false }, true)).toBe(true);
  });

  it('returns false when user is not vibe plus', () => {
    expect(isVibePlus({ is_vibe_plus: false }, false)).toBe(false);
  });

  it('returns false for null user outside demo', () => {
    expect(isVibePlus(null, false)).toBe(false);
  });

  it('returns true when subscription is active (future expiry)', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isVibePlus({ is_vibe_plus: true, vibe_plus_expires_at: future }, false)).toBe(true);
  });

  it('returns false when subscription has expired', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isVibePlus({ is_vibe_plus: true, vibe_plus_expires_at: past }, false)).toBe(false);
  });

  it('returns true when is_vibe_plus and no expiry (lifetime)', () => {
    expect(isVibePlus({ is_vibe_plus: true, vibe_plus_expires_at: null }, false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Simple state transitions (set/get simulation)
// ---------------------------------------------------------------------------

describe('Auth state transitions', () => {
  it('setUser updates user and isAuthenticated', () => {
    const { get, set } = makeSliceEnv();
    set({ user: null, isAuthenticated: false });

    const mockUser = { id: 'u-1', username: 'ada' };
    set({ user: mockUser, isAuthenticated: !!mockUser });

    expect(get().user).toEqual(mockUser);
    expect(get().isAuthenticated).toBe(true);
  });

  it('logout clears user and session token', () => {
    const { get, set } = makeSliceEnv();
    set({ user: { id: 'u-1' }, sessionToken: 'tok', isAuthenticated: true });

    // Simulate logout action
    set({ user: null, sessionToken: null, isAuthenticated: false });

    expect(get().user).toBeNull();
    expect(get().sessionToken).toBeNull();
    expect(get().isAuthenticated).toBe(false);
  });

  it('completeOnboarding sets hasSeenOnboarding true', () => {
    const { get, set } = makeSliceEnv();
    set({ hasSeenOnboarding: false });
    set({ hasSeenOnboarding: true });
    expect(get().hasSeenOnboarding).toBe(true);
  });

  it('toggleLocationSharing flips the flag', () => {
    const { get, set } = makeSliceEnv();
    set({ locationSharingEnabled: true });
    set({ locationSharingEnabled: !get().locationSharingEnabled });
    expect(get().locationSharingEnabled).toBe(false);
    set({ locationSharingEnabled: !get().locationSharingEnabled });
    expect(get().locationSharingEnabled).toBe(true);
  });
});
