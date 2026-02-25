/**
 * VibeBriefCard — Daily Claude AI city nightlife briefing.
 * Shown on the home screen above the venue list.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';
import VibePlusModal from './VibePlusModal';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VibeBrief {
  headline: string;
  briefing: string;
  top_pick: string;
  hot_area: string;
  powered_by: string;
}

interface Props {
  city: string;
  isDemoMode?: boolean;
}

const DEMO_BRIEF: VibeBrief = {
  headline: 'Tonight in Lagos: DNA Nightclub is taking no prisoners',
  briefing: "VI is on fire from 11pm — get there early or join the queue with everyone else. Quilox is the backup if DNA fills up.",
  top_pick: 'DNA Nightclub',
  hot_area: 'Victoria Island',
  powered_by: 'claude',
};

export default function VibeBriefCard({ city, isDemoMode }: Props) {
  const { isVibePlus } = useVibeStore();
  const [brief, setBrief] = useState<VibeBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showVibePlus, setShowVibePlus] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setBrief(DEMO_BRIEF);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/city/${city}/vibe-brief`)
      .then(r => r.json())
      .then(d => { setBrief(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [city, isDemoMode]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#FF3366" />
        <Text style={styles.loadingText}>Getting tonight's brief...</Text>
      </View>
    );
  }

  if (!brief) return null;

  return (
    <>
    <TouchableOpacity activeOpacity={0.85} onPress={() => setExpanded(e => !e)}>
      <LinearGradient
        colors={['rgba(255,51,102,0.12)', 'rgba(153,51,255,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI BRIEF</Text>
            </View>
            <Text style={styles.hotArea}>{brief.hot_area} is HOT tonight</Text>
          </View>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>

        <Text style={styles.headline}>{brief.headline}</Text>

        {expanded && isVibePlus() && (
          <>
            <Text style={styles.briefing}>{brief.briefing}</Text>
            <View style={styles.topPickRow}>
              <Text style={styles.topPickLabel}>Tonight's top pick</Text>
              <Text style={styles.topPickName}>{brief.top_pick}</Text>
            </View>
          </>
        )}

        {expanded && !isVibePlus() && (
          <TouchableOpacity
            style={styles.lockedSection}
            onPress={() => setShowVibePlus(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={13} color="#FFD700" />
            <Text style={styles.lockedText}>Vibe+ · Full brief for ₦1,500/mo</Text>
          </TouchableOpacity>
        )}

        {!isVibePlus() && !expanded && (
          <View style={styles.lockChip}>
            <Ionicons name="lock-closed" size={10} color="#FFD700" />
            <Text style={styles.lockChipText}>VIBE+</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>

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
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
    gap: 8,
  },
  loadingCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.1)',
  },
  loadingText: { color: '#555', fontSize: 13 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBadge: {
    backgroundColor: 'rgba(255,51,102,0.25)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  aiBadgeText: { color: '#FF3366', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  hotArea: { color: '#FF9933', fontSize: 11, fontWeight: '600' },
  chevron: { color: '#555', fontSize: 11 },
  headline: { color: '#FFF', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  briefing: { color: '#AAA', fontSize: 13, lineHeight: 19, marginTop: 2 },
  topPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  topPickLabel: { color: '#666', fontSize: 11 },
  topPickName: { color: '#FF3366', fontSize: 12, fontWeight: '700' },
  lockedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    marginTop: 4,
  },
  lockedText: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  lockChipText: { color: '#FFD700', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});
