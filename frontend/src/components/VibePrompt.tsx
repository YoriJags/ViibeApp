/**
 * VibePrompt — Compact connective prompt that bridges features together.
 * Each prompt type has a unique accent color. Dismissable with slide-out animation.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { VibePromptData, VibePromptType } from '../data/demoData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VibePromptProps {
  prompt: VibePromptData;
  onDismiss?: (id: string) => void;
  onPress?: () => void;
}

const PROMPT_COLORS: Record<VibePromptType, { accent: string; gradient: [string, string] }> = {
  badge_proximity:    { accent: '#9933FF', gradient: ['#9933FF', '#6B1FCC'] },
  leaderboard_impact: { accent: '#FFD700', gradient: ['#FFD700', '#FFA500'] },
  cartel_activity:    { accent: '#FF3366', gradient: ['#FF3366', '#FF6B35'] },
  streak_active:      { accent: '#FF9933', gradient: ['#FF9933', '#FF6B35'] },
  clout_milestone:    { accent: '#00D4FF', gradient: ['#00D4FF', '#3399FF'] },
};

export default function VibePrompt({ prompt, onDismiss, onPress }: VibePromptProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateXAnim, {
        toValue: SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.(prompt.id);
    });
  };

  const colors = PROMPT_COLORS[prompt.type] || PROMPT_COLORS.streak_active;

  return (
    <Animated.View
      style={[
        s.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }, { translateX: translateXAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={s.card}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        {/* Left accent bar */}
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.accentBar}
        />

        {/* Content */}
        <View style={s.content}>
          <Text style={s.emoji}>{prompt.emoji}</Text>
          <Text style={s.message} numberOfLines={1}>
            {prompt.message}
          </Text>
        </View>

        {/* Dismiss button */}
        {onDismiss && (
          <TouchableOpacity
            style={s.dismissBtn}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={14} color="#555" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  card: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 35, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    height: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  emoji: {
    fontSize: 16,
  },
  message: {
    fontSize: 12,
    color: '#CCC',
    fontWeight: '500',
    flex: 1,
  },
  dismissBtn: {
    paddingRight: 12,
    paddingLeft: 4,
  },
});
