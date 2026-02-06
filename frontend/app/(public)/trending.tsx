/**
 * PUBLIC FLOOR - Trending Leaderboard
 * Premium Top 3 Podium with Neon Pink/Gold accents
 * Top Scouts with Mini-Profile Modal
 * Map integration via 'Pull Up' button
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
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { publicTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = publicTheme;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface TrendingVenue {
  venue: {
    id: string;
    name: string;
    area: string;
    current_vibe_score: number;
    coordinates: { lat: number; lng: number };
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

interface ScoutProfile {
  user: {
    id: string;
    username: string;
    avatar: string | null;
    clout_points: number;
    scout_status: string;
    total_ratings: number;
    tier: string;
    tier_color: string;
  };
  activity_heatmap: Array<{
    venue_id: string;
    venue_name: string;
    venue_area: string;
    vibe_score: number;
    energy: string;
    time_ago: string;
  }>;
  stats: {
    checks_24h: number;
    checks_7d: number;
    unique_venues_7d: number;
  };
  last_seen: {
    venue_name: string;
    time_ago: string;
  } | null;
}

interface TrendingData {
  city: string;
  venues: TrendingVenue[];
  sponsored?: TrendingVenue[];  // Separate sponsored section
  last_updated: string;
}

interface ScoutsData {
  city: string;
  scouts: TopScout[];
  last_updated: string;
}

export default function TrendingScreen() {
  const router = useRouter();
  const { selectedCity, setSelectedCity } = useVibeStore();
  const [trendingData, setTrendingData] = useState<TrendingData | null>(null);
  const [scoutsData, setScoutsData] = useState<ScoutsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedScout, setSelectedScout] = useState<TopScout | null>(null);
  const [scoutProfile, setScoutProfile] = useState<ScoutProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  // Animation values
  const pulseAnim = useState(new Animated.Value(1))[0];
  const glowAnim = useState(new Animated.Value(0))[0];
  const crownBounce = useState(new Animated.Value(0))[0];

  // Premium pulse animation for #1 venue
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Crown bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(crownBounce, {
          toValue: -5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(crownBounce, {
          toValue: 0,
          duration: 600,
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

  const fetchScoutProfile = async (userId: string) => {
    setLoadingProfile(true);
    try {
      const response = await fetch(`${API_URL}/api/scout/${userId}/profile`);
      if (response.ok) {
        const data = await response.json();
        setScoutProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch scout profile:', error);
    } finally {
      setLoadingProfile(false);
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

  const handleScoutPress = async (scout: TopScout) => {
    setSelectedScout(scout);
    await fetchScoutProfile(scout.user_id);
  };

  const handlePullUp = (venue: TrendingVenue['venue']) => {
    // Navigate to map tab with venue highlight parameter
    router.push({
      pathname: '/',
      params: { 
        highlightVenue: venue.id,
        centerLat: venue.coordinates.lat.toString(),
        centerLng: venue.coordinates.lng.toString()
      }
    });
  };

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

  const glowInterpolate = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.8)'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Trending</Text>
            <Text style={styles.cityName}>
              {selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)} 🔥
            </Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Last Updated */}
        {trendingData?.last_updated && (
          <View style={styles.lastUpdated}>
            <Ionicons name="time-outline" size={14} color={colors.text.muted} />
            <Text style={styles.lastUpdatedText}>
              Updated {getTimeAgo(trendingData.last_updated)}
            </Text>
          </View>
        )}

        {/* ====== PREMIUM TOP 3 PODIUM ====== */}
        <View style={styles.podiumSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏆 Top Spots Tonight</Text>
            <Text style={styles.sectionSubtitle}>The hottest vibes in the city</Text>
          </View>
          
          <View style={styles.podiumContainer}>
            {/* #2 Position (Left - Silver) */}
            {topThree[1] && (
              <TouchableOpacity 
                style={styles.podiumItem}
                onPress={() => handlePullUp(topThree[1].venue)}
                activeOpacity={0.8}
              >
                <View style={styles.silverBadge}>
                  <Text style={styles.podiumRank}>2</Text>
                </View>
                <View style={[styles.podiumBar, styles.silverBar]}>
                  <Text style={styles.podiumVenueName} numberOfLines={2}>
                    {topThree[1].venue.name}
                  </Text>
                  <Text style={styles.podiumArea}>{topThree[1].venue.area}</Text>
                  <View style={styles.podiumScoreContainer}>
                    <Text style={styles.podiumScoreLabel}>ENERGY</Text>
                    <Text style={[styles.podiumScore, { color: '#C0C0C0' }]}>
                      {topThree[1].energy_percent}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* #1 Position (Center - GOLD CHAMPION) */}
            {topThree[0] && (
              <TouchableOpacity 
                style={[styles.podiumItem, styles.goldPodiumItem]}
                onPress={() => handlePullUp(topThree[0].venue)}
                activeOpacity={0.8}
              >
                {/* Crown Animation */}
                <Animated.View style={[
                  styles.crownContainer,
                  { transform: [{ translateY: crownBounce }] }
                ]}>
                  <Text style={styles.crownEmoji}>👑</Text>
                </Animated.View>
                
                {/* HOT Badge with Pulse */}
                <Animated.View style={[
                  styles.hotBadge,
                  { transform: [{ scale: pulseAnim }] }
                ]}>
                  <LinearGradient
                    colors={['#FF3366', '#FF6B35']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.hotBadgeGradient}
                  >
                    <Text style={styles.hotBadgeText}>🔥 #1 HOT</Text>
                  </LinearGradient>
                </Animated.View>

                <View style={styles.goldBadge}>
                  <Ionicons name="trophy" size={24} color="#0A0A0F" />
                </View>
                
                {/* Gold Podium with Gradient */}
                <LinearGradient
                  colors={['#FFD700', '#FFA500', '#FF8C00']}
                  style={[styles.podiumBar, styles.goldBar]}
                >
                  {/* Sparkle effects */}
                  <View style={styles.sparkleContainer}>
                    <Text style={styles.sparkle}>✨</Text>
                    <Text style={[styles.sparkle, { left: '70%', top: '20%' }]}>✨</Text>
                    <Text style={[styles.sparkle, { left: '20%', top: '60%' }]}>✨</Text>
                  </View>
                  
                  <Text style={styles.goldVenueName} numberOfLines={2}>
                    {topThree[0].venue.name}
                  </Text>
                  <Text style={styles.goldArea}>{topThree[0].venue.area}</Text>
                  
                  <View style={styles.goldScoreContainer}>
                    <Text style={styles.goldScoreLabel}>ENERGY</Text>
                    <Text style={styles.goldScore}>{topThree[0].energy_percent}%</Text>
                  </View>
                  
                  {/* Velocity Badge */}
                  <View style={styles.velocityBadge}>
                    <Ionicons name="flash" size={14} color="#FFD700" />
                    <Text style={styles.velocityText}>
                      {topThree[0].check_in_velocity || 0} checks/hr
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* #3 Position (Right - Bronze) */}
            {topThree[2] && (
              <TouchableOpacity 
                style={styles.podiumItem}
                onPress={() => handlePullUp(topThree[2].venue)}
                activeOpacity={0.8}
              >
                <View style={styles.bronzeBadge}>
                  <Text style={styles.podiumRank}>3</Text>
                </View>
                <View style={[styles.podiumBar, styles.bronzeBar]}>
                  <Text style={styles.podiumVenueName} numberOfLines={2}>
                    {topThree[2].venue.name}
                  </Text>
                  <Text style={styles.podiumArea}>{topThree[2].venue.area}</Text>
                  <View style={styles.podiumScoreContainer}>
                    <Text style={styles.podiumScoreLabel}>ENERGY</Text>
                    <Text style={[styles.podiumScore, { color: '#CD7F32' }]}>
                      {topThree[2].energy_percent}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ====== SPONSORED SECTION (Pulse Drop Venues) ====== */}
        {trendingData?.sponsored && trendingData.sponsored.length > 0 && (
          <View style={styles.sponsoredSection}>
            <View style={styles.sponsoredHeader}>
              <Ionicons name="flash" size={16} color="#FFD700" />
              <Text style={styles.sponsoredTitle}>Sponsored</Text>
              <Text style={styles.sponsoredSubtitle}>2x Clout for check-ins!</Text>
            </View>
            {trendingData.sponsored.map((item) => (
              <TouchableOpacity 
                key={item.venue.id}
                style={styles.sponsoredItem}
                onPress={() => handlePullUp(item.venue)}
                activeOpacity={0.8}
              >
                {/* Gold Border */}
                <View style={styles.sponsoredGoldBorder} />
                
                {/* PULSE Badge */}
                <View style={styles.sponsoredPulseBadge}>
                  <Ionicons name="flash" size={10} color="#FFD700" />
                  <Text style={styles.sponsoredPulseText}>PULSE</Text>
                </View>

                {/* Venue Info */}
                <View style={styles.sponsoredVenueInfo}>
                  <Text style={styles.sponsoredVenueName}>{item.venue.name}</Text>
                  <Text style={styles.sponsoredVenueArea}>{item.venue.area}</Text>
                </View>

                {/* REAL Energy Score - Displayed Honestly */}
                <View style={styles.sponsoredScoreContainer}>
                  <Text style={[
                    styles.sponsoredEnergyLabel,
                    { color: getEnergyColor(item.energy_percent) }
                  ]}>
                    {item.energy_percent >= 70 ? 'Electric' : item.energy_percent >= 40 ? 'Vibe' : 'Quiet'}
                  </Text>
                  <Text style={[
                    styles.sponsoredScore,
                    { color: getEnergyColor(item.energy_percent) }
                  ]}>
                    {item.energy_percent}%
                  </Text>
                </View>

                {/* Pull Up */}
                <Ionicons name="chevron-forward" size={18} color="#FFD700" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Rest of Leaderboard (#4 - #10) */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>📊 The Ranks</Text>
          {restOfList.map((item) => (
            <TouchableOpacity 
              key={item.venue.id}
              style={styles.listItem}
              onPress={() => handlePullUp(item.venue)}
              activeOpacity={0.8}
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
                onPress={() => handlePullUp(item.venue)}
              >
                <Ionicons name="location" size={14} color={colors.primary} />
                <Text style={styles.pullUpText}>Pull up</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* ====== TOP SCOUTS SECTION ====== */}
        <View style={styles.scoutsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Top Scouts Tonight</Text>
            <Text style={styles.scoutsSubtitle}>Most verified vibe checks in 24h</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scoutsScroll}
          >
            {scouts.map((scout) => (
              <TouchableOpacity 
                key={scout.user_id}
                style={styles.scoutCard}
                onPress={() => handleScoutPress(scout)}
                activeOpacity={0.8}
              >
                {/* Rank Badge */}
                {scout.rank <= 3 && (
                  <View style={[
                    styles.scoutRankBadge,
                    scout.rank === 1 && { backgroundColor: '#FFD700' },
                    scout.rank === 2 && { backgroundColor: '#C0C0C0' },
                    scout.rank === 3 && { backgroundColor: '#CD7F32' },
                  ]}>
                    <Text style={styles.scoutRankText}>{scout.rank}</Text>
                  </View>
                )}
                
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
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    </View>
                  )}
                </View>

                {/* Scout Info */}
                <Text style={styles.scoutName} numberOfLines={1}>
                  {scout.username}
                </Text>
                <View style={styles.scoutStats}>
                  <Ionicons name="flame" size={12} color={colors.gold} />
                  <Text style={styles.checkCount}>{scout.check_count} Checks</Text>
                </View>
                <Text style={[styles.scoutTier, { color: scout.ring_color }]}>
                  {scout.tier.toUpperCase()}
                </Text>
                
                {/* Clout Points */}
                <View style={styles.cloutBadge}>
                  <Text style={styles.cloutText}>⚡ {scout.clout_points}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {scouts.length === 0 && (
              <View style={styles.noScoutsCard}>
                <Ionicons name="search" size={40} color={colors.text.muted} />
                <Text style={styles.noScoutsText}>No scouts yet tonight</Text>
                <Text style={styles.noScoutsSubtext}>Be the first to check in!</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ====== SCOUT MINI-PROFILE MODAL ====== */}
      <Modal
        visible={selectedScout !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedScout(null);
          setScoutProfile(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setSelectedScout(null);
                setScoutProfile(null);
              }}
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>

            {loadingProfile ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.modalLoadingText}>Loading scout profile...</Text>
              </View>
            ) : scoutProfile ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                  <View style={[
                    styles.profileAvatarContainer,
                    { borderColor: scoutProfile.user.tier_color }
                  ]}>
                    {scoutProfile.user.avatar ? (
                      <Image 
                        source={{ uri: scoutProfile.user.avatar }} 
                        style={styles.profileAvatar} 
                      />
                    ) : (
                      <View style={[
                        styles.profileAvatarPlaceholder,
                        { backgroundColor: scoutProfile.user.tier_color + '40' }
                      ]}>
                        <Text style={styles.profileAvatarInitial}>
                          {scoutProfile.user.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.profileUsername}>{scoutProfile.user.username}</Text>
                  <View style={[
                    styles.profileTierBadge,
                    { backgroundColor: scoutProfile.user.tier_color + '30' }
                  ]}>
                    <Text style={[styles.profileTierText, { color: scoutProfile.user.tier_color }]}>
                      {scoutProfile.user.tier.toUpperCase()} SCOUT
                    </Text>
                  </View>
                </View>

                {/* Total Clout */}
                <View style={styles.cloutSection}>
                  <LinearGradient
                    colors={['#FFD700', '#FF8C00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cloutCard}
                  >
                    <Ionicons name="flash" size={28} color="#0A0A0F" />
                    <View style={styles.cloutInfo}>
                      <Text style={styles.cloutLabel}>Total Clout</Text>
                      <Text style={styles.cloutValue}>{scoutProfile.user.clout_points}</Text>
                    </View>
                  </LinearGradient>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{scoutProfile.stats.checks_24h}</Text>
                    <Text style={styles.statLabel}>Checks (24h)</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{scoutProfile.stats.checks_7d}</Text>
                    <Text style={styles.statLabel}>Checks (7d)</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{scoutProfile.stats.unique_venues_7d}</Text>
                    <Text style={styles.statLabel}>Venues</Text>
                  </View>
                </View>

                {/* Activity Heatmap */}
                <View style={styles.activitySection}>
                  <Text style={styles.activityTitle}>🗺️ Activity Heatmap</Text>
                  {scoutProfile.last_seen && (
                    <View style={styles.lastSeenCard}>
                      <Ionicons name="location" size={16} color={colors.primary} />
                      <Text style={styles.lastSeenText}>
                        Last seen at <Text style={styles.lastSeenVenue}>{scoutProfile.last_seen.venue_name}</Text>
                        {' '}{scoutProfile.last_seen.time_ago}
                      </Text>
                    </View>
                  )}
                  
                  {scoutProfile.activity_heatmap.length > 0 ? (
                    scoutProfile.activity_heatmap.slice(0, 5).map((activity, index) => (
                      <View key={index} style={styles.activityItem}>
                        <View style={styles.activityDot}>
                          <View style={[
                            styles.activityDotInner,
                            { backgroundColor: getEnergyColor(activity.vibe_score) }
                          ]} />
                        </View>
                        <View style={styles.activityInfo}>
                          <Text style={styles.activityVenue}>{activity.venue_name}</Text>
                          <Text style={styles.activityArea}>{activity.venue_area}</Text>
                        </View>
                        <View style={styles.activityTime}>
                          <Text style={styles.activityTimeText}>{activity.time_ago}</Text>
                          <Text style={styles.activityEnergy}>
                            {activity.energy.charAt(0).toUpperCase() + activity.energy.slice(1)}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.noActivityCard}>
                      <Ionicons name="map-outline" size={32} color={colors.text.muted} />
                      <Text style={styles.noActivityText}>No recent activity</Text>
                    </View>
                  )}
                </View>

                {/* Follow Scout Button (Placeholder) */}
                <TouchableOpacity style={styles.followButton} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[colors.primary, '#FF6B35']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.followButtonGradient}
                  >
                    <Ionicons name="person-add" size={20} color="#FFF" />
                    <Text style={styles.followButtonText}>Follow Scout</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <Text style={styles.followHint}>Coming soon: Get alerts when they check in!</Text>
              </ScrollView>
            ) : (
              <View style={styles.modalError}>
                <Ionicons name="alert-circle" size={48} color={colors.status.error} />
                <Text style={styles.modalErrorText}>Could not load profile</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  liveText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.status.success,
    letterSpacing: 1,
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
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },

  // ====== PREMIUM PODIUM STYLES ======
  podiumSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 260,
    paddingHorizontal: spacing.sm,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  goldPodiumItem: {
    marginTop: -40,
  },
  
  // Crown
  crownContainer: {
    position: 'absolute',
    top: -15,
    zIndex: 10,
  },
  crownEmoji: {
    fontSize: 28,
  },
  
  // HOT Badge
  hotBadge: {
    position: 'absolute',
    top: 15,
    zIndex: 5,
  },
  hotBadgeGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  hotBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  
  // Badges
  goldBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -26,
    zIndex: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  silverBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C0C0C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -20,
    zIndex: 3,
  },
  bronzeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CD7F32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -20,
    zIndex: 3,
  },
  podiumRank: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  
  // Bars
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.md,
    paddingTop: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  goldBar: {
    height: 200,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  silverBar: {
    height: 150,
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: '#C0C0C080',
    borderBottomWidth: 0,
  },
  bronzeBar: {
    height: 130,
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: '#CD7F3280',
    borderBottomWidth: 0,
  },
  
  // Sparkles
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 14,
    left: '40%',
    top: '30%',
  },
  
  // Gold Venue Styling
  goldVenueName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#0A0A0F',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  goldArea: {
    fontSize: typography.fontSize.xs,
    color: '#0A0A0F80',
    marginBottom: spacing.md,
  },
  goldScoreContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goldScoreLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: '#0A0A0F80',
    letterSpacing: 1,
  },
  goldScore: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    color: '#0A0A0F',
  },
  velocityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  velocityText: {
    fontSize: typography.fontSize.xs,
    color: '#FFD700',
    fontWeight: typography.fontWeight.semibold,
  },
  
  // Silver/Bronze Venue Styling
  podiumVenueName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  podiumArea: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  podiumScoreContainer: {
    alignItems: 'center',
  },
  podiumScoreLabel: {
    fontSize: 9,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.muted,
    letterSpacing: 1,
  },
  podiumScore: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
  },

  // ====== LIST STYLES ======
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
    borderWidth: 1,
    borderColor: colors.border,
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
    gap: spacing.xs,
  },
  pullUpText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },

  // ====== SCOUTS STYLES ======
  scoutsSection: {
    paddingLeft: spacing.lg,
    marginBottom: spacing.xl,
  },
  scoutsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  scoutsScroll: {
    paddingRight: spacing.lg,
  },
  scoutCard: {
    width: 110,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  scoutRankBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background.dark,
  },
  scoutRankText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: '#0A0A0F',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  checkCount: {
    fontSize: typography.fontSize.xs,
    color: colors.gold,
    fontWeight: typography.fontWeight.semibold,
  },
  scoutTier: {
    fontSize: 9,
    marginTop: spacing.xs,
    letterSpacing: 1,
    fontWeight: typography.fontWeight.bold,
  },
  cloutBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  cloutText: {
    fontSize: 10,
    color: colors.gold,
    fontWeight: typography.fontWeight.bold,
  },
  noScoutsCard: {
    width: SCREEN_WIDTH - 64,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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

  // ====== MODAL STYLES ======
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxHeight: '85%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.input,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  modalLoadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.md,
  },
  modalError: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  modalErrorText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.md,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  profileAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  profileAvatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarInitial: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  profileUsername: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  profileTierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  profileTierText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },

  // Clout Section
  cloutSection: {
    marginBottom: spacing.xl,
  },
  cloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  cloutInfo: {
    flex: 1,
  },
  cloutLabel: {
    fontSize: typography.fontSize.sm,
    color: '#0A0A0F80',
    fontWeight: typography.fontWeight.semibold,
  },
  cloutValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    color: '#0A0A0F',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },

  // Activity Section
  activitySection: {
    marginBottom: spacing.xl,
  },
  activityTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  lastSeenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  lastSeenText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  lastSeenVenue: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityVenue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  activityArea: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  activityTime: {
    alignItems: 'flex-end',
  },
  activityTimeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  activityEnergy: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 2,
  },
  noActivityCard: {
    backgroundColor: colors.background.input,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  noActivityText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },

  // Follow Button
  followButton: {
    marginBottom: spacing.sm,
  },
  followButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  followButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFF',
  },
  followHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // ====== SPONSORED SECTION STYLES ======
  sponsoredSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sponsoredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sponsoredTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: '#FFD700',
  },
  sponsoredSubtitle: {
    fontSize: typography.fontSize.xs,
    color: '#4CAF50',
    fontWeight: typography.fontWeight.semibold,
  },
  sponsoredItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1815',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: '#FFD70050',
    position: 'relative',
    overflow: 'hidden',
  },
  sponsoredGoldBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FFD700',
  },
  sponsoredPulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FFD70040',
    marginRight: spacing.md,
    gap: 4,
  },
  sponsoredPulseText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.black,
    color: '#FFD700',
    letterSpacing: 1,
  },
  sponsoredVenueInfo: {
    flex: 1,
  },
  sponsoredVenueName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sponsoredVenueArea: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  sponsoredScoreContainer: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  sponsoredEnergyLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  sponsoredScore: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black,
  },
});
