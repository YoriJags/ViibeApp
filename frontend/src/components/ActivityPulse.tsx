/**
 * ActivityPulse - "The Pulse" live activity feed
 *
 * Scrolling ticker of recent check-ins, ratings, and Pulse Drops.
 * Auto-scrolls with fade-in stagger. Each item has an icon + color
 * based on activity type. Shows on home screen above venue list.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface ActivityItem {
  id: string;
  type: 'checkin' | 'rating' | 'pulse' | 'streak' | 'achievement';
  username: string;
  venueName: string;
  message: string;
  timeAgo: string;
}

interface ActivityPulseProps {
  activities: ActivityItem[];
}

const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; gradient: [string, string] }> = {
  checkin: { icon: 'location', color: '#00E676', gradient: ['#00E676', '#00D4FF'] },
  rating: { icon: 'star', color: '#FFD700', gradient: ['#FFD700', '#FF9800'] },
  pulse: { icon: 'flash', color: '#FF3366', gradient: ['#FF3366', '#FF6B35'] },
  streak: { icon: 'flame', color: '#FF6B35', gradient: ['#FF6B35', '#FFD700'] },
  achievement: { icon: 'trophy', color: '#9933FF', gradient: ['#9933FF', '#FF3366'] },
};

function ActivityRow({ item, index }: { item: ActivityItem; index: number }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const config = ACTIVITY_CONFIG[item.type] || ACTIVITY_CONFIG.checkin;

  return (
    <Animated.View style={[styles.row, { opacity: fadeIn, transform: [{ translateX: slideX }] }]}>
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        <Ionicons name={config.icon as any} size={14} color="#FFF" />
      </LinearGradient>
      <View style={styles.textWrap}>
        <Text style={styles.message} numberOfLines={1}>
          <Text style={[styles.username, { color: config.color }]}>{item.username}</Text>
          {' '}{item.message}
        </Text>
        <Text style={styles.timeAgo}>{item.timeAgo}</Text>
      </View>
    </Animated.View>
  );
}

export default function ActivityPulse({ activities }: ActivityPulseProps) {
  if (activities.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.title}>THE PULSE</Text>
        </View>
        <Text style={styles.subtitle}>Live Activity</Text>
      </View>
      <FlatList
        data={activities.slice(0, 5)}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ActivityRow item={item} index={index} />}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(21,21,32,0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.12)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3366',
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  message: {
    fontSize: 12,
    color: '#AAA',
  },
  username: {
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
});
