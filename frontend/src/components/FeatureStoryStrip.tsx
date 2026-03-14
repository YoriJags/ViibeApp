/**
 * FeatureStoryStrip — Homepage feature discovery guide.
 *
 * A horizontal story strip below the header that educates users about
 * key features with social proof nudges ("61% of scouts use REACTOR").
 *
 * Each card is a tap-to-explore feature highlight. New/trending features
 * show a hot badge. VIBE+ features show a lock.
 *
 * Dismissed per-session (not persisted — shows every app open so new users
 * always see it, returning users get the nudge when checking in).
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import { SKINS } from './skins/skinTypes';

const { width: W } = Dimensions.get('window');
const CARD_W = W * 0.52;

// ─── Feature definitions ─────────────────────────────────────────────────────

const FEATURES = [
  {
    id:          'reactor',
    icon:        '⚡',
    title:       'REACTOR',
    sub:         'Tap to charge the venue',
    desc:        'Every tap builds the vibe score. Get there first and earn scout rank.',
    accentColor: '#FF3366',
    badgeText:   '🔥 Most used',
    isPremium:   false,
    route:       null,
    skinId:      'reactor',
  },
  {
    id:          'skins',
    icon:        '✦',
    title:       'REACTOR SKINS',
    sub:         '8 ways to see the scene',
    desc:        'Switch your energy display. AURA, TERRAIN, RADAR and more.',
    accentColor: '#CC44FF',
    badgeText:   '✨ New',
    isPremium:   false,
    route:       null,
    skinId:      null,
  },
  {
    id:          'oscillator',
    icon:        '〰',
    title:       'SCENE FREQUENCY',
    sub:         'Live energy waveform',
    desc:        'See the venue\'s energy as a live frequency. Real BPM, real crowd.',
    accentColor: '#3399FF',
    badgeText:   '◆ VIBE+',
    isPremium:   true,
    route:       null,
    skinId:      'wave',
  },
  {
    id:          'torch',
    icon:        '🔦',
    title:       'TORCH IGNITE',
    sub:         'Sync your light with the crowd',
    desc:        'Hold IGNITE with other scouts to fire a synchronized flashlight moment.',
    accentColor: '#FFD700',
    badgeText:   '🔥 Trending',
    isPremium:   false,
    route:       null,
    skinId:      null,
  },
  {
    id:          'streak',
    icon:        '🔥',
    title:       'NIGHT STREAK',
    sub:         'Back-to-back nights out',
    desc:        'Keep showing up. Hit 7 nights and go FULLY LIT for a clout bonus.',
    accentColor: '#FF8C00',
    badgeText:   null,
    isPremium:   false,
    route:       null,
    skinId:      null,
  },
  {
    id:          'radar',
    icon:        '◉',
    title:       'RADAR SKIN',
    sub:         'Scout activity sweep',
    desc:        'Watch other scouts appear as blips on a live radar as you charge.',
    accentColor: '#00FFAA',
    badgeText:   '◆ VIBE+',
    isPremium:   true,
    route:       null,
    skinId:      'radar',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onUnlockPress:    () => void;
  onOpenSelector:   () => void;
}

export default function FeatureStoryStrip({ onUnlockPress, onOpenSelector }: Props) {
  const { selectedSkin, setSkin } = useVibeStore();
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setDismissed(true);
    });
  };

  if (dismissed) return null;

  const handleCardPress = (feature: typeof FEATURES[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (feature.isPremium) {
      onUnlockPress();
      return;
    }
    if (feature.id === 'skins') {
      onOpenSelector();
      return;
    }
    if (feature.skinId) {
      setSkin(feature.skinId as any);
      onOpenSelector();
    }
  };

  // Social proof: get usage% for skin-related features
  const getUsage = (featureId: string) => {
    const skin = SKINS.find(s => s.id === featureId);
    return skin?.usagePercent ?? null;
  };

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>DISCOVER VIIBE</Text>
        <TouchableOpacity onPress={dismiss} style={styles.dismissBtn}>
          <Ionicons name="close" size={14} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
      </View>

      {/* Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
        snapToInterval={CARD_W + 10}
      >
        {FEATURES.map((feature) => {
          const usage = getUsage(feature.id);
          const isActiveSkin = selectedSkin === feature.skinId;

          return (
            <TouchableOpacity
              key={feature.id}
              style={[styles.card, { width: CARD_W }]}
              onPress={() => handleCardPress(feature)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[feature.accentColor + '18', feature.accentColor + '06', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Left accent bar */}
              <View style={[styles.accentBar, { backgroundColor: feature.accentColor }]} />

              <View style={styles.cardContent}>
                {/* Icon + badge row */}
                <View style={styles.iconRow}>
                  <Text style={styles.icon}>{feature.icon}</Text>
                  {feature.badgeText && (
                    <View style={[styles.badge, { backgroundColor: feature.isPremium ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)' }]}>
                      <Text style={[styles.badgeText, feature.isPremium && { color: '#FFD700' }]}>
                        {feature.badgeText}
                      </Text>
                    </View>
                  )}
                  {isActiveSkin && (
                    <View style={[styles.badge, { backgroundColor: feature.accentColor + '30' }]}>
                      <Text style={[styles.badgeText, { color: feature.accentColor }]}>ACTIVE</Text>
                    </View>
                  )}
                </View>

                {/* Text */}
                <Text style={[styles.title, { color: feature.accentColor }]}>{feature.title}</Text>
                <Text style={styles.sub}>{feature.sub}</Text>
                <Text style={styles.desc} numberOfLines={2}>{feature.desc}</Text>

                {/* Social proof */}
                {usage !== null && (
                  <Text style={styles.usage}>{usage}% of scouts use this</Text>
                )}

                {/* CTA */}
                <View style={styles.ctaRow}>
                  <Text style={[styles.ctaText, { color: feature.accentColor }]}>
                    {feature.isPremium ? 'UNLOCK' : feature.skinId ? 'TRY IT' : 'EXPLORE'}
                  </Text>
                  <Ionicons name="chevron-forward" size={10} color={feature.accentColor} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Swipe hint on first render */}
      <Text style={styles.swipeHint}>swipe to explore ›</Text>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.25)',
  },
  dismissBtn: { padding: 4 },

  scroll: { paddingLeft: 16, paddingRight: 8, gap: 10 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: { width: 3, borderRadius: 2 },
  cardContent: {
    flex: 1,
    padding: 14,
    gap: 4,
  },

  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  icon:    { fontSize: 22 },
  badge:   { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 8, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },

  title:   { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  sub:     { fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '600' },
  desc:    { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '500', lineHeight: 14, marginTop: 2 },
  usage:   { fontSize: 9, color: 'rgba(255,255,255,0.20)', fontWeight: '600', marginTop: 2 },

  ctaRow:  { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  ctaText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  swipeHint: {
    textAlign: 'center', fontSize: 9,
    color: 'rgba(255,255,255,0.12)',
    fontWeight: '500', marginTop: 6,
  },
});
