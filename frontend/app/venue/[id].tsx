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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../../src/store/vibeStore';
import RateVibeModal from '../../src/components/RateVibeModal';
import VibeSuccessAnimation from '../../src/components/VibeSuccessAnimation';

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
  const { id } = useLocalSearchParams<{ id: string }>();
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
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadVenueData();
    checkUserLocation();
    
    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [id]);

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

  const checkUserLocation = async () => {
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
        const within = distance <= 50;
        setIsWithinGeofence(within);
        setGpsLocked(within);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
    setCheckingLocation(false);
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
    energy: 'chill' | 'popping' | 'electric';
    capacity: 'sparse' | 'vibrant' | 'full';
    gate: 'clear' | 'slow' | 'blocked';
    photoBase64?: string;
  }) => {
    if (!user || !venue || !userLocation) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          venue_id: venue.id,
          energy: data.energy,
          capacity: data.capacity,
          gate: data.gate,
          photo_base64: data.photoBase64,
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit rating');
      }

      const result = await response.json();
      const cloutEarned = result.clout_earned || 10;
      const hasPhoto = !!data.photoBase64;
      
      // Update local user clout immediately
      updateUserClout(hasPhoto ? cloutEarned + 5 : cloutEarned);
      
      // Set the last rated venue for map glow effect
      setLastRatedVenueId(venue.id);
      
      // Store values for success animation
      setLastCloutEarned(cloutEarned);
      setLastHadPhoto(hasPhoto);
      
      // Close modal and show success animation
      setShowRateModal(false);
      setShowSuccessAnimation(true);
      
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

  const getEnergyLabel = (level: string) => {
    switch (level) {
      case 'electric': return 'ELECTRIC';
      case 'popping': return 'VIBE';
      case 'chill': return 'QUIET';
      default: return 'QUIET';
    }
  };

  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366';
    if (score >= 60) return '#FF9933';
    if (score >= 40) return '#9933FF';
    return '#3399FF';
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
          <Text style={styles.loadingText}>Loading venue...</Text>
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

  const vibeColor = getVibeColor(venue.current_vibe_score);
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
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

        {/* ====== GLASSMORPHISM VENUE PULSE CARD ====== */}
        <View style={styles.glassCardContainer}>
          <BlurView intensity={20} tint="dark" style={styles.glassCard}>
            <View style={styles.glassCardInner}>
              {/* Energy Level Headline */}
              <View style={styles.energyHeadline}>
                <View style={[styles.energyDot, { backgroundColor: vibeColor }]} />
                <Text style={[styles.energyLabel, { color: vibeColor }]}>
                  {getEnergyLabel(venue.energy_level)}
                </Text>
                <View style={styles.energyScoreBadge}>
                  <Text style={[styles.energyScoreText, { color: vibeColor }]}>
                    {Math.round(venue.current_vibe_score)}%
                  </Text>
                </View>
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

              {/* Current Vibe Stats */}
              <View style={styles.vibeStatsRow}>
                <View style={styles.vibeStat}>
                  <Ionicons name="people" size={16} color="#888" />
                  <Text style={styles.vibeStatText}>
                    {venue.capacity_level.charAt(0).toUpperCase() + venue.capacity_level.slice(1)}
                  </Text>
                </View>
                <View style={styles.vibeStatDivider} />
                <View style={styles.vibeStat}>
                  <Ionicons name="enter" size={16} color="#888" />
                  <Text style={styles.vibeStatText}>
                    Gate: {venue.gate_level.charAt(0).toUpperCase() + venue.gate_level.slice(1)}
                  </Text>
                </View>
                <View style={styles.vibeStatDivider} />
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
                    {venue.vibe_velocity === 'heating_up' ? 'Rising' : venue.vibe_velocity === 'cooling_down' ? 'Falling' : 'Stable'}
                  </Text>
                </View>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={20} color="#FF3366" />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationAddress}>{venue.address}</Text>
              <Text style={styles.locationArea}>{venue.area}</Text>
            </View>
          </View>
          
          {/* GET DIRECTIONS Button */}
          <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections}>
            <LinearGradient
              colors={['#1E88E5', '#1565C0']}
              style={styles.directionsGradient}
            >
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={styles.directionsText}>GET DIRECTIONS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* GPS Lock / Geofence Status */}
        <Animated.View 
          style={[
            styles.gpsContainer,
            isWithinGeofence && styles.gpsContainerActive
          ]}
        >
          <View style={styles.gpsContent}>
            <Animated.View style={{ transform: [{ scale: isWithinGeofence ? pulseAnim : 1 }] }}>
              <View style={[
                styles.gpsIcon,
                isWithinGeofence ? styles.gpsIconActive : styles.gpsIconInactive
              ]}>
                <Ionicons 
                  name={isWithinGeofence ? "location" : "location-outline"} 
                  size={24} 
                  color={isWithinGeofence ? "#4CAF50" : "#666"} 
                />
              </View>
            </Animated.View>
            <View style={styles.gpsTextContainer}>
              <Text style={[styles.gpsTitle, { color: isWithinGeofence ? "#4CAF50" : "#888" }]}>
                {checkingLocation 
                  ? "Verifying location..." 
                  : isWithinGeofence 
                    ? "GPS Verified - Ready to Rate!" 
                    : "Location Required"}
              </Text>
              <Text style={styles.gpsSubtitle}>
                {isWithinGeofence 
                  ? "You're at the venue" 
                  : "Must be within 50m to rate"}
              </Text>
            </View>
            {checkingLocation && <ActivityIndicator size="small" color="#FF3366" />}
          </View>
        </Animated.View>

        {/* Rating Status */}
        {user && ratingStatus && (
          <View style={styles.ratingStatusCard}>
            <View style={styles.ratingStatusHeader}>
              <Text style={styles.ratingStatusTitle}>Your Rating Status</Text>
              <View style={styles.ratingCount}>
                <Text style={styles.ratingCountText}>{ratingStatus.ratings_count}/2</Text>
              </View>
            </View>
            <View style={styles.ratingStatusContent}>
              {ratingStatus.can_rate ? (
                <View style={styles.ratingStatusRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={styles.ratingStatusText}>
                    {ratingStatus.is_correction_available ? 'Correction available' : 'Ready to rate'}
                  </Text>
                </View>
              ) : (
                <View style={styles.ratingStatusRow}>
                  <Ionicons name="time" size={18} color="#FF9800" />
                  <Text style={styles.ratingStatusText}>Limit reached (resets in 24h)</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Geofence Tooltip */}
        {showGeofenceTooltip && (
          <Animated.View style={[styles.tooltip, { opacity: tooltipAnim }]}>
            <Ionicons name="location-outline" size={16} color="#FFF" />
            <Text style={styles.tooltipText}>You must be at the venue to rate it</Text>
          </Animated.View>
        )}

        {/* RATE BUTTON with Geofence Enforcement */}
        <TouchableOpacity
          style={[
            styles.rateButton,
            (!user || !isWithinGeofence || !ratingStatus?.can_rate) && styles.rateButtonDisabled,
          ]}
          onPress={() => {
            if (!user) {
              router.push('/profile');
            } else if (!isWithinGeofence) {
              showTooltip();
              checkUserLocation();
            } else if (ratingStatus?.can_rate) {
              setShowRateModal(true);
            }
          }}
        >
          <LinearGradient
            colors={(!user || !isWithinGeofence || !ratingStatus?.can_rate) 
              ? ['#333', '#222'] 
              : ['#FF3366', '#FF6B35']}
            style={styles.rateButtonGradient}
          >
            <Ionicons
              name={!user ? 'person' : !isWithinGeofence ? 'location-outline' : 'star'}
              size={24}
              color="#FFF"
            />
            <Text style={styles.rateButtonText}>
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

        {/* Geofence Warning when disabled */}
        {user && !isWithinGeofence && (
          <View style={styles.geofenceWarning}>
            <Ionicons name="information-circle" size={16} color="#888" />
            <Text style={styles.geofenceWarningText}>
              You must be within 50m of the venue to submit a rating
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Rate Vibe Modal */}
      <RateVibeModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        onSubmit={handleSubmitRating}
        venueName={venue?.name || ''}
        isGpsVerified={isWithinGeofence}
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
  scrollView: {
    flex: 1,
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
});
