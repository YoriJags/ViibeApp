import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Seismic Ring ────────────────────────────────────────────────────────────
// Cinematic sonar rings — slow, deliberate, like a radar sweep.
// WorldMonitor-inspired: unhurried, not alarming. The map breathes.
const SeismicRing: React.FC<{ color: string; delay: number; baseSize: number }> = ({
  color,
  delay,
  baseSize,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);

  const run = useCallback(() => {
    scale.setValue(1);
    opacity.setValue(0.5);
    Animated.parallel([
      // Slower expand: 4800ms instead of 2400ms. Max 2.6x instead of 4.2x.
      Animated.timing(scale, { toValue: 2.6, duration: 4800, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 4680, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished && mounted.current) run();
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(run, delay);
    return () => {
      mounted.current = false;
      clearTimeout(t);
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: baseSize,
        height: baseSize,
        borderRadius: baseSize / 2,
        borderWidth: 0.5,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
};

// ─── Breath Glow ─────────────────────────────────────────────────────────────
// The pin's living core — soft scale breath. WorldMonitor's heartbeat mechanic.
// Runs on native driver (GPU only). No JS thread involvement.
const BreathGlow: React.FC<{ color: string; size: number; delay?: number }> = ({
  color,
  size,
  delay = 0,
}) => {
  const breath = useRef(new Animated.Value(1)).current;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(() => {
      if (!mounted.current) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 1.18, duration: 2200, useNativeDriver: true }),
          Animated.timing(breath, { toValue: 1, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
    return () => {
      mounted.current = false;
      clearTimeout(t);
      breath.stopAnimation();
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '18',
        transform: [{ scale: breath }],
      }}
    />
  );
};

// ─── Live Dot ────────────────────────────────────────────────────────────────
// 8px pulsing status dot — WorldMonitor's exact live indicator mechanic.
const LiveDot: React.FC = () => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={liveDotStyles.container}>
      <Animated.View style={[liveDotStyles.ring, { transform: [{ scale }] }]} />
      <View style={liveDotStyles.dot} />
      <Text style={liveDotStyles.label}>LIVE</Text>
    </View>
  );
};

const liveDotStyles = {
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  ring: {
    position: 'absolute' as const,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0f504040',
    left: -3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  label: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#16a34a',
    letterSpacing: 1.5,
  },
};

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
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  is_featured: boolean;
  // New fields
  active_pulse_tier?: 'spark' | 'flare' | 'supernova' | null;
  entry_fee?: string;
  music_genre?: string;
  ratings_last_30m?: number;
}

interface CrewPin {
  id: string;
  username: string;
  lat: number;
  lng: number;
  emoji: string;
  color: string;
}

interface MockMapProps {
  venues: Venue[];
  userLocation: Coordinates | null;
  onVenuePress: (venue: Venue) => void;
  highlightedVenueId?: string | null;
  ratedGlowVenueId?: string | null;
  crewPins?: CrewPin[];
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
  crewPins,
  ratedGlowVenueId,
}) => {
  // Pulse animation for highlighted venue
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const ratedPulseAnim = useRef(new Animated.Value(1)).current;
  const ratedGlowOpacity = useRef(new Animated.Value(0)).current;
  
  // Hover tooltip state (for web)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipOpacity = useRef(new Animated.Value(0)).current;

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

  // Rated glow animation - shows after user submits a rating
  useEffect(() => {
    if (ratedGlowVenueId) {
      // Start special "contribution" glow animation
      ratedGlowOpacity.setValue(0);
      
      Animated.sequence([
        Animated.timing(ratedGlowOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(ratedPulseAnim, {
                toValue: 1.5,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(ratedPulseAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
          ]),
          { iterations: 5 }
        ),
      ]).start();
    } else {
      ratedPulseAnim.setValue(1);
      ratedGlowOpacity.setValue(0);
    }
  }, [ratedGlowVenueId]);

  // Tooltip animation
  useEffect(() => {
    if (hoveredVenue) {
      Animated.timing(tooltipOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [hoveredVenue]);

  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366'; // Electric - Red/Pink
    if (score >= 60) return '#FF9933'; // Popping - Orange
    if (score >= 40) return '#9933FF'; // Moderate - Purple
    return '#3399FF'; // Chill - Blue
  };

  const getVibeLabel = (score: number) => {
    if (score >= 80) return 'Electric';
    if (score >= 60) return 'Popping';
    if (score >= 40) return 'Moderate';
    return 'Chill';
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

  // Handle hover events (web only)
  const handleMouseEnter = (venue: Venue, position: { x: number; y: number }) => {
    if (Platform.OS === 'web') {
      setHoveredVenue(venue);
      // Position tooltip above the marker
      setTooltipPosition({
        x: position.x,
        y: position.y - 80,
      });
    }
  };

  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      setHoveredVenue(null);
    }
  };

  return (
    <View style={styles.mapContainer}>
      {/* ── Cinematic background: WorldMonitor radial gradient ── */}
      <LinearGradient
        colors={['#0a2a20', '#071a14', '#020a08']}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Dot grid (replaces hard grid lines) ── */}
      <View style={styles.mapBackground} pointerEvents="none">
        {[0.15, 0.30, 0.45, 0.60, 0.75, 0.90].map((row, ri) =>
          [0.12, 0.25, 0.38, 0.51, 0.64, 0.77, 0.90].map((col, ci) => (
            <View
              key={`${ri}-${ci}`}
              style={[
                styles.gridDot,
                { top: `${row * 100}%`, left: `${col * 100}%` },
              ]}
            />
          ))
        )}

        {/* Area labels — monospace, atmospheric */}
        <View style={[styles.areaLabel, { top: 18, left: 16 }]}>
          <Text style={styles.areaText}>IKOYI</Text>
        </View>
        <View style={[styles.areaLabel, { bottom: 44, right: 16 }]}>
          <Text style={styles.areaText}>VICTORIA ISLAND</Text>
        </View>

        {/* Live dot — bottom left */}
        <View style={styles.liveIndicator}>
          <LiveDot />
        </View>
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
          const isHovered = hoveredVenue?.id === venue.id;
          const isRatedGlow = venue.id === ratedGlowVenueId;
          const color = getVibeColor(venue.current_vibe_score);
          const hasPulseDrop = venue.active_pulse_tier !== null && venue.active_pulse_tier !== undefined;
          const markerSize = isRatedGlow ? 60 : hasPulseDrop ? 56 : isHighlighted ? 52 : 44;
          // Seismic rings: silent signal that something real is happening
          const isSpiking = (venue.energy_level === 'peak' || venue.energy_level === 'lit') && venue.vibe_velocity === 'heating_up';

          return (
            <TouchableOpacity
              key={venue.id}
              style={[
                styles.venueMarker,
                {
                  left: position.x - markerSize / 2,
                  top: position.y - markerSize / 2,
                  width: markerSize,
                  height: markerSize,
                  zIndex: isRatedGlow ? 150 : isHighlighted || isHovered || hasPulseDrop ? 100 : 1,
                },
              ]}
              onPress={() => onVenuePress(venue)}
              activeOpacity={0.8}
              // @ts-ignore - Web-only events
              onMouseEnter={() => handleMouseEnter(venue, position)}
              onMouseLeave={handleMouseLeave}
            >
              {/* ── Breath Glow ── every pin breathes. The map is alive. */}
              <BreathGlow
                color={color}
                size={markerSize + 8}
                delay={parseInt(venue.id.slice(-3), 16) % 1400}
              />

              {/* ── Seismic Rings ── slow sonar waves. Deliberate. Cinematic. */}
              {isSpiking && !isRatedGlow && (
                <>
                  <SeismicRing color={color} delay={0}     baseSize={markerSize} />
                  <SeismicRing color={color} delay={1600}  baseSize={markerSize} />
                  <SeismicRing color={color} delay={3200}  baseSize={markerSize} />
                </>
              )}

              {/* Rated Glow Effect - Green pulsing ring */}
              {isRatedGlow && (
                <>
                  <Animated.View
                    style={[
                      styles.ratedGlowRing,
                      {
                        width: markerSize + 30,
                        height: markerSize + 30,
                        borderRadius: (markerSize + 30) / 2,
                        transform: [{ scale: ratedPulseAnim }],
                        opacity: ratedGlowOpacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.ratedGlowInner,
                      {
                        width: markerSize + 16,
                        height: markerSize + 16,
                        borderRadius: (markerSize + 16) / 2,
                        opacity: ratedGlowOpacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.ratedLabel,
                      { opacity: ratedGlowOpacity },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                    <Text style={styles.ratedLabelText}>Updated!</Text>
                  </Animated.View>
                </>
              )}

              {/* Gold Glow for Pulse Drop venues */}
              {hasPulseDrop && (
                <Animated.View
                  style={[
                    styles.pulseDropGlow,
                    {
                      width: markerSize + 16,
                      height: markerSize + 16,
                      borderRadius: (markerSize + 16) / 2,
                    },
                  ]}
                />
              )}
              
              {/* Highlight pulse ring */}
              {isHighlighted && (
                <>
                  <Animated.View
                    style={[
                      styles.highlightRing,
                      {
                        width: markerSize * 2,
                        height: markerSize * 2,
                        borderRadius: markerSize,
                        transform: [{ scale: pulseAnim }],
                        borderColor: glowInterpolate,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.highlightGlow,
                      {
                        width: markerSize * 1.8,
                        height: markerSize * 1.8,
                        borderRadius: markerSize * 0.9,
                        backgroundColor: glowInterpolate,
                        opacity: 0.3,
                      },
                    ]}
                  />
                </>
              )}
              
              {/* Custom Marker with Energy Score */}
              <View style={[
                styles.customMarker,
                {
                  backgroundColor: hasPulseDrop ? '#1A1A25' : '#0D1117',
                  borderColor: hasPulseDrop ? '#FFD700' : color,
                  borderWidth: hasPulseDrop ? 2 : 1,
                  width: markerSize - 4,
                  height: markerSize - 4,
                  borderRadius: (markerSize - 4) / 2,
                }
              ]}>
                {/* Energy Score Display */}
                <Text style={[
                  styles.markerScore,
                  { 
                    color: hasPulseDrop ? '#FFD700' : color,
                    fontSize: hasPulseDrop ? 14 : 12,
                  }
                ]}>
                  {Math.round(venue.current_vibe_score)}%
                </Text>
                
                {/* Featured Star for Pulse Drop */}
                {hasPulseDrop && (
                  <View style={styles.markerPulseIcon}>
                    <Ionicons name="flame" size={10} color="#FFD700" />
                  </View>
                )}
              </View>
              
              {/* Highlighted venue label */}
              {isHighlighted && (
                <View style={styles.highlightLabel}>
                  <Text style={styles.highlightLabelText} numberOfLines={1}>
                    {venue.name}
                  </Text>
                  <View style={styles.highlightArrow} />
                </View>
              )}
              
              {/* Momentum indicator — up/star/down on map pins */}
              {venue.vibe_velocity === 'heating_up' && !isHighlighted && (
                <View style={[styles.velocityBadge, { borderColor: '#4CAF5040' }]}>
                  <Ionicons name="trending-up" size={10} color="#4CAF50" />
                </View>
              )}
              {venue.vibe_velocity === 'cooling_down' && !isHighlighted && (
                <View style={[styles.velocityBadge, { borderColor: '#FF525240' }]}>
                  <Ionicons name="trending-down" size={10} color="#FF5252" />
                </View>
              )}
              {venue.vibe_velocity === 'stable' && venue.current_vibe_score >= 70 && !isHighlighted && (
                <View style={[styles.velocityBadge, { borderColor: '#FFD70040' }]}>
                  <Ionicons name="star" size={9} color="#FFD700" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* ====== CREW MEMBER PINS ====== */}
        {crewPins && crewPins.map((pin) => {
          const pos = coordsToPosition(pin.lat, pin.lng);
          return (
            <View
              key={pin.id}
              style={[
                styles.crewPin,
                {
                  left: pos.x - 20,
                  top: pos.y - 44,
                  zIndex: 200,
                },
              ]}
              pointerEvents="none"
            >
              <View style={[styles.crewPinBubble, { backgroundColor: pin.color }]}>
                <Text style={styles.crewPinEmoji}>{pin.emoji}</Text>
              </View>
              <View style={[styles.crewPinTail, { borderTopColor: pin.color }]} />
              <Text style={styles.crewPinLabel} numberOfLines={1}>{pin.username}</Text>
            </View>
          );
        })}

        {/* ====== HOVER TOOLTIP (Web Only) ====== */}
        {hoveredVenue && Platform.OS === 'web' && (
          <Animated.View
            style={[
              styles.hoverTooltip,
              {
                left: Math.max(10, Math.min(tooltipPosition.x - 75, width - 170)),
                top: Math.max(10, tooltipPosition.y),
                opacity: tooltipOpacity,
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.tooltipContent}>
              {/* Venue Name */}
              <Text style={styles.tooltipName} numberOfLines={1}>
                {hoveredVenue.name}
              </Text>
              
              {/* District/Area */}
              <View style={styles.tooltipRow}>
                <Ionicons name="location-outline" size={12} color="#888" />
                <Text style={styles.tooltipDistrict}>{hoveredVenue.area}</Text>
              </View>
              
              {/* Pulse Score */}
              <View style={styles.tooltipScoreRow}>
                <View style={[
                  styles.tooltipScoreDot,
                  { backgroundColor: getVibeColor(hoveredVenue.current_vibe_score) }
                ]} />
                <Text style={styles.tooltipScoreLabel}>Pulse Score</Text>
                <Text style={[
                  styles.tooltipScore,
                  { color: getVibeColor(hoveredVenue.current_vibe_score) }
                ]}>
                  {hoveredVenue.current_vibe_score}%
                </Text>
              </View>
              
              {/* Vibe Level */}
              <View style={[
                styles.tooltipVibeBadge,
                { backgroundColor: getVibeColor(hoveredVenue.current_vibe_score) + '30' }
              ]}>
                <Text style={[
                  styles.tooltipVibeText,
                  { color: getVibeColor(hoveredVenue.current_vibe_score) }
                ]}>
                  {getVibeLabel(hoveredVenue.current_vibe_score).toUpperCase()}
                </Text>
              </View>

              {/* Raw spike data — only shown when spiking */}
              {(hoveredVenue.energy_level === 'peak' || hoveredVenue.energy_level === 'lit') && hoveredVenue.vibe_velocity === 'heating_up' && hoveredVenue.ratings_last_30m && (
                <View style={styles.tooltipSpikeRow}>
                  <View style={styles.tooltipSpikeDot} />
                  <Text style={styles.tooltipSpikeText}>
                    {hoveredVenue.ratings_last_30m} ratings · 30 mins
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>
        )}
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
                  <Text style={styles.highlightedScoreLabel}>VIIBE</Text>
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
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
  },
  gridDot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ffffff08',
  },
  areaLabel: {
    position: 'absolute',
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  areaText: {
    color: '#ffffff18',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    fontVariant: ['small-caps'],
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 50,
    left: 14,
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
    cursor: 'pointer',
  },
  ratedGlowRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#4CAF50',
    backgroundColor: 'transparent',
  },
  ratedGlowInner: {
    position: 'absolute',
    backgroundColor: '#4CAF5030',
  },
  ratedLabel: {
    position: 'absolute',
    top: -32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratedLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  pulseDropGlow: {
    position: 'absolute',
    backgroundColor: '#FFD70030',
    borderWidth: 1,
    borderColor: '#FFD70050',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  customMarker: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
    // Backdrop blur effect via border styling
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  markerScore: {
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  markerPulseIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 2,
  },
  markerGlow: {
    position: 'absolute',
    transition: 'all 0.2s ease',
  },
  markerDot: {
    position: 'absolute',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
    transition: 'all 0.2s ease',
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
    backgroundColor: 'rgba(2, 10, 8, 0.85)',
    padding: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  
  // ====== HOVER TOOLTIP STYLES ======
  hoverTooltip: {
    position: 'absolute',
    zIndex: 200,
    width: 160,
  },
  tooltipContent: {
    backgroundColor: '#071a14F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.15)',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  tooltipName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  tooltipDistrict: {
    fontSize: 12,
    color: '#888',
  },
  tooltipScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tooltipScoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipScoreLabel: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  tooltipScore: {
    fontSize: 16,
    fontWeight: '800',
  },
  tooltipVibeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tooltipVibeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tooltipArrow: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#071a14F2',
  },
  tooltipSpikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  tooltipSpikeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3366',
  },
  tooltipSpikeText: {
    fontSize: 10,
    color: '#FF3366',
    fontWeight: '700',
    letterSpacing: 0.3,
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
    backgroundColor: '#071a14F0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF3366',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
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
    backgroundColor: '#071a14F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.12)',
  },
  featuredText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Crew pin styles
  crewPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  crewPinBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  crewPinEmoji: {
    fontSize: 18,
  },
  crewPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  crewPinLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    maxWidth: 60,
    textAlign: 'center',
  },
});
