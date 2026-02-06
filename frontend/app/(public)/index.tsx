import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useVibeStore } from '../../src/store/vibeStore';
import { MockMap } from '../../src/components/MockMap';
import { VenueCard } from '../../src/components/VenueCard';
import DailyPulseCard from '../../src/components/DailyPulseCard';
import CloutReward from '../../src/components/CloutReward';
import { CityStats } from '../../src/utils/vibeMaster';

const { width } = Dimensions.get('window');

const CITIES = [
  { code: 'lagos', name: 'Lagos', emoji: '🏙️' },
  { code: 'abuja', name: 'Abuja', emoji: '🌆' },
  { code: 'port_harcourt', name: 'Port Harcourt', emoji: '🌴' },
  { code: 'ibadan', name: 'Ibadan', emoji: '🏛️' },
];

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ highlightVenue?: string; centerLat?: string; centerLng?: string; showRatedGlow?: string }>();
  const { venues, fetchVenues, loading, error, connectSocket, selectedCity, setSelectedCity, lastRatedVenueId, setLastRatedVenueId } = useVibeStore();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [showList, setShowList] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCloutReward, setShowCloutReward] = useState(false);
  const [highlightedVenueId, setHighlightedVenueId] = useState<string | null>(null);
  const [ratedGlowVenueId, setRatedGlowVenueId] = useState<string | null>(null);
  
  // Handle venue highlight from Trending page "Pull Up" button
  useEffect(() => {
    if (params.highlightVenue) {
      setHighlightedVenueId(params.highlightVenue);
      setShowList(false); // Ensure map view is shown
      
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedVenueId(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [params.highlightVenue]);

  // Handle "rated glow" effect after user submits a rating
  useEffect(() => {
    if (params.showRatedGlow === 'true' && lastRatedVenueId) {
      setRatedGlowVenueId(lastRatedVenueId);
      setShowList(false); // Ensure map view is shown
      
      // Refresh venues to get updated scores
      fetchVenues(selectedCity);
      
      // Clear glow after 6 seconds
      const timer = setTimeout(() => {
        setRatedGlowVenueId(null);
        setLastRatedVenueId(null);
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [params.showRatedGlow, lastRatedVenueId]);

  // Calculate city stats for Daily Pulse
  const cityStats: CityStats = useMemo(() => {
    const sortedVenues = [...venues].sort((a, b) => b.current_vibe_score - a.current_vibe_score);
    const hotSpots = venues.filter(v => v.current_vibe_score >= 60).length;
    const activeVenues = venues.filter(v => v.current_vibe_score >= 20).length;
    const avgVibe = venues.length > 0 
      ? venues.reduce((sum, v) => sum + v.current_vibe_score, 0) / venues.length 
      : 0;
    
    const topVenue = sortedVenues[0] ? {
      name: sortedVenues[0].name,
      vibeScore: sortedVenues[0].current_vibe_score,
      area: sortedVenues[0].area || 'Lagos',
    } : null;

    const today = new Date();
    const isWeekend = today.getDay() === 5 || today.getDay() === 6; // Friday or Saturday

    return {
      city: selectedCity,
      totalVenues: venues.length,
      activeVenues,
      averageVibe: avgVibe,
      topVenue,
      hotSpots,
      isWeekend,
    };
  }, [venues, selectedCity]);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');

    if (status === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      } catch (err) {
        // Default to Lagos VI if location fails
        setUserLocation({ lat: 6.4281, lng: 3.4219 });
      }
    } else {
      // Default location for testing
      setUserLocation({ lat: 6.4281, lng: 3.4219 });
    }

    // Connect socket and fetch venues
    connectSocket();
    await fetchVenues();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVenues();
    setRefreshing(false);
  }, []);

  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366'; // Electric - Red/Pink
    if (score >= 60) return '#FF9933'; // Popping - Orange
    if (score >= 40) return '#9933FF'; // Moderate - Purple
    return '#3399FF'; // Chill - Blue
  };

  if (loading && !venues.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
          <Text style={styles.loadingText}>Loading Lagos Nightlife...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>VIBE</Text>
          <TouchableOpacity 
            style={styles.citySelector}
            onPress={() => setShowCityPicker(true)}
          >
            <Text style={styles.headerSubtitle}>
              {CITIES.find(c => c.code === selectedCity)?.emoji} {CITIES.find(c => c.code === selectedCity)?.name} Nightlife
            </Text>
            <Ionicons name="chevron-down" size={14} color="#FF3366" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => setShowList(!showList)}
        >
          <Ionicons
            name={showList ? 'map' : 'list'}
            size={24}
            color="#FF3366"
          />
        </TouchableOpacity>
      </View>

      {/* City Picker Modal */}
      <Modal
        visible={showCityPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            {CITIES.map((city) => (
              <TouchableOpacity
                key={city.code}
                style={[
                  styles.cityOption,
                  selectedCity === city.code && styles.cityOptionActive
                ]}
                onPress={() => {
                  setSelectedCity(city.code);
                  setShowCityPicker(false);
                }}
              >
                <Text style={styles.cityEmoji}>{city.emoji}</Text>
                <Text style={[
                  styles.cityName,
                  selectedCity === city.code && styles.cityNameActive
                ]}>
                  {city.name}
                </Text>
                {selectedCity === city.code && (
                  <Ionicons name="checkmark-circle" size={20} color="#FF3366" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3399FF' }]} />
          <Text style={styles.legendText}>Chill</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#9933FF' }]} />
          <Text style={styles.legendText}>Moderate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9933' }]} />
          <Text style={styles.legendText}>Popping</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF3366' }]} />
          <Text style={styles.legendText}>Electric</Text>
        </View>
      </View>

      {/* Daily Pulse Card - Vibe Master Commentary */}
      {venues.length > 0 && (
        <DailyPulseCard 
          stats={cityStats}
          onPress={() => {
            if (cityStats.topVenue) {
              const topVenueObj = venues.find(v => v.name === cityStats.topVenue?.name);
              if (topVenueObj) {
                router.push(`/venue/${topVenueObj.id}`);
              }
            }
          }}
        />
      )}

      {/* Clout Reward Animation */}
      <CloutReward 
        visible={showCloutReward} 
        onAnimationComplete={() => setShowCloutReward(false)} 
      />

      {showList ? (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF3366"
            />
          }
        >
          {venues
            .sort((a, b) => b.current_vibe_score - a.current_vibe_score)
            .map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                onPress={() => router.push(`/venue/${venue.id}`)}
              />
            ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <MockMap
            venues={venues}
            userLocation={userLocation}
            onVenuePress={(venue) => router.push(`/venue/${venue.id}`)}
            highlightedVenueId={highlightedVenueId}
            ratedGlowVenueId={ratedGlowVenueId}
          />
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{venues.length}</Text>
          <Text style={styles.statLabel}>Venues</Text>
        </View>
        <View style={styles.statItem}>>
          <Text style={styles.statValue}>
            {venues.filter((v) => v.current_vibe_score >= 70).length}
          </Text>
          <Text style={styles.statLabel}>Hot Spots</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {venues.filter((v) => v.vibe_velocity === 'heating_up').length}
          </Text>
          <Text style={styles.statLabel}>Heating Up</Text>
        </View>
      </View>
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
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 4,
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  viewToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#151520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#0A0A0F',
  },
  cityOptionActive: {
    backgroundColor: '#FF336620',
    borderWidth: 1,
    borderColor: '#FF3366',
  },
  cityEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    flex: 1,
  },
  cityNameActive: {
    color: '#FFF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#888',
    fontSize: 11,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#151520',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#252530',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
});
