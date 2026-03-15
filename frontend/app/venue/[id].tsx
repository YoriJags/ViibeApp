import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import VibeReactor from '../../src/components/VibeReactor';
import SurgeCelebration from '../../src/components/SurgeCelebration';
import FirstScoutCelebration from '../../src/components/FirstScoutCelebration';
import ResonancePrompt from '../../src/components/ResonancePrompt';
import EmojiPulse from '../../src/components/EmojiPulse';
import VenueInsiderPanel from '../../src/components/VenueInsiderPanel';
import ScoutPressureChip from '../../src/components/ScoutPressureChip';
import VibeMomentum from '../../src/components/VibeMomentum';
import TorchButton from '../../src/components/TorchButton';

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
  const vibePersona = useVibeStore(s => s.vibePersona);

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
    setVenueGeofence,
    isInsideVenue,
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
  const [personaToast, setPersonaToast] = useState<string | null>(null);
  const personaToastAnim = useRef(new Animated.Value(0)).current;
  const [showFirstScout, setShowFirstScout] = useState(false);
  const [showResonance, setShowResonance] = useState(false);
  const [sessionBoltCount, setSessionBoltCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'now' | 'intel' | 'crew' | 'info'>('now');

  // ── Reactor auto-scroll refs ─────────────────────────────────────────────
  const scrollViewRef    = useRef<any>(null);
  const reactorLayoutY   = useRef<number>(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const checkinBannerAnim = useRef(new Animated.Value(0)).current;
  const checkinDotAnim = useRef(new Animated.Value(1)).current;
  const readyBannerAnim = useRef(new Animated.Value(0)).current;
  const readyDotAnim = useRef(new Animated.Value(1)).current;

  // ── Auto-scroll: bring VibeReactor to top when entering geofence on NOW tab
  useEffect(() => {
    if (isInsideVenue && activeTab === 'now' && reactorLayoutY.current > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: reactorLayoutY.current - 12, animated: true });
      }, 400); // brief delay lets spring animation settle
    }
  }, [isInsideVenue]);

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
    if (openRateModal === 'true' && venue && (isWithinGeofence || isDemoMode)) {
      setShowRateModal(true);
    }
  }, [openRateModal, venue, isWithinGeofence, isDemoMode]);

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
    if (isDemoMode) {
      const { DEMO_VENUES } = require('../../src/data/demoData');
      const demoVenue = DEMO_VENUES.find((v: any) => v.id === id);
      if (demoVenue) {
        setVenue(demoVenue);
        setLoading(false);
        return;
      }
      // Real venue ID accessed in demo mode — fall through to API
    }
    const venueData = await fetchVenue(id || '');
    setVenue(venueData);

    if (user) {
      const status = await getUserRatingStatus(id || '');
      setRatingStatus(status);
    }

    setLoading(false);
  };

  // Socket.IO — join room + live venue_update → patch local state
  useEffect(() => {
    if (!socket || !venue?.id) return;
    socket.emit('join_venue', { venue_id: venue.id });

    const handleVenueUpdate = (updated: any) => {
      if (updated?.id === venue.id) {
        setVenue((prev: any) => prev ? { ...prev, ...updated } : updated);
      }
    };
    socket.on('venue_update', handleVenueUpdate);

    return () => {
      socket.off('venue_update', handleVenueUpdate);
    };
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
      setVenueGeofence(id ?? null, venue?.name ?? null, venue?.coordinates ?? null, true);
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
        setVenueGeofence(venue.id, venue.name, venue.coordinates, within);
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

  // Persona identity reinforcement — fires after a successful rating
  const PERSONA_MESSAGES: Record<string, Record<string, string>> = {
    turn_up:    { club: "Turn Up certified 🔥", bar: "The scene knows you 🔥", concert: "You caught the wave ⚡", default: "Turn Up sensor activated 🔥" },
    grown_sexy: { lounge: "Classic Luxe taste 🥂", restaurant: "Refined as always 🥂", bar: "Curated. That's the Luxe way 🥂", default: "The Luxe eye never misses 🥂" },
    culture:    { concert: "Pure culture alignment 🎵", default: "Culture documented 🎵" },
    chill_set:  { restaurant: "Smooth operator 😌", lounge: "Easy living 😌", default: "Low-key, high taste 😌" },
  };
  const showPersonaToast = (persona: string | null, venueType: string | null) => {
    const map = persona ? PERSONA_MESSAGES[persona] : null;
    const msg = map ? (map[venueType ?? ''] ?? map['default'] ?? null) : "Your signal is live 📡";
    if (!msg) return;
    setPersonaToast(msg);
    personaToastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(personaToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(personaToastAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setPersonaToast(null));
  };

  const handleSubmitRating = async (data: {
    energy: 'quiet' | 'chill' | 'warming' | 'lit' | 'peak';
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
      // Persona identity reinforcement
      showPersonaToast(vibePersona, venue?.venue_type ?? null);
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
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >

        {/* ====== CINEMATIC HERO ====== */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: venue.last_snapshot_url || getPlaceholderImage() }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Cinematic bottom gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', '#000']}
            style={styles.heroGradient}
          />

          {/* Pulse-drop gold shimmer */}
          {hasPulseDrop && (
            <LinearGradient
              colors={['rgba(201,168,76,0.18)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Top row: back + snapshot pill + actions */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroBackBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </TouchableOpacity>

            {/* Snapshot time pill — centered */}
            <View style={styles.heroSnapshotPill}>
              <Ionicons name="eye" size={10} color="#4CAF50" />
              <Text style={styles.heroSnapshotText}>{getSnapshotTimeAgo()}</Text>
            </View>

            {/* Right-side action buttons */}
            <View style={styles.heroActionsRow}>
              <TouchableOpacity style={styles.heroActionBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color="#FFF" />
              </TouchableOpacity>
              {isAuthenticated && (
                <TouchableOpacity style={styles.heroActionBtn} onPress={handleToggleLobby}>
                  <Ionicons
                    name={inLobby ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={inLobby ? '#C9A84C' : '#FFF'}
                  />
                </TouchableOpacity>
              )}
              {isAuthenticated && (
                <TouchableOpacity style={styles.heroActionBtn} onPress={() => setShowAlertModal(true)}>
                  <Ionicons
                    name={venueAlerts.length > 0 ? 'notifications' : 'notifications-outline'}
                    size={18}
                    color={venueAlerts.length > 0 ? '#C9A84C' : '#FFF'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Bottom hero info: name + vibe state label + score badge */}
          <View style={styles.heroBottom}>
            <Text style={styles.heroVenueName} numberOfLines={2}>{venue.name}</Text>
            <Text style={[styles.heroVenueState, { color: vibeColor }]}>{vibeStateLabel}</Text>

            {/* Vibe score badge — bottom-right */}
            <View style={styles.heroScoreBadge}>
              <Text style={[styles.heroScoreNumber, { color: vibeColor }]}>
                {Math.round(venue.current_vibe_score)}
                <Text style={{ fontSize: 20, fontWeight: '700' }}>%</Text>
              </Text>
              <Text style={styles.heroScoreLabel}>VIBE SCORE</Text>
            </View>

            {/* Certified + Verified badges */}
            {(venue.vibe_certified || venue.is_verified) && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {venue.vibe_certified && <CertifiedBadge compact />}
                {venue.is_verified && (
                  <View style={styles.heroCertBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                    <Text style={{ fontSize: 10, color: '#4CAF50', fontWeight: '700', letterSpacing: 1 }}>VERIFIED</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ====== LIVE CHECKIN BANNER ====== */}
        {isWithinGeofence && (
          <Animated.View style={[styles.checkinBanner, {
            opacity: checkinBannerAnim,
            transform: [{ translateY: checkinBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Animated.View style={[styles.checkinBannerDot, { opacity: checkinDotAnim }]} />
              <Text style={styles.checkinBannerText}>
                YOU'RE IN
                {checkinMinutes > 0 ? ` · ${checkinMinutes}m` : ' · Just arrived'}
                {venueCheckinCount > 0 ? ` · ${venueCheckinCount} here` : ''}
              </Text>
            </View>
            <Ionicons name="people" size={14} color="#00E676" />
          </Animated.View>
        )}

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

        {/* ====== QUICK STATS STRIP ====== */}
        <View style={styles.statsStrip}>
          {/* VIBE — pulsing live dot */}
          <TouchableOpacity style={styles.statCol} activeOpacity={0.7} onPress={() => setActiveTab('now')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.statNumber, { color: vibeColor }]}>
                {Math.round(venue.current_vibe_score)}
              </Text>
              <Animated.View style={{
                width: 6, height: 6, borderRadius: 3, backgroundColor: vibeColor,
                opacity: pulseAnim.interpolate({ inputRange: [1, 1.3], outputRange: [0.5, 1] }),
              }} />
            </View>
            <Text style={styles.statLabel}>VIBE</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          {/* CROWD — color-coded */}
          <TouchableOpacity style={styles.statCol} activeOpacity={0.7} onPress={() => setActiveTab('intel')}>
            <Text style={[styles.statNumber, {
              color: venue.capacity_level === 'full' ? '#FF3366' : venue.capacity_level === 'vibrant' ? '#FF9933' : '#3399FF',
              fontSize: 14,
            }]}>
              {venue.capacity_level === 'full' ? 'Packed' : venue.capacity_level === 'vibrant' ? 'Filling' : 'Quiet'}
            </Text>
            <Text style={styles.statLabel}>CROWD</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          {/* ENTRY — taps to booking */}
          <TouchableOpacity style={styles.statCol} activeOpacity={0.7} onPress={() => setShowBookingModal(true)}>
            <Text style={[styles.statNumber, { color: '#C9A84C' }]}>
              {venue.entry_fee || 'FREE'}
            </Text>
            <Text style={styles.statLabel}>ENTRY ›</Text>
          </TouchableOpacity>
        </View>

        {/* ====== VIIBE CERTIFIED BAR ====== */}
        {venue.viibe_certified && (
          <View style={styles.viibeBar}>
            <Text style={styles.viibeBarText}>✦ VIIBE CERTIFIED — Peak Energy + Max Pulse</Text>
          </View>
        )}

        {/* ====== VELOCITY CHIP ====== */}
        <View style={styles.velocityChip}>
          <Ionicons
            name={venue.vibe_velocity === 'heating_up' ? 'trending-up' : venue.vibe_velocity === 'cooling_down' ? 'trending-down' : 'remove'}
            size={16}
            color={venue.vibe_velocity === 'heating_up' ? '#4CAF50' : venue.vibe_velocity === 'cooling_down' ? '#FF5252' : 'rgba(255,255,255,0.3)'}
          />
          <Text style={[styles.velocityText, {
            color: venue.vibe_velocity === 'heating_up' ? '#4CAF50' : venue.vibe_velocity === 'cooling_down' ? '#FF5252' : 'rgba(255,255,255,0.3)',
          }]}>
            {venue.vibe_velocity === 'heating_up' ? 'HEATING UP' : venue.vibe_velocity === 'cooling_down' ? 'COOLING DOWN' : 'HOLDING STEADY'}
          </Text>
        </View>

        {/* ====== TAB BAR ====== */}
        <View style={styles.tabBar}>
          {([
            { key: 'now',   label: 'NOW' },
            { key: 'intel', label: 'INTEL' },
            { key: 'crew',  label: 'CREW' },
            { key: 'info',  label: 'INFO' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ====== TAB CONTENT ====== */}
        <View style={styles.tabContent}>

          {/* NOW TAB */}
          {activeTab === 'now' && (
            <>
              {/* ── Emoji Milestone Energy Bar ── */}
              {(() => {
                const score = Math.round(venue.current_vibe_score);
                const MILESTONES = [
                  { pct: 0,   emoji: '😴', label: '0'   },
                  { pct: 20,  emoji: '👀', label: '20'  },
                  { pct: 40,  emoji: '⚡', label: '40'  },
                  { pct: 60,  emoji: '🔥', label: '60'  },
                  { pct: 80,  emoji: '💜', label: '80'  },
                  { pct: 100, emoji: '👑', label: '100' },
                ];
                const currentBracket = [80, 60, 40, 20, 0].find(b => score >= b) ?? 0;
                return (
                  <TouchableOpacity
                    style={styles.contentPad}
                    onPress={() => setShowRateModal(true)}
                    activeOpacity={0.85}
                  >
                    {/* Big score */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 16 }}>
                      <Text style={{ fontSize: 56, fontWeight: '900', color: vibeColor, letterSpacing: -2 }}>
                        {score}
                      </Text>
                      <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.25)', fontWeight: '600' }}>/100</Text>
                    </View>
                    {/* Bar */}
                    <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
                      <View style={{ height: 8, width: `${score}%` as any, backgroundColor: vibeColor, borderRadius: 4 }} />
                    </View>
                    {/* Emoji markers */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      {MILESTONES.map(m => {
                        const isCurrent = m.pct === currentBracket;
                        const isPast    = m.pct < currentBracket;
                        return (
                          <View key={m.pct} style={{ alignItems: 'center', gap: 3 }}>
                            <Text style={{
                              fontSize: isCurrent ? 22 : 16,
                              opacity: isCurrent ? 1 : isPast ? 0.55 : 0.2,
                            }}>
                              {m.emoji}
                            </Text>
                            <Text style={{
                              fontSize: 9, fontWeight: '700',
                              color: isCurrent ? vibeColor : 'rgba(255,255,255,0.25)',
                            }}>
                              {m.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    {/* Sports-broadcast narrative line */}
                    {venue.venue_narrative ? (
                      <View style={{
                        flexDirection: 'row', alignItems: 'flex-start', gap: 7,
                        marginTop: 14, backgroundColor: 'rgba(255,255,255,0.04)',
                        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
                        borderLeftWidth: 3, borderLeftColor: vibeColor,
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: vibeColor, letterSpacing: 1.5, marginTop: 1 }}>LIVE</Text>
                        <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', lineHeight: 17 }}>
                          {venue.venue_narrative}
                        </Text>
                      </View>
                    ) : venueCheckinCount > 0 ? (
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 10, fontWeight: '600' }}>
                        {venueCheckinCount} scouts here tonight
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })()}

              {/* Torch */}
              <View style={styles.contentPad}>
                <TorchButton
                  vibeScore={venue.current_vibe_score}
                  venueId={venue.id}
                  socket={socket}
                />
              </View>

              {/* Emoji Pulse */}
              <View style={styles.contentPad}>
                <ErrorBoundary label="Emoji Pulse">
                  <EmojiPulse
                    venueId={venue.id}
                    isDemoMode={isDemoMode}
                  />
                </ErrorBoundary>
              </View>

              {/* Vibe Momentum */}
              <View style={styles.contentPad}>
                <ErrorBoundary label="Vibe Momentum">
                  <VibeMomentum
                    venueId={venue.id}
                    isDemoMode={isDemoMode}
                  />
                </ErrorBoundary>
              </View>

              {/* Scout Pressure Chip */}
              <ErrorBoundary label="Scout Pressure">
                <ScoutPressureChip
                  venueId={venue.id}
                  isDemoMode={isDemoMode}
                  style={{ marginHorizontal: 20, marginBottom: 10 }}
                />
              </ErrorBoundary>

              {/* Venue Intent Bar */}
              {id && <VenueIntentBar venueId={id} venueName={venue?.name} />}

              {/* Context stats */}
              <View style={[styles.contentPad, { marginTop: 16, marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="people" size={14} color="rgba(255,255,255,0.3)" />
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>
                    {venue.capacity_level === 'full' ? 'Packed' : venue.capacity_level === 'vibrant' ? 'Filling Up' : 'Almost Empty'}
                  </Text>
                  <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 }} />
                  <Ionicons name="enter" size={14} color="rgba(255,255,255,0.3)" />
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>
                    {venue.gate_level === 'blocked' ? 'Long Queue' : venue.gate_level === 'slow' ? 'Short Wait' : 'Walk In'}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* INTEL TAB */}
          {activeTab === 'intel' && (
            <View style={styles.contentPad}>
              {id && isFeatureEnabled('vibe_oracle') && (
                <ErrorBoundary label="Vibe Oracle">
                  <VibeOracle venueId={id} venueName={venue?.name} />
                </ErrorBoundary>
              )}
              {id && venue && isFeatureEnabled('roast_toast') && (
                <ErrorBoundary label="AI Take">
                  <VenueRoastCard venueId={id} venueName={venue.name} isDemoMode={isDemoMode} />
                </ErrorBoundary>
              )}
              {id && (
                <ErrorBoundary label="Arrival Intel">
                  <ArrivalIntelCard venueId={id} isDemoMode={isDemoMode} />
                </ErrorBoundary>
              )}
              {id && (
                <ErrorBoundary label="Crowd">
                  <CrowdCompositionBar venueId={id} isDemoMode={isDemoMode} />
                </ErrorBoundary>
              )}
              {venueTimeline.length > 0 && (
                <ErrorBoundary label="Timeline">
                  <VibeTimeline timeline={venueTimeline} peakHour={timelinePeakHour} />
                </ErrorBoundary>
              )}
              {id && (
                <ErrorBoundary label="Forecast">
                  <VibeForecast venueId={id} />
                </ErrorBoundary>
              )}
            </View>
          )}

          {/* CREW TAB */}
          {activeTab === 'crew' && (
            <View style={styles.contentPad}>
              {id && isFeatureEnabled('top_scouts') && (
                <ErrorBoundary label="Top Scouts">
                  <TopScoutsCard venueId={id} />
                </ErrorBoundary>
              )}
            </View>
          )}

          {/* INFO TAB */}
          {activeTab === 'info' && (
            <>
              {venue.active_campaign_multiplier && (
                <View style={styles.contentPad}>
                  <CampaignBadge multiplier={venue.active_campaign_multiplier} expiresAt={venue.active_campaign_expires} />
                </View>
              )}
              {venue.vibe_certified && (
                <View style={styles.contentPad}>
                  <CertifiedBadge score={venue.certification_score} />
                </View>
              )}

              {/* Action buttons */}
              <Text style={styles.sectionLabel}>ACTIONS</Text>
              <View style={styles.actionButtonStack}>
                <TouchableOpacity style={styles.actionFullBtn} onPress={handleGetDirections} activeOpacity={0.85}>
                  <Ionicons name="navigate" size={20} color="#1E88E5" />
                  <Text style={styles.actionFullBtnText}>GET DIRECTIONS</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
                {isAuthenticated && (
                  <TouchableOpacity style={styles.actionFullBtn} onPress={() => setShowBookingModal(true)} activeOpacity={0.85}>
                    <Ionicons name="calendar" size={20} color="#FF3366" />
                    <Text style={styles.actionFullBtnText}>RESERVE TABLE</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Venue Details */}
              <Text style={styles.sectionLabel}>VENUE DETAILS</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={16} color="#FF3366" />
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{venue.address}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="map" size={16} color="#C9A84C" />
                  <Text style={styles.infoLabel}>Area</Text>
                  <Text style={styles.infoValue}>{venue.area} · {venue.city}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="ticket-outline" size={16} color="#FFD700" />
                  <Text style={styles.infoLabel}>Entry</Text>
                  <Text style={styles.infoValue}>{venue.entry_fee || 'Free'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="musical-notes" size={16} color="#9933FF" />
                  <Text style={styles.infoLabel}>Music</Text>
                  <Text style={styles.infoValue}>{venue.music_genre || 'Mixed'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name={venue.tables_available ? 'checkmark-circle' : 'close-circle'} size={16} color={venue.tables_available ? '#4CAF50' : '#FF5252'} />
                  <Text style={styles.infoLabel}>Tables</Text>
                  <Text style={[styles.infoValue, { color: venue.tables_available ? '#4CAF50' : '#FF5252' }]}>
                    {venue.tables_available ? 'Available' : 'Full tonight'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="people" size={16} color="#33CCFF" />
                  <Text style={styles.infoLabel}>Crowd</Text>
                  <Text style={styles.infoValue}>
                    {venue.capacity_level === 'full' ? 'Packed' : venue.capacity_level === 'vibrant' ? 'Filling Up' : 'Plenty of Room'}
                  </Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Ionicons name="enter" size={16} color="#FF9933" />
                  <Text style={styles.infoLabel}>Entry Queue</Text>
                  <Text style={styles.infoValue}>
                    {venue.gate_level === 'blocked' ? 'Long Queue' : venue.gate_level === 'slow' ? 'Short Wait' : 'Walk In'}
                  </Text>
                </View>
              </View>

              {/* Your Status */}
              <Text style={styles.sectionLabel}>YOUR STATUS</Text>
              <View style={styles.infoCard}>
                <View style={[styles.infoRow, { borderBottomWidth: user && ratingStatus ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }]}>
                  <Animated.View style={{ transform: [{ scale: isWithinGeofence ? pulseAnim : 1 }] }}>
                    <Ionicons name={isWithinGeofence ? 'location' : 'location-outline'} size={16} color={isWithinGeofence ? '#4CAF50' : '#555'} />
                  </Animated.View>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={[styles.infoValue, { color: isWithinGeofence ? '#4CAF50' : '#888' }]}>
                    {checkingLocation ? 'Verifying...' : isWithinGeofence ? 'At the venue' : `Within ${venue?.geofence_radius_m || 100}m to rate`}
                  </Text>
                  {checkingLocation && <ActivityIndicator size="small" color="#FF3366" />}
                </View>

                {user && ratingStatus && (
                  <View style={[styles.infoRow, { borderBottomWidth: user && isWithinGeofence ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }]}>
                    <Ionicons name={ratingStatus.can_rate ? 'star' : 'time'} size={16} color={ratingStatus.can_rate ? '#FF3366' : '#FF9800'} />
                    <Text style={styles.infoLabel}>Rating</Text>
                    <Text style={[styles.infoValue, { color: ratingStatus.can_rate ? '#FF3366' : '#888' }]}>
                      {ratingStatus.is_correction_available ? 'Correction available' : ratingStatus.can_rate ? 'Ready to rate' : 'Limit reached'}
                    </Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>{ratingStatus.ratings_count}/2</Text>
                    </View>
                  </View>
                )}

                {user && isWithinGeofence && (
                  <TouchableOpacity
                    style={[styles.infoRow, { borderBottomWidth: 0 }]}
                    onPress={handleGhostCheckin}
                    disabled={checkinLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={activeCheckin?.venue_id === venue?.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={activeCheckin?.venue_id === venue?.id ? '#00E676' : '#555'} />
                    <Text style={styles.infoLabel}>Check-in</Text>
                    <Text style={[styles.infoValue, { color: activeCheckin?.venue_id === venue?.id ? '#00E676' : '#888' }]}>
                      {checkinLoading ? 'Updating...' : activeCheckin?.venue_id === venue?.id ? "You're Here (ghost mode)" : "Tap to ghost check-in"}
                    </Text>
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
            </>
          )}
        </View>

        {/* ====== SCOUT PULSE / NARRATIVE INDICATOR ====== */}
        {venue && (venue.venue_narrative || venueCheckinCount > 1) && (
          <Animated.View style={[styles.scoutPulseRow, {
            opacity: pulseAnim.interpolate({ inputRange: [1, 1.3], outputRange: [0.7, 1] }),
          }]}>
            <Animated.View style={[styles.scoutPulseDot, {
              transform: [{ scale: pulseAnim }],
              backgroundColor: vibeColor,
            }]} />
            {venue.venue_narrative ? (
              <Text style={[styles.scoutPulseText, { color: vibeColor, flex: 1 }]} numberOfLines={1}>
                {venue.venue_narrative}
              </Text>
            ) : (
              <>
                <Text style={[styles.scoutPulseText, { color: vibeColor }]}>
                  {venueCheckinCount} scouts pushing
                </Text>
                <Text style={styles.scoutPulseGap}>
                  · {Math.max(0, 85 - Math.round(venue.current_vibe_score))} pts to PEAK
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* ====== PERSONAL VENUE STATS (geofence only) ====== */}
        {(isWithinGeofence || isDemoMode) && id && venue && (
          <VenueInsiderPanel
            venueId={id}
            venueName={venue.name}
            vibeColor={vibeColor}
            isDemoMode={isDemoMode}
            authHeaders={getAuthHeaders()}
            userName={user?.display_name ?? user?.username}
          />
        )}

        {/* ====== VIBE REACTOR ====== */}
        {id && venue && (
          <>
            <Text style={styles.sectionLabel}>REACTOR</Text>
            <View style={styles.reactorWrap}>
              <ErrorBoundary label="Vibe Reactor">
                <View onLayout={e => { reactorLayoutY.current = e.nativeEvent.layout.y; }}>
                  <VibeReactor
                    venueId={id}
                    venueName={venue.name ?? ''}
                    venueCoordinates={venue.coordinates ?? null}
                    userLocation={userLocation}
                    isDemoMode={isDemoMode}
                    onElectric={(tc) => { setSurgeTapCount(tc); setShowSurgeCelebration(true); }}
                    onReact={handleReact}
                    onQuestSucceeded={(participants) => {
                      setSurgeTapCount(participants);
                      setShowSurgeCelebration(true);
                    }}
                  />
                </View>
              </ErrorBoundary>
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ═══ GPS Ready to Rate Banner ═══ */}
      {(isWithinGeofence || isDemoMode) && (
        <Animated.View style={[styles.readyToRateBanner, {
          opacity: readyBannerAnim,
          transform: [{ translateY: readyBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}>
          <View style={styles.readyToRateRow}>
            <Animated.View style={[styles.readyToRateDot, { opacity: readyDotAnim }]} />
            <Text style={styles.readyToRateText}>GPS LOCKED IN · READY TO RATE</Text>
            <Ionicons name="star" size={16} color="#00E676" />
          </View>
        </Animated.View>
      )}

      {/* ═══ Sticky Footer — Rate + Check In ═══ */}
      <View style={styles.stickyRateFooter}>
        <BlurView intensity={30} tint="dark" style={styles.stickyBlur}>
          <LinearGradient
            colors={['rgba(15,15,25,0.92)', 'rgba(10,10,18,0.98)']}
            style={styles.stickyGradient}
          >
            <View style={styles.stickyFooterRow}>
              {/* Check In — primary when geofenced */}
              {(isWithinGeofence || isDemoMode) && user && (
                <Animated.View style={[styles.stickyCheckinBtn, {
                  transform: [{ scale: readyDotAnim.interpolate({ inputRange: [0.2, 1], outputRange: [0.97, 1.02] }) }],
                }]}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.8}
                  onPress={handleGhostCheckin}
                  disabled={checkinLoading}
                >
                  <LinearGradient
                    colors={activeCheckin?.venue_id === venue?.id ? ['#00C853', '#00A846'] : ['#00E676', '#00C853']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.stickyRateGradient}
                  >
                    <Ionicons
                      name={activeCheckin?.venue_id === venue?.id ? 'radio-button-on' : 'radio-button-off'}
                      size={20} color="#000"
                    />
                    <Text style={[styles.stickyRateText, { color: '#000' }]}>
                      {checkinLoading ? 'UPDATING...' : activeCheckin?.venue_id === venue?.id ? 'CHECKED IN' : 'CHECK IN'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                </Animated.View>
              )}

              {/* Rate */}
              <Animated.View style={[
                styles.stickyRateBtn,
                (isWithinGeofence || isDemoMode) && user && { flex: 0.9 },
                user && (isWithinGeofence || isDemoMode) && {
                  transform: [{ scale: readyDotAnim.interpolate({ inputRange: [0.2, 1], outputRange: [1, 1.02] }) }],
                  shadowColor: '#FF3366',
                  shadowOpacity: readyDotAnim.interpolate({ inputRange: [0.2, 1], outputRange: [0, 0.6] }),
                  shadowRadius: 12,
                  elevation: 8,
                },
              ]}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.8}
                onPress={() => {
                  if (!user) { router.push('/profile'); }
                  else if (!isWithinGeofence && !isDemoMode) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    checkUserLocation();
                  } else {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowRateModal(true);
                  }
                }}
              >
                <LinearGradient
                  colors={
                    user && (isWithinGeofence || isDemoMode) && (ratingStatus?.can_rate || isDemoMode)
                      ? ['#FF3366', '#FF6B35'] : ['#2A2A3E', '#1A1A2E']
                  }
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.stickyRateGradient}
                >
                  <Ionicons
                    name={!user ? 'person' : (!isWithinGeofence && !isDemoMode) ? 'location-outline' : 'star'}
                    size={20} color="#FFF"
                  />
                  <Text style={styles.stickyRateText}>
                    {!user ? 'Sign in' : !isWithinGeofence && !isDemoMode ? 'Get Closer' : ratingStatus?.can_rate || isDemoMode ? 'Rate the Vibe' : 'Limit Reached'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              </Animated.View>
            </View>
          </LinearGradient>
        </BlurView>
      </View>

      {/* Vibe+ Upgrade Modal */}
      <VibePlusModal
        visible={showVibePlusModal}
        onClose={() => setShowVibePlusModal(false)}
        onSuccess={() => {}}
      />

      {/* Booking Modal */}
      {venue && (
        <BookingModal
          visible={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          venueId={venue.id}
          venueName={venue.name}
          authToken={user?.token ?? ''}
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
          if (!venue) return;
          fetch(`${API_URL}/api/venues/${venue.id}/resonance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              score,
              bolt_count: sessionBoltCount,
              scene_mood: useVibeStore.getState().sceneMood ?? undefined,
            }),
          }).catch(() => {});
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

      {/* Persona Identity Reinforcement Toast */}
      {personaToast && (
        <Animated.View
          style={[{
            position: 'absolute',
            bottom: 100,
            alignSelf: 'center',
            backgroundColor: '#0D0D1E',
            borderWidth: 1,
            borderColor: '#FF336640',
            borderRadius: 24,
            paddingHorizontal: 20,
            paddingVertical: 10,
            opacity: personaToastAnim,
            transform: [{ translateY: personaToastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }]}
          pointerEvents="none"
        >
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>{personaToast}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ====== BASE ======
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // ====== ERROR / LOADING ======
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  backButtonLarge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },

  // ====== CINEMATIC HERO ======
  heroContainer: {
    width: '100%',
    height: 380,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  heroTopRow: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSnapshotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroSnapshotText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heroBottom: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroVenueName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroVenueState: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  heroScoreBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
  },
  heroScoreNumber: {
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 44,
  },
  heroScoreLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textAlign: 'right',
    marginTop: 2,
  },
  heroCertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  // ====== CHECKIN BANNER ======
  checkinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderLeftWidth: 2,
    borderLeftColor: '#00E676',
  },
  checkinBannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
    marginRight: 8,
  },
  checkinBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E676',
    letterSpacing: 1.5,
  },

  // ====== STORY ROW ======
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  storyScroll: {
    gap: 10,
  },
  crowdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  crowdText: {
    fontSize: 11,
    color: '#00E676',
    fontWeight: '700',
  },

  // ====== QUICK STATS STRIP ======
  statsStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '700',
  },

  // ====== VIIBE CERTIFIED BAR ======
  viibeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    marginTop: 12,
    marginHorizontal: 20,
  },
  viibeBarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C9A84C',
    letterSpacing: 2,
  },


  // ====== VELOCITY CHIP ======
  velocityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  velocityText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ====== SECTION LABEL ======
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C9A84C',
    letterSpacing: 3,
    marginBottom: 12,
    paddingHorizontal: 20,
    marginTop: 28,
  },

  // ====== REACTOR WRAP ======
  reactorWrap: {
    paddingHorizontal: 20,
  },

  // ====== ACTION BAR ======
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1.5,
  },
  actionBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // ====== TAB BAR ======
  tabBar: {
    flexDirection: 'row',
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#000',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
  },
  tabLabelActive: {
    color: '#C9A84C',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#C9A84C',
    borderRadius: 1,
  },

  // ====== TAB CONTENT ======
  tabContent: {
    paddingTop: 8,
  },
  contentPad: {
    paddingHorizontal: 20,
  },

  // ====== INFO TAB ======
  infoCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    flex: 1,
  },
  infoValue: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
    textAlign: 'right',
  },
  actionButtonStack: {
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 16,
  },
  actionFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionFullBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
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

  // ====== GPS READY BANNER ======
  readyToRateBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    padding: 16,
  },
  readyToRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readyToRateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  readyToRateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },

  // ====== SCOUT PULSE ======
  scoutPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  scoutPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoutPulseText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scoutPulseGap: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
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
  stickyCheckinBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
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

  // ====== STORY VIEWER MODAL ======
  storyViewerModal: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ====== PERSONA TOAST ======
  personaToast: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,51,102,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  personaToastText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
});
