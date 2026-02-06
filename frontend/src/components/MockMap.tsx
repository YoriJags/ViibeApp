import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
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
  highlightedVenueId?: string | null;
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
  highlightedVenueId,
}) => {
  // Pulse animation for highlighted venue
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (highlightedVenueId) {
      // Start pulsing animation for highlighted venue
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.8,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: false,
            }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [highlightedVenueId]);

  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366'; // Electric - Red/Pink
    if (score >= 60) return '#FF9933'; // Popping - Orange
    if (score >= 40) return '#9933FF'; // Moderate - Purple
    return '#3399FF'; // Chill - Blue
  };

  const getGlowSize = (score: number, isHighlighted: boolean) => {
    const baseSize = score >= 80 ? 50 : score >= 60 ? 40 : score >= 40 ? 30 : 24;
    return isHighlighted ? baseSize * 1.5 : baseSize;
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

  const glowInterpolate = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 51, 102, 0.3)', 'rgba(255, 51, 102, 1)'],
  });

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
          const isHighlighted = venue.id === highlightedVenueId;
          const color = getVibeColor(venue.current_vibe_score);
          const size = getGlowSize(venue.current_vibe_score, isHighlighted);

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
                  zIndex: isHighlighted ? 100 : 1,
                },
              ]}
              onPress={() => onVenuePress(venue)}
              activeOpacity={0.8}
            >
              {/* Highlight pulse ring */}
              {isHighlighted && (
                <>
                  <Animated.View
                    style={[
                      styles.highlightRing,
                      {
                        width: size * 2,
                        height: size * 2,
                        borderRadius: size,
                        transform: [{ scale: pulseAnim }],
                        borderColor: glowInterpolate,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.highlightGlow,
                      {
                        width: size * 1.8,
                        height: size * 1.8,
                        borderRadius: size * 0.9,
                        backgroundColor: glowInterpolate,
                        opacity: 0.3,
                      },
                    ]}
                  />
                </>
              )}
              
              {/* Glow effect */}
              <View
                style={[
                  styles.markerGlow,
                  {
                    backgroundColor: isHighlighted ? color + '60' : color + '30',
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
                    borderWidth: isHighlighted ? 3 : 0,
                    borderColor: '#FFD700',
                  },
                ]}
              />
              
              {/* Highlighted venue label */}
              {isHighlighted && (
                <View style={styles.highlightLabel}>
                  <Text style={styles.highlightLabelText} numberOfLines={1}>
                    {venue.name}
                  </Text>
                  <View style={styles.highlightArrow} />
                </View>
              )}
              
              {/* Velocity indicator */}
              {venue.vibe_velocity === 'heating_up' && !isHighlighted && (
                <View style={styles.velocityBadge}>
                  <Ionicons name="trending-up" size={10} color="#4CAF50" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Highlighted venue card at bottom */}
      {highlightedVenueId && (
        <View style={styles.highlightedCard}>
          {venues.filter(v => v.id === highlightedVenueId).map(venue => (
            <TouchableOpacity 
              key={venue.id}
              style={styles.highlightedCardInner}
              onPress={() => onVenuePress(venue)}
              activeOpacity={0.9}
            >
              <View style={styles.highlightedCardContent}>
                <View style={[styles.vibeIndicator, { backgroundColor: getVibeColor(venue.current_vibe_score) }]} />
                <View style={styles.highlightedCardInfo}>
                  <Text style={styles.highlightedCardName}>{venue.name}</Text>
                  <Text style={styles.highlightedCardArea}>{venue.area}</Text>
                </View>
                <View style={styles.highlightedCardScore}>
                  <Text style={styles.highlightedScoreValue}>{venue.current_vibe_score}%</Text>
                  <Text style={styles.highlightedScoreLabel}>VIBE</Text>
                </View>
              </View>
              <View style={styles.highlightedCardAction}>
                <Ionicons name="arrow-forward-circle" size={24} color="#FF3366" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Mini info card for featured venue */}
      {!highlightedVenueId && venues.filter((v) => v.is_featured && v.current_vibe_score >= 80).length > 0 && (
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
  highlightRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FF3366',
  },
  highlightGlow: {
    position: 'absolute',
  },
  highlightLabel: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    backgroundColor: '#FF3366',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  highlightLabelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  highlightArrow: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF3366',
  },
  velocityBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1A1F2A',
    padding: 2,
    borderRadius: 8,
  },
  highlightedCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  highlightedCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2AE8',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF3366',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  highlightedCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
  },
  vibeIndicator: {
    width: 8,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  highlightedCardInfo: {
    flex: 1,
  },
  highlightedCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  highlightedCardArea: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  highlightedCardScore: {
    alignItems: 'center',
    paddingRight: 8,
  },
  highlightedScoreValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF3366',
  },
  highlightedScoreLabel: {
    fontSize: 10,
    color: '#888',
    letterSpacing: 1,
  },
  highlightedCardAction: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#333',
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
