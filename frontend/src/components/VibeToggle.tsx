import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type EnergyLevel = 'chill' | 'popping' | 'electric';

interface VibeToggleOption {
  value: EnergyLevel;
  label: string;
  icon: string;
  color: string;
}

interface VibeToggleProps {
  options: VibeToggleOption[];
  selected: EnergyLevel | null;
  onSelect: (value: EnergyLevel) => void;
}

const VibeToggle: React.FC<VibeToggleProps> = ({ options, selected, onSelect }) => {
  // Animation values for electric effect
  const electricPulse = useRef(new Animated.Value(1)).current;
  const electricGlow = useRef(new Animated.Value(0)).current;
  const electricRotate = useRef(new Animated.Value(0)).current;
  const electricShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selected === 'electric') {
      // Start intense pulse animation
      Animated.loop(
        Animated.parallel([
          // Pulse scale
          Animated.sequence([
            Animated.timing(electricPulse, {
              toValue: 1.3,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(electricPulse, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
          // Glow intensity
          Animated.sequence([
            Animated.timing(electricGlow, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(electricGlow, {
              toValue: 0.4,
              duration: 400,
              useNativeDriver: false,
            }),
          ]),
          // Rotation wiggle
          Animated.sequence([
            Animated.timing(electricRotate, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(electricRotate, {
              toValue: -1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(electricRotate, {
              toValue: 0.5,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(electricRotate, {
              toValue: -0.5,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(electricRotate, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();

      // Random shake effect
      const shakeLoop = () => {
        Animated.sequence([
          Animated.timing(electricShake, {
            toValue: Math.random() * 4 - 2,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(electricShake, {
            toValue: Math.random() * 4 - 2,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(electricShake, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.delay(200 + Math.random() * 300),
        ]).start(() => {
          if (selected === 'electric') {
            shakeLoop();
          }
        });
      };
      shakeLoop();
    } else {
      // Reset animations
      electricPulse.setValue(1);
      electricGlow.setValue(0);
      electricRotate.setValue(0);
      electricShake.setValue(0);
    }
  }, [selected]);

  const rotateInterpolate = electricRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  const glowInterpolate = electricGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 51, 102, 0.2)', 'rgba(255, 51, 102, 0.9)'],
  });

  const shadowRadiusInterpolate = electricGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 25],
  });

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected === option.value;
        const isElectric = option.value === 'electric' && isSelected;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionCard,
              isSelected && {
                borderColor: option.color,
                backgroundColor: option.color + '20',
              },
            ]}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.7}
          >
            {/* Electric glow background */}
            {isElectric && (
              <Animated.View
                style={[
                  styles.electricGlowOuter,
                  {
                    backgroundColor: glowInterpolate,
                    opacity: electricGlow,
                  },
                ]}
              />
            )}

            {/* Electric spark effects */}
            {isElectric && (
              <>
                <Animated.View
                  style={[
                    styles.spark,
                    styles.spark1,
                    { 
                      opacity: electricGlow,
                      transform: [{ scale: electricPulse }]
                    },
                  ]}
                >
                  <Text style={styles.sparkEmoji}>⚡</Text>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.spark,
                    styles.spark2,
                    { 
                      opacity: electricGlow,
                      transform: [{ scale: electricPulse }]
                    },
                  ]}
                >
                  <Text style={styles.sparkEmoji}>⚡</Text>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.spark,
                    styles.spark3,
                    { 
                      opacity: electricGlow,
                      transform: [{ scale: electricPulse }]
                    },
                  ]}
                >
                  <Text style={styles.sparkEmojiSmall}>✨</Text>
                </Animated.View>
              </>
            )}

            {/* Icon with animation */}
            <Animated.View
              style={[
                isElectric && {
                  transform: [
                    { scale: electricPulse },
                    { rotate: rotateInterpolate },
                    { translateX: electricShake },
                  ],
                },
              ]}
            >
              {isElectric && (
                <Animated.View
                  style={[
                    styles.iconGlow,
                    {
                      opacity: electricGlow,
                      shadowRadius: shadowRadiusInterpolate,
                    },
                  ]}
                />
              )}
              <Ionicons
                name={option.icon as any}
                size={isElectric ? 40 : 32}
                color={isSelected ? option.color : '#666'}
                style={isElectric ? styles.electricIcon : undefined}
              />
            </Animated.View>

            <Text
              style={[
                styles.optionLabel,
                isSelected && { color: option.color },
                isElectric && styles.electricLabel,
              ]}
            >
              {option.label}
            </Text>

            {/* Peak Energy Badge */}
            {isElectric && (
              <Animated.View
                style={[
                  styles.peakBadge,
                  { opacity: electricGlow, transform: [{ scale: electricPulse }] },
                ]}
              >
                <Text style={styles.peakBadgeText}>PEAK</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  electricLabel: {
    fontWeight: '800',
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  electricGlowOuter: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 30,
  },
  iconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF336640',
    top: -10,
    left: -10,
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
  },
  electricIcon: {
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  spark: {
    position: 'absolute',
  },
  spark1: {
    top: 5,
    right: 5,
  },
  spark2: {
    bottom: 20,
    left: 5,
  },
  spark3: {
    top: '50%',
    right: 2,
  },
  sparkEmoji: {
    fontSize: 14,
  },
  sparkEmojiSmall: {
    fontSize: 10,
  },
  peakBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF3366',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  peakBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
});

export default VibeToggle;
