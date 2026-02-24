/**
 * TheWave — live city energy visualizer
 * 7 animated bars that pulse to the city's collective activity.
 * Tap to reveal the energy label and live spot count.
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

const BAR_WIDTHS = [3, 4, 3, 5, 3, 4, 3];
const BAR_GAPS   = [7, 5, 8, 5, 7, 5, 0];
// Base duration per bar — varied so they drift out of phase naturally
const BAR_BASE_DUR = [920, 670, 1140, 750, 980, 710, 1060];

function waveColor(energy: number) {
  if (energy >= 80) return '#FF3366';
  if (energy >= 60) return '#FF9933';
  if (energy >= 30) return '#9933FF';
  return '#3399FF';
}

function energyLabel(energy: number) {
  if (energy >= 80) return 'ELECTRIC';
  if (energy >= 60) return 'POPPING';
  if (energy >= 30) return 'BUILDING';
  return 'QUIET';
}

interface Props {
  energy: number;    // 0–100 from cityPulse.pulse_score
  spotsLive: number; // count of venues with score ≥ 60
  cityName: string;
}

export default function TheWave({ energy, spotsLive, cityName }: Props) {
  // 7 individual refs — rules of hooks require fixed call order
  const b0 = useRef(new Animated.Value(0.22)).current;
  const b1 = useRef(new Animated.Value(0.38)).current;
  const b2 = useRef(new Animated.Value(0.18)).current;
  const b3 = useRef(new Animated.Value(0.45)).current;
  const b4 = useRef(new Animated.Value(0.24)).current;
  const b5 = useRef(new Animated.Value(0.32)).current;
  const b6 = useRef(new Animated.Value(0.16)).current;

  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const color = waveColor(energy);

  // Speed factor: high energy = fast bars, low energy = slow lazy pulse
  const speedFactor = energy >= 80 ? 0.6 : energy >= 60 ? 0.85 : energy >= 30 ? 1.3 : 2.0;
  // Scale range grows with energy: quiet bars barely move, electric bars slam
  const minScale = 0.12 + (energy / 100) * 0.18;
  const maxScale = 0.32 + (energy / 100) * 0.68;

  useEffect(() => {
    const barVals = [b0, b1, b2, b3, b4, b5, b6];
    const anims: Animated.CompositeAnimation[] = [];

    // Clear any pending stagger timeouts
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];

    barVals.forEach((bar, i) => {
      const dur = BAR_BASE_DUR[i] * speedFactor;
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: maxScale, duration: dur * 0.5, useNativeDriver: true }),
          Animated.timing(bar, { toValue: minScale, duration: dur * 0.5, useNativeDriver: true }),
        ])
      );
      anims.push(anim);
      // Stagger starts so bars begin at different points in their cycle
      const t = setTimeout(() => anim.start(), i * 90);
      timeoutRefs.current.push(t);
    });

    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      anims.forEach(a => a.stop());
    };
  }, [energy]);

  const handlePress = () => {
    if (tooltipVisible) return;
    setTooltipVisible(true);
    Animated.sequence([
      Animated.timing(tooltipOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(tooltipOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setTooltipVisible(false));
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.85}
      hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
    >
      <View style={styles.waveRow}>
        {[b0, b1, b2, b3, b4, b5, b6].map((bar, i) => (
          <React.Fragment key={i}>
            <Animated.View
              style={[
                styles.bar,
                {
                  width: BAR_WIDTHS[i],
                  backgroundColor: color,
                  shadowColor: color,
                  transform: [{ scaleY: bar }],
                },
              ]}
            />
            {i < 6 && <View style={{ width: BAR_GAPS[i] }} />}
          </React.Fragment>
        ))}
      </View>

      {tooltipVisible && (
        <Animated.View style={[styles.tooltip, { borderColor: color + '40', opacity: tooltipOpacity }]}>
          <Text style={[styles.tooltipEnergy, { color }]}>{energyLabel(energy)}</Text>
          <Text style={styles.tooltipSub}>
            {cityName} · {spotsLive} {spotsLive === 1 ? 'spot' : 'spots'} live
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  bar: {
    height: 42,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  tooltip: {
    position: 'absolute',
    top: -52,
    backgroundColor: 'rgba(10,10,15,0.96)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  tooltipEnergy: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  tooltipSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
});
