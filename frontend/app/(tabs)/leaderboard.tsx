import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../../src/store/vibeStore';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { venues, fetchVenues, loading } = useVibeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'vi' | 'ikoyi'>('all');

  useEffect(() => {
    fetchVenues();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVenues();
    setRefreshing(false);
  }, []);

  const filteredVenues = venues
    .filter((v) => {
      if (filter === 'vi') return v.area === 'Victoria Island';
      if (filter === 'ikoyi') return v.area === 'Ikoyi';
      return true;
    })
    .sort((a, b) => b.current_vibe_score - a.current_vibe_score);

  const getVelocityIcon = (velocity: string) => {
    switch (velocity) {
      case 'heating_up':
        return { name: 'trending-up', color: '#4CAF50' };
      case 'cooling_down':
        return { name: 'trending-down', color: '#FF5252' };
      default:
        return { name: 'remove', color: '#888' };
    }
  };

  const getEnergyEmoji = (energy: string) => {
    switch (energy) {
      case 'electric':
        return '⚡';
      case 'popping':
        return '🔥';
      default:
        return '✨';
    }
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { backgroundColor: '#FFD700', color: '#000' };
    if (rank === 2) return { backgroundColor: '#C0C0C0', color: '#000' };
    if (rank === 3) return { backgroundColor: '#CD7F32', color: '#FFF' };
    return { backgroundColor: '#252530', color: '#888' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Leaderboard</Text>
        <Text style={styles.headerSubtitle}>Real-time vibe rankings</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: 'All' },
          { key: 'vi', label: 'V.I.' },
          { key: 'ikoyi', label: 'Ikoyi' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setFilter(tab.key as any)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !venues.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF3366"
            />
          }
        >
          {filteredVenues.map((venue, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyle(rank);
            const velocityIcon = getVelocityIcon(venue.vibe_velocity);

            return (
              <TouchableOpacity
                key={venue.id}
                style={styles.leaderboardItem}
                onPress={() => router.push(`/venue/${venue.id}`)}
                activeOpacity={0.7}
              >
                {/* Rank Badge */}
                <View
                  style={[styles.rankBadge, { backgroundColor: rankStyle.backgroundColor }]}
                >
                  <Text style={[styles.rankText, { color: rankStyle.color }]}>
                    {rank}
                  </Text>
                </View>

                {/* Venue Info */}
                <View style={styles.venueInfo}>
                  <View style={styles.venueHeader}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <Text style={styles.energyEmoji}>
                      {getEnergyEmoji(venue.energy_level)}
                    </Text>
                  </View>
                  <Text style={styles.venueArea}>{venue.area}</Text>
                  <View style={styles.venueStats}>
                    <View style={styles.statChip}>
                      <Text style={styles.statChipText}>
                        {venue.capacity_level}
                      </Text>
                    </View>
                    <View style={styles.statChip}>
                      <Text style={styles.statChipText}>
                        Gate: {venue.gate_level}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Vibe Score & Velocity */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.vibeScore}>
                    {Math.round(venue.current_vibe_score)}
                  </Text>
                  <View style={styles.velocityContainer}>
                    <Ionicons
                      name={velocityIcon.name as any}
                      size={16}
                      color={velocityIcon.color}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#151520',
  },
  filterTabActive: {
    backgroundColor: '#FF3366',
  },
  filterTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800',
  },
  venueInfo: {
    flex: 1,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  energyEmoji: {
    fontSize: 14,
  },
  venueArea: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  venueStats: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  statChip: {
    backgroundColor: '#252530',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statChipText: {
    fontSize: 10,
    color: '#888',
    textTransform: 'capitalize',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  vibeScore: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF3366',
  },
  velocityContainer: {
    marginTop: 4,
  },
});
