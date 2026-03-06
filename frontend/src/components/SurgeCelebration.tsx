/**
 * SurgeCelebration - The VIIBE brand moment when a venue hits ELECTRIC.
 *
 * NOT confetti. This is a signature: the VIIBE wordmark surges, a city-wide
 * bolt ring expands from the venue out, "ELECTRIC" stamps in hard, crowd count
 * rises. Every device in the city that has this venue open sees it simultaneously.
 *
 * Design language: dark screen flood -> brand red glow ring -> stamp -> fade out.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  venueName: string;
  tapCount: number;
  onDone: () => void;
}

export default function SurgeCelebration({ visible, venueName, tapCount, onDone }: Props) {
  const overlay  = useRef(new Animated.Value(0)).current;
  const ring1    = useRef(new Animated.Value(0)).current;
  const ring2    = useRef(new Animated.Value(0)).current;
  const ring3    = useRef(new Animated.Value(0)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const stamp    = useRef(new Animated.Value(0)).current;
  const stampY   = useRef(new Animated.Value(30)).current;
  const venueFade= useRef(new Animated.Value(0)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    // Reset
    [overlay, ring1, ring2, ring3, logoGlow, stamp, stampY, venueFade, exitFade].forEach(a => a.setValue(0));
    exitFade.setValue(1);
    stampY.setValue(30);

    // Haptic: double heavy punch
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 120);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);

    Animated.sequence([
      // 1. Dark overlay floods in
      Animated.timing(overlay, { toValue: 0.92, duration: 180, useNativeDriver: true }),
      // 2. Three bolt rings expand from center
      Animated.parallel([
        Animated.timing(ring1, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(120),
          Animated.timing(ring2, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(240),
          Animated.timing(ring3, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.timing(logoGlow, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
      // 3. ELECTRIC stamp drops in
      Animated.parallel([
        Animated.spring(stamp, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
        Animated.spring(stampY, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
        Animated.timing(venueFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // 4. Hold
      Animated.delay(1800),
      // 5. Fade out everything
      Animated.timing(exitFade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [visible]);

  if (!visible) return null;

  const ringScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 4] });
  const ringOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] });

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.root, { opacity: exitFade }]}>
        {/* Dark flood */}
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.flood, { opacity: overlay }]} />

        {/* Expanding bolt rings */}
        {[ring1, ring2, ring3].map((r, i) => (
          <Animated.View key={i} style={[styles.ring, {
            transform: [{ scale: ringScale(r) }],
            opacity: ringOpacity(r),
            borderColor: i === 0 ? '#FF3366' : i === 1 ? '#FF6633' : '#FF9933',
          }]} />
        ))}

        {/* Center content */}
        <View style={styles.center}>
          {/* VIIBE wordmark glowing */}
          <Animated.Text style={[styles.viibeLogo, {
            textShadowRadius: logoGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }),
            opacity: logoGlow,
          }]}>
            VIIBE
          </Animated.Text>

          {/* ELECTRIC stamp */}
          <Animated.Text style={[styles.electricStamp, {
            opacity: stamp,
            transform: [{ translateY: stampY }, { scale: stamp.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.05, 1] }) }],
          }]}>
            ELECTRIC
          </Animated.Text>

          {/* Venue name + tap count */}
          <Animated.View style={[styles.venueBlock, { opacity: venueFade }]}>
            <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
            <Text style={styles.tapStat}>{tapCount} taps charged this venue tonight</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flood: { backgroundColor: '#050508' },
  ring: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2,
    shadowColor: '#FF3366', shadowOpacity: 0.8, shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  center: { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  viibeLogo: {
    fontSize: 52, fontWeight: '900', color: '#FF3366',
    letterSpacing: 12,
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
  },
  electricStamp: {
    fontSize: 40, fontWeight: '900', color: '#FFF',
    letterSpacing: 6, textAlign: 'center',
    textShadowColor: '#FF3366',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  venueBlock: { alignItems: 'center', marginTop: 16, gap: 6 },
  venueName: {
    fontSize: 18, fontWeight: '800', color: '#FF9933',
    letterSpacing: 1, textAlign: 'center',
  },
  tapStat: {
    fontSize: 12, color: '#666', fontWeight: '500', textAlign: 'center',
  },
});
