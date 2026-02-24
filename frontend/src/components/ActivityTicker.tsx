/**
 * ActivityTicker — Horizontal auto-scrolling live activity feed.
 * Replaces the static ActivityPulse vertical list.
 * Shows: who did what, where, when — in a single compact strip.
 * Loops infinitely. Pauses on touch.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ActivityItem {
  id: string;
  type: 'checkin' | 'rating' | 'pulse' | 'streak' | 'achievement';
  username: string;
  venueName?: string;
  message: string;
  timeAgo: string;
}

interface Props {
  items: ActivityItem[];
  speed?: number; // px per second (default 38)
}

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; iconBg: string }
> = {
  checkin:     { icon: 'location',      color: '#4CAF50', iconBg: '#4CAF5020' },
  rating:      { icon: 'star',          color: '#FFD700', iconBg: '#FFD70020' },
  pulse:       { icon: 'flash',         color: '#FF6B35', iconBg: '#FF6B3520' },
  streak:      { icon: 'flame',         color: '#FF3366', iconBg: '#FF336620' },
  achievement: { icon: 'ribbon',        color: '#9933FF', iconBg: '#9933FF20' },
};

// Single activity pill
function ActivityPill({ item }: { item: ActivityItem }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.checkin;
  return (
    <View style={styles.pill}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
        <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
      </View>

      {/* Text */}
      <Text style={styles.pillText} numberOfLines={1}>
        <Text style={styles.username}>{item.username}</Text>
        {' '}
        <Text style={styles.messageText}>{item.message}</Text>
      </Text>

      {/* Dot separator */}
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
    </View>
  );
}

export default function ActivityTicker({ items, speed = 38 }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [contentWidth, setContentWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Double the items so we can loop seamlessly
  const doubled = [...items, ...items];

  useEffect(() => {
    if (contentWidth === 0 || paused) return;

    const halfWidth = contentWidth / 2;
    const duration = (halfWidth / speed) * 1000;

    scrollX.setValue(0);

    animRef.current = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -halfWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();

    return () => animRef.current?.stop();
  }, [contentWidth, paused, speed]);

  // Pause / resume on press
  const handlePressIn = () => {
    setPaused(true);
    animRef.current?.stop();
  };
  const handlePressOut = () => {
    setPaused(false);
  };

  if (!items || items.length === 0) return null;

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <View style={styles.container}>
        {/* Live badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {/* Scrolling strip */}
        <View style={styles.strip}>
          <Animated.View
            style={[styles.track, { transform: [{ translateX: scrollX }] }]}
            onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
          >
            {doubled.map((item, i) => (
              <ActivityPill key={`${item.id}_${i}`} item={item} />
            ))}
          </Animated.View>
        </View>

        {/* Right fade */}
        <View style={styles.fadeRight} pointerEvents="none" />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    height: 32,
    overflow: 'hidden',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF336618',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF336640',
    marginRight: 10,
    flexShrink: 0,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF3366',
  },
  liveText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 1.5,
  },
  strip: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
    backgroundColor: '#111118',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252530',
  },
  iconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pillText: {
    maxWidth: 200,
    flexShrink: 1,
  },
  username: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  messageText: {
    fontSize: 11,
    color: '#666',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    flexShrink: 0,
    marginLeft: 2,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    // Gradient-like fade using nested views isn't possible, use backgroundColor trick
    backgroundColor: 'transparent',
  },
});
