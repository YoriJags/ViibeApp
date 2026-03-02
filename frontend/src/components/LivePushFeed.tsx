/**
 * LivePushFeed
 * Shows recent live blasts from venues the user follows.
 * Tapping a card opens that venue's detail page.
 * Shows on the public home screen above the venue list.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore, LivePush } from '../store/vibeStore';

const CATEGORY_ICONS: Record<string, string> = {
  club:         '🎶',
  lounge:       '🥂',
  rave:         '⚡',
  bar:          '🍺',
  restaurant:   '🍽',
  concert:      '🎤',
  block_party:  '🏙',
  event:        '🎟',
  church:       '✝',
  brunch:       '☀️',
  rooftop:      '🌃',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

interface Props {
  onEmpty?: () => void;
}

export default function LivePushFeed({ onEmpty }: Props) {
  const router = useRouter();
  const { livePushFeed, fetchFollowingFeed, isAuthenticated, isDemoMode } = useVibeStore();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAuthenticated || isDemoMode) {
      fetchFollowingFeed();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (livePushFeed.length === 0 && onEmpty) onEmpty();
  }, [livePushFeed.length]);

  // Pulse animation for the live dot
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (livePushFeed.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
        <Text style={styles.headerText}>Live Updates</Text>
        <Text style={styles.headerSub}>from venues you follow</Text>
      </View>

      {/* Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {livePushFeed.map((push: LivePush, i: number) => (
          <TouchableOpacity
            key={push.push_id || i}
            style={styles.card}
            onPress={() => router.push(`/venue/${push.venue_id}`)}
            activeOpacity={0.85}
          >
            {/* Venue icon + name */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>
                {CATEGORY_ICONS[push.venue_category] || '📍'}
              </Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardVenueName} numberOfLines={1}>
                  {push.venue_name}
                </Text>
                <Text style={styles.cardTime}>{timeAgo(push.sent_at)}</Text>
              </View>
              <View style={styles.livePill}>
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            </View>

            {/* Message */}
            <Text style={styles.cardMessage} numberOfLines={3}>
              {push.message}
            </Text>

            {/* Footer */}
            <View style={styles.cardFooter}>
              {(push.heading_count ?? 0) > 0 && (
                <View style={styles.enrouteChip}>
                  <Ionicons name="navigate" size={10} color="#4ade80" />
                  <Text style={styles.enrouteText}>
                    {push.heading_count} enroute
                  </Text>
                </View>
              )}
              <Text style={styles.tapHint}>Tap to see venue →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4d6d',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: '#555',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  card: {
    width: 260,
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardVenueName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  cardTime: {
    fontSize: 11,
    color: '#555',
    marginTop: 1,
  },
  livePill: {
    backgroundColor: '#ff4d6d20',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ff4d6d40',
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ff4d6d',
    letterSpacing: 0.5,
  },
  cardMessage: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  enrouteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4ade8015',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  enrouteText: {
    fontSize: 10,
    color: '#4ade80',
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 10,
    color: '#444',
  },
});
