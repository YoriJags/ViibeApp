/**
 * SkeletonLoader - Shimmer loading placeholder
 * Left-to-right shimmer sweep animation
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius as br } from '../theme';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonProps> & {
  VenueCard: React.FC<{ style?: ViewStyle }>;
  StatCard: React.FC<{ style?: ViewStyle }>;
  Circle: React.FC<{ size: number; style?: ViewStyle }>;
} = ({ width, height, borderRadius = br.md, style }) => {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 2],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.background.card,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// Preset: Venue card skeleton
SkeletonLoader.VenueCard = ({ style }) => (
  <View style={[skeletonStyles.venueCard, style]}>
    <View style={skeletonStyles.venueRow}>
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader width="70%" height={16} borderRadius={4} />
        <SkeletonLoader width="40%" height={12} borderRadius={4} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <SkeletonLoader width={60} height={20} borderRadius={10} />
          <SkeletonLoader width={60} height={20} borderRadius={10} />
        </View>
      </View>
      <SkeletonLoader width={52} height={52} borderRadius={12} />
    </View>
  </View>
);

// Preset: Stat card skeleton
SkeletonLoader.StatCard = ({ style }) => (
  <View style={[skeletonStyles.statCard, style]}>
    <SkeletonLoader width={32} height={32} borderRadius={16} />
    <SkeletonLoader width="60%" height={24} borderRadius={4} style={{ marginTop: 8 }} />
    <SkeletonLoader width="40%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
  </View>
);

// Preset: Circle skeleton
SkeletonLoader.Circle = ({ size, style }) => (
  <SkeletonLoader width={size} height={size} borderRadius={size / 2} style={style} />
);

const skeletonStyles = StyleSheet.create({
  venueCard: {
    backgroundColor: colors.background.card,
    borderRadius: br.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCard: {
    backgroundColor: colors.background.card,
    borderRadius: br.lg,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
  },
});

export default SkeletonLoader;
