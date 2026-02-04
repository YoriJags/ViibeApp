import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useVibeStore } from '../../src/store/vibeStore';
import { MockMap } from '../../src/components/MockMap';
import { VenueCard } from '../../src/components/VenueCard';

const { width } = Dimensions.get('window');

const CITIES = [
  { code: 'lagos', name: 'Lagos', emoji: '🏙️' },
  { code: 'abuja', name: 'Abuja', emoji: '🌆' },
  { code: 'port_harcourt', name: 'Port Harcourt', emoji: '🌴' },
  { code: 'ibadan', name: 'Ibadan', emoji: '🏛️' },
];

export default function MapScreen() {
  const router = useRouter();
  const { venues, fetchVenues, loading, error, connectSocket, selectedCity, setSelectedCity } = useVibeStore();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [showList, setShowList] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

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
          <Text style={styles.headerSubtitle}>Lagos Nightlife Pulse</Text>
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
          />
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{venues.length}</Text>
          <Text style={styles.statLabel}>Venues</Text>
        </View>
        <View style={styles.statItem}>
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
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
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
