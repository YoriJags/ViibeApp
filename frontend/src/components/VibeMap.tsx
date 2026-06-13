/**
 * VibeMap — Mapbox GL JS map via WebView.
 * Works with Expo Go — no native build required.
 *
 * Features:
 *  - Energy-colored glow rings (visible, color-coded by vibe energy)
 *  - Animated pulse rings for hot venues (electric / peak / lit)
 *  - Venue name labels that appear on zoom
 *  - Tap popup with venue name + vibe score
 *  - Crew emoji pins with battery-aware color
 *  - User location dot
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
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

const HOT_LEVELS = new Set(['electric', 'peak', 'lit']);

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
        isHot: HOT_LEVELS.has(v.energy_level ?? '') ? 1 : 0,
      },
    })),
  };

  const crewGeoJSON = {
    type: 'FeatureCollection',
    features: crewPins.map((c) => ({
      type: 'Feature',
      id: c.id,
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { id: c.id, emoji: c.emoji, color: c.color, username: c.username },
    })),
  };

  const userMarkerJS = userLocation
    ? `new mapboxgl.Marker({ color: '#00D4FF', scale: 0.9 })
         .setLngLat([${userLocation.lng}, ${userLocation.lat}])
         .addTo(map);`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"><\/script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #0A0A0F; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display: none !important; }

    /* Venue tap popup */
    .vibe-popup .mapboxgl-popup-content {
      background: rgba(10,10,20,0.93);
      border: 1px solid rgba(255,255,255,0.13);
      border-radius: 14px;
      padding: 10px 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      pointer-events: none;
    }
    .vibe-popup .mapboxgl-popup-tip { display: none; }
    .popup-name {
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .popup-score {
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: 0.5px;
      margin-top: 3px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = '${token}';

    var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [${center.lng}, ${center.lat}],
      zoom: ${zoomLevel},
      attributionControl: false,
      logoPosition: 'bottom-right',
      pitchWithRotate: false,
      dragRotate: false,
    });

    var venues = ${JSON.stringify(venueGeoJSON)};
    var crew   = ${JSON.stringify(crewGeoJSON)};

    map.on('load', function () {

      // ── Venues source ──────────────────────────────────────────────────
      map.addSource('venues', { type: 'geojson', data: venues });

      // 1. Outer pulse ring — animates for hot (electric/peak/lit) venues
      map.addLayer({
        id: 'venue-pulse',
        type: 'circle',
        source: 'venues',
        filter: ['==', ['get', 'isHot'], 1],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 22, 15, 44],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.0,
          'circle-blur': 0.4,
        },
      });

      // 2. Energy glow ring — visible halo, color-coded by energy
      map.addLayer({
        id: 'venue-glow',
        type: 'circle',
        source: 'venues',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 17, 15, 34],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.42,
          'circle-blur': 0.6,
        },
      });

      // 3. Main venue pin
      map.addLayer({
        id: 'venue-circle',
        type: 'circle',
        source: 'venues',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 20],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.6,
        },
      });

      // 4. Score label inside pin
      map.addLayer({
        id: 'venue-score',
        type: 'symbol',
        source: 'venues',
        layout: {
          'text-field': ['concat', ['to-string', ['get', 'score']], '%'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 11],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.5)',
          'text-halo-width': 0.8,
        },
      });

      // 5. Venue name label — fades in at zoom 12+
      map.addLayer({
        id: 'venue-label',
        type: 'symbol',
        source: 'venues',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 0, 12.5, 10, 15, 12],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-anchor': 'top',
          'text-offset': [0, 1.6],
          'text-max-width': 10,
          'text-optional': true,
        },
        paint: {
          'text-color': '#D8D8F0',
          'text-halo-color': 'rgba(5,5,12,0.85)',
          'text-halo-width': 1.5,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 1],
        },
      });

      // ── Pulse animation (requestAnimationFrame) ────────────────────────
      var phase = 0;
      function animatePulse() {
        phase += 0.038;
        var t = (Math.sin(phase) + 1) / 2; // 0 → 1
        var radius = ['interpolate', ['linear'], ['zoom'], 10, 18 + t * 12, 15, 36 + t * 22];
        var opacity = 0.08 + t * 0.28;
        if (map.getLayer('venue-pulse')) {
          map.setPaintProperty('venue-pulse', 'circle-radius', radius);
          map.setPaintProperty('venue-pulse', 'circle-opacity', opacity);
        }
        requestAnimationFrame(animatePulse);
      }
      requestAnimationFrame(animatePulse);

      // ── Tap + hover popup ──────────────────────────────────────────────
      var popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 22,
        className: 'vibe-popup',
        maxWidth: '200px',
      });

      function showPopup(props, lngLat) {
        popup
          .setLngLat(lngLat)
          .setHTML(
            '<div class="popup-name">' + props.name + '</div>' +
            '<div class="popup-score" style="color:' + props.color + '">' + props.score + '% VIBE</div>'
          )
          .addTo(map);
      }

      map.on('click', 'venue-circle', function (e) {
        var props = e.features[0].properties;
        showPopup(props, e.features[0].geometry.coordinates.slice());
        setTimeout(function () { popup.remove(); }, 2200);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'venue_press', id: props.id }));
        }
      });

      map.on('mouseenter', 'venue-circle', function (e) {
        map.getCanvas().style.cursor = 'pointer';
        showPopup(e.features[0].properties, e.features[0].geometry.coordinates.slice());
      });
      map.on('mouseleave', 'venue-circle', function () {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      // ── Crew pins ──────────────────────────────────────────────────────
      if (crew.features.length > 0) {
        map.addSource('crew', { type: 'geojson', data: crew });

        // Crew glow
        map.addLayer({
          id: 'crew-glow',
          type: 'circle',
          source: 'crew',
          paint: {
            'circle-radius': 22,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.2,
            'circle-blur': 0.8,
          },
        });

        // Crew avatar circle
        map.addLayer({
          id: 'crew-ring',
          type: 'circle',
          source: 'crew',
          paint: {
            'circle-radius': 16,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.95,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.7,
          },
        });

        // Crew emoji
        map.addLayer({
          id: 'crew-emoji',
          type: 'symbol',
          source: 'crew',
          layout: {
            'text-field': ['get', 'emoji'],
            'text-size': 14,
            'text-anchor': 'center',
            'text-allow-overlap': true,
          },
        });

        // Crew username label
        map.addLayer({
          id: 'crew-label',
          type: 'symbol',
          source: 'crew',
          layout: {
            'text-field': ['get', 'username'],
            'text-size': 10,
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
            'text-anchor': 'top',
            'text-offset': [0, 1.8],
            'text-optional': true,
          },
          paint: {
            'text-color': '#FFFFFF',
            'text-halo-color': 'rgba(0,0,0,0.85)',
            'text-halo-width': 1.5,
          },
        });
      }

      // ── User location ──────────────────────────────────────────────────
      ${userMarkerJS}
    });
  <\/script>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // baseUrl gives the inline HTML a real https origin. Without it, Android
        // WebView serves the page from a null origin and Mapbox GL JS's tile/style
        // requests to api.mapbox.com are blocked → blank dark map. (iOS is lenient,
        // but we set it on both for parity.)
        source={{ html, baseUrl: 'https://api.mapbox.com/' }}
        style={styles.webview}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        originWhitelist={['*']}
        mixedContentMode="always"
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
