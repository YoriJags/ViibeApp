/**
 * VenueIntentBar
 * Three-tap intent signal for any venue type (clubs, lounges, raves, restaurants, events, etc.)
 *
 * Enroute  → confirmed, heading there
 * Maybe    → still deciding
 * Pass     → not tonight
 *
 * Also shows Follow toggle.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Intent = 'enroute' | 'maybe' | 'pass' | null;

interface IntentCounts {
  enroute: number;
  maybe: number;
  pass: number;
}

interface Props {
  venueId: string;
  venueName?: string;
}

const INTENT_CONFIG = {
  enroute: {
    label: 'Enroute',
    icon: 'navigate' as const,
    activeColor: '#4ade80',
    activeBg: '#4ade8020',
    activeBorder: '#4ade80',
    inactiveColor: '#555',
  },
  maybe: {
    label: 'Maybe',
    icon: 'help-circle' as const,
    activeColor: '#fbbf24',
    activeBg: '#fbbf2420',
    activeBorder: '#fbbf24',
    inactiveColor: '#555',
  },
  pass: {
    label: 'Pass',
    icon: 'close-circle' as const,
    activeColor: '#f87171',
    activeBg: '#f8717120',
    activeBorder: '#f87171',
    inactiveColor: '#555',
  },
};

export default function VenueIntentBar({ venueId, venueName }: Props) {
  const { setDeyRoad, cancelDeyRoad, followVenue, unfollowVenue, getAuthHeaders, isDemoMode } = useVibeStore();

  const [activeIntent, setActiveIntent] = useState<Intent>(null);
  const [counts, setCounts] = useState<IntentCounts>({ enroute: 0, maybe: 0, pass: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [initialised, setInitialised] = useState(false);

  // Scale animations for tap feedback
  const scaleAnims = {
    enroute: new Animated.Value(1),
    maybe: new Animated.Value(1),
    pass: new Animated.Value(1),
  };

  useEffect(() => {
    fetchStatus();
  }, [venueId]);

  const fetchStatus = async () => {
    if (isDemoMode) {
      setCounts({ enroute: 4, maybe: 2, pass: 1 });
      setInitialised(true);
      return;
    }
    try {
      const headers = getAuthHeaders();
      const [countRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/venues/${venueId}/heading-count`),
        fetch(`${API_URL}/api/venues/${venueId}/follow-status`, { headers }),
      ]);
      if (countRes.ok) {
        const c = await countRes.json();
        setCounts({ enroute: c.enroute ?? 0, maybe: c.maybe ?? 0, pass: c.pass ?? 0 });
      }
      if (statusRes.ok) {
        const s = await statusRes.json();
        setIsFollowing(s.following ?? false);
      }
    } catch { /* ignore */ }
    setInitialised(true);
  };

  const animateTap = (intent: keyof typeof scaleAnims) => {
    Animated.sequence([
      Animated.timing(scaleAnims[intent], { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnims[intent], { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handleIntent = async (intent: Intent) => {
    if (!intent || loadingIntent) return;
    animateTap(intent);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setLoadingIntent(true);
    if (activeIntent === intent) {
      // Toggle off
      await cancelDeyRoad(venueId);
      setActiveIntent(null);
      setCounts(prev => ({ ...prev, [intent]: Math.max(0, prev[intent] - 1) }));
    } else {
      // Switch or set
      const prev = activeIntent;
      setActiveIntent(intent);
      if (prev) {
        setCounts(c => ({ ...c, [prev]: Math.max(0, c[prev] - 1) }));
      }
      const newEnroute = await setDeyRoad(venueId, intent);
      setCounts(c => ({ ...c, [intent]: c[intent] + 1, enroute: intent === 'enroute' ? newEnroute : c.enroute }));
    }
    setLoadingIntent(false);
  };

  const handleFollow = async () => {
    if (loadingFollow) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingFollow(true);
    if (isFollowing) {
      await unfollowVenue(venueId);
      setIsFollowing(false);
    } else {
      await followVenue(venueId);
      setIsFollowing(true);
    }
    setLoadingFollow(false);
  };

  if (!initialised) return null;

  return (
    <View style={styles.container}>
      {/* Follow button */}
      <TouchableOpacity
        style={[styles.followBtn, isFollowing && styles.followBtnActive]}
        onPress={isDemoMode ? () => setIsFollowing(f => !f) : handleFollow}
        disabled={loadingFollow}
      >
        {loadingFollow ? (
          <ActivityIndicator size="small" color={isFollowing ? '#ff4d6d' : '#888'} />
        ) : (
          <>
            <Ionicons
              name={isFollowing ? 'notifications' : 'notifications-outline'}
              size={15}
              color={isFollowing ? '#ff4d6d' : '#888'}
            />
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Intent taps */}
      <View style={styles.intentRow}>
        {(Object.keys(INTENT_CONFIG) as Intent[]).map((intent) => {
          if (!intent) return null;
          const cfg = INTENT_CONFIG[intent];
          const isActive = activeIntent === intent;
          return (
            <Animated.View key={intent} style={{ transform: [{ scale: scaleAnims[intent] }], flex: 1 }}>
              <TouchableOpacity
                style={[
                  styles.intentBtn,
                  isActive && {
                    backgroundColor: cfg.activeBg,
                    borderColor: cfg.activeBorder,
                  },
                ]}
                onPress={() => handleIntent(intent)}
                disabled={loadingIntent}
              >
                <Ionicons
                  name={cfg.icon}
                  size={16}
                  color={isActive ? cfg.activeColor : cfg.inactiveColor}
                />
                <Text style={[
                  styles.intentLabel,
                  isActive && { color: cfg.activeColor },
                ]}>
                  {cfg.label}
                </Text>
                {counts[intent] > 0 && (
                  <View style={[styles.countBadge, isActive && { backgroundColor: cfg.activeColor }]}>
                    <Text style={[styles.countText, isActive && { color: '#000' }]}>
                      {counts[intent]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: 'hidden',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  followBtnActive: {
    backgroundColor: '#ff4d6d12',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  followBtnTextActive: {
    color: '#ff4d6d',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e1e1e',
    marginHorizontal: 12,
  },
  intentRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 6,
  },
  intentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0d0d0d',
  },
  intentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  countBadge: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
  },
});
