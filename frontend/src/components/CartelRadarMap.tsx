/**
 * CartelRadarMap — "Find Your Crew" squad location tracker
 *
 * Shows live crew member positions on a mini-map inside the crew screen.
 * Polls every 15 seconds when focused. Supports Ghost Mode (hide own pin)
 * and an "I'm Here!" SOS pulse alert.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import { MockMap } from './MockMap';

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
    isDemoMode,
    user,
  } = useVibeStore();

  const [loading, setLoading] = useState(true);
  const [sosActive, setSosActive] = useState(false);
  const sosAnim = useRef(new Animated.Value(1)).current;
  const sosOpacity = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    await fetchCrewLocations(crewId);
    setLoading(false);
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

  // Build crew pins for MockMap
  // Filter out self if ghostMode is on
  const visibleLocations = ghostMode
    ? crewLocations.filter((loc) => loc.user_id !== user?.id)
    : crewLocations;

  const crewPins = visibleLocations.map((loc) => ({
    id: loc.user_id,
    username: loc.username,
    lat: loc.lat,
    lng: loc.lng,
    emoji: loc.avatar_config?.emoji || '👤',
    color: loc.avatar_config?.bgColor || '#7C3AED',
  }));

  const outCount = crewLocations.length;
  const totalCount = crewSize;

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator color="#FF3366" size="small" />
        <Text style={styles.loadingText}>Scanning for your Cartel...</Text>
      </View>
    );
  }

  if (outCount === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Ionicons name="location-outline" size={36} color="#333" />
        <Text style={styles.emptyTitle}>No one's out yet</Text>
        <Text style={styles.emptySubtitle}>
          Check in at a venue and your Cartel can find you here
        </Text>
      </View>
    );
  }

  return (
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
          {/* Ghost Mode toggle */}
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
        </View>
      </View>

      {/* Mini map */}
      <View style={[styles.mapContainer, { height: height - 48 - 44 }]}>
        <MockMap
          venues={[]}
          userLocation={null}
          onVenuePress={() => {}}
          crewPins={crewPins}
        />
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Member list (scrollable text) */}
        <Text style={styles.memberList} numberOfLines={1}>
          {crewLocations.map((l) => `${l.avatar_config?.emoji || '👤'} ${l.username}`).join('  ·  ')}
        </Text>

        {/* SOS pulse button */}
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

      {/* Ghost mode banner */}
      {ghostMode && (
        <View style={styles.ghostBanner}>
          <Ionicons name="moon" size={12} color="#00D4FF" />
          <Text style={styles.ghostBannerText}>You're in Ghost Mode — your pin is hidden</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  mapContainer: {
    overflow: 'hidden',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 44,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  memberList: {
    flex: 1,
    fontSize: 11,
    color: '#777',
    fontWeight: '600',
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
});

export default CartelRadarMap;
