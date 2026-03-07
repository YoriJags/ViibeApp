/**
 * AuraLevelUp — cinematic Scout Aura level-up ceremony.
 * Fires at most 4 times ever per user (Shadow→Rising→Scene Maker→Hot Scout→VIBE GOD).
 * Liquid color fill, orbital icon, staggered text reveal, perks unlock.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');
const ORBIT_R   = 76;
const ORBIT_N   = 16;

const LEVEL_ICONS: Record<string, string> = {
  // Nightly heat
  warming:  'trending-up',
  hot:      'flame',
  on_fire:  'flash',
  // Legacy permanent levels
  shadow: 'eye-off', rising: 'trending-up', scene_maker: 'star', vibe_god: 'flash',
};
const LEVEL_TAGLINES: Record<string, string> = {
  // Heat levels
  warming:  'You showed up.\nThat\'s where it starts.',
  hot:      'You\'re in the scene.\nHot Nights count +1.',
  on_fire:  'The scene feels you.\nEveryone knows you\'re out.',
  // Legacy
  rising:      'Your radar is live.\nThe scene is watching.',
  scene_maker: 'You set the scene.\nThey follow.',
  vibe_god:    'MAXIMUM VIBE.\nYou are the scene.',
};

interface Props {
  visible: boolean;
  newLevel: string;
  newLabel: string;
  color: string;
  perks: string[];
  onDismiss: () => void;
}

export default function AuraLevelUp({ visible, newLevel, newLabel, color, perks, onDismiss }: Props) {
  const fillA     = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpac  = useRef(new Animated.Value(0)).current;
  const lblOpac   = useRef(new Animated.Value(0)).current;
  const stampSc   = useRef(new Animated.Value(0.3)).current;
  const stampOp   = useRef(new Animated.Value(0)).current;
  const titleOp   = useRef(new Animated.Value(0)).current;
  const titleTY   = useRef(new Animated.Value(24)).current;
  const tagOp     = useRef(new Animated.Value(0)).current;
  const tagTY     = useRef(new Animated.Value(16)).current;
  const perksOp   = useRef(new Animated.Value(0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0.5)).current;

  const isGod = newLevel === 'vibe_god' || newLevel === 'on_fire';

  useEffect(() => {
    if (!visible) return;

    // Reset all
    [fillA, iconScale, iconOpac, lblOpac, stampSc, stampOp, titleOp, titleTY, tagOp, tagTY, perksOp].forEach(a => a.stopAnimation());
    fillA.setValue(0); iconScale.setValue(0); iconOpac.setValue(0); lblOpac.setValue(0);
    stampSc.setValue(0.3); stampOp.setValue(0); titleOp.setValue(0); titleTY.setValue(24);
    tagOp.setValue(0); tagTY.setValue(16); perksOp.setValue(0);

    // Haptic crescendo
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 550);
    if (isGod) {
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 900);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1100);
    }

    // Staggered animation sequence
    Animated.timing(fillA, { toValue: 1, duration: 900, useNativeDriver: false }).start();

    setTimeout(() => Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, tension: 180, friction: 5, useNativeDriver: true }),
      Animated.timing(iconOpac,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(), 320);

    setTimeout(() => Animated.timing(lblOpac, { toValue: 1, duration: 300, useNativeDriver: true }).start(), 550);

    setTimeout(() => Animated.parallel([
      Animated.spring(stampSc, { toValue: 1, tension: 260, friction: 5, useNativeDriver: true }),
      Animated.timing(stampOp, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(), 780);

    setTimeout(() => Animated.parallel([
      Animated.timing(titleOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(titleTY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start(), 1100);

    setTimeout(() => Animated.parallel([
      Animated.timing(tagOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(tagTY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start(), 1500);

    setTimeout(() => Animated.timing(perksOp, { toValue: 1, duration: 500, useNativeDriver: true }).start(), 1950);

    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [visible]);

  // Orbit spin
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.timing(orbitAnim, { toValue: 1, duration: 3500, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [visible]);

  // VIBE GOD pulse glow
  useEffect(() => {
    if (!visible || !isGod) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, isGod]);

  const orbitDeg = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const iconName = (LEVEL_ICONS[newLevel] || 'star') as any;
  const tagline  = LEVEL_TAGLINES[newLevel] || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>

        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000010' }]} />

        {/* Liquid fill — two layers for depth */}
        <Animated.View style={[styles.liquid, {
          height: fillA.interpolate({ inputRange: [0, 1], outputRange: ['0%', '70%'] }),
          backgroundColor: color, opacity: 0.10,
        }]} pointerEvents="none" />
        <Animated.View style={[styles.liquid, {
          height: fillA.interpolate({ inputRange: [0, 1], outputRange: ['0%', '42%'] }),
          backgroundColor: color, opacity: 0.07,
        }]} pointerEvents="none" />

        {/* Subtle grid lines */}
        <View style={styles.gridOverlay} pointerEvents="none">
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[styles.gridLine, { top: `${i * 14}%` as any }]} />
          ))}
        </View>

        <View style={styles.stage}>
          {/* Orbital icon stage */}
          <View style={styles.iconStage}>
            <Animated.View style={[styles.orbitRing, {
              transform: [{ rotate: orbitDeg }],
              borderColor: color,
            }]}>
              {Array.from({ length: ORBIT_N }).map((_, i) => {
                const rad = ((i / ORBIT_N) * 360 * Math.PI) / 180;
                return (
                  <View key={i} style={[styles.orbitDot, {
                    transform: [{ translateX: ORBIT_R * Math.cos(rad) }, { translateY: ORBIT_R * Math.sin(rad) }],
                    backgroundColor: color,
                    width:  i % 4 === 0 ? 8 : 5,
                    height: i % 4 === 0 ? 8 : 5,
                    borderRadius: i % 4 === 0 ? 4 : 2.5,
                    opacity: i % 4 === 0 ? 1 : 0.35,
                  }]} />
                );
              })}
            </Animated.View>

            {/* Icon glow */}
            <Animated.View style={[styles.iconGlow, {
              backgroundColor: color,
              opacity: isGod
                ? glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.15, 0.38] })
                : 0.20,
            }]} />

            {/* Icon — 3D sphere with specular highlight */}
            <Animated.View style={[{ transform: [{ perspective: 400 }, { rotateX: '15deg' }, { scale: iconScale }], opacity: iconOpac }]}>
              <LinearGradient
                colors={[color + 'EE', color + '66', color + '22']}
                style={styles.iconCircle}
                start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
              >
                {/* Sphere specular highlight — top-left bright spot */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sphereShine}
                  pointerEvents="none"
                />
                <Animated.View style={isGod ? { opacity: glowAnim } : {}}>
                  <Ionicons name={iconName} size={52} color="#FFF" />
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Label */}
          <Animated.Text style={[styles.smallLabel, { opacity: lblOpac }]}>
            SCOUT AURA
          </Animated.Text>

          {/* LEVEL UP stamp */}
          <Animated.Text style={[styles.levelUpStamp, {
            color,
            transform: [{ scale: stampSc }],
            opacity: stampOp,
          }]}>
            LEVEL UP
          </Animated.Text>

          {/* Tier name */}
          <Animated.Text style={[styles.tierName, {
            color,
            opacity: titleOp,
            transform: [{ translateY: titleTY }],
          }]}>
            {newLabel.toUpperCase()}
          </Animated.Text>

          {/* Tagline */}
          {tagline.length > 0 && (
            <Animated.Text style={[styles.tagline, {
              opacity: tagOp,
              transform: [{ translateY: tagTY }],
            }]}>
              {tagline}
            </Animated.Text>
          )}

          {/* Divider */}
          <Animated.View style={[styles.divider, { backgroundColor: color + '40', opacity: perksOp }]} />

          {/* Perks */}
          {perks.length > 0 && (
            <Animated.View style={{ opacity: perksOp }}>
              <Text style={styles.perksTitle}>PERKS UNLOCKED</Text>
              {perks.map((perk, i) => (
                <View key={i} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={14} color={color} />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>

        <Animated.Text style={[styles.tapHint, { opacity: perksOp }]}>
          tap anywhere to continue
        </Animated.Text>

      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  liquid:       { position: 'absolute', bottom: 0, left: 0, right: 0 },
  gridOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gridLine:     { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFFFFF06' },
  stage:        { alignItems: 'center', paddingHorizontal: 36, width: W },
  iconStage:    { width: ORBIT_R * 2 + 40, height: ORBIT_R * 2 + 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  orbitRing:    { position: 'absolute', width: ORBIT_R * 2, height: ORBIT_R * 2, borderRadius: ORBIT_R, borderWidth: 0.5 },
  orbitDot:     { position: 'absolute', borderRadius: 4 },
  iconGlow:     { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  iconCircle:   { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  sphereShine:  { position: 'absolute', top: 6, left: 8, width: 40, height: 28, borderRadius: 20 },
  smallLabel:   { fontSize: 10, color: '#3A3A4E', fontWeight: '700', letterSpacing: 2.5, marginBottom: 12 },
  levelUpStamp: { fontSize: 40, fontWeight: '900', letterSpacing: 5, marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  tierName:     { fontSize: 30, fontWeight: '900', letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  tagline:      { fontSize: 16, color: '#777', fontWeight: '500', textAlign: 'center', lineHeight: 26, marginBottom: 22 },
  divider:      { width: W * 0.55, height: 1, marginBottom: 20 },
  perksTitle:   { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 2, marginBottom: 12, textAlign: 'center' },
  perkRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  perkText:     { fontSize: 13, color: '#777', fontWeight: '500', flex: 1 },
  tapHint:      { position: 'absolute', bottom: 52, fontSize: 11, color: '#333', fontWeight: '500', letterSpacing: 1 },
});
