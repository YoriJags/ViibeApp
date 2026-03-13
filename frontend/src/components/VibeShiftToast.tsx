/**
 * VibeShiftToast — slides in from top when a venue jumps energy tiers.
 * "Lekki Phase 1 just went PEAK 🔥" — auto-dismisses in 4s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string; up: boolean }> = {
  peak:    { label: 'PEAK',    color: '#FF3366', icon: 'flame',       up: true  },
  lit:     { label: 'LIT',     color: '#FF8C00', icon: 'flash',       up: true  },
  charged: { label: 'CHARGED', color: '#9933FF', icon: 'thunderstorm',up: true  },
  warming: { label: 'WARMING', color: '#6655FF', icon: 'trending-up', up: true  },
  chill:   { label: 'CHILL',   color: '#3399FF', icon: 'trending-down',up: false },
  quiet:   { label: 'QUIET',   color: '#555',    icon: 'moon',        up: false },
};

interface Props {
  visible: boolean;
  venueName: string;
  newTier: string;
  prevTier?: string;
  onPress?: () => void;
  onDismiss: () => void;
}

export default function VibeShiftToast({ visible, venueName, newTier, prevTier, onPress, onDismiss }: Props) {
  const slideY = useRef(new Animated.Value(-120)).current;
  const opac   = useRef(new Animated.Value(0)).current;
  const timer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tier = TIER_CONFIG[newTier] ?? TIER_CONFIG['warming'];
  const isUpgrade = tier.up;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(
        isUpgrade ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
      slideY.setValue(-120);
      opac.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 90, friction: 12, useNativeDriver: true }),
        Animated.timing(opac,   { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(() => dismiss(), 4000);
    }
    return () => clearTimeout(timer.current);
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opac,   { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: slideY }], opacity: opac }]}>
      <TouchableOpacity
        style={[styles.toast, { borderColor: tier.color + '44' }]}
        onPress={() => { clearTimeout(timer.current); dismiss(); onPress?.(); }}
        activeOpacity={0.88}
      >
        {/* Left: icon */}
        <View style={[styles.iconWrap, { backgroundColor: tier.color + '22' }]}>
          <Ionicons name={tier.icon as any} size={20} color={tier.color} />
        </View>

        {/* Center: text */}
        <View style={styles.textWrap}>
          <Text style={styles.venueText} numberOfLines={1}>{venueName}</Text>
          <View style={styles.tierRow}>
            {prevTier && TIER_CONFIG[prevTier] && (
              <>
                <Text style={[styles.tierPrev, { color: TIER_CONFIG[prevTier].color + '88' }]}>
                  {TIER_CONFIG[prevTier].label}
                </Text>
                <Ionicons name="arrow-forward" size={10} color="#444" />
              </>
            )}
            <Text style={[styles.tierNew, { color: tier.color }]}>{tier.label}</Text>
          </View>
        </View>

        {/* Right: up/down arrow */}
        <Ionicons
          name={isUpgrade ? 'trending-up' : 'trending-down'}
          size={18}
          color={isUpgrade ? '#00E676' : '#FF5252'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 54, left: 16, right: 16, zIndex: 9999,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0E0E18',
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  textWrap: { flex: 1 },
  venueText: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tierPrev: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tierNew:  { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
