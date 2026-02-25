/**
 * TopScoutsCard - Shows the most active raters for a specific venue.
 * "Who knows this spot best?" — top 5 scouts by number of ratings submitted.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';
import { DEMO_VENUE_TOP_SCOUTS } from '../data/demoData';

interface VenueScout {
  rank: number;
  user_id: string;
  username: string;
  scout_status: string;
  ratings_count: number;
  clout_earned: number;
  tier_color: string;
}

interface TopScoutsCardProps {
  venueId: string;
}

const RANK_ICONS: Record<number, string> = { 1: '👑', 2: '🥈', 3: '🥉' };

const TIER_LABEL: Record<string, string> = {
  elite: 'ELITE',
  scout: 'SCOUT',
  regular: 'REGULAR',
  newbie: 'NEWBIE',
};

export default function TopScoutsCard({ venueId }: TopScoutsCardProps) {
  const { isDemoMode } = useVibeStore();
  const [scouts, setScouts] = useState<VenueScout[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  useEffect(() => {
    if (!venueId) return;
    fetchTopScouts();
  }, [venueId]);

  const fetchTopScouts = async () => {
    setLoading(true);
    if (isDemoMode) {
      // Simulate a short load for realism
      setTimeout(() => {
        setScouts(DEMO_VENUE_TOP_SCOUTS);
        setLoading(false);
      }, 400);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/top-scouts`);
      if (res.ok) {
        const data = await res.json();
        setScouts(data);
      }
    } catch {
      // fail silently — non-critical feature
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no data (non-demo, DB not connected)
  if (!loading && scouts.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={16} color="#FFD700" />
          <Text style={styles.title}>Top Scouts</Text>
        </View>
        <Text style={styles.subtitle}>Who knows this spot best</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#FF3366" style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.list}>
          {scouts.map((scout) => (
            <View key={scout.user_id} style={styles.row}>
              {/* Rank */}
              <View style={styles.rankCell}>
                {RANK_ICONS[scout.rank] ? (
                  <Text style={styles.rankIcon}>{RANK_ICONS[scout.rank]}</Text>
                ) : (
                  <Text style={styles.rankNumber}>{scout.rank}</Text>
                )}
              </View>

              {/* Avatar placeholder */}
              <LinearGradient
                colors={[scout.tier_color + '40', scout.tier_color + '20']}
                style={styles.avatar}
              >
                <Text style={styles.avatarInitial}>
                  {(scout.username ?? '?').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>

              {/* Name + tier */}
              <View style={styles.nameBlock}>
                <Text style={styles.username} numberOfLines={1}>{scout.username}</Text>
                <View style={[styles.tierBadge, { borderColor: scout.tier_color + '60' }]}>
                  <Text style={[styles.tierText, { color: scout.tier_color }]}>
                    {TIER_LABEL[scout.scout_status] ?? scout.scout_status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsBlock}>
                <Text style={styles.ratingCount}>{scout.ratings_count}</Text>
                <Text style={styles.ratingLabel}>ratings</Text>
              </View>

              <View style={styles.cloutBlock}>
                <Text style={styles.cloutCount}>{scout.clout_earned}</Text>
                <Text style={styles.cloutLabel}>clout</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#666',
    fontSize: 11,
  },
  list: {
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  rankCell: {
    width: 28,
    alignItems: 'center',
  },
  rankIcon: {
    fontSize: 18,
  },
  rankNumber: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  nameBlock: {
    flex: 1,
    gap: 3,
  },
  username: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tierBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tierText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statsBlock: {
    alignItems: 'center',
    minWidth: 40,
  },
  ratingCount: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ratingLabel: {
    color: '#666',
    fontSize: 9,
  },
  cloutBlock: {
    alignItems: 'center',
    minWidth: 44,
  },
  cloutCount: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '700',
  },
  cloutLabel: {
    color: '#666',
    fontSize: 9,
  },
});
