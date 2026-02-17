/**
 * VibeMatch - Personalized venue recommendation card
 *
 * "Tonight's Match" — one featured venue picked based on user's
 * rating history, energy preference, and crew activity.
 * Animated reveal with gradient background + match percentage.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface VibeMatchProps {
  venueName: string;
  venueArea: string;
  matchPercent: number;
  vibeScore: number;
  energyLevel: string;
  reason: string;
  onPress: () => void;
}

export default function VibeMatch({
  venueName,
  venueArea,
  matchPercent,
  vibeScore,
  energyLevel,
  reason,
  onPress,
}: VibeMatchProps) {
  const revealScale = useRef(new Animated.Value(0.9)).current;
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const percentCounter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.spring(revealScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(revealOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Match percent count-up
    Animated.timing(percentCounter, {
      toValue: matchPercent,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, []);

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.03, 0.1],
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View
      style={[styles.container, { opacity: revealOpacity, transform: [{ scale: revealScale }] }]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <LinearGradient
          colors={['#1A1030', '#0D0D1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Shimmer overlay */}
          <Animated.View style={[styles.shimmerOverlay, { opacity: shimmerOpacity }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,51,102,0.15)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.matchLabel}>
              <Ionicons name="sparkles" size={14} color="#FF3366" />
              <Text style={styles.matchTitle}>TONIGHT'S MATCH</Text>
            </View>
            <View style={styles.matchPercentBadge}>
              <Text style={styles.matchPercentText}>{matchPercent}%</Text>
            </View>
          </View>

          {/* Venue info */}
          <Text style={styles.venueName}>{venueName}</Text>
          <Text style={styles.venueArea}>{venueArea}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{vibeScore}%</Text>
              <Text style={styles.statLabel}>Vibe</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: '#00E676' }]}>{energyLevel}</Text>
              <Text style={styles.statLabel}>Energy</Text>
            </View>
          </View>

          {/* Why matched */}
          <View style={styles.reasonRow}>
            <Ionicons name="heart" size={12} color="#FF6B35" />
            <Text style={styles.reasonText}>{reason}</Text>
          </View>

          {/* CTA */}
          <LinearGradient
            colors={['#FF3366', '#FF6B35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Check It Out</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.15)',
    overflow: 'hidden',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 2,
  },
  matchPercentBadge: {
    backgroundColor: '#FF336625',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF336640',
  },
  matchPercentText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF3366',
  },
  venueName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  venueArea: {
    fontSize: 13,
    color: '#888',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFD700',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#333',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  reasonText: {
    fontSize: 12,
    color: '#AAA',
    fontStyle: 'italic',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
