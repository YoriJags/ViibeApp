/**
 * SurgeAlertBanner — Sports-broadcast FOMO alert for home-screen viewers.
 *
 * Listens for `global_surge_alert` socket events (emitted when any venue
 * jumps > 15 pts in 15 mins). Slides in from the top like a breaking-news
 * ticker, auto-dismisses after 6 seconds, tappable to navigate to the venue.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVibeStore } from '../store/vibeStore';

const { width: W } = Dimensions.get('window');
const AUTO_DISMISS_MS = 6000;

interface SurgeAlert {
  venue_id: string;
  venue_name: string;
  delta: number;
  score: number;
  narrative: string;
}

interface Props {
  onPress: (venueId: string) => void;
}

export default function SurgeAlertBanner({ onPress }: Props) {
  const socket = useVibeStore(s => s.socket);
  const insets = useSafeAreaInsets();

  const [alert, setAlert] = useState<SurgeAlert | null>(null);
  const slideY  = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(1)).current;
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (data: SurgeAlert) => {
    if (timer.current) clearTimeout(timer.current);
    setAlert(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Slide in
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      // Pulse the delta number
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      ).start();
    });

    timer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -120, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => setAlert(null));
  };

  useEffect(() => {
    if (!socket) return;
    const handler = (data: SurgeAlert) => show(data);
    socket.on('global_surge_alert', handler);
    return () => { socket.off('global_surge_alert', handler); };
  }, [socket]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!alert) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        { top: insets.top + 8, transform: [{ translateY: slideY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { dismiss(); onPress(alert.venue_id); }}
      >
        <LinearGradient
          colors={['#1A0808', '#0D0D1A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.card}
        >
          {/* Left accent bar */}
          <View style={styles.accentBar} />

          {/* Breaking label */}
          <View style={styles.body}>
            <View style={styles.topRow}>
              <View style={styles.breakingPill}>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
                <Text style={styles.breakingText}>SURGE</Text>
              </View>
              <Text style={styles.venueName} numberOfLines={1}>{alert.venue_name}</Text>
              <Animated.Text style={[styles.delta, { transform: [{ scale: pulse }] }]}>
                ▲{alert.delta.toFixed(0)}
              </Animated.Text>
            </View>

            <Text style={styles.narrative} numberOfLines={2}>{alert.narrative}</Text>

            <View style={styles.footerRow}>
              <Text style={styles.scoreText}>{alert.score.toFixed(0)} pts now</Text>
              <Text style={styles.tapHint}>Tap to see venue  →</Text>
            </View>
          </View>

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,51,51,0.35)',
    overflow: 'hidden',
    shadowColor: '#FF3333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#FF3333',
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,51,51,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF3333',
  },
  breakingText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FF3333',
    letterSpacing: 1.5,
  },
  venueName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  delta: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF3333',
    letterSpacing: -0.5,
  },
  narrative: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 15,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  scoreText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 10,
    color: 'rgba(255,51,51,0.6)',
    fontWeight: '700',
  },
  closeBtn: {
    paddingRight: 12,
    paddingLeft: 4,
    alignSelf: 'flex-start',
    paddingTop: 10,
  },
});
