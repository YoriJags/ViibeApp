import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Coordinates {
  lat: number;
  lng: number;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  coordinates: Coordinates;
  current_vibe_score: number;
  energy_level: 'chill' | 'popping' | 'electric';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  is_featured: boolean;
}

interface MockMapProps {
  venues: Venue[];
  userLocation: Coordinates | null;
  onVenuePress: (venue: Venue) => void;
}

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.55;

// Lagos coordinates boundaries (Victoria Island & Ikoyi area)
const LAGOS_BOUNDS = {
  minLat: 6.42,
  maxLat: 6.46,
  minLng: 3.41,
  maxLng: 3.46,
};

export const MockMap: React.FC<MockMapProps> = ({
  venues,
  userLocation,
  onVenuePress,
}) => {
  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366'; // Electric - Red/Pink
    if (score >= 60) return '#FF9933'; // Popping - Orange
    if (score >= 40) return '#9933FF'; // Moderate - Purple
    return '#3399FF'; // Chill - Blue
  };

  const getGlowSize = (score: number) => {
    if (score >= 80) return 50;
    if (score >= 60) return 40;
    if (score >= 40) return 30;
    return 24;
  };

  // Convert lat/lng to pixel position on map
  const coordsToPosition = (lat: number, lng: number) => {
    const x =
      ((lng - LAGOS_BOUNDS.minLng) / (LAGOS_BOUNDS.maxLng - LAGOS_BOUNDS.minLng)) *
      (width - 40);
    const y =
      ((LAGOS_BOUNDS.maxLat - lat) / (LAGOS_BOUNDS.maxLat - LAGOS_BOUNDS.minLat)) *
      (MAP_HEIGHT - 60);
    return { x: Math.max(20, Math.min(x, width - 60)), y: Math.max(30, Math.min(y, MAP_HEIGHT - 80)) };
  };

  return (
    <View style={styles.mapContainer}>
      {/* Dark map background with grid */}
      <View style={styles.mapBackground}>
        {/* Grid lines */}
        {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => (
          <React.Fragment key={i}>
            <View
              style={[
                styles.gridLineH,
                { top: `${ratio * 100}%` },
              ]}
            />
            <View
              style={[
                styles.gridLineV,
                { left: `${ratio * 100}%` },
              ]}
            />
          </React.Fragment>
        ))}

        {/* Area labels */}
        <View style={[styles.areaLabel, { top: 20, left: 20 }]}>
          <Text style={styles.areaText}>IKOYI</Text>
        </View>
        <View style={[styles.areaLabel, { bottom: 40, right: 20 }]}>
          <Text style={styles.areaText}>VICTORIA ISLAND</Text>
        </View>

        {/* Map ready indicator */}
        <View style={styles.mapReadyBadge}>
          <Ionicons name="location" size={12} color="#4CAF50" />
          <Text style={styles.mapReadyText}>Ready for Google Maps API</Text>
        </View>

        {/* User location marker */}
        {userLocation && (
          <View
            style={[
              styles.userMarker,
              coordsToPosition(userLocation.lat, userLocation.lng),
            ]}
          >
            <View style={styles.userMarkerPulse} />
            <View style={styles.userMarkerDot} />
          </View>
        )}

        {/* Venue markers */}
        {venues.map((venue) => {
          const position = coordsToPosition(
            venue.coordinates.lat,
            venue.coordinates.lng
          );
          const color = getVibeColor(venue.current_vibe_score);
          const size = getGlowSize(venue.current_vibe_score);

          return (
            <TouchableOpacity
              key={venue.id}
              style={[
                styles.venueMarker,
                {
                  left: position.x - size / 2,
                  top: position.y - size / 2,
                  width: size,
                  height: size,
                },
              ]}
              onPress={() => onVenuePress(venue)}
              activeOpacity={0.8}
            >
              {/* Glow effect */}
              <View
                style={[
                  styles.markerGlow,
                  {
                    backgroundColor: color + '30',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                  },
                ]}
              />
              {/* Inner dot */}
              <View
                style={[
                  styles.markerDot,
                  {
                    backgroundColor: color,
                    width: size * 0.5,
                    height: size * 0.5,
                    borderRadius: size * 0.25,
                  },
                ]}
              />
              {/* Velocity indicator */}
              {venue.vibe_velocity === 'heating_up' && (
                <View style={styles.velocityBadge}>
                  <Ionicons name="trending-up" size={10} color="#4CAF50" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mini info card for featured venue */}
      {venues.filter((v) => v.is_featured && v.current_vibe_score >= 80).length > 0 && (
        <View style={styles.featuredCard}>
          <Ionicons name="flame" size={16} color="#FF3366" />
          <Text style={styles.featuredText}>
            {venues.filter((v) => v.is_featured && v.current_vibe_score >= 80).length} spots are lit right now!
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#0D1117',
    position: 'relative',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1A1F2A',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1A1F2A',
  },
  areaLabel: {
    position: 'absolute',
    backgroundColor: '#1A1F2A80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  areaText: {
    color: '#444',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
  },
  mapReadyBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  mapReadyText: {
    color: '#4CAF50',
    fontSize: 9,
    fontWeight: '600',
  },
  userMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2196F320',
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  venueMarker: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerGlow: {
    position: 'absolute',
  },
  markerDot: {
    position: 'absolute',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  velocityBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1A1F2A',
    padding: 2,
    borderRadius: 8,
  },
  featuredCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  featuredText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
