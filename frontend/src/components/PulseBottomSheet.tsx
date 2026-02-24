/**
 * PulseBottomSheet — full Source of Pulse breakdown
 * Opens when user taps the PulseStrip on a venue card.
 * Shows tier progress, scout count, top contributor, and CTA to rate.
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
import { PulseData, PulseTier, TIER_CONFIG } from './PulseStrip';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.62;

const TIERS: PulseTier[] = ['dormant', 'stirring', 'charged', 'electric', 'max_pulse', 'source'];
const TIER_THRESHOLDS: Record<PulseTier, number> = {
  dormant:   0,
  stirring:  20,
  charged:   40,
  electric:  60,
  max_pulse: 80,
  source:    100,
};

interface TopContributor {
  username: string;
  rating_count: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  venueName: string;
  pulse: PulseData;
  topContributor?: TopContributor;
  onRatePress?: () => void;
}

export default function PulseBottomSheet({
  visible,
  onClose,
  venueName,
  pulse,
  topContributor,
  onRatePress,
}: Props) {
  const slideAnim  = useRef(new Animated.Value(SHEET_H)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const barAnim    = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const tier = TIER_CONFIG[pulse.tier];
  const pct  = Math.min(pulse.count / pulse.total, 1);
  const remaining = pulse.next_tier_at > 0 ? pulse.next_tier_at - pulse.count : 0;
  const isSource  = pulse.tier === 'source';

  useEffect(() => {
    if (visible) {
      // Sheet slides up
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

      // Bar fills after short delay
      setTimeout(() => {
        Animated.spring(barAnim, {
          toValue: pct,
          tension: 50,
          friction: 10,
          useNativeDriver: false,
        }).start();
      }, 300);

      // Shimmer on the bar
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: false,
        })
      ).start();
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
      shimmerAnim.setValue(0);
    }
  }, [visible]);

  const fillWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEyebrow}>SOURCE OF PULSE</Text>
            <Text style={styles.headerVenue}>{venueName}</Text>
            <Text style={styles.headerSub}>Tonight's collective intelligence</Text>
          </View>

          {/* Count display */}
          <View style={styles.countDisplay}>
            <Text style={[styles.countNumber, { color: tier.color }]}>
              {pulse.count}
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
            {/* Tier tick marks */}
            {TIERS.slice(1).map((t) => {
              const threshold = TIER_THRESHOLDS[t];
              const reached   = pulse.count >= threshold;
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

          {/* Tier icons row */}
          <View style={styles.tiersRow}>
            {TIERS.map((t) => {
              const cfg       = TIER_CONFIG[t];
              const threshold = TIER_THRESHOLDS[t];
              const isActive  = pulse.tier === t;
              const isPassed  = TIERS.indexOf(t) < TIERS.indexOf(pulse.tier);

              return (
                <View key={t} style={styles.tierItem}>
                  <Text style={[
                    styles.tierIcon,
                    !isActive && !isPassed && { opacity: 0.3 },
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

          {/* Status + next milestone */}
          <View style={[styles.statusCard, { borderColor: tier.color + '40' }]}>
            <View style={[styles.statusBadge, { backgroundColor: tier.color + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: tier.color }]}>
                {tier.icon}  {tier.label.toUpperCase()}
              </Text>
            </View>

            {!isSource && remaining > 0 && (
              <Text style={styles.nextMilestone}>
                <Text style={{ color: tier.color, fontWeight: '700' }}>{remaining} scouts</Text>
                {' '}away from {tier.nextLabel} tonight
              </Text>
            )}

            {isSource && (
              <Text style={styles.sourceMessage}>
                👑 This venue reached SOURCE tonight.{'\n'}The community vouches for it.
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* Scout count */}
          <View style={styles.statRow}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statText}>
              <Text style={styles.statBold}>{pulse.count} scouts</Text> contributed tonight
            </Text>
          </View>

          {/* Top contributor */}
          {topContributor && (
            <View style={styles.statRow}>
              <Text style={styles.statIcon}>🏆</Text>
              <Text style={styles.statText}>
                Top contributor:{' '}
                <Text style={styles.statBold}>@{topContributor.username}</Text>
                {' · '}
                {topContributor.rating_count} ratings
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* CTA */}
          <View style={styles.ctaSection}>
            {!isSource ? (
              <>
                <Text style={styles.ctaHint}>
                  Be one of{' '}
                  <Text style={{ color: tier.color, fontWeight: '700' }}>{remaining}</Text>
                  {' '}to push this venue to {tier.nextLabel}
                </Text>
                <Pressable
                  style={[styles.ctaButton, { backgroundColor: tier.color }]}
                  onPress={onRatePress}
                >
                  <Text style={styles.ctaButtonText}>⭐  Rate This Venue</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.sourceAchieved}>
                <Text style={styles.sourceAchievedText}>
                  Source status achieved 👑{'\n'}
                  <Text style={styles.sourceAchievedSub}>
                    This venue's vibe is fully validated by the community.
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
    borderColor: 'rgba(139,92,246,0.2)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
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

  // Header
  header: { gap: 4 },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
    color: 'rgba(139,92,246,0.7)',
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

  // Count
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

  // Bar
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

  // Tiers row
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

  // Status card
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
  nextMilestone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  sourceMessage: {
    fontSize: 14,
    color: '#fbbf24',
    lineHeight: 22,
    textAlign: 'center',
  },

  // Stats
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIcon: { fontSize: 16 },
  statText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  statBold: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },

  // CTA
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
  sourceAchieved: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  sourceAchievedText: {
    fontSize: 15,
    color: '#fbbf24',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  sourceAchievedSub: {
    fontSize: 13,
    color: 'rgba(251,191,36,0.6)',
    fontWeight: '400',
  },
});
