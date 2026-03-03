/**
 * VibeDNACard — User's vibe fingerprint derived from rating history.
 * Shows on the profile screen between the Stats Grid and Streak Card.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';
import VibePlusModal from './VibePlusModal';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_MAX_WIDTH = SCREEN_WIDTH - 140; // room for label + score

const BAR_COLORS: Record<string, string> = {
  club:        '#FF3366',
  lounge:      '#9933FF',
  bar:         '#FF9933',
  restaurant:  '#00E676',
  concert:     '#FFD700',
  block_party: '#FF3366',
  rave:        '#FF3366',
  event:       '#00D4FF',
  church:      '#00E676',
  other:       '#3399FF',
};

const NIGHT_STYLE_ICONS: Record<string, string> = {
  early_bird:    '🌅',
  midnight_crew: '🌙',
  night_owl:     '🦉',
};

const DOMINANT_EMOJIS: Record<string, string> = {
  club:        '⚡',
  lounge:      '🍸',
  bar:         '🍺',
  restaurant:  '🍽️',
  concert:     '🎤',
  block_party: '🎉',
  rave:        '🔊',
  event:       '🎯',
  church:      '⛪',
  other:       '✨',
};

interface VibeDNACardProps {
  userId: string;
}

export default function VibeDNACard({ userId }: VibeDNACardProps) {
  const { vibeDNA, fetchVibeDNA, isDemoMode, isVibePlus } = useVibeStore();
  const [narrative, setNarrative] = useState<{ narrative: string; vibe_archetype: string } | null>(null);
  const [showVibePlus, setShowVibePlus] = useState(false);

  useEffect(() => {
    if (userId) fetchVibeDNA(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (isDemoMode) {
      setNarrative({ narrative: "You are a late-night creature who peaks when Amapiano drops. You thrive in VIP energy but aren't precious about it — your scene is VI after midnight, always.", vibe_archetype: "The Club Connoisseur" });
      return;
    }
    fetch(`${API_URL}/api/users/${userId}/dna-narrative`)
      .then(r => r.json())
      .then(d => { if (d.narrative) setNarrative(d); })
      .catch(() => {});
  }, [userId, isDemoMode]);

  if (!vibeDNA) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#FF3366" />
        <Text style={styles.loadingText}>Computing your DNA...</Text>
      </View>
    );
  }

  if (vibeDNA.insufficient_data) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>🧬</Text>
        <Text style={styles.emptyTitle}>Your Vibe DNA is loading</Text>
        <Text style={styles.emptySubtitle}>Rate 3+ venues and we'll map your taste fingerprint</Text>
      </View>
    );
  }

  const dominantEmoji = DOMINANT_EMOJIS[vibeDNA.dominant_type] ?? '✨';
  const dominantLabel = vibeDNA.dominant_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const nightIcon = NIGHT_STYLE_ICONS[vibeDNA.night_style] ?? '🌙';

  return (
    <>
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dnaIcon}>🧬</Text>
          <Text style={styles.title}>VIBE DNA</Text>
        </View>
        <Text style={styles.headerSub}>Your taste fingerprint</Text>
      </View>

      {/* Dominant scene badge */}
      <View style={styles.dominantBadge}>
        <Text style={styles.dominantEmoji}>{dominantEmoji}</Text>
        <View>
          <Text style={styles.dominantLabel}>Your Dominant Scene</Text>
          <Text style={styles.dominantValue}>{dominantLabel}s</Text>
        </View>
      </View>

      {/* Night style chip */}
      <View style={styles.nightStyleChip}>
        <Text style={styles.nightStyleIcon}>{nightIcon}</Text>
        <Text style={styles.nightStyleText}>{vibeDNA.night_style_label}</Text>
      </View>

      {/* Affinity bars */}
      <View style={styles.barsContainer}>
        {vibeDNA.affinities.map((aff) => {
          const barColor = BAR_COLORS[aff.venue_type] ?? '#3399FF';
          const barWidth = Math.max(8, (aff.score / 100) * BAR_MAX_WIDTH);
          const typeLabel = aff.venue_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
          return (
            <View key={aff.venue_type} style={styles.barRow}>
              <Text style={styles.barTypeLabel} numberOfLines={1}>{typeLabel}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: barWidth, backgroundColor: barColor }]} />
              </View>
              <Text style={[styles.barScore, { color: barColor }]}>{aff.score}</Text>
            </View>
          );
        })}
      </View>

      {/* AI Narrative — Vibe+ gated */}
      {narrative && isVibePlus() && (
        <View style={styles.narrativeBox}>
          {narrative.vibe_archetype && (
            <Text style={styles.archetypeLabel}>{narrative.vibe_archetype}</Text>
          )}
          <Text style={styles.narrativeText}>{narrative.narrative}</Text>
        </View>
      )}

      {!isVibePlus() && (
        <TouchableOpacity style={styles.narrativeLocked} onPress={() => setShowVibePlus(true)} activeOpacity={0.8}>
          <Ionicons name="lock-closed" size={13} color="#FFD700" />
          <View style={{ flex: 1 }}>
            <Text style={styles.narrativeLockedTitle}>AI Narrative · Viibe+</Text>
            <Text style={styles.narrativeLockedDesc}>Your full AI personality story unlocks at ₦1,500/mo</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,215,0,0.5)" />
        </TouchableOpacity>
      )}

      {/* Footer */}
      <Text style={styles.footer}>Based on {vibeDNA.total_ratings_analyzed} ratings</Text>
    </View>

    <VibePlusModal
      visible={showVibePlus}
      onClose={() => setShowVibePlus(false)}
      onSuccess={() => setShowVibePlus(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
    overflow: 'hidden',
    padding: 16,
    gap: 12,
  },
  loadingCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.15)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#666',
    fontSize: 13,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.12)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dnaIcon: {
    fontSize: 16,
  },
  title: {
    color: '#FF3366',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSub: {
    color: '#555',
    fontSize: 11,
  },
  dominantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
  },
  dominantEmoji: {
    fontSize: 24,
  },
  dominantLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dominantValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  nightStyleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nightStyleIcon: {
    fontSize: 14,
  },
  nightStyleText: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '500',
  },
  barsContainer: {
    gap: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTypeLabel: {
    color: '#888',
    fontSize: 11,
    width: 72,
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  barScore: {
    fontSize: 12,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  narrativeBox: {
    backgroundColor: 'rgba(255,51,102,0.06)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.12)',
    gap: 4,
  },
  archetypeLabel: {
    color: '#FF3366',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  narrativeText: {
    color: '#CCC',
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  footer: {
    color: '#555',
    fontSize: 11,
    textAlign: 'right',
  },
  narrativeLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: 12,
  },
  narrativeLockedTitle: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  narrativeLockedDesc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
});
