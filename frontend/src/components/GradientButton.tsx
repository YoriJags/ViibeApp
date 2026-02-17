/**
 * GradientButton - Premium button with gradient background + press animation
 * Scale down on press + optional shimmer sweep
 */
import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  Animated,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { gradients, borderRadius, typography, neonGlow } from '../theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  gradient?: readonly string[];
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  glowColor?: string;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  gradient = gradients.neonPink,
  icon,
  loading = false,
  disabled = false,
  size = 'medium',
  style,
  textStyle,
  glowColor,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 40,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const sizeConfig = {
    small: { paddingVertical: 10, paddingHorizontal: 16, fontSize: typography.fontSize.sm, iconSize: 14 },
    medium: { paddingVertical: 14, paddingHorizontal: 24, fontSize: typography.fontSize.lg, iconSize: 18 },
    large: { paddingVertical: 18, paddingHorizontal: 32, fontSize: typography.fontSize.xl, iconSize: 22 },
  };

  const config = sizeConfig[size];
  const glowStyle = glowColor ? neonGlow(glowColor, 'medium') : {};

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, glowStyle, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={disabled ? ['#333', '#2A2A2A'] : (gradient as string[])}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            {
              paddingVertical: config.paddingVertical,
              paddingHorizontal: config.paddingHorizontal,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={config.iconSize}
                  color={disabled ? '#666' : '#FFF'}
                  style={styles.icon}
                />
              )}
              <Text
                style={[
                  styles.text,
                  { fontSize: config.fontSize },
                  disabled && styles.disabledText,
                  textStyle,
                ]}
              >
                {title}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  gradient: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledText: {
    color: '#666',
  },
});

export default GradientButton;
