/**
 * RollingDeepBanner — crew group check-in coordination card.
 *
 * Shown on the crew screen when a Rolling Deep session is active.
 * Lets non-initiating members confirm ("I'm In") and tracks confirmed count.
 * When 2+ confirm → "ROLLING DEEP" status + bonus clout awarded.
 *
 * Also exported: useRollingDeep hook for initiating from the venue detail page.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Session {
  crew_id:              string;
  crew_name:            string;
  venue_id:             string;
  venue_name:           string;
  initiator_username:   string;
  members_in:           string[];
  status:               'building' | 'rolling';
}

interface Props {
  crewId:         string;
  currentUserId:  string;
  isDemoMode?:    boolean;
  onVenuePress?:  (venueId: string) => void;
}

const DEMO_SESSION: Session = {
  crew_id: 'demo', crew_name: 'WAVE CARTEL',
  venue_id: 'demo_venue', venue_name: 'Club Quilox',
  initiator_username: 'wave_captain',
  members_in: ['demo_user_1'],
  status: 'building',
};

export default function RollingDeepBanner({ crewId, currentUserId, isDemoMode, onVenuePress }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);

  const [session, setSession]     = useState<Session | null>(null);
  const [joining, setJoining]     = useState(false);
  const [justRolled, setJustRolled] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const fetchSession = useCallback(async () => {
    if (isDemoMode) { setSession(DEMO_SESSION); return; }
    try {
      const res = await fetch(`${API_URL}/api/crews/${crewId}/rolling-deep`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session ?? null);
      }
    } catch {}
  }, [crewId, isDemoMode]);

  useEffect(() => {
    fetchSession();
    const t = setInterval(fetchSession, 15_000); // poll every 15s
    return () => clearInterval(t);
  }, [fetchSession]);

  // Pulse animation when session is active
  useEffect(() => {
    if (!session) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [session]);

  const handleJoin = async () => {
    if (joining || !session) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);

    if (isDemoMode) {
      const updated = {
        ...session,
        members_in: [...session.members_in, currentUserId],
        status: (session.members_in.length + 1 >= 2 ? 'rolling' : 'building') as 'building' | 'rolling',
      };
      setSession(updated);
      if (updated.status === 'rolling') setJustRolled(true);
      setJoining(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/crews/${crewId}/rolling-deep/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'rolling') setJustRolled(true);
        await fetchSession();
      }
    } catch {}
    setJoining(false);
  };

  if (!session) return null;

  const isIn       = session.members_in.includes(currentUserId);
  const isRolling  = session.status === 'rolling';
  const count      = session.members_in.length;
  const isInitiator = session.initiator_username === currentUserId;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: pulseAnim }] }]}>
      <LinearGradient
        colors={isRolling ? ['#001A00', '#001200'] : ['#0A0014', '#070010']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: isRolling ? '#00E67618' : '#FF336618' }]}>
          <View style={[styles.statusDot, { backgroundColor: isRolling ? '#00E676' : '#FF3366' }]} />
          <Text style={[styles.statusText, { color: isRolling ? '#00E676' : '#FF3366' }]}>
            {isRolling ? 'ROLLING DEEP' : 'BUILDING'}
          </Text>
        </View>

        {/* Venue info */}
        <TouchableOpacity
          onPress={() => session.venue_id && session.venue_id !== 'demo_venue' && onVenuePress?.(session.venue_id)}
          activeOpacity={session.venue_id && session.venue_id !== 'demo_venue' ? 0.8 : 1}
          style={styles.venueRow}
        >
          <Ionicons name="location" size={14} color={isRolling ? '#00E676' : '#FF3366'} />
          <Text style={styles.venueName}>{session.venue_name}</Text>
          <Ionicons name="chevron-forward" size={12} color="#444" />
        </TouchableOpacity>

        {/* Members confirmed */}
        <Text style={styles.memberCount}>
          {count} {count === 1 ? 'member' : 'members'} confirmed
          {!isRolling && ` · need ${Math.max(0, 2 - count)} more to roll`}
        </Text>

        {/* Initiator line */}
        <Text style={styles.initiatorLine}>
          Started by @{session.initiator_username}
        </Text>

        {/* Action */}
        {!isIn && !isInitiator ? (
          <TouchableOpacity onPress={handleJoin} activeOpacity={0.8} style={styles.joinBtn}>
            <LinearGradient
              colors={['#FF3366', '#CC0044']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.joinBtnGrad}
            >
              {joining
                ? <ActivityIndicator size="small" color="#FFF" />
                : <>
                    <Ionicons name="people" size={14} color="#FFF" />
                    <Text style={styles.joinBtnText}>I'M IN — ROLL DEEP</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.confirmedRow}>
            <Ionicons name="checkmark-circle" size={14} color={isRolling ? '#00E676' : '#555'} />
            <Text style={[styles.confirmedText, { color: isRolling ? '#00E676' : '#555' }]}>
              {isRolling ? `You're rolling! +10 clout incoming` : "You're in — waiting on the crew"}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF336622',
    padding: 16,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  venueName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#FFF' },
  memberCount: { fontSize: 12, color: '#888', fontWeight: '500' },
  initiatorLine: { fontSize: 10, color: '#555', fontWeight: '500' },
  joinBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  joinBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13,
  },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  confirmedText: { fontSize: 12, fontWeight: '600' },
});
