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
    label: "I'm Heading There",
    shortLabel: 'Heading',
    icon: 'navigate-circle' as const,
    activeColor: '#4ade80',
    activeBg: '#4ade8018',
    activeBorder: '#4ade8055',
    inactiveColor: '#444',
  },
  maybe: {
    label: 'Still Deciding',
    shortLabel: 'Maybe',
    icon: 'time' as const,
    activeColor: '#fbbf24',
    activeBg: '#fbbf2418',
    activeBorder: '#fbbf2455',
    inactiveColor: '#444',
  },
  pass: {
    label: 'Not Tonight',
    shortLabel: 'Pass',
    icon: 'moon' as const,
    activeColor: '#f87171',
    activeBg: '#f8717118',
    activeBorder: '#f8717155',
    inactiveColor: '#444',
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

  const headingCount = counts.enroute + counts.maybe;

  return (
    <View style={styles.container}>
      {/* Header row: social proof + follow */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>SCENE PLANS</Text>
          {headingCount > 0 && (
            <Text style={styles.socialProof}>
              {counts.enroute > 0 ? `${counts.enroute} heading here` : ''}
              {counts.enroute > 0 && counts.maybe > 0 ? '  ·  ' : ''}
              {counts.maybe > 0 ? `${counts.maybe} deciding` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={isDemoMode ? () => setIsFollowing(f => !f) : handleFollow}
          disabled={loadingFollow}
          activeOpacity={0.7}
        >
          {loadingFollow ? (
            <ActivityIndicator size="small" color={isFollowing ? '#ff4d6d' : '#555'} />
          ) : (
            <>
              <Ionicons
                name={isFollowing ? 'notifications' : 'notifications-outline'}
                size={13}
                color={isFollowing ? '#ff4d6d' : '#555'}
              />
              <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                {isFollowing ? 'Alerts On' : 'Get Alerts'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
                activeOpacity={0.75}
              >
                <Ionicons
                  name={cfg.icon}
                  size={18}
                  color={isActive ? cfg.activeColor : cfg.inactiveColor}
                />
                <Text style={[styles.intentLabel, isActive && { color: cfg.activeColor }]}>
                  {cfg.shortLabel}
                </Text>
                {counts[intent] > 0 && (
                  <View style={[styles.countBadge, isActive && { backgroundColor: cfg.activeColor + '30' }]}>
                    <Text style={[styles.countText, isActive && { color: cfg.activeColor }]}>
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
    backgroundColor: '#0C0C18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A1A28',
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
  },
  headerLeft: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3A3A4E',
    letterSpacing: 2,
    marginBottom: 3,
  },
  socialProof: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '600',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A38',
    backgroundColor: '#111120',
  },
  followBtnActive: {
    backgroundColor: '#ff4d6d12',
    borderColor: '#ff4d6d40',
  },
  followBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 0.3,
  },
  followBtnTextActive: {
    color: '#ff4d6d',
  },
  intentRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 6,
  },
  intentBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A28',
    backgroundColor: '#0A0A14',
  },
  intentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444',
    letterSpacing: 0.2,
  },
  countBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    backgroundColor: '#1A1A28',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555',
  },
});
