/**
 * VibeMap — Real Mapbox map replacing MockMap.
 *
 * Dark nightlife style map with:
 * - Venue pins showing vibe % score + energy ring color
 * - Crew member pins with emoji avatars
 * - User location dot
 * - Mapbox dark style matching Vibe's aesthetic
 *
 * Falls back to MockMap on web (Mapbox GL requires WebGL which may not always work).
 */
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, ShapeSource, CircleLayer, SymbolLayer } from '@rnmapbox/maps';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

// Initialize token once
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

// Dark Mapbox style URL — matches Vibe's dark theme
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

interface Venue {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  current_vibe_score?: number;
  energy_level?: string;
  pulse?: { tier: string };
}

interface CrewPin {
  id: string;
  username: string;
  lat: number;
  lng: number;
  emoji: string;
  color: string;
  battery_level?: number;
}

interface Props {
  venues: Venue[];
  userLocation: { lat: number; lng: number } | null;
  onVenuePress: (venue: Venue) => void;
  crewPins?: CrewPin[];
  highlightedVenueId?: string | null;
  center?: { lat: number; lng: number };
  zoomLevel?: number;
}

const ENERGY_COLORS: Record<string, string> = {
  electric: '#FF3366',
  peak:     '#FF3366',
  lit:      '#FF8C00',
  charged:  '#9933FF',
  warming:  '#6655FF',
  chill:    '#3399FF',
  quiet:    '#3A3A4E',
};

function venueColor(venue: Venue): string {
  return ENERGY_COLORS[venue.energy_level ?? 'quiet'] ?? '#9933FF';
}

export default function VibeMap({
  venues,
  userLocation,
  onVenuePress,
  crewPins = [],
  highlightedVenueId,
  center,
  zoomLevel = 13,
}: Props) {
  const cameraRef = useRef<Camera>(null);

  const mapCenter = center ?? userLocation ?? { lat: 6.4316, lng: 3.4223 }; // Default: VI Lagos

  // Build GeoJSON for venues
  const venueFeatures: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: venues.map((v) => ({
      type: 'Feature',
      id: v.id,
      geometry: {
        type: 'Point',
        coordinates: [v.coordinates.lng, v.coordinates.lat],
      },
      properties: {
        id: v.id,
        name: v.name,
        score: v.current_vibe_score ?? 0,
        color: venueColor(v),
        isHighlighted: v.id === highlightedVenueId ? 1 : 0,
      },
    })),
  };

  // Build GeoJSON for crew pins
  const crewFeatures: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: crewPins.map((c) => ({
      type: 'Feature',
      id: c.id,
      geometry: {
        type: 'Point',
        coordinates: [c.lng, c.lat],
      },
      properties: {
        id: c.id,
        label: c.emoji,
        color: c.color,
      },
    })),
  };

  if (!MAPBOX_TOKEN) {
    return (
      <View style={styles.noToken}>
        <Text style={styles.noTokenText}>Mapbox token not configured</Text>
        <Text style={styles.noTokenSub}>Set EXPO_PUBLIC_MAPBOX_TOKEN in .env</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={DARK_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onPress={() => {}}
      >
        <Camera
          ref={cameraRef}
          centerCoordinate={[mapCenter.lng, mapCenter.lat]}
          zoomLevel={zoomLevel}
          animationMode="flyTo"
          animationDuration={800}
        />

        {/* User location dot */}
        <UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          renderMode="native"
        />

        {/* Venue pins */}
        {venues.length > 0 && (
          <ShapeSource
            id="venues"
            shape={venueFeatures}
            onPress={(e) => {
              const feat = e.features?.[0];
              if (feat?.properties?.id) {
                const v = venues.find((x) => x.id === feat.properties!.id);
                if (v) onVenuePress(v);
              }
            }}
          >
            {/* Outer glow ring */}
            <CircleLayer
              id="venue-glow"
              style={{
                circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 22],
                circleColor: ['get', 'color'],
                circleOpacity: 0.15,
                circleBlur: 1,
              }}
            />
            {/* Main circle */}
            <CircleLayer
              id="venue-circle"
              style={{
                circleRadius: ['interpolate', ['linear'], ['zoom'], 10, 7, 15, 16],
                circleColor: ['get', 'color'],
                circleOpacity: 0.85,
                circleStrokeWidth: 1.5,
                circleStrokeColor: '#FFF',
                circleStrokeOpacity: 0.4,
              }}
            />
            {/* Score label */}
            <SymbolLayer
              id="venue-score"
              style={{
                textField: ['concat', ['to-string', ['get', 'score']], '%'],
                textSize: 10,
                textColor: '#FFF',
                textHaloColor: 'rgba(0,0,0,0.7)',
                textHaloWidth: 1,
                textFont: ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                textAnchor: 'center',
                textAllowOverlap: true,
              }}
            />
          </ShapeSource>
        )}

        {/* Crew pins */}
        {crewPins.length > 0 && (
          <ShapeSource id="crew" shape={crewFeatures}>
            <CircleLayer
              id="crew-ring"
              style={{
                circleRadius: 18,
                circleColor: ['get', 'color'],
                circleOpacity: 0.9,
                circleStrokeWidth: 2,
                circleStrokeColor: '#FFF',
                circleStrokeOpacity: 0.6,
              }}
            />
            <SymbolLayer
              id="crew-emoji"
              style={{
                textField: ['get', 'label'],
                textSize: 14,
                textAnchor: 'center',
                textAllowOverlap: true,
              }}
            />
          </ShapeSource>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  noToken: {
    flex: 1,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noTokenText: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '700',
  },
  noTokenSub: {
    color: '#555',
    fontSize: 12,
  },
});
