/**
 * PUBLIC FLOOR - Trending Leaderboard
 * Dynamic ranking with Top 3 Podium and Top Scouts
 * Neon/Midnight Theme
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { publicTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = publicTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface TrendingVenue {
  venue: {
    id: string;
    name: string;
    area: string;
    current_vibe_score: number;
  };
  rank: number;
  trending_score: number;
  energy_percent: number;
  check_in_velocity: number;
  scout_count: number;
  trend: 'up' | 'down' | 'stable';
  last_rating: string | null;
}

interface TopScout {
  rank: number;
  user_id: string;
  username: string;
  avatar: string | null;
  check_count: number;
  venues_visited: number;
  tier: string;
  ring_color: string;
  is_elite: boolean;
  clout_points: number;
}

interface TrendingData {
  city: string;
  venues: TrendingVenue[];
  last_updated: string;
}

interface ScoutsData {
  city: string;
  scouts: TopScout[];
  last_updated: string;
}

export default function TrendingScreen() {
  const router = useRouter();
  const { selectedCity } = useVibeStore();
  const [trendingData, setTrendingData] = useState<TrendingData | null>(null);
  const [scoutsData, setScoutsData] = useState<ScoutsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pulseAnim = useState(new Animated.Value(1))[0];

  // Pulse animation for hot venues
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const fetchData = async () => {
    try {
      const [trendingRes, scoutsRes] = await Promise.all([
        fetch(`${API_URL}/api/trending/${selectedCity}`),
        fetch(`${API_URL}/api/top-scouts/${selectedCity}`)
      ]);

      if (trendingRes.ok) {
        const data = await trendingRes.json();
        setTrendingData(data);
      }

      if (scoutsRes.ok) {
        const data = await scoutsRes.json();
        setScoutsData(data);
      }
    } catch (error) {
      console.error('Failed to fetch trending data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [selectedCity]);

  const getTimeAgo = (isoString: string) => {
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHours / 24)} day${diffHours >= 48 ? 's' : ''} ago`;
  };

  const handlePullUp = (venueId: string) => {
    router.push(`/venue/${venueId}`);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <Ionicons name="trending-up" size={16} color={colors.status.success} />;
      case 'down':
        return <Ionicons name="trending-down" size={16} color={colors.status.error} />;
      default:
        return <Ionicons name="remove" size={16} color={colors.text.muted} />;
    }
  };

  const getEnergyColor = (percent: number) => {
    if (percent >= 80) return colors.vibe.electric;
    if (percent >= 60) return colors.vibe.popping;
    if (percent >= 40) return colors.vibe.moderate;
    return colors.vibe.chill;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trending spots...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const venues = trendingData?.venues || [];
  const topThree = venues.slice(0, 3);
  const restOfList = venues.slice(3, 10);
  const scouts = scoutsData?.scouts || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trending</Text>
          <Text style={styles.cityName}>
            {selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)} 🔥
          </Text>
        </View>

        {/* Last Updated */}
        {trendingData?.last_updated && (
          <View style={styles.lastUpdated}>
            <Ionicons name="time-outline" size={14} color={colors.text.muted} />
            <Text style={styles.lastUpdatedText}>
              Last updated {getTimeAgo(trendingData.last_updated)}
            </Text>
          </View>
        )}

        {/* Top 3 Podium */}
        <View style={styles.podiumSection}>
          <Text style={styles.sectionTitle}>🏆 Top Spots Tonight</Text>
          <View style={styles.podiumContainer}>
            {/* #2 Position (Left) */}
            {topThree[1] && (
              <TouchableOpacity 
                style={styles.podiumItem}
                onPress={() => handlePullUp(topThree[1].venue.id)}
              >
                <View style={[styles.podiumBadge, styles.silverBadge]}>
                  <Text style={styles.podiumRank}>2</Text>
                </View>
                <View style={[styles.podiumBar, styles.silverBar]}>
                  <Text style={styles.podiumVenueName} numberOfLines={2}>
                    {topThree[1].venue.name}
                  </Text>
                  <Text style={styles.podiumScore}>
                    {topThree[1].energy_percent}%
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* #1 Position (Center - Tallest) */}
            {topThree[0] && (
              <TouchableOpacity 
                style={styles.podiumItem}
                onPress={() => handlePullUp(topThree[0].venue.id)}
              >
                <Animated.View style={[
                  styles.hotIndicator,
                  { transform: [{ scale: pulseAnim }] }
                ]}>
                  <Text style={styles.hotText}>🔥 HOT</Text>
                </Animated.View>
                <View style={[styles.podiumBadge, styles.goldBadge]}>
                  <Ionicons name="trophy" size={20} color="#FFF" />
                </View>
                <LinearGradient
                  colors={['#FFD700', '#FF8C00']}
                  style={[styles.podiumBar, styles.goldBar]}
                >
                  <Text style={styles.podiumVenueName} numberOfLines={2}>
                    {topThree[0].venue.name}
                  </Text>
                  <Text style={[styles.podiumScore, styles.goldScore]}>
                    {topThree[0].energy_percent}%
                  </Text>
                  <View style={styles.velocityBadge}>
                    <Ionicons name="flash" size={12} color="#FFD700" />
                    <Text style={styles.velocityText}>
                      {topThree[0].check_in_velocity} checks/hr
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* #3 Position (Right) */}
            {topThree[2] && (
              <TouchableOpacity 
                style={styles.podiumItem}
                onPress={() => handlePullUp(topThree[2].venue.id)}
              >
                <View style={[styles.podiumBadge, styles.bronzeBadge]}>
                  <Text style={styles.podiumRank}>3</Text>
                </View>
                <View style={[styles.podiumBar, styles.bronzeBar]}>
                  <Text style={styles.podiumVenueName} numberOfLines={2}>
                    {topThree[2].venue.name}
                  </Text>
                  <Text style={styles.podiumScore}>
                    {topThree[2].energy_percent}%
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Rest of Leaderboard (#4 - #10) */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>📊 The Ranks</Text>
          {restOfList.map((item) => (
            <TouchableOpacity 
              key={item.venue.id}
              style={styles.listItem}
              onPress={() => handlePullUp(item.venue.id)}
            >
              {/* Rank */}
              <View style={styles.rankContainer}>
                <Text style={styles.rankNumber}>#{item.rank}</Text>
                {getTrendIcon(item.trend)}
              </View>

              {/* Venue Info */}
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{item.venue.name}</Text>
                <Text style={styles.venueArea}>{item.venue.area}</Text>
              </View>

              {/* Energy */}
              <View style={styles.energyContainer}>
                <View style={styles.energyBar}>
                  <View 
                    style={[
                      styles.energyFill, 
                      { 
                        width: `${item.energy_percent}%`,
                        backgroundColor: getEnergyColor(item.energy_percent)
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.energyText, { color: getEnergyColor(item.energy_percent) }]}>
                  {item.energy_percent}%
                </Text>
              </View>

              {/* Pull Up Button */}
              <TouchableOpacity 
                style={styles.pullUpButton}
                onPress={() => handlePullUp(item.venue.id)}
              >
                <Text style={styles.pullUpText}>Pull up</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top Scouts Section */}
        <View style={styles.scoutsSection}>
          <Text style={styles.sectionTitle}>🔥 Top Scouts Tonight</Text>
          <Text style={styles.scoutsSubtitle}>Most verified vibe checks in 24h</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scoutsScroll}
          >
            {scouts.map((scout) => (
              <TouchableOpacity 
                key={scout.user_id}
                style={styles.scoutCard}
              >
                {/* Avatar with Ring */}
                <View style={[styles.avatarContainer, { borderColor: scout.ring_color }]}>
                  {scout.avatar ? (
                    <Image source={{ uri: scout.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: scout.ring_color + '40' }]}>
                      <Text style={styles.avatarInitial}>
                        {scout.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {scout.is_elite && (
                    <View style={styles.eliteBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                    </View>
                  )}
                </View>

                {/* Scout Info */}
                <Text style={styles.scoutName} numberOfLines={1}>
                  {scout.username}
                </Text>
                <View style={styles.scoutStats}>
                  <Text style={styles.checkCount}>🔥 {scout.check_count} Checks</Text>
                </View>
                <Text style={styles.scoutTier}>{scout.tier.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}

            {scouts.length === 0 && (
              <View style={styles.noScoutsCard}>
                <Ionicons name="search" size={32} color={colors.text.muted} />
                <Text style={styles.noScoutsText}>No scouts yet tonight</Text>
                <Text style={styles.noScoutsSubtext}>Be the first to check in!</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.black,
    color: colors.primary,
  },
  cityName: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  lastUpdatedText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  // Podium Styles
  podiumSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 200,
    paddingHorizontal: spacing.sm,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  podiumBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -18,
    zIndex: 1,
  },
  goldBadge: {
    backgroundColor: '#FFD700',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: -22,
  },
  silverBadge: {
    backgroundColor: '#C0C0C0',
  },
  bronzeBadge: {
    backgroundColor: '#CD7F32',
  },
  podiumRank: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  goldBar: {
    height: 160,
  },
  silverBar: {
    height: 120,
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: '#C0C0C0',
  },
  bronzeBar: {
    height: 100,
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: '#CD7F32',
  },
  podiumVenueName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  podiumScore: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
  },
  goldScore: {
    color: '#FFF',
    fontSize: typography.fontSize.xxl,
  },
  hotIndicator: {
    position: 'absolute',
    top: -30,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    zIndex: 2,
  },
  hotText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  velocityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  velocityText: {
    fontSize: typography.fontSize.xs,
    color: '#FFD700',
    fontWeight: typography.fontWeight.semibold,
  },
  // List Styles
  listSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  venueInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  venueName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  venueArea: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  energyContainer: {
    width: 60,
    alignItems: 'center',
  },
  energyBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.background.input,
    borderRadius: 2,
    overflow: 'hidden',
  },
  energyFill: {
    height: '100%',
    borderRadius: 2,
  },
  energyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xs,
  },
  pullUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  pullUpText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  // Scouts Styles
  scoutsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  scoutsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  scoutsScroll: {
    paddingRight: spacing.lg,
  },
  scoutCard: {
    width: 100,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  eliteBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.background.dark,
    borderRadius: 10,
  },
  scoutName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  scoutStats: {
    marginTop: spacing.xs,
  },
  checkCount: {
    fontSize: typography.fontSize.xs,
    color: colors.gold,
    fontWeight: typography.fontWeight.semibold,
  },
  scoutTier: {
    fontSize: 9,
    color: colors.text.muted,
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  noScoutsCard: {
    width: 200,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  noScoutsText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  noScoutsSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});
