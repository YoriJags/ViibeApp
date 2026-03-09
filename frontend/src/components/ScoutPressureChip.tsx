/**
 * ScoutPressureChip — "X scouts heading here" social pressure indicator.
 * Shows on venue detail page. Pulls heading_count from I Dey Road data.
 * Creates urgency: if others are going, you should too.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Props {
  venueId: string;
  isDemoMode?: boolean;
  style?: any;
}

export default function ScoutPressureChip({ venueId, isDemoMode, style }: Props) {
  const [count, setCount] = useState(0);
  const [enrouteCount, setEnrouteCount] = useState(0);
  const dotPulse = useRef(new Animated.Value(0.4)).current;

  // Dot pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const fetchCount = async () => {
    if (isDemoMode) {
      setCount(7);
      setEnrouteCount(3);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/headings-count`);
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.count ?? 0);
      setEnrouteCount(data.enroute_count ?? 0);
    } catch {
      // Silently fail — endpoint may not exist yet
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [venueId, isDemoMode]);

  if (count === 0) return null;

  const plural = count !== 1 ? 's' : '';
  const showEnroute = enrouteCount > 0 && count > enrouteCount;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Animated.View style={[styles.dot, { opacity: dotPulse }]} />
        <Text style={styles.label}>
          {count} scout{plural} heading here
        </Text>
      </View>
      {showEnroute && (
        <Text style={styles.enroute}>({enrouteCount} en route)</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    backgroundColor: '#00E67610',
    borderWidth: 1,
    borderColor: '#00E67630',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E676',
  },
  enroute: {
    fontSize: 11,
    color: '#00E67680',
    marginTop: 2,
    marginLeft: 13,
  },
});
