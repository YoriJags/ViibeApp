/**
 * GlassCard - Reusable glassmorphism container
 * Frosted glass look with subtle border sheen and optional colored glow
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, neonGlow } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  style?: ViewStyle;
  glowColor?: string;
  glowIntensity?: 'soft' | 'medium' | 'strong';
  noPadding?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 25,
  tint = 'dark',
  style,
  glowColor,
  glowIntensity = 'soft',
  noPadding = false,
}) => {
  const glowStyle = glowColor ? neonGlow(glowColor, glowIntensity) : {};

  return (
    <View style={[styles.container, glowStyle, style]}>
      <BlurView intensity={intensity} tint={tint} style={styles.blur}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, !noPadding && styles.padding]}
        >
          {children}
        </LinearGradient>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  blur: {
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
  },
  padding: {
    padding: 16,
  },
});

export default GlassCard;
