/**
 * SignalDensitySheet — the full evidence breakdown behind a venue's reading.
 * Opens when a user taps the SignalDensityStrip on a venue card.
 *
 * Every line here answers "how much do we actually know about this room right
 * now", and none of them claims anything about the room itself. That is the
 * whole point of the rename. See docs/VOCABULARY.md.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SignalDensityData, DensityTier, DENSITY_CONFIG } from './SignalDensityStrip';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.62;

const TIERS: DensityTier[] = ['none', 'thin', 'partial', 'firm', 'dense', 'saturated'];
const TIER_THRESHOLDS: Record<DensityTier, number> = {
  none:      0,
  thin:      20,
  partial:   40,
  firm:      60,
  dense:     80,
  saturated: 100,
};

interface TopContributor {
  username: string;
  rating_count: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  venueName: string;
  density: SignalDensityData;
  topContributor?: TopContributor;
  onRatePress?: () => void;
}

export default function SignalDensitySheet({
  visible,
  onClose,
  venueName,
  density,
  topContributor,
  onRatePress,
}: Props) {
  const slideAnim   = useRef(new Animated.Value(SHEET_H)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const barAnim     = useRef(new Animated.Value(0)).current;

  const tier = DENSITY_CONFIG[density.tier] ?? DENSITY_CONFIG.none;
  const pct  = Math.min(density.count / density.total, 1);
  const remaining   = density.next_tier_at > 0 ? density.next_tier_at - density.count : 0;
  const isSaturated = density.tier === 'saturated';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 55,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.spring(barAnim, {
          toValue: pct,
          tension: 50,
          friction: 10,
          useNativeDriver: false,
        }).start();
      }, 300);
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_H,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      barAnim.setValue(0);
    }
  }, [visible]);

  const fillWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEyebrow}>SIGNAL DENSITY</Text>
            <Text style={styles.headerVenue}>{venueName}</Text>
            <Text style={styles.headerSub}>How much evidence sits behind tonight's reading</Text>
          </View>

          {/* Count */}
          <View style={styles.countDisplay}>
            <Text style={[styles.countNumber, { color: tier.color }]}>
              {density.count}
            </Text>
            <Text style={styles.countSlash}>/</Text>
            <Text style={styles.countTotal}>100</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  width: fillWidth,
                  backgroundColor: tier.color,
                  shadowColor: tier.glow,
                },
              ]}
            />
            {TIERS.slice(1).map((t) => {
              const threshold = TIER_THRESHOLDS[t];
              const reached   = density.count >= threshold;
              return (
                <View
                  key={t}
                  style={[
                    styles.barTick,
                    { left: `${threshold}%` as any },
                    reached && { backgroundColor: tier.color, opacity: 0.8 },
                  ]}
                />
              );
            })}
          </View>

          {/* Tier ramp */}
          <View style={styles.tiersRow}>
            {TIERS.map((t) => {
              const cfg       = DENSITY_CONFIG[t];
              const threshold = TIER_THRESHOLDS[t];
              const isActive  = density.tier === t;
              const isPassed  = TIERS.indexOf(t) < TIERS.indexOf(density.tier);

              return (
                <View key={t} style={styles.tierItem}>
                  <Text style={[
                    styles.tierIcon,
                    { color: isActive ? cfg.color : 'rgba(255,255,255,0.5)' },
                    !isActive && !isPassed && { opacity: 0.25 },
                  ]}>
                    {cfg.icon}
                  </Text>
                  <Text style={[
                    styles.tierThreshold,
                    isActive && { color: cfg.color, fontWeight: '700' },
                    !isActive && !isPassed && { opacity: 0.3 },
                  ]}>
                    {threshold}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Status and what it means */}
          <View style={[styles.statusCard, { borderColor: tier.color + '40' }]}>
            <View style={[styles.statusBadge, { backgroundColor: tier.color + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: tier.color }]}>
                {tier.icon}  SIGNAL {tier.label.toUpperCase()}
              </Text>
            </View>

            <Text style={styles.statusMeaning}>{tier.meaning}</Text>

            {!isSaturated && remaining > 0 && (
              <Text style={styles.nextMilestone}>
                <Text style={{ color: tier.color, fontWeight: '700' }}>
                  {remaining} more {remaining === 1 ? 'reading' : 'readings'}
                </Text>
                {' '}and tonight's number firms up to {tier.nextLabel.toLowerCase()}.
              </Text>
            )}

            {isSaturated && (
              <Text style={styles.nextMilestone}>
                Tonight's reading here rests on as much evidence as we ever collect.
              </Text>
            )}
          </View>

          {/* The line that keeps the whole screen honest */}
          <View style={styles.clarifier}>
            <Text style={styles.clarifierText}>
              This bar is not the energy. It is how much we know. A room can read
              quiet on saturated signal, and that is a confident quiet.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Who produced it */}
          <View style={styles.statRow}>
            <Text style={styles.statIcon}>{'●'}</Text>
            <Text style={styles.statText}>
              <Text style={styles.statBold}>
                {density.count} {density.count === 1 ? 'reading' : 'readings'}
              </Text>
              {' '}from scouts inside the room in the last 24 hours
            </Text>
          </View>

          {topContributor && (
            <View style={styles.statRow}>
              <Text style={styles.statIcon}>{'●'}</Text>
              <Text style={styles.statText}>
                Most readings tonight:{' '}
                <Text style={styles.statBold}>@{topContributor.username}</Text>
                {' with '}
                {topContributor.rating_count}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* CTA */}
          <View style={styles.ctaSection}>
            {!isSaturated ? (
              <>
                <Text style={styles.ctaHint}>
                  If you are in the room, your reading is the only thing that moves this.
                </Text>
                <Pressable
                  style={[styles.ctaButton, { backgroundColor: tier.color }]}
                  onPress={onRatePress}
                >
                  <Text
                    style={[
                      styles.ctaButtonText,
                      tier.color === '#f1f5f9' && { color: '#0b0b14' },
                    ]}
                  >
                    Add your reading
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.saturatedPanel}>
                <Text style={styles.saturatedPanelText}>
                  Fully covered tonight.{'\n'}
                  <Text style={styles.saturatedPanelSub}>
                    More readings will not make this number more certain.
                  </Text>
                </Text>
              </View>
            )}
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: '#131320',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(34,211,238,0.18)',
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },

  header: { gap: 4 },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
    color: 'rgba(34,211,238,0.7)',
    textTransform: 'uppercase',
  },
  headerVenue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },

  countDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  countNumber: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  countSlash: {
    fontSize: 28,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '300',
  },
  countTotal: {
    fontSize: 28,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '600',
  },

  barTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  barTick: {
    position: 'absolute',
    width: 1,
    height: 12,
    top: -2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
  },

  tiersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  tierItem: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  tierIcon: { fontSize: 16 },
  tierThreshold: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontVariant: ['tabular-nums'],
  },

  statusCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusMeaning: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  nextMilestone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
  },

  clarifier: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(34,211,238,0.35)',
    paddingLeft: 12,
  },
  clarifierText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIcon: {
    fontSize: 8,
    color: 'rgba(34,211,238,0.6)',
  },
  statText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  statBold: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },

  ctaSection: { gap: 14 },
  ctaHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  saturatedPanel: {
    backgroundColor: 'rgba(241,245,249,0.06)',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.18)',
  },
  saturatedPanelText: {
    fontSize: 15,
    color: '#f1f5f9',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  saturatedPanelSub: {
    fontSize: 13,
    color: 'rgba(241,245,249,0.55)',
    fontWeight: '400',
  },
});
