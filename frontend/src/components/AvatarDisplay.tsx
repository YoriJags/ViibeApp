/**
 * AvatarDisplay - Renders user avatar from config or fallback to initials
 *
 * Used everywhere: crew cards, profile, map pins, member lists.
 * Emoji-based avatar system — no image CDN needed.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types ──────────────────────────────────────────────────────
export interface AvatarConfig {
  emoji: string;
  bgColor: string;
  accentColor: string;
}

interface AvatarDisplayProps {
  config: AvatarConfig | null;
  username: string;
  size?: number;
  showBorder?: boolean;
  borderColor?: string;
}

// ─── Scout status colors (fallback when no config) ─────────────
const STATUS_COLORS: Record<string, string> = {
  newbie: '#888888',
  regular: '#4FC3F7',
  scout: '#FF3366',
  elite: '#FFD700',
};

// ─── Darken a hex color for gradient end ────────────────────────
function darken(hex: string, amount = 0.3): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (num & 0xff) * (1 - amount));
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;
}

// ─── Component ──────────────────────────────────────────────────
export default function AvatarDisplay({
  config,
  username,
  size = 40,
  showBorder = false,
  borderColor,
}: AvatarDisplayProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showBorder) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [showBorder]);

  const radius = size / 2;
  const emojiSize = size * 0.5;
  const letterSize = size * 0.42;
  const activeBorderColor = borderColor || config?.accentColor || '#00E676';

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radius,
  };

  // Emoji avatar with gradient background
  if (config) {
    return (
      <View style={containerStyle}>
        {/* Glow border ring */}
        {showBorder && (
          <Animated.View
            style={[
              styles.glowRing,
              {
                width: size + 6,
                height: size + 6,
                borderRadius: (size + 6) / 2,
                top: -3,
                left: -3,
                borderColor: activeBorderColor,
                opacity: glowOpacity,
                shadowColor: activeBorderColor,
              },
            ]}
          />
        )}
        <LinearGradient
          colors={[config.bgColor, darken(config.bgColor)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientCircle,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
        >
          <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.2 }}>
            {config.emoji}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Fallback: letter initial
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const bgColor = '#1A1A28';

  return (
    <View style={containerStyle}>
      {showBorder && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) / 2,
              top: -3,
              left: -3,
              borderColor: activeBorderColor,
              opacity: glowOpacity,
              shadowColor: activeBorderColor,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.letterCircle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: bgColor,
          },
        ]}
      >
        <Text
          style={[
            styles.letterText,
            { fontSize: letterSize, color: '#FFFFFF' },
          ]}
        >
          {initial}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  gradientCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  letterCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  letterText: {
    fontWeight: '700',
  },
});
