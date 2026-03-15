/**
 * FeatureStoryStrip — Homepage feature discovery guide.
 * Horizontal story strip that educates users about key features.
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');
const CARD_W = W * 0.52;

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
  },
  {
    id:          'crew',
    icon:        '👥',
    title:       'CREW MODE',
    sub:         'Move with your squad',
    desc:        'See where your crew is in real time. Coordinate the night without texting.',
    accentColor: '#3399FF',
    badgeText:   '✨ New',
    isPremium:   false,
  },
  {
    id:          'intel',
    icon:        '◉',
    title:       'VENUE INTEL',
    sub:         'Know before you go',
    desc:        'Crowd size, queue status, and vibe forecast before you leave the house.',
    accentColor: '#00FFAA',
    badgeText:   null,
    isPremium:   false,
  },
];

interface Props {
  onUnlockPress:  () => void;
  onOpenSelector: () => void;
}

export default function FeatureStoryStrip({ onUnlockPress }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setDismissed(true);
    });
  };

  if (dismissed) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>DISCOVER VIIBE</Text>
        <TouchableOpacity onPress={dismiss} style={styles.dismissBtn}>
          <Ionicons name="close" size={14} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
        snapToInterval={CARD_W + 10}
      >
        {FEATURES.map((feature) => (
          <TouchableOpacity
            key={feature.id}
            style={[styles.card, { width: CARD_W }]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[feature.accentColor + '18', feature.accentColor + '06', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.accentBar, { backgroundColor: feature.accentColor }]} />
            <View style={styles.cardContent}>
              <View style={styles.iconRow}>
                <Text style={styles.icon}>{feature.icon}</Text>
                {feature.badgeText && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{feature.badgeText}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.title, { color: feature.accentColor }]}>{feature.title}</Text>
              <Text style={styles.sub}>{feature.sub}</Text>
              <Text style={styles.desc} numberOfLines={2}>{feature.desc}</Text>
              <View style={styles.ctaRow}>
                <Text style={[styles.ctaText, { color: feature.accentColor }]}>EXPLORE</Text>
                <Ionicons name="chevron-forward" size={10} color={feature.accentColor} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.swipeHint}>swipe to explore ›</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10,
  },
  headerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)' },
  dismissBtn: { padding: 4 },
  scroll: { paddingLeft: 16, paddingRight: 8, gap: 10 },
  card: {
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden', flexDirection: 'row',
  },
  accentBar: { width: 3, borderRadius: 2 },
  cardContent: { flex: 1, padding: 14, gap: 4 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  icon: { fontSize: 22 },
  badge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  badgeText: { fontSize: 8, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  title: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  sub: { fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '600' },
  desc: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '500', lineHeight: 14, marginTop: 2 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  ctaText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  swipeHint: { textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.12)', fontWeight: '500', marginTop: 6 },
});
