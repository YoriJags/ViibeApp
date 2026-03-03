import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import FloatingBolt, { BoltOrigin } from './FloatingBolt';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Bolt color maps to venue energy state
const BOLT_COLORS: Record<string, string> = {
  peak: '#FF3366',
  lit: '#FF9933',
  charged: '#9B59B6',
  warming: '#9B59B6',
  chill: '#3399FF',
  quiet: '#555E6E',
};

const GLOW_COLORS: Record<string, [string, string]> = {
  peak: ['rgba(255,51,102,0.3)', 'rgba(255,51,102,0.05)'],
  lit: ['rgba(255,153,51,0.3)', 'rgba(255,153,51,0.05)'],
  charged: ['rgba(155,89,182,0.3)', 'rgba(155,89,182,0.05)'],
  warming: ['rgba(155,89,182,0.25)', 'rgba(155,89,182,0.04)'],
  chill: ['rgba(51,153,255,0.2)', 'rgba(51,153,255,0.04)'],
  quiet: ['rgba(85,94,110,0.15)', 'rgba(85,94,110,0.02)'],
};

interface Bolt {
  id: string;
  origin: BoltOrigin;
  startX: number;
}

interface ReactionTapAreaProps {
  venueId: string;
  userId: string;
  vibeState: string;          // peak / lit / charged / warming / chill / quiet
  reactionsPerMin: number;    // live rate from socket
  activeScouts: number;       // scouts reacting right now
  incomingBoltCount: number;  // increments when another scout reacts — triggers other bolt
  onReact: () => Promise<void>;
}

/**
 * The core reaction mechanic. All scouts tap ⚡ to express live energy.
 * Tap rate across all scouts at the venue IS the energy measurement.
 */
export default function ReactionTapArea({
  venueId,
  userId,
  vibeState,
  reactionsPerMin,
  activeScouts,
  incomingBoltCount,
  onReact,
}: ReactionTapAreaProps) {
  const [bolts, setBolts] = useState<Bolt[]>([]);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;
  const lastTapRef = useRef<number>(0);

  const color = BOLT_COLORS[vibeState] ?? BOLT_COLORS.chill;
  const glowColors = GLOW_COLORS[vibeState] ?? GLOW_COLORS.chill;

  // Pulse glow when other scouts are active
  React.useEffect(() => {
    if (reactionsPerMin > 5) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      glowPulse.setValue(0.6);
    }
  }, [reactionsPerMin]);

  const handleTap = useCallback(async () => {
    // Throttle to 4 taps/sec on the client side
    const now = Date.now();
    if (now - lastTapRef.current < 250) return;
    lastTapRef.current = now;

    // Haptic
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Button bounce
    Animated.sequence([
      Animated.spring(buttonScale, { toValue: 0.88, friction: 8, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    // Spawn bolt at center of button
    const newBolt: Bolt = {
      id: `bolt-${Date.now()}-${Math.random()}`,
      origin: 'self',
      startX: 0,
    };
    setBolts(prev => [...prev, newBolt]);

    // Fire API call (non-blocking)
    onReact().catch(() => {});
  }, [onReact]);

  // Called by each bolt when its animation finishes
  const removeBolt = useCallback((id: string) => {
    setBolts(prev => prev.filter(b => b.id !== id));
  }, []);

  // When incomingBoltCount increments (socket event from another scout), spawn a side bolt
  const prevIncomingRef = useRef(0);
  useEffect(() => {
    if (incomingBoltCount > prevIncomingRef.current) {
      prevIncomingRef.current = incomingBoltCount;
      const side = Math.random() > 0.5 ? -SCREEN_WIDTH / 4 : SCREEN_WIDTH / 4;
      const newBolt: Bolt = {
        id: `other-${Date.now()}-${Math.random()}`,
        origin: 'other',
        startX: side,
      };
      setBolts(prev => [...prev.slice(-12), newBolt]);
    }
  }, [incomingBoltCount]);

  const intensityLabel = () => {
    if (reactionsPerMin >= 60) return 'ELECTRIC';
    if (reactionsPerMin >= 30) return 'GOING OFF';
    if (reactionsPerMin >= 15) return 'HEATING UP';
    if (reactionsPerMin >= 5) return 'LIVE';
    return activeScouts > 0 ? 'SCOUTS HERE' : 'BE FIRST';
  };

  return (
    <View style={styles.wrapper}>
      {/* Floating bolts overlay */}
      <View style={styles.boltsLayer} pointerEvents="none">
        {bolts.map(bolt => (
          <FloatingBolt
            key={bolt.id}
            id={bolt.id}
            color={color}
            origin={bolt.origin}
            startX={bolt.startX}
            onDone={removeBolt}
          />
        ))}
      </View>

      {/* Live count bar */}
      <View style={styles.liveBar}>
        {reactionsPerMin > 0 && (
          <Animated.Text style={[styles.liveLabel, { color, opacity: glowPulse }]}>
            {`⚡ ${reactionsPerMin}/min`}
          </Animated.Text>
        )}
        {activeScouts > 0 && (
          <Text style={styles.scoutCount}>{activeScouts} scout{activeScouts !== 1 ? 's' : ''} reacting</Text>
        )}
      </View>

      {/* Tap button */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleTap}
        style={styles.buttonWrapper}
      >
        <Animated.View style={[styles.buttonOuter, { transform: [{ scale: buttonScale }] }]}>
          {/* Glow ring */}
          <Animated.View
            style={[
              styles.glowRing,
              { borderColor: color, opacity: glowPulse, shadowColor: color },
            ]}
          />

          {/* Button body */}
          <LinearGradient
            colors={[`${color}33`, `${color}11`]}
            style={[styles.button, { borderColor: color }]}
          >
            <Text style={styles.boltEmoji}>⚡</Text>
          </LinearGradient>
        </Animated.View>

        {/* Intensity label */}
        <Text style={[styles.tapLabel, { color }]}>{intensityLabel()}</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  boltsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    height: 20,
  },
  liveLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scoutCount: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 0.5,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  buttonOuter: {
    position: 'relative',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.8,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  boltEmoji: {
    fontSize: 30,
  },
  tapLabel: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
