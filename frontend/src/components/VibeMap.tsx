/**
 * VibeMap — Mapbox GL JS map via WebView.
 * Works with Expo Go — no native build required.
 *
 * Passes venue + crew data as embedded JSON into a Mapbox GL JS HTML page.
 * Venue taps are received via WebView postMessage → onVenuePress callback.
 */
import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

interface Venue {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  current_vibe_score?: number;
  energy_level?: string;
}

interface CrewPin {
  id: string;
  username: string;
  lat: number;
  lng: number;
  emoji: string;
  color: string;
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

function buildHTML(
  venues: Venue[],
  crewPins: CrewPin[],
  center: { lat: number; lng: number },
  userLocation: { lat: number; lng: number } | null,
  zoomLevel: number,
  token: string,
): string {
  const venueGeoJSON = {
    type: 'FeatureCollection',
    features: venues.map((v) => ({
      type: 'Feature',
      id: v.id,
      geometry: { type: 'Point', coordinates: [v.coordinates.lng, v.coordinates.lat] },
      properties: {
        id: v.id,
        name: v.name,
        score: Math.round(v.current_vibe_score ?? 0),
        color: ENERGY_COLORS[v.energy_level ?? 'quiet'] ?? '#9933FF',
      },
    })),
  };

  const crewGeoJSON = {
    type: 'FeatureCollection',
    features: crewPins.map((c) => ({
      type: 'Feature',
      id: c.id,
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { id: c.id, emoji: c.emoji, color: c.color },
    })),
  };

  const userMarker = userLocation
    ? `new mapboxgl.Marker({ color: '#00D4FF', scale: 0.8 })
         .setLngLat([${userLocation.lng}, ${userLocation.lat}])
         .addTo(map);`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #0A0A0F; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = '${token}';

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [${center.lng}, ${center.lat}],
      zoom: ${zoomLevel},
      attributionControl: false,
      logoPosition: 'bottom-right',
      pitchWithRotate: false,
      dragRotate: false,
    });

    const venues = ${JSON.stringify(venueGeoJSON)};
    const crew   = ${JSON.stringify(crewGeoJSON)};

    map.on('load', function () {
      // ── Venues ────────────────────────────────────────────────────────
      map.addSource('venues', { type: 'geojson', data: venues });

      // Outer glow
      map.addLayer({
        id: 'venue-glow',
        type: 'circle',
        source: 'venues',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 14, 15, 28],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.15,
          'circle-blur': 1.2,
        },
      });

      // Main pin
      map.addLayer({
        id: 'venue-circle',
        type: 'circle',
        source: 'venues',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 18],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.92,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.45,
        },
      });

      // Score label
      map.addLayer({
        id: 'venue-score',
        type: 'symbol',
        source: 'venues',
        layout: {
          'text-field': ['concat', ['to-string', ['get', 'score']], '%'],
          'text-size': 10,
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.65)',
          'text-halo-width': 1,
        },
      });

      // Tap handler
      map.on('click', 'venue-circle', function (e) {
        var id = e.features[0].properties.id;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'venue_press', id: id }));
        }
      });
      map.on('mouseenter', 'venue-circle', function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'venue-circle', function () { map.getCanvas().style.cursor = ''; });

      // ── Crew pins ─────────────────────────────────────────────────────
      if (crew.features.length > 0) {
        map.addSource('crew', { type: 'geojson', data: crew });
        map.addLayer({
          id: 'crew-ring',
          type: 'circle',
          source: 'crew',
          paint: {
            'circle-radius': 16,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.95,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.6,
          },
        });
        map.addLayer({
          id: 'crew-emoji',
          type: 'symbol',
          source: 'crew',
          layout: {
            'text-field': ['get', 'emoji'],
            'text-size': 13,
            'text-anchor': 'center',
            'text-allow-overlap': true,
          },
        });
      }

      // ── User location ─────────────────────────────────────────────────
      ${userMarker}
    });
  </script>
</body>
</html>`;
}

export default function VibeMap({
  venues,
  userLocation,
  onVenuePress,
  crewPins = [],
  center,
  zoomLevel = 13,
}: Props) {
  const mapCenter = center ?? userLocation ?? { lat: 6.4316, lng: 3.4223 };

  const html = useMemo(
    () => buildHTML(venues, crewPins, mapCenter, userLocation, zoomLevel, MAPBOX_TOKEN),
    [venues, crewPins, userLocation?.lat, userLocation?.lng, zoomLevel],
  );

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'venue_press') {
        const venue = venues.find((v) => v.id === msg.id);
        if (venue) onVenuePress(venue);
      }
    } catch {}
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0A0A0F' },
});
