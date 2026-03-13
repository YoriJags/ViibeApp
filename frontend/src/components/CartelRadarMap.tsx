/**
 * CartelRadarMap — "Find Your Crew" squad location tracker
 *
 * Shows live crew member positions on a mini-map inside the crew screen.
 * Tap the expand button to go fullscreen.
 * Polls every 15 seconds when focused. Supports Ghost Mode + SOS pulse.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import { MockMap } from './MockMap';
import VibeMap from './VibeMap';
import BatteryIndicator from './BatteryIndicator';

interface CartelRadarMapProps {
  crewId: string;
  crewSize: number;
  height?: number;
}

const POLL_INTERVAL_MS = 15000;

const CartelRadarMap: React.FC<CartelRadarMapProps> = ({
  crewId,
  crewSize,
  height = 280,
}) => {
  const {
    crewLocations,
    ghostMode,
    fetchCrewLocations,
    toggleGhostMode,
    user,
  } = useVibeStore();

  const [mapReady, setMapReady] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const sosAnim = useRef(new Animated.Value(1)).current;
  const sosOpacity = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    await fetchCrewLocations(crewId);
    setMapReady(true);
  }, [crewId]);

  // Initial load + 15s polling
  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // SOS pulse animation
  const triggerSOS = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSosActive(true);
    sosOpacity.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(sosAnim, { toValue: 1.25, duration: 300, useNativeDriver: true }),
        Animated.timing(sosAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    ).start(() => {
      setSosActive(false);
      sosAnim.setValue(1);
    });
    Animated.timing(sosOpacity, {
      toValue: 0,
      duration: 2400,
      delay: 200,
      useNativeDriver: true,
    }).start();
  };

  const visibleLocations = ghostMode
    ? crewLocations.filter((loc) => loc.user_id !== user?.id)
    : crewLocations;

  const crewPins = visibleLocations
    .filter((loc) => loc.lat != null && loc.lng != null)
    .map((loc) => ({
      id: loc.user_id,
      username: loc.username,
      lat: loc.lat as number,
      lng: loc.lng as number,
      emoji: loc.avatar_config?.emoji || '👤',
      color: loc.avatar_config?.bgColor || '#7C3AED',
    }));

  const outCount = crewLocations.length;
  const totalCount = crewSize;

  // Shared map component
  const MapView = ({ style }: { style?: any }) => (
    <View style={[styles.mapFill, style]}>
      {/* eslint-disable-next-line react-native/no-raw-text */}
      {Platform.OS === 'web' ? (
        <MockMap
          venues={[]}
          userLocation={null}
          onVenuePress={() => {}}
          crewPins={crewPins}
        />
      ) : (
        <VibeMap
          venues={[]}
          userLocation={null}
          onVenuePress={() => {}}
          crewPins={crewPins}
          zoomLevel={13}
        />
      )}
    </View>
  );

  // Shared bottom controls (member chips + SOS)
  const BottomControls = ({ overlay = false }: { overlay?: boolean }) => (
    <View style={[styles.bottomBar, overlay && styles.bottomBarOverlay]}>
      <View style={styles.memberList}>
        {crewLocations.slice(0, overlay ? 5 : 4).map((l) => (
          <View key={l.user_id} style={styles.memberChip}>
            <Text style={styles.memberEmoji}>{l.avatar_config?.emoji || '👤'}</Text>
            <Text style={styles.memberName} numberOfLines={1}>{l.username}</Text>
            <BatteryIndicator level={l.battery_level} size="sm" showPct={true} />
          </View>
        ))}
      </View>
      <Animated.View style={{ transform: [{ scale: sosAnim }] }}>
        <TouchableOpacity
          style={[styles.sosBtn, sosActive && styles.sosBtnActive]}
          onPress={triggerSOS}
          disabled={sosActive}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={sosActive ? ['#FF3366', '#FF6B35'] : ['#1A1A2E', '#2A2A3E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sosBtnGradient}
          >
            <Ionicons name="location" size={14} color={sosActive ? '#FFF' : '#888'} />
            <Text style={[styles.sosBtnText, sosActive && { color: '#FFF' }]}>
              I'm Here!
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  return (
    <>
      {/* Mini-map card */}
      <View style={[styles.wrapper, { height }]}>
        {/* Header bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.liveDot} />
            <Text style={styles.headerText}>
              {outCount} of {totalCount} out tonight
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.ghostBtn, ghostMode && styles.ghostBtnActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleGhostMode(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="moon" size={13} color={ghostMode ? '#00D4FF' : '#888'} />
              <Text style={[styles.ghostBtnText, ghostMode && { color: '#00D4FF' }]}>
                {ghostMode ? 'Ghost' : 'Visible'}
              </Text>
            </TouchableOpacity>
            {/* Fullscreen toggle */}
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFullscreen(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="expand-outline" size={15} color="#AAA" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mini map */}
        <MapView style={{ height: height - 48 - 44 }} />

        {/* Loading overlay */}
        {!mapReady && (
          <View style={styles.mapOverlay}>
            <Text style={styles.overlayIcon}>📡</Text>
            <Text style={styles.overlayText}>Scanning for your Cartel...</Text>
          </View>
        )}

        {/* Empty overlay — map is visible but no one out yet */}
        {mapReady && outCount === 0 && (
          <View style={styles.mapOverlay}>
            <Ionicons name="location-outline" size={28} color="#333" />
            <Text style={styles.overlayTitle}>No one's out yet</Text>
            <Text style={styles.overlaySubtitle}>Check in at a venue — your Cartel can find you here</Text>
          </View>
        )}

        {/* Bottom bar */}
        <BottomControls />

        {ghostMode && (
          <View style={styles.ghostBanner}>
            <Ionicons name="moon" size={12} color="#00D4FF" />
            <Text style={styles.ghostBannerText}>You're in Ghost Mode — your pin is hidden</Text>
          </View>
        )}
      </View>

      {/* 82% bottom-sheet modal */}
      <Modal
        visible={fullscreen}
        transparent
        animationType="slide"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.fsOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setFullscreen(false)} activeOpacity={1} />
          <View style={styles.fsSheet}>
            {/* Handle */}
            <View style={styles.fsHandle} />

            {/* Top bar */}
            <View style={styles.fsTopBar}>
              <View style={styles.fsTopLeft}>
                <View style={styles.liveDotLg} />
                <Text style={styles.fsTopTitle}>CARTEL RADAR</Text>
                <Text style={styles.fsTopSub}>{outCount} out tonight</Text>
              </View>
              <View style={styles.fsTopRight}>
                <TouchableOpacity
                  style={[styles.ghostBtn, ghostMode && styles.ghostBtnActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleGhostMode(); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="moon" size={13} color={ghostMode ? '#00D4FF' : '#888'} />
                  <Text style={[styles.ghostBtnText, ghostMode && { color: '#00D4FF' }]}>
                    {ghostMode ? 'Ghost' : 'Visible'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFullscreen(false); }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Map fills remaining space */}
            <View style={{ flex: 1 }}>
              <MapView />
            </View>

            {/* Bottom controls */}
            <View style={styles.fsBottomBar}>
              <BottomControls overlay />
            </View>

            {ghostMode && (
              <View style={styles.ghostBanner}>
                <Ionicons name="moon" size={12} color="#00D4FF" />
                <Text style={styles.ghostBannerText}>Ghost Mode — your pin is hidden</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // ── Mini card ──────────────────────────────────────────────────────────────
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#0D0D1A',
  },
  loadingText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  mapOverlay: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    bottom: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(8,8,20,0.72)',
  },
  overlayIcon: { fontSize: 24 },
  overlayTitle: { fontSize: 14, fontWeight: '700', color: '#555' },
  overlaySubtitle: { fontSize: 11, color: '#333', textAlign: 'center', paddingHorizontal: 24, lineHeight: 17 },
  overlayText: { fontSize: 12, color: '#444', fontWeight: '600' },

  // ── Header row ─────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  liveDotLg: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#00E676',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CCC',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  // ── Ghost + Expand buttons ─────────────────────────────────────────────────
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ghostBtnActive: {
    borderColor: 'rgba(0,212,255,0.4)',
    backgroundColor: 'rgba(0,212,255,0.08)',
  },
  ghostBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Shared map fill ────────────────────────────────────────────────────────
  mapFill: {
    flex: 1,
  },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 48,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 8,
    backgroundColor: '#0D0D1A',
  },
  bottomBarOverlay: {
    backgroundColor: 'rgba(8,8,16,0.88)',
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  memberList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  memberEmoji: {
    fontSize: 11,
  },
  memberName: {
    fontSize: 10,
    color: '#AAA',
    fontWeight: '600',
    maxWidth: 52,
  },
  sosBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  sosBtnActive: {
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  sosBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sosBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
  },

  // ── Ghost banner ───────────────────────────────────────────────────────────
  ghostBanner: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,212,255,0.08)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
  },
  ghostBannerText: {
    fontSize: 11,
    color: '#00D4FF',
    fontWeight: '600',
  },

  // ── Fullscreen modal ───────────────────────────────────────────────────────
  fsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  fsSheet: {
    height: Dimensions.get('window').height * 0.82,
    backgroundColor: '#0A0A0F',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },
  fsHandle: {
    width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  fsContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  fsTopSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  fsTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(8,8,16,0.82)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  fsTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fsTopTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  fsTopSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  fsTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  fsGhostBanner: {
    bottom: 96,
  },
});

export default CartelRadarMap;
