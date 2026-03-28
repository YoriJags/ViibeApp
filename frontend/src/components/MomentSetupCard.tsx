/**
 * MomentSetupCard
 *
 * One-time dismissible card that teaches scouts the three Moment gestures.
 * Shown automatically after a scout's first check-in at a venue.
 * Persisted via AsyncStorage — never shown again after dismiss.
 *
 * iOS:     Back Tap setup (deep links to iOS Accessibility settings)
 *          + Shake + Raise to face
 * Android: Shake + Raise to face (Back Tap not available)
 *
 * Design: frosted glass sheet over the venue screen. Premium, not tutorial-y.
 * Three gesture rows with live demo icons. Single CTA. Skip link.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Platform, Linking, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'viibe_moment_setup_seen';
const { height: H } = Dimensions.get('window');

const ACCENT   = '#6655FF';
const GOLD     = '#C9A84C';

// ─── Gesture row data ─────────────────────────────────────────────────────────

interface GestureRow {
  icon:    keyof typeof Ionicons.glyphMap;
  color:   string;
  label:   string;
  sub:     string;
  iosOnly?: boolean;
}

const GESTURES: GestureRow[] = [
  {
    icon:    'phone-portrait-outline',
    color:   ACCENT,
    label:   'Shake',
    sub:     'Sharp wrist flick — works anywhere, eyes-free',
  },
  {
    icon:    'eye-outline',
    color:   '#FF3366',
    label:   'Raise to face',
    sub:     'Lift your phone like you\'re checking the time',
  },
  {
    icon:    'finger-print-outline',
    color:   GOLD,
    label:   'Back tap',
    sub:     'Double tap the back of your phone — iOS only',
    iosOnly: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Override visibility — useful for testing. Normally self-manages via AsyncStorage. */
  forceVisible?: boolean;
  onDismiss?: () => void;
}

export default function MomentSetupCard({ forceVisible, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  const sheetY    = useSharedValue(H);
  const bgOpacity = useSharedValue(0);

  // ── Check if already seen ─────────────────────────────────────────────────
  useEffect(() => {
    if (forceVisible) { show(); return; }
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (!val) show();
    });
  }, [forceVisible]);

  const show = useCallback(() => {
    setVisible(true);
    bgOpacity.value = withTiming(1, { duration: 280 });
    sheetY.value    = withSpring(0, { stiffness: 160, damping: 22 });
  }, []);

  const dismiss = useCallback(() => {
    bgOpacity.value = withTiming(0, { duration: 260 });
    sheetY.value    = withTiming(H, { duration: 320, easing: Easing.in(Easing.ease) });
    AsyncStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 330);
  }, [onDismiss]);

  // ── Back Tap setup — deep links to iOS Accessibility ─────────────────────
  const openBackTapSetup = useCallback(() => {
    // Opens directly to Accessibility on iOS. User then navigates:
    // Touch → Back Tap → Double Tap → Open URL → viibe://moment
    Linking.openURL('App-Prefs:ACCESSIBILITY').catch(() =>
      Linking.openURL('app-settings:')
    );
  }, []);

  // ── Animated styles ───────────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  if (!visible) return null;

  const gestures = Platform.OS === 'ios'
    ? GESTURES
    : GESTURES.filter(g => !g.iosOnly);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>

      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, overlayStyle]} />

      {/* Sheet */}
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <BlurView intensity={70} tint="dark" style={styles.sheet}>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[ACCENT + '33', ACCENT + '11']}
              style={styles.iconCircle}
            >
              <Ionicons name="flash" size={22} color={ACCENT} />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={styles.title}>Feel it. Fire it.</Text>
              <Text style={styles.subtitle}>
                Three ways to signal a Moment — no screen required.
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Gesture rows */}
          {gestures.map((g, i) => (
            <View key={g.label} style={[styles.row, i < gestures.length - 1 && styles.rowBorder]}>
              <LinearGradient
                colors={[g.color + '28', g.color + '0A']}
                style={[styles.rowIcon, { borderColor: g.color + '44' }]}
              >
                <Ionicons name={g.icon} size={20} color={g.color} />
              </LinearGradient>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: g.color }]}>{g.label}</Text>
                <Text style={styles.rowSub}>{g.sub}</Text>
              </View>
              {/* Back Tap: show setup link on iOS */}
              {g.iosOnly && Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.setupBtn, { borderColor: GOLD + '55' }]}
                  onPress={openBackTapSetup}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.setupBtnText, { color: GOLD }]}>SET UP</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={styles.divider} />

          {/* What happens */}
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.35)" />
            <Text style={styles.infoText}>
              When 5+ scouts feel it simultaneously — a <Text style={{ color: ACCENT }}>Moment Locks</Text> and the whole venue erupts.
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.cta} onPress={dismiss} activeOpacity={0.85}>
            <LinearGradient
              colors={[ACCENT, '#8844FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>GOT IT — I'M READY</Text>
              <Ionicons name="flash" size={14} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity onPress={dismiss} style={styles.skip} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.skipText}>remind me later</Text>
          </TouchableOpacity>

        </BlurView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheetWrap: {
    position:       'absolute',
    bottom:         0,
    left:           0,
    right:          0,
  },
  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    overflow:    'hidden',
    paddingBottom: 40,
    borderWidth:   1,
    borderColor:   'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    20,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 20,
    gap:            14,
    marginBottom:   18,
  },
  iconCircle: {
    width:          48,
    height:         48,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    ACCENT + '44',
    flexShrink:     0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize:      18,
    fontWeight:    '800',
    color:         '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom:  4,
  },
  subtitle: {
    fontSize:   12,
    color:      'rgba(255,255,255,0.45)',
    lineHeight: 17,
    fontWeight: '500',
  },
  divider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 20,
    marginBottom:    16,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    gap:               14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowIcon: {
    width:          44,
    height:         44,
    borderRadius:   14,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  rowText: {
    flex:    1,
    gap:     3,
  },
  rowLabel: {
    fontSize:      14,
    fontWeight:    '800',
    letterSpacing: 0.5,
  },
  rowSub: {
    fontSize:   12,
    color:      'rgba(255,255,255,0.4)',
    lineHeight: 16,
    fontWeight: '500',
  },
  setupBtn: {
    borderWidth:     1,
    borderRadius:    8,
    paddingHorizontal: 10,
    paddingVertical:   5,
    flexShrink:      0,
  },
  setupBtnText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.5,
  },
  infoRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingHorizontal: 20,
    gap:               10,
    marginBottom:      20,
  },
  infoText: {
    flex:       1,
    fontSize:   12,
    color:      'rgba(255,255,255,0.35)',
    lineHeight: 17,
    fontWeight: '500',
  },
  cta: {
    marginHorizontal: 20,
    borderRadius:     16,
    overflow:         'hidden',
    marginBottom:     12,
  },
  ctaGradient: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   16,
    gap:               8,
  },
  ctaText: {
    fontSize:      13,
    fontWeight:    '900',
    color:         '#FFFFFF',
    letterSpacing: 1.5,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    fontSize:      11,
    color:         'rgba(255,255,255,0.25)',
    letterSpacing: 1,
    fontWeight:    '500',
  },
});
