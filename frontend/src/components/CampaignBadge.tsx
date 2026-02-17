/**
 * CampaignBadge - "2x CLOUT" or "3x CLOUT" animated badge
 * Shown on venue cards and map markers during active campaigns
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CampaignBadgeProps {
  multiplier: number;
  expiresAt?: string;
  compact?: boolean;
}

export default function CampaignBadge({ multiplier, expiresAt, compact = false }: CampaignBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Calculate time remaining
  let timeRemaining = '';
  if (expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff > 0) {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      timeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
  }

  if (compact) {
    return (
      <Animated.View style={[styles.compactBadge, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="flash" size={10} color="#FFD700" />
        <Text style={styles.compactText}>{multiplier}x</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.badgeInner}>
        <Ionicons name="flash" size={16} color="#FFD700" />
        <Text style={styles.multiplierText}>{multiplier}x CLOUT</Text>
      </View>
      {timeRemaining ? (
        <Text style={styles.timerText}>{timeRemaining} left</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFD70020',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FFD70040',
    alignItems: 'center',
  },
  badgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  multiplierText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 10,
    color: '#FFD700AA',
    marginTop: 2,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70030',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFD700',
  },
});
