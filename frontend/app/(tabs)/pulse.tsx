import React, { useEffect, useState, useCallback } from 'react';
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
import { formatDistanceToNow } from 'date-fns';

interface PulseDrop {
  id: string;
  venue_id: string;
  venue_name: string;
  message: string;
  deal_type: string;
  radius_km: number;
  expires_at: string;
  created_at: string;
  venue?: any;
  distance_m?: number;
}

export default function PulseScreen() {
  const router = useRouter();
  const { venues } = useVibeStore();
  const [pulseDrops, setPulseDrops] = useState<PulseDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    fetchPulseDrops();
  }, []);

  const fetchPulseDrops = async () => {
    try {
      // Using Lagos VI default coordinates
      const response = await fetch(
        `${API_URL}/api/pulse-drops/nearby/6.4281/3.4219?radius_km=10`
      );
      const data = await response.json();
      setPulseDrops(data);
    } catch (error) {
      console.error('Error fetching pulse drops:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPulseDrops();
    setRefreshing(false);
  }, []);

  const getDealIcon = (dealType: string) => {
    switch (dealType) {
      case 'discount':
        return { name: 'pricetag', color: '#4CAF50' };
      case 'free_entry':
        return { name: 'ticket', color: '#FF9800' };
      case 'vip_access':
        return { name: 'star', color: '#E91E63' };
      case 'special_event':
        return { name: 'sparkles', color: '#9C27B0' };
      default:
        return { name: 'flash', color: '#2196F3' };
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m left`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m left`;
  };

  // Show trending venues if no pulse drops
  const trendingVenues = venues
    .filter((v) => v.vibe_velocity === 'heating_up')
    .slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pulse Drops</Text>
        <Text style={styles.headerSubtitle}>Flash deals & trending alerts</Text>
      </View>

      {loading ? (
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
          {/* Active Pulse Drops */}
          {pulseDrops.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Drops</Text>
              {pulseDrops.map((drop) => {
                const dealIcon = getDealIcon(drop.deal_type);
                return (
                  <TouchableOpacity
                    key={drop.id}
                    style={styles.pulseCard}
                    onPress={() => router.push(`/venue/${drop.venue_id}`)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: dealIcon.color + '20' },
                      ]}
                    >
                      <Ionicons
                        name={dealIcon.name as any}
                        size={24}
                        color={dealIcon.color}
                      />
                    </View>
                    <View style={styles.pulseInfo}>
                      <Text style={styles.pulseDealType}>
                        {drop.deal_type.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text style={styles.pulseVenue}>{drop.venue_name}</Text>
                      <Text style={styles.pulseMessage}>{drop.message}</Text>
                    </View>
                    <View style={styles.pulseTimer}>
                      <Text style={styles.timerText}>
                        {getTimeRemaining(drop.expires_at)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Trending Now */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Heating Up Now</Text>
            </View>
            {trendingVenues.length > 0 ? (
              trendingVenues.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={styles.trendingCard}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.trendingIcon}>
                    <Ionicons name="flame" size={20} color="#FF5722" />
                  </View>
                  <View style={styles.trendingInfo}>
                    <Text style={styles.trendingName}>{venue.name}</Text>
                    <Text style={styles.trendingArea}>{venue.area}</Text>
                  </View>
                  <View style={styles.trendingScore}>
                    <Text style={styles.scoreValue}>
                      {Math.round(venue.current_vibe_score)}
                    </Text>
                    <Ionicons name="arrow-up" size={12} color="#4CAF50" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="moon" size={48} color="#333" />
                <Text style={styles.emptyText}>No spots heating up right now</Text>
                <Text style={styles.emptySubtext}>
                  Check back later for real-time updates
                </Text>
              </View>
            )}
          </View>

          {/* Empty State for Pulse Drops */}
          {pulseDrops.length === 0 && (
            <View style={styles.noPulsesContainer}>
              <View style={styles.noPulsesIcon}>
                <Ionicons name="notifications-off" size={32} color="#666" />
              </View>
              <Text style={styles.noPulsesTitle}>No Active Pulse Drops</Text>
              <Text style={styles.noPulsesText}>
                Flash deals from venues will appear here. Keep the app open to
                receive real-time notifications!
              </Text>
            </View>
          )}

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
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  pulseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3366',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pulseInfo: {
    flex: 1,
  },
  pulseDealType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF3366',
    letterSpacing: 1,
  },
  pulseVenue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 2,
  },
  pulseMessage: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  pulseTimer: {
    backgroundColor: '#FF336620',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3366',
  },
  trendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  trendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF572220',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  trendingArea: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  trendingScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF3366',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },
  noPulsesContainer: {
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 32,
    marginTop: 16,
  },
  noPulsesIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#252530',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noPulsesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  noPulsesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
