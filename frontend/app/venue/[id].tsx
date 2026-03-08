import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Image,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../../src/store/vibeStore';
import { calculateDistance } from '../../src/utils/geo';
import RateVibeModal from '../../src/components/RateVibeModal';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import VibeSuccessAnimation from '../../src/components/VibeSuccessAnimation';
import StoryBubble from '../../src/components/StoryBubble';
import StoryViewer from '../../src/components/StoryViewer';
import VibeTimeline from '../../src/components/VibeTimeline';
import VibeForecast from '../../src/components/VibeForecast';
import CampaignBadge from '../../src/components/CampaignBadge';
import CheckInCelebration from '../../src/components/CheckInCelebration';
import CertifiedBadge from '../../src/components/CertifiedBadge';
import TopScoutsCard from '../../src/components/TopScoutsCard';
import VibeOracle from '../../src/components/VibeOracle';
import VenueRoastCard from '../../src/components/VenueRoastCard';
import VibePlusModal from '../../src/components/VibePlusModal';
import VenueAlertModal, { VenueAlert } from '../../src/components/VenueAlertModal';
import EnergyMeter from '../../src/components/EnergyMeter';
import VenueIntentBar from '../../src/components/VenueIntentBar';
import ArrivalIntelCard from '../../src/components/ArrivalIntelCard';
import CrowdCompositionBar from '../../src/components/CrowdCompositionBar';
import BookingModal from '../../src/components/BookingModal';
import VibeSurgeBar from '../../src/components/VibeSurgeBar';
import SurgeCelebration from '../../src/components/SurgeCelebration';
import FirstScoutCelebration from '../../src/components/FirstScoutCelebration';
import ResonancePrompt from '../../src/components/ResonancePrompt';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Placeholder club interior images (high-quality Lagos club vibes)
const CLUB_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
  'https://images.unsplash.com/photo-1571266028243-d220c8b77883?w=400&q=80',
];

export default function VenueDetailScreen() {
  const { id, openRateModal } = useLocalSearchParams<{ id: string; openRateModal?: string }>();
  const router = useRouter();
  const {
    fetchVenue,
    getUserRatingStatus,
    user,
    recordDirectionClick,
    gpsLocked,
    setGpsLocked,
    setLastRatedVenueId,
    updateUserClout,
    addToLobby,
    removeFromLobby,
    isInLobby,
    isAuthenticated,
    ghostCheckIn,
    ghostCheckOut,
    fetchActiveCheckin,
    fetchVenueCheckins,
    fetchStories,
    fetchTimeline,
    activeCheckin,
    venueStories,
    venueTimeline,
    timelinePeakHour,
    venueCheckinCount,
    isDemoMode,
    cooldownSkip,
    isFeatureEnabled,
    socket,
    getAuthHeaders,
  } = useVibeStore();
  const [venue, setVenue] = useState<any>(null);
  const [ratingStatus, setRatingStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [showGeofenceTooltip, setShowGeofenceTooltip] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [lastCloutEarned, setLastCloutEarned] = useState(10);
  const [lastHadPhoto, setLastHadPhoto] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showVibePlusModal, setShowVibePlusModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [venueAlerts, setVenueAlerts] = useState<VenueAlert[]>([]);
  const [checkinEnteredAt, setCheckinEnteredAt] = useState<number | null>(null);
  const [checkinMinutes, setCheckinMinutes] = useState(0);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSurgeCelebration, setShowSurgeCelebration] = useState(false);
  const [surgeTapCount, setSurgeTapCount] = useState(0);
  const [showFirstScout, setShowFirstScout] = useState(false);
  const [showResonance, setShowResonance] = useState(false);
  const [sessionBoltCount, setSessionBoltCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'now' | 'intel' | 'crew' | 'info'>('now');

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const checkinBannerAnim = useRef(new Animated.Value(0)).current;
  const checkinDotAnim = useRef(new Animated.Value(1)).current;
  const readyBannerAnim = useRef(new Animated.Value(0)).current;
  const readyDotAnim = useRef(new Animated.Value(1)).current;

  // ── Check-in mode: triggers when geofence confirmed ──────────────────────
  useEffect(() => {
    if (isWithinGeofence && checkinEnteredAt === null) {
      const enteredAt = Date.now();
      setCheckinEnteredAt(enteredAt);
      // Slide banner down
      Animated.spring(checkinBannerAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }).start();
      // Pulse the green dot continuously
      Animated.loop(
        Animated.sequence([
          Animated.timing(checkinDotAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
          Animated.timing(checkinDotAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
      // Ready to rate banner — slide up from bottom
      Animated.spring(readyBannerAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(readyDotAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(readyDotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])).start();
    }
    if (!isWithinGeofence && checkinEnteredAt !== null) {
      setCheckinEnteredAt(null);
      checkinBannerAnim.setValue(0);
    }
  }, [isWithinGeofence]);

  // ── Live "time here" counter ─────────────────────────────────────────────
  useEffect(() => {
    if (!checkinEnteredAt) return;
    const interval = setInterval(() => {
      setCheckinMinutes(Math.floor((Date.now() - checkinEnteredAt) / 60000));
    }, 30000);
    return () => clearInterval(interval);
  }, [checkinEnteredAt]);

  useEffect(() => {
    loadVenueData();
    checkUserLocation();
    if (id) {
      setInLobby(isInLobby(id));
      fetchStories(id);
      fetchVenueCheckins(id);
      fetchTimeline(id);
    }
    if (isAuthenticated) fetchActiveCheckin();

    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [id]);

  // Auto-open rate modal when navigated with ?openRateModal=true
  useEffect(() => {
    const canOpen = openRateModal === 'true' && venue && ratingStatus?.can_rate;
    if (canOpen && (isWithinGeofence || isDemoMode)) {
      setShowRateModal(true);
    }
  }, [openRateModal, venue, isWithinGeofence, ratingStatus, isDemoMode]);

  const handleShare = async () => {
    if (!venue) return;
    const deepLink = `https://vibe-app-hc83.vercel.app/venue/${venue.id}`;
    try {
      await Share.share({
        message: `${venue.name} is ${venue.energy_level?.toUpperCase() ?? 'LIVE'} right now 🔥 Check the viibe on Viibe: ${deepLink}`,
        url: deepLink,
      });
    } catch {
      // user cancelled
    }
  };

  const handleToggleLobby = async () => {
    if (!isAuthenticated || !id) return;
    if (inLobby) {
      const removed = await removeFromLobby(id);
      if (removed) setInLobby(false);
    } else {
      const added = await addToLobby(id);
      if (added) setInLobby(true);
    }
  };

  const handleGhostCheckin = async () => {
    if (!user || !venue || !userLocation || !isWithinGeofence) return;
    setCheckinLoading(true);
    try {
      if (activeCheckin && activeCheckin.venue_id === venue.id) {
        await ghostCheckOut(venue.id);
      } else {
        const result = await ghostCheckIn(venue.id, userLocation.lat, userLocation.lng);
        setShowCelebration(true);
        if (result?.is_first_tonight || isDemoMode) setShowFirstScout(true);
      }
      fetchVenueCheckins(venue.id);
    } catch (e) {
      // silently fail
    }
    setCheckinLoading(false);
  };

  useEffect(() => {
    if (isWithinGeofence) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
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
      
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [isWithinGeofence]);

  const loadVenueData = async () => {
    setLoading(true);
    const venueData = await fetchVenue(id || '');
    setVenue(venueData);

    if (user) {
      const status = await getUserRatingStatus(id || '');
      setRatingStatus(status);
    }

    setLoading(false);
  };

  // Socket.IO — live reaction feed for this venue
  useEffect(() => {
    if (!socket || !venue?.id) return;
    socket.emit('join_venue', { venue_id: venue.id });
    return () => {};
  }, [socket, venue?.id, user?.id]);

  const handleReact = async () => {
    if (!user || !venue) return;
    fetch(`${API_URL}/api/venues/${venue.id}/react`, {
      method: 'POST', headers: getAuthHeaders(),
    }).catch(() => {});
  };

  const checkUserLocation = async () => {
    // Demo mode: bypass GPS, always in geofence
    if (isDemoMode) {
      setIsWithinGeofence(true);
      setGpsLocked(true);
      setUserLocation({ lat: 6.4316, lng: 3.4223 });
      return;
    }

    setCheckingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);

      if (venue) {
        const distance = calculateDistance(
          coords.lat, coords.lng,
          venue.coordinates.lat, venue.coordinates.lng
        );
        const venueRadius = venue.geofence_radius_m || 100;
        const within = distance <= venueRadius;
        setIsWithinGeofence(within);
        setGpsLocked(within);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
    setCheckingLocation(false);
  };

  const handleGetDirections = () => {
    if (!venue) return;
    
    recordDirectionClick(venue.id);
    
    const { lat, lng } = venue.coordinates;
    const label = encodeURIComponent(venue.name);
    
    // Native deep links for map apps
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`,
    });
    
    Linking.openURL(url as string);
  };

  const handleSubmitRating = async (data: {
    energy: 'chill' | 'buzzing' | 'popping' | 'electric';
    capacity: 'sparse' | 'vibrant' | 'full';
    gate: 'clear' | 'slow' | 'blocked';
    venueSpecific?: string;
    photoBase64?: string;
  }) => {
    if (!user || !venue) return;

    try {
      let cloutEarned = 10;

      if (isDemoMode) {
        // Use store's submitRating so demo cooldown is tracked
        const { submitRating } = useVibeStore.getState();
        const result = await submitRating(
          venue.id, data.energy as any, data.capacity, data.gate,
          { lat: userLocation?.lat || 0, lng: userLocation?.lng || 0 },
          data.photoBase64
        );
        cloutEarned = result.clout_earned || 15;
      } else {
        const response = await fetch(`${API_URL}/api/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            venue_id: venue.id,
            energy: data.energy,
            capacity: data.capacity,
            gate: data.gate,
            venue_specific: data.venueSpecific,
            photo_base64: data.photoBase64,
            coordinates: { lat: userLocation?.lat || 0, lng: userLocation?.lng || 0 },
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to submit rating');
        }
        const result = await response.json();
        cloutEarned = result.clout_earned || 10;
      }

      const hasPhoto = !!data.photoBase64;
      updateUserClout(hasPhoto ? cloutEarned + 5 : cloutEarned);
      setLastRatedVenueId(venue.id);
      setLastCloutEarned(cloutEarned);
      setLastHadPhoto(hasPhoto);
      setShowRateModal(false);
      setShowSuccessAnimation(true);
      setSessionBoltCount(prev => prev + 1);
      // Show ResonancePrompt 2s after success animation clears
      setTimeout(() => setShowResonance(true), 2000);

      // Refresh rating status so modal shows cooldown next open
      const updatedStatus = await getUserRatingStatus(venue.id);
      setRatingStatus(updatedStatus);

    } catch (error: any) {
      console.error('Rating error:', error);
      throw error;
    }
  };

  const handleSuccessAnimationComplete = () => {
    setShowSuccessAnimation(false);
    // Navigate back to map with venue highlighted
    router.push({
      pathname: '/',
      params: { 
        highlightVenue: venue?.id,
        showRatedGlow: 'true',
      }
    });
  };

  const getVibeState = (score: number, capacity: string): string => {
    if (score >= 85) return 'PEAK';
    if (score >= 65) return 'LIT';
    if (score >= 45) return (capacity === 'full' || capacity === 'vibrant') ? 'CHARGED' : 'WARMING';
    if (score >= 20) return 'CHILL';
    return 'QUIET';
  };

  const now = new Date();
  const isVibePlus = !!(
    user?.is_vibe_plus &&
    (!user?.vibe_plus_expires_at || new Date(user.vibe_plus_expires_at) > now)
  );

  const getVibeColor = (score: number, capacity = 'sparse') => {
    if (score >= 85) return '#FF3366';
    if (score >= 65) return '#FF9933';
    if (score >= 45) return (capacity === 'full' || capacity === 'vibrant') ? '#9B59B6' : '#9933FF';
    if (score >= 20) return '#3399FF';
    return '#555E6E';
  };

  const getSnapshotTimeAgo = () => {
    if (!venue?.last_snapshot_time) return 'No recent snapshot';
    const now = new Date();
    const snapshot = new Date(venue.last_snapshot_time);
    const diffMs = now.getTime() - snapshot.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Verified just now';
    if (diffMins < 60) return `Verified ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Verified ${diffHours}h ago`;
    return `Verified ${Math.floor(diffHours / 24)}d ago`;
  };

  const getPlaceholderImage = () => {
    // Consistent image per venue based on id
    const hash = venue?.id?.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) || 0;
    return CLUB_PLACEHOLDERS[hash % CLUB_PLACEHOLDERS.length];
  };

  const showTooltip = () => {
    setShowGeofenceTooltip(true);
    Animated.sequence([
      Animated.timing(tooltipAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(tooltipAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowGeofenceTooltip(false));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Back button row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <SkeletonLoader width={36} height={36} borderRadius={18} />
        </View>
        {/* Hero block */}
        <SkeletonLoader width="100%" height={220} borderRadius={0} />
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          {/* Venue name + score */}
          <SkeletonLoader width="65%" height={22} borderRadius={6} />
          <SkeletonLoader width="40%" height={14} borderRadius={4} />
          {/* Action chips row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <SkeletonLoader width={80} height={32} borderRadius={16} />
            <SkeletonLoader width={80} height={32} borderRadius={16} />
            <SkeletonLoader width={80} height={32} borderRadius={16} />
          </View>
          {/* Cards */}
          <SkeletonLoader width="100%" height={110} borderRadius={14} style={{ marginTop: 8 }} />
          <SkeletonLoader width="100%" height={90} borderRadius={14} />
          <SkeletonLoader width="100%" height={90} borderRadius={14} />
        </View>
      </SafeAreaView>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF5252" />
          <Text style={styles.errorText}>Venue not found</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const vibeColor = getVibeColor(venue.current_vibe_score, venue.capacity_level ?? 'sparse');
  const vibeStateLabel = getVibeState(venue.current_vibe_score, venue.capacity_level ?? 'sparse');
  const hasPulseDrop = venue.active_pulse_tier !== null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{venue.name}</Text>
          <View style={styles.headerBadges}>
            {venue.vibe_certified && (
              <CertifiedBadge compact />
            )}
            {venue.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
              </View>
            )}
            {hasPulseDrop && (
              <View style={styles.pulseBadge}>
                <Ionicons name="flame" size={12} color="#FFD700" />
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.lobbyButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color="#888" />
        </TouchableOpacity>
        {isAuthenticated && (
          <TouchableOpacity style={styles.lobbyButton} onPress={handleToggleLobby}>
            <Ionicons
              name={inLobby ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={inLobby ? '#FF3366' : '#888'}
            />
          </TouchableOpacity>
        )}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.lobbyButton}
            onPress={() => setShowAlertModal(true)}
          >
            <Ionicons
              name={venueAlerts.length > 0 ? 'notifications' : 'notifications-outline'}
              size={22}
              color={venueAlerts.length > 0 ? '#FF9933' : '#888'}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ====== LIVE LOOK THUMBNAIL ====== */}
        <Animated.View style={[styles.liveLookContainer, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.liveLookWrapper}>
            <Image
              source={{ uri: venue.last_snapshot_url || getPlaceholderImage() }}
              style={styles.liveLookImage}
              resizeMode="cover"
            />
            
            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,15,0.8)']}
              style={styles.liveLookGradient}
            />
            
            {/* Verified Badge */}
            <View style={styles.liveLookBadge}>
              <Ionicons name="eye" size={12} color="#4CAF50" />
              <Text style={styles.liveLookBadgeText}>{getSnapshotTimeAgo()}</Text>
            </View>
            
            {/* Pulse Drop Glow Effect */}
            {hasPulseDrop && (
              <View style={styles.pulseGlowOverlay}>
                <LinearGradient
                  colors={['rgba(255,215,0,0.3)', 'transparent']}
                  style={styles.pulseGlow}
                />
              </View>
            )}
          </View>
        </Animated.View>

        {/* ====== STORY BUBBLES + CROWD COUNT ====== */}
        {(venueStories.length > 0 || venueCheckinCount > 0) && (
          <View style={styles.storyRow}>
            {venueStories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storyScroll}
              >
                {venueStories.map((story, i) => (
                  <StoryBubble
                    key={story.id}
                    username={story.username}
                    onPress={() => {
                      setSelectedStoryIndex(i);
                      setShowStoryViewer(true);
                    }}
                  />
                ))}
              </ScrollView>
            )}
            {venueCheckinCount > 0 && (
              <View style={styles.crowdBadge}>
                <Ionicons name="people" size={14} color="#00E676" />
                <Text style={styles.crowdText}>{venueCheckinCount} here now</Text>
              </View>
            )}
          </View>
        )}

        {/* ====== GLASSMORPHISM VENUE PULSE CARD ====== */}
        <View style={styles.glassCardContainer}>
          <BlurView
            intensity={20}
            tint="dark"
            style={[styles.glassCard, isWithinGeofence && styles.glassCardLockedIn]}
          >
            <View style={styles.glassCardInner}>
              {/* LOCKED IN banner — modern with crowd count */}
              {isWithinGeofence && (
                <Animated.View style={[styles.lockedInBanner, {
                  opacity: checkinBannerAnim,
                  transform: [{ translateY: checkinBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
                }]}>
                  <LinearGradient
                    colors={['rgba(0,230,118,0.12)', 'rgba(0,230,118,0.04)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.lockedInGradient}
                  >
                    <View style={styles.lockedInLeft}>
                      <Animated.View style={[styles.lockedInDot, { opacity: checkinDotAnim }]} />
                      <Text style={styles.lockedInLabel}>YOU'RE IN</Text>
                    </View>
                    <View style={styles.lockedInMeta}>
                      <Text style={styles.lockedInTime}>
                        {checkinMinutes > 0 ? checkinMinutes + 'm' : 'Just arrived'}
                      </Text>
                      {venueCheckinCount > 0 && (
                        <>
                          <View style={styles.lockedInDivider} />
                          <Ionicons name="people" size={12} color="#00E676" />
                          <Text style={styles.lockedInCrowd}>{venueCheckinCount}</Text>
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </Animated.View>
              )}

              {/* VIIBE CERTIFIED banner */}
              {venue.viibe_certified && (
                <View style={styles.viibeBar}>
                  <Text style={styles.viibeBarText}>✦ VIIBE CERTIFIED — Peak Energy + Max Pulse</Text>
                </View>
              )}

              {/* Energy Level Headline */}
              <View style={styles.energyHeadline}>
                <View style={[styles.energyDot, { backgroundColor: vibeColor }]} />
                <Text style={[styles.energyLabel, { color: vibeColor }]}>
                  {vibeStateLabel}
                </Text>
                <View style={styles.energyScoreBadge}>
                  <Text style={[styles.energyScoreText, { color: vibeColor }]}>
                    {Math.round(venue.current_vibe_score)}%
                  </Text>
                </View>
              </View>

              {/* Energy Meter Bar */}
              <View style={{ marginBottom: 16 }}>
                <EnergyMeter
                  percent={venue.current_vibe_score}
                  size="md"
                  showLabel={false}
                  animate={true}
                />
              </View>

              {/* Utility Stats Row */}
              <View style={styles.utilityStatsRow}>
                {/* Entry Fee */}
                <View style={styles.utilityStat}>
                  <View style={styles.utilityIconContainer}>
                    <Ionicons name="ticket-outline" size={18} color="#FFD700" />
                  </View>
                  <Text style={styles.utilityLabel}>Entry</Text>
                  <Text style={styles.utilityValue}>{venue.entry_fee || 'Free'}</Text>
                </View>

                {/* Music Genre */}
                <View style={styles.utilityStat}>
                  <View style={styles.utilityIconContainer}>
                    <Ionicons name="musical-notes" size={18} color="#FF3366" />
                  </View>
                  <Text style={styles.utilityLabel}>Music</Text>
                  <Text style={styles.utilityValue} numberOfLines={1}>
                    {venue.music_genre || 'Mixed'}
                  </Text>
                </View>

                {/* Table Availability */}
                <View style={styles.utilityStat}>
                  <View style={styles.utilityIconContainer}>
                    <Ionicons 
                      name={venue.tables_available ? "checkmark-circle" : "close-circle"} 
                      size={18} 
                      color={venue.tables_available ? "#4CAF50" : "#FF5252"} 
                    />
                  </View>
                  <Text style={styles.utilityLabel}>Tables</Text>
                  <Text style={[
                    styles.utilityValue,
                    { color: venue.tables_available ? "#4CAF50" : "#FF5252" }
                  ]}>
                    {venue.tables_available ? 'Available' : 'Full'}
                  </Text>
                </View>
              </View>

              {/* Velocity */}
              <View style={styles.vibeStatsRow}>
                <View style={styles.vibeStat}>
                  <Ionicons
                    name={venue.vibe_velocity === 'heating_up' ? 'trending-up' : venue.vibe_velocity === 'cooling_down' ? 'trending-down' : 'remove'}
                    size={16}
                    color={venue.vibe_velocity === 'heating_up' ? '#4CAF50' : venue.vibe_velocity === 'cooling_down' ? '#FF5252' : '#888'}
                  />
                  <Text style={[
                    styles.vibeStatText,
                    { color: venue.vibe_velocity === 'heating_up' ? '#4CAF50' : venue.vibe_velocity === 'cooling_down' ? '#FF5252' : '#888' }
                  ]}>
                    {venue.vibe_velocity === 'heating_up' ? 'Heating Up' : venue.vibe_velocity === 'cooling_down' ? 'Cooling Down' : 'Holding Steady'}
                  </Text>
                </View>
              </View>

              {/* Context row — crowd + queue (informational only) */}
              <View style={styles.contextStatsRow}>
                <Text style={styles.contextStatsLabel}>CONTEXT</Text>
                <View style={styles.vibeStat}>
                  <Ionicons name="people" size={14} color="#555" />
                  <Text style={styles.contextStatText}>
                    {venue.capacity_level === 'full' ? 'Packed' : venue.capacity_level === 'vibrant' ? 'Filling Up' : 'Almost Empty'}
                  </Text>
                </View>
                <View style={styles.vibeStatDivider} />
                <View style={styles.vibeStat}>
                  <Ionicons name="enter" size={14} color="#555" />
                  <Text style={styles.contextStatText}>
                    {venue.gate_level === 'blocked' ? 'Long Queue' : venue.gate_level === 'slow' ? 'Short Wait' : 'Walk In'}
                  </Text>
                </View>
              </View>
            </View>
          </BlurView>
        </View>

        {/* ====== TAB NAVIGATION ====== */}
        <View style={styles.tabBar}>
          {([
            { key: 'now',   label: 'NOW',   icon: 'flash' },
            { key: 'intel', label: 'INTEL', icon: 'analytics' },
            { key: 'crew',  label: 'CREW',  icon: 'people' },
            { key: 'info',  label: 'INFO',  icon: 'information-circle' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#FF3366' : '#3A3A4E'} />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              {activeTab === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* NOW — live energy + intent */}
        {activeTab === 'now' && <>
          {id && <VenueIntentBar venueId={id} venueName={venue?.name} />}
        </>}

        {/* INTEL — predictions, crowd, timing */}
        {activeTab === 'intel' && <>
          {id && isFeatureEnabled('vibe_oracle') && <ErrorBoundary label="Vibe Oracle"><VibeOracle venueId={id} venueName={venue?.name} /></ErrorBoundary>}
          {id && venue && isFeatureEnabled('roast_toast') && <ErrorBoundary label="AI Take"><VenueRoastCard venueId={id} venueName={venue.name} isDemoMode={isDemoMode} /></ErrorBoundary>}
          {id && <ErrorBoundary label="Arrival Intel"><ArrivalIntelCard venueId={id} isDemoMode={isDemoMode} /></ErrorBoundary>}
          {id && <ErrorBoundary label="Crowd"><CrowdCompositionBar venueId={id} isDemoMode={isDemoMode} /></ErrorBoundary>}
          {venueTimeline.length > 0 && <ErrorBoundary label="Timeline"><VibeTimeline timeline={venueTimeline} peakHour={timelinePeakHour} /></ErrorBoundary>}
          {id && <ErrorBoundary label="Forecast"><View style={{ paddingHorizontal: 16, marginTop: 12 }}><VibeForecast venueId={id} /></View></ErrorBoundary>}
        </>}

        {/* CREW — scouts + social */}
        {activeTab === 'crew' && <>
          {id && isFeatureEnabled('top_scouts') && <ErrorBoundary label="Top Scouts"><TopScoutsCard venueId={id} /></ErrorBoundary>}
        </>}

        {/* INFO — location, booking, status */}
        {activeTab === 'info' && <>
          {venue.active_campaign_multiplier && <View style={{ paddingHorizontal: 16, marginTop: 12 }}><CampaignBadge multiplier={venue.active_campaign_multiplier} expiresAt={venue.active_campaign_expires} /></View>}
          {venue.vibe_certified && <View style={{ paddingHorizontal: 16, marginTop: 12 }}><CertifiedBadge score={venue.certification_score} /></View>}

        {/* ── Action Buttons: full-width stacked ── */}
        <View style={styles.actionButtonStack}>
          <TouchableOpacity onPress={handleGetDirections} activeOpacity={0.85}>
            <LinearGradient colors={['#1E88E5', '#1565C0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
              <Ionicons name="navigate" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>GET DIRECTIONS</Text>
            </LinearGradient>
          </TouchableOpacity>
          {isAuthenticated && (
            <TouchableOpacity onPress={() => setShowBookingModal(true)} activeOpacity={0.85}>
              <LinearGradient colors={['#FF3366', '#CC0044']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
                <Ionicons name="calendar" size={20} color="#FFF" />
                <Text style={styles.actionBtnText}>RESERVE TABLE</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Venue Details Card ── */}
        <View style={styles.venueDetailsCard}>
          <Text style={styles.venueDetailsSectionLabel}>VENUE DETAILS</Text>

          <View style={styles.venueDetailsGrid}>
            {/* Address */}
            <View style={styles.venueDetailRow}>
              <View style={styles.venueDetailIcon}><Ionicons name="location" size={16} color="#FF3366" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Address</Text>
                <Text style={styles.venueDetailValue}>{venue.address}</Text>
                <Text style={styles.venueDetailSub}>{venue.area} · {venue.city}</Text>
              </View>
            </View>

            {/* Entry */}
            <View style={styles.venueDetailRow}>
              <View style={styles.venueDetailIcon}><Ionicons name="ticket-outline" size={16} color="#FFD700" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Entry</Text>
                <Text style={styles.venueDetailValue}>{venue.entry_fee || 'Free'}</Text>
              </View>
            </View>

            {/* Music */}
            <View style={styles.venueDetailRow}>
              <View style={styles.venueDetailIcon}><Ionicons name="musical-notes" size={16} color="#9933FF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Music</Text>
                <Text style={styles.venueDetailValue}>{venue.music_genre || 'Mixed'}</Text>
              </View>
            </View>

            {/* Tables */}
            <View style={styles.venueDetailRow}>
              <View style={styles.venueDetailIcon}>
                <Ionicons name={venue.tables_available ? 'checkmark-circle' : 'close-circle'} size={16} color={venue.tables_available ? '#4CAF50' : '#FF5252'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Tables</Text>
                <Text style={[styles.venueDetailValue, { color: venue.tables_available ? '#4CAF50' : '#FF5252' }]}>
                  {venue.tables_available ? 'Available' : 'Full tonight'}
                </Text>
              </View>
            </View>

            {/* Crowd / Capacity */}
            <View style={styles.venueDetailRow}>
              <View style={styles.venueDetailIcon}><Ionicons name="people" size={16} color="#33CCFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Crowd</Text>
                <Text style={styles.venueDetailValue}>
                  {venue.capacity_level === 'full' ? 'Packed' : venue.capacity_level === 'vibrant' ? 'Filling Up' : 'Plenty of Room'}
                </Text>
              </View>
            </View>

            {/* Queue */}
            <View style={[styles.venueDetailRow, { borderBottomWidth: 0 }]}>
              <View style={styles.venueDetailIcon}><Ionicons name="enter" size={16} color="#FF9933" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Entry Queue</Text>
                <Text style={styles.venueDetailValue}>
                  {venue.gate_level === 'blocked' ? 'Long Queue' : venue.gate_level === 'slow' ? 'Short Wait' : 'Walk In'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* GPS status + check-in */}
        <View style={styles.venueDetailsCard}>
          <Text style={styles.venueDetailsSectionLabel}>YOUR STATUS</Text>

          {/* GPS / Location row */}
          <View style={[styles.venueDetailRow, { borderBottomWidth: user && ratingStatus ? 1 : 0 }]}>
            <Animated.View style={[styles.venueDetailIcon, { transform: [{ scale: isWithinGeofence ? pulseAnim : 1 }] }]}>
              <Ionicons name={isWithinGeofence ? 'location' : 'location-outline'} size={16} color={isWithinGeofence ? '#4CAF50' : '#555'} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueDetailLabel}>Location</Text>
              <Text style={[styles.venueDetailValue, { color: isWithinGeofence ? '#4CAF50' : '#888' }]}>
                {checkingLocation ? 'Verifying...' : isWithinGeofence ? `At the venue` : `Must be within ${venue?.geofence_radius_m || 100}m to rate`}
              </Text>
            </View>
            {checkingLocation && <ActivityIndicator size="small" color="#FF3366" />}
          </View>

          {/* Rating status */}
          {user && ratingStatus && (
            <View style={[styles.venueDetailRow, { borderBottomWidth: user && isWithinGeofence ? 1 : 0 }]}>
              <View style={styles.venueDetailIcon}>
                <Ionicons name={ratingStatus.can_rate ? 'star' : 'time'} size={16} color={ratingStatus.can_rate ? '#FF3366' : '#FF9800'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Rating</Text>
                <Text style={[styles.venueDetailValue, { color: ratingStatus.can_rate ? '#FF3366' : '#888' }]}>
                  {ratingStatus.is_correction_available ? 'Correction available' : ratingStatus.can_rate ? 'Ready to rate' : 'Limit reached — resets in 24h'}
                </Text>
              </View>
              <View style={{ backgroundColor: '#1E1E2E', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Text style={{ color: '#555', fontSize: 11, fontWeight: '700' }}>{ratingStatus.ratings_count}/2</Text>
              </View>
            </View>
          )}

          {/* Ghost check-in */}
          {user && isWithinGeofence && (
            <TouchableOpacity
              style={[styles.venueDetailRow, { borderBottomWidth: 0 }]}
              onPress={handleGhostCheckin}
              disabled={checkinLoading}
              activeOpacity={0.7}
            >
              <View style={styles.venueDetailIcon}>
                <Ionicons name={activeCheckin?.venue_id === venue?.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={activeCheckin?.venue_id === venue?.id ? '#00E676' : '#555'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.venueDetailLabel}>Check-in</Text>
                <Text style={[styles.venueDetailValue, { color: activeCheckin?.venue_id === venue?.id ? '#00E676' : '#888' }]}>
                  {checkinLoading ? 'Updating...' : activeCheckin?.venue_id === venue?.id ? "You're Here (ghost mode)" : "Tap to ghost check-in"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Geofence Tooltip */}
        {showGeofenceTooltip && (
          <Animated.View style={[styles.tooltip, { opacity: tooltipAnim }]}>
            <Ionicons name="location-outline" size={16} color="#FFF" />
            <Text style={styles.tooltipText}>You must be at the venue to rate it</Text>
          </Animated.View>
        )}

        </>}

        {/* ── Vibe Surge Bar — always visible, near Rate the Vibe ── */}
        {id && <ErrorBoundary label="Vibe Surge"><VibeSurgeBar venueId={id} venueName={venue?.name ?? ''} isDemoMode={isDemoMode} onElectric={(tc) => { setSurgeTapCount(tc); setShowSurgeCelebration(true); }} onReact={handleReact} /></ErrorBoundary>}

        <View style={{ height: 200 }} />
      </ScrollView>

      {/* ═══ GPS Ready to Rate Banner ═══ */}
      {(isWithinGeofence || isDemoMode) && (
        <Animated.View style={[styles.readyToRateBanner, {
          opacity: readyBannerAnim,
          transform: [{ translateY: readyBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}>
          <LinearGradient
            colors={['rgba(0,230,118,0.14)', 'rgba(0,200,100,0.06)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.readyToRateGradient}
          >
            <Animated.View style={[styles.readyToRateDot, { opacity: readyDotAnim, shadowColor: '#00E676', shadowOpacity: 0.8, shadowRadius: 6 }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.readyToRateText}>GPS LOCKED IN · READY TO RATE</Text>
              <Text style={styles.readyToRateSub}>You're at the venue — your rating counts now</Text>
            </View>
            <Ionicons name="star" size={18} color="#00E676" />
          </LinearGradient>
        </Animated.View>
      )}

      {/* ═══ Sticky Rate Footer ═══ */}
      <View style={styles.stickyRateFooter}>
        <BlurView intensity={30} tint="dark" style={styles.stickyBlur}>
          <LinearGradient
            colors={['rgba(15,15,25,0.92)', 'rgba(10,10,18,0.98)']}
            style={styles.stickyGradient}
          >
            <View style={styles.stickyFooterRow}>
              <TouchableOpacity
                style={styles.stickyRateBtn}
                activeOpacity={0.8}
                onPress={() => {
                  if (!user) {
                    router.push('/profile');
                  } else if (!isWithinGeofence && !isDemoMode) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    checkUserLocation();
                  } else {
                    // Always open modal — it shows cooldown screen if on cooldown
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowRateModal(true);
                  }
                }}
              >
                <LinearGradient
                  colors={
                    user && isWithinGeofence && ratingStatus?.can_rate
                      ? ['#FF3366', '#FF6B35']
                      : ['#2A2A3E', '#1A1A2E']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.stickyRateGradient}
                >
                  <Ionicons
                    name={!user ? 'person' : !isWithinGeofence ? 'location-outline' : 'star'}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.stickyRateText}>
                    {!user
                      ? 'Sign in to Rate'
                      : !isWithinGeofence
                      ? 'Get Closer to Rate'
                      : ratingStatus?.can_rate
                      ? 'Rate the Vibe'
                      : 'Limit Reached'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </LinearGradient>
        </BlurView>
      </View>

      {/* Vibe+ Upgrade Modal */}
      <VibePlusModal
        visible={showVibePlusModal}
        onClose={() => setShowVibePlusModal(false)}
      />

      {/* Booking Modal */}
      {venue && (
        <BookingModal
          visible={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          venueId={venue.id}
          venueName={venue.name}
          authToken={user?.token}
          isDemoMode={isDemoMode}
        />
      )}

      {/* Surge Celebration */}
      <SurgeCelebration
        visible={showSurgeCelebration}
        venueName={venue?.name ?? ''}
        tapCount={surgeTapCount}
        onDone={() => setShowSurgeCelebration(false)}
      />

      {/* First Scout Celebration */}
      <FirstScoutCelebration
        visible={showFirstScout}
        venueName={venue?.name ?? ''}
        onDismiss={() => setShowFirstScout(false)}
      />

      {/* Venue Energy Alert Modal */}
      <VenueAlertModal
        visible={showAlertModal}
        venueId={venue?.id ?? ''}
        venueName={venue?.name ?? ''}
        existingAlerts={venueAlerts}
        onClose={() => setShowAlertModal(false)}
        onSaved={(alert) => {
          setVenueAlerts(prev => {
            const idx = prev.findIndex(a => a.id === alert.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = alert;
              return next;
            }
            return [...prev, alert];
          });
        }}
        onDeleted={(id) => setVenueAlerts(prev => prev.filter(a => a.id !== id))}
      />

      {/* Resonance Prompt — post-rating quality annotation */}
      <ResonancePrompt
        visible={showResonance}
        venueName={venue?.name || ''}
        boltCount={sessionBoltCount}
        onSelect={(score) => {
          setShowResonance(false);
          // TODO: POST /api/venues/:id/resonance { score }
        }}
        onDismiss={() => setShowResonance(false)}
      />

      {/* Rate Vibe Modal */}
      <ErrorBoundary label="Rating">
        <RateVibeModal
          visible={showRateModal}
          onClose={() => setShowRateModal(false)}
          onSubmit={handleSubmitRating}
          venueName={venue?.name || ''}
          venueType={venue?.venue_type as any}
          isGpsVerified={isWithinGeofence || isDemoMode}
          geofenceRadius={venue?.geofence_radius_m || 100}
          cooldownRemainingSeconds={ratingStatus?.cooldown_remaining_seconds || 0}
          userClout={user?.clout_points || 0}
          onSkipCooldown={async (method) => {
            const result = await cooldownSkip(venue?.id || '', method);
            if (result.success) {
              const updatedStatus = await getUserRatingStatus(venue?.id || '');
              setRatingStatus(updatedStatus);
            }
            return result;
          }}
        />
      </ErrorBoundary>

      {/* Story Viewer Modal */}
      {venueStories.length > 0 && (
        <StoryViewer
          visible={showStoryViewer}
          stories={venueStories.map(s => ({
            id: s.id,
            username: s.username,
            scout_status: s.scout_status || 'regular',
            media_url: s.media_url || '',
            caption: s.caption || '',
            views: s.views || 0,
            created_at: s.created_at,
            venue_name: venue?.name || '',
          }))}
          initialIndex={selectedStoryIndex}
          onClose={() => setShowStoryViewer(false)}
        />
      )}

      {/* Success Animation */}
      <VibeSuccessAnimation
        visible={showSuccessAnimation}
        cloutEarned={lastCloutEarned}
        hasPhoto={lastHadPhoto}
        venueName={venue?.name || ''}
        onComplete={handleSuccessAnimationComplete}
      />

      {/* Check-in Celebration Overlay */}
      <CheckInCelebration
        visible={showCelebration}
        cloutEarned={20}
        emoji={'\u{1F525}'}
        onComplete={() => setShowCelebration(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F', // Midnight Premium theme
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonLarge: {
    backgroundColor: '#FF3366',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A25',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  verifiedBadge: {
    backgroundColor: '#4CAF5020',
    padding: 4,
    borderRadius: 6,
  },
  pulseBadge: {
    backgroundColor: '#FFD70030',
    padding: 4,
    borderRadius: 6,
  },
  lobbyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // ====== LIVE LOOK STYLES ======
  liveLookContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  liveLookWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A25',
  },
  liveLookImage: {
    width: '100%',
    height: '100%',
  },
  liveLookGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  liveLookBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveLookBadgeText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  pulseGlowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#FFD70060',
    borderRadius: 20,
  },
  pulseGlow: {
    flex: 1,
  },

  // ====== GLASSMORPHISM CARD ======
  glassCardContainer: {
    paddingHorizontal: 16,
    marginTop: -40,
    zIndex: 10,
  },
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCardInner: {
    padding: 20,
    backgroundColor: 'rgba(26, 26, 37, 0.85)',
  },
  energyHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  energyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  energyLabel: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    flex: 1,
  },
  energyScoreBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  energyScoreText: {
    fontSize: 18,
    fontWeight: '800',
  },
  utilityStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  utilityStat: {
    flex: 1,
    alignItems: 'center',
  },
  utilityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  utilityLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  utilityValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  viibeBar: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  viibeBarText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1.2,
  },
  contextStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  contextStatsLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#444',
    letterSpacing: 1.5,
    marginRight: 4,
  },
  contextStatText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '500',
  },
  vibeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  vibeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vibeStatText: {
    fontSize: 12,
    color: '#888',
  },
  vibeStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#333',
    marginHorizontal: 12,
  },

  // ====== LOCATION CARD ======
  tabBar: { flexDirection: 'row', backgroundColor: '#0A0A12', borderBottomWidth: 1, borderBottomColor: '#1C1C2C', marginTop: 4, marginBottom: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3, position: 'relative' },
  tabItemActive: { },
  tabLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1 },
  tabLabelActive: { color: '#FF3366' },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: '#FF3366', borderRadius: 1 },
  locationCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1A1A25',
    borderRadius: 16,
    padding: 16,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  locationArea: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  directionsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  directionsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  directionsText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ====== GPS CONTAINER ======
  gpsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1A1A25',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gpsContainerActive: {
    borderColor: '#4CAF5040',
    backgroundColor: '#4CAF5010',
  },
  gpsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gpsIconActive: {
    backgroundColor: '#4CAF5020',
  },
  gpsIconInactive: {
    backgroundColor: '#33333380',
  },
  gpsTextContainer: {
    flex: 1,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  gpsSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // ====== RATING STATUS ======
  ratingStatusCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1A1A25',
    borderRadius: 16,
    padding: 16,
  },
  ratingStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  ratingCount: {
    backgroundColor: '#FF336620',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3366',
  },
  ratingStatusContent: {},
  ratingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingStatusText: {
    fontSize: 13,
    color: '#888',
  },

  // ====== TOOLTIP ======
  tooltip: {
    position: 'absolute',
    bottom: 180,
    left: 32,
    right: 32,
    backgroundColor: '#FF5252',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  tooltipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // ====== RATE BUTTON ======
  rateButton: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  rateButtonDisabled: {
    opacity: 0.6,
  },
  rateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  geofenceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  geofenceWarningText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // ====== STICKY RATE FOOTER ======
  stickyRateFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  stickyBlur: {
    overflow: 'hidden',
  },
  stickyGradient: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  stickyFooterRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  stickyRateBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  stickyRateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    borderRadius: 16,
  },
  stickyRateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // ====== STORY BUBBLES + CROWD ======
  storyRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyScroll: {
    gap: 12,
    paddingRight: 12,
    flex: 1,
  },
  crowdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E67615',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  crowdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00E676',
  },

  // ====== GHOST CHECK-IN ======
  ghostCheckinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#1A1A25',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    gap: 8,
  },
  ghostCheckinActive: {
    borderColor: '#00E67640',
    backgroundColor: '#00E67610',
    borderStyle: 'solid',
  },
  ghostCheckinText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },

  // ====== CHECK-IN MODE ======
  glassCardLockedIn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  lockedInBanner: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.22)',
    overflow: 'hidden',
  },
  lockedInGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lockedInLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedInMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockedInDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(0, 230, 118, 0.3)',
  },
  lockedInCrowd: {
    fontSize: 12,
    color: '#00E676',
    fontWeight: '700',
  },
  lockedInDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#00E676',
    shadowColor: '#00E676', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  lockedInLabel: {
    fontSize: 12, fontWeight: '900', color: '#00E676', letterSpacing: 2,
  },
  lockedInTime: {
    fontSize: 13, fontWeight: '700', color: '#00E676',
  },

  // ====== INFO TAB: ACTION BUTTONS ======
  actionButtonStack: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // ====== INFO TAB: VENUE DETAILS CARD ======
  venueDetailsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#0F0F1C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  venueDetailsSectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3A3A4E',
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  venueDetailsGrid: {},
  venueDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  venueDetailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueDetailLabel: {
    fontSize: 10,
    color: '#3A3A4E',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  venueDetailValue: {
    fontSize: 14,
    color: '#DDD',
    fontWeight: '600',
  },
  venueDetailSub: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },

  // ====== GPS READY BANNER ======
  readyToRateBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  readyToRateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  readyToRateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  readyToRateText: {
    flex: 1,
    color: '#00E676',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  readyToRateSub: {
    color: 'rgba(0,230,118,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
