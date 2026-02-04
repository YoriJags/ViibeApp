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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useVibeStore } from '../../src/store/vibeStore';

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchVenue, getUserRatingStatus, user, recordDirectionClick, gpsLocked, setGpsLocked } = useVibeStore();
  const [venue, setVenue] = useState<any>(null);
  const [ratingStatus, setRatingStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  
  // GPS Lock Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadVenueData();
    checkUserLocation();
  }, [id]);

  useEffect(() => {
    if (isWithinGeofence) {
      // Start pulse animation when GPS is locked
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
      
      // Glow animation
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

      // Check if within 50m of venue
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

  const handleDirections = () => {
    if (!venue) return;
    
    // Record click for ROI tracking
    recordDirectionClick(venue.id);
    
    // Open maps
    const { lat, lng } = venue.coordinates;
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    
    Linking.openURL(url);
  };

  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366';
    if (score >= 60) return '#FF9933';
    if (score >= 40) return '#9933FF';
    return '#3399FF';
  };

  const getVelocityIcon = (velocity: string) => {
    switch (velocity) {
      case 'heating_up':
        return { name: 'trending-up', color: '#4CAF50', text: 'Heating Up' };
      case 'cooling_down':
        return { name: 'trending-down', color: '#FF5252', text: 'Cooling Down' };
      default:
        return { name: 'remove', color: '#888', text: 'Stable' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
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
          <TouchableOpacity
            style={styles.backButtonLarge}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const vibeColor = getVibeColor(venue.current_vibe_score);
  const velocityIcon = getVelocityIcon(venue.vibe_velocity);
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(76, 175, 80, 0)', 'rgba(76, 175, 80, 0.3)'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {venue.name}
          </Text>
          <View style={styles.headerBadges}>
            {venue.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            {venue.is_featured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={handleDirections}
        >
          <Ionicons name="navigate" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Vibe Score Hero */}
        <View style={[styles.scoreHero, { borderColor: vibeColor + '40' }]}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreValue, { color: vibeColor }]}>
              {Math.round(venue.current_vibe_score)}
            </Text>
            <Text style={styles.scoreLabel}>Vibe Score</Text>
          </View>
          <View style={styles.velocityIndicator}>
            <Ionicons
              name={velocityIcon.name as any}
              size={20}
              color={velocityIcon.color}
            />
            <Text style={[styles.velocityText, { color: velocityIcon.color }]}>
              {velocityIcon.text}
            </Text>
          </View>
        </View>

        {/* GPS Lock Indicator */}
        <Animated.View 
          style={[
            styles.gpsLockContainer,
            { backgroundColor: glowColor }
          ]}
        >
          <View style={styles.gpsLockContent}>
            <Animated.View style={{ transform: [{ scale: isWithinGeofence ? pulseAnim : 1 }] }}>
              <View style={[
                styles.gpsLockIcon,
                isWithinGeofence ? styles.gpsLockIconActive : styles.gpsLockIconInactive
              ]}>
                <Ionicons 
                  name={isWithinGeofence ? "location" : "location-outline"} 
                  size={24} 
                  color={isWithinGeofence ? "#4CAF50" : "#666"} 
                />
              </View>
            </Animated.View>
            <View style={styles.gpsLockTextContainer}>
              <Text style={[
                styles.gpsLockTitle,
                { color: isWithinGeofence ? "#4CAF50" : "#888" }
              ]}>
                {checkingLocation 
                  ? "Checking location..." 
                  : isWithinGeofence 
                    ? "GPS Locked - Ready to Rate!" 
                    : "Get closer to unlock rating"}
              </Text>
              <Text style={styles.gpsLockSubtitle}>
                {isWithinGeofence 
                  ? "You're verified at this venue" 
                  : "Must be within 50m of venue"}
              </Text>
            </View>
            {checkingLocation && (
              <ActivityIndicator size="small" color="#FF3366" />
            )}
          </View>
        </Animated.View>

        {/* Location Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#FF3366" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{venue.address}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="map" size={20} color="#2196F3" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Area</Text>
              <Text style={styles.infoValue}>{venue.area}, {venue.city}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="business" size={20} color="#9C27B0" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={[styles.infoValue, { textTransform: 'capitalize' }]}>{venue.venue_type}</Text>
            </View>
          </View>
        </View>

        {/* Current Vibe Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Current Vibe</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="flash" size={28} color="#FFD700" />
              <Text style={styles.statValue}>{venue.energy_level}</Text>
              <Text style={styles.statLabel}>Energy</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="people" size={28} color="#4CAF50" />
              <Text style={styles.statValue}>{venue.capacity_level}</Text>
              <Text style={styles.statLabel}>Crowd</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="enter" size={28} color="#2196F3" />
              <Text style={styles.statValue}>{venue.gate_level}</Text>
              <Text style={styles.statLabel}>Gate</Text>
            </View>
          </View>
        </View>

        {/* Active Pulse Drop Badge */}
        {venue.active_pulse_tier && (
          <View style={styles.pulseDropBadge}>
            <Ionicons name="flame" size={20} color="#FF3366" />
            <Text style={styles.pulseDropText}>
              {venue.active_pulse_tier.toUpperCase()} Boost Active
            </Text>
          </View>
        )}

        {/* Rating Status */}
        {user && ratingStatus && (
          <View style={styles.ratingStatusCard}>
            <Text style={styles.sectionTitle}>Your Rating Status</Text>
            <View style={styles.ratingStatusContent}>
              <View style={styles.ratingCount}>
                <Text style={styles.ratingCountValue}>
                  {ratingStatus.ratings_count}/2
                </Text>
                <Text style={styles.ratingCountLabel}>Ratings Today</Text>
              </View>
              <View style={styles.ratingInfo}>
                {ratingStatus.can_rate ? (
                  <View style={styles.ratingInfoRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.ratingInfoText}>
                      {ratingStatus.is_correction_available
                        ? 'Correction available'
                        : 'Ready to rate'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.ratingInfoRow}>
                    <Ionicons name="time" size={20} color="#FF9800" />
                    <Text style={styles.ratingInfoText}>
                      Limit reached (resets in 24h)
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Rate Button */}
        <TouchableOpacity
          style={[
            styles.rateButton,
            (!user || !ratingStatus?.can_rate || !isWithinGeofence) && styles.rateButtonDisabled,
          ]}
          onPress={() => {
            if (user && ratingStatus?.can_rate && isWithinGeofence) {
              router.push(`/rate/${venue.id}`);
            } else if (!user) {
              router.push('/profile');
            } else if (!isWithinGeofence) {
              checkUserLocation();
            }
          }}
          disabled={user && (!ratingStatus?.can_rate || !isWithinGeofence)}
        >
          <Ionicons
            name={!user ? 'person' : !isWithinGeofence ? 'location-outline' : ratingStatus?.can_rate ? 'star' : 'time'}
            size={24}
            color="#FFF"
          />
          <Text style={styles.rateButtonText}>
            {!user
              ? 'Sign in to Rate'
              : !isWithinGeofence
              ? 'Check Location'
              : ratingStatus?.can_rate
              ? ratingStatus?.is_correction_available
                ? 'Update Your Vibe'
                : 'Rate the Vibe'
              : 'Rating Limit Reached'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
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
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#151520',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  featuredBadge: {
    backgroundColor: '#FFD70020',
    padding: 4,
    borderRadius: 8,
  },
  directionsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scoreHero: {
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 24,
    padding: 32,
    marginBottom: 16,
    borderWidth: 2,
  },
  scoreCircle: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: '900',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  velocityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  velocityText: {
    fontSize: 16,
    fontWeight: '600',
  },
  gpsLockContainer: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gpsLockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  gpsLockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsLockIconActive: {
    backgroundColor: '#4CAF5020',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  gpsLockIconInactive: {
    backgroundColor: '#252530',
    borderWidth: 2,
    borderColor: '#333',
  },
  gpsLockTextContainer: {
    flex: 1,
  },
  gpsLockTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  gpsLockSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 2,
  },
  statsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
    textTransform: 'capitalize',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  pulseDropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF336620',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF3366',
  },
  pulseDropText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF3366',
  },
  ratingStatusCard: {
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  ratingStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingCount: {
    alignItems: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#252530',
  },
  ratingCountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF3366',
  },
  ratingCountLabel: {
    fontSize: 11,
    color: '#666',
  },
  ratingInfo: {
    flex: 1,
    paddingLeft: 16,
  },
  ratingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingInfoText: {
    fontSize: 14,
    color: '#FFF',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3366',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 12,
  },
  rateButtonDisabled: {
    backgroundColor: '#333',
  },
  rateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
});
