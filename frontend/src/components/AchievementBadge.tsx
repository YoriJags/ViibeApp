/**
 * AchievementBadge - Displays earned and locked achievement badges
 *
 * Grid of badges with glow for unlocked + dimmed for locked.
 * Used on profile screen. Each badge has emoji + label + description.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  unlocked: boolean;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  progress?: number; // 0-1 for locked badges
}

interface AchievementBadgeProps {
  badges: Badge[];
}

const TIER_COLORS: Record<string, [string, string]> = {
  bronze: ['#CD7F32', '#8B4513'],
  silver: ['#C0C0C0', '#808080'],
  gold: ['#FFD700', '#FF9800'],
  diamond: ['#00D4FF', '#9933FF'],
};

function BadgeItem({ badge, index }: { badge: Badge; index: number }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 60),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();

    if (badge.unlocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const tierColors = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;

  return (
    <Animated.View style={[styles.badgeWrap, { transform: [{ scale: scaleAnim }] }]}>
      {badge.unlocked ? (
        <Animated.View style={{ opacity: glowAnim }}>
          <LinearGradient
            colors={tierColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badgeCircle}
          >
            <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
          </LinearGradient>
        </Animated.View>
      ) : (
        <View style={[styles.badgeCircle, styles.badgeLocked]}>
          <Text style={[styles.badgeEmoji, { opacity: 0.3 }]}>{badge.emoji}</Text>
          {badge.progress !== undefined && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${badge.progress * 100}%` }]} />
            </View>
          )}
        </View>
      )}
      <Text style={[styles.badgeName, !badge.unlocked && styles.lockedText]} numberOfLines={1}>
        {badge.name}
      </Text>
    </Animated.View>
  );
}

export default function AchievementBadge({ badges }: AchievementBadgeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ACHIEVEMENTS</Text>
        <Text style={styles.count}>
          {badges.filter(b => b.unlocked).length}/{badges.length}
        </Text>
      </View>
      <View style={styles.grid}>
        {badges.map((badge, i) => (
          <BadgeItem key={badge.id} badge={badge} index={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 2,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeWrap: {
    alignItems: 'center',
    width: 68,
  },
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeLocked: {
    backgroundColor: '#1A1A28',
    borderWidth: 1,
    borderColor: '#333',
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#CCC',
    textAlign: 'center',
  },
  lockedText: {
    color: '#555',
  },
  progressBar: {
    position: 'absolute',
    bottom: 4,
    width: 36,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#333',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 1.5,
  },
});
