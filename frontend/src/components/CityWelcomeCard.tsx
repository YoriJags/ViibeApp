/**
 * CityWelcomeCard — First-impression hook for new users.
 * Shows city energy, live stats, and invites into the night.
 * Previously an inline function inside (public)/index.tsx.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface CityWelcomeProps {
  cityPulse: { pulse_score: number; pulse_label: string; active_scouts: number; live_venues: number } | null;
  cityName: string;
  onPlannerPress: () => void;
}

export default function CityWelcomeCard({ cityPulse, cityName, onPlannerPress }: CityWelcomeProps) {
  const score = cityPulse?.pulse_score ?? 42;
  const label = (cityPulse?.pulse_label ?? 'BUZZING').toUpperCase();
  const scouts = cityPulse?.active_scouts ?? 0;
  const liveSpots = cityPulse?.live_venues ?? 0;

  const color =
    score >= 80 ? '#FF3366' :
    score >= 60 ? '#FF9933' :
    score >= 30 ? '#9933FF' :
    '#3399FF';

  const headline =
    label === 'ELECTRIC' ? `🔥 ${cityName} is going absolutely OFF` :
    label === 'POPPING'  ? `🎉 ${cityName} is popping right now` :
    label === 'BUZZING'  ? `✨ The ${cityName} scene is building` :
    `🌙 ${cityName} is quiet — early spots available`;

  const subline =
    label === 'ELECTRIC' ? "Don't sleep — the best spots are filling fast" :
    label === 'POPPING'  ? 'Good timing. Pick your spot before it maxes out' :
    label === 'BUZZING'  ? 'Night is young. Get in early, earn more clout' :
    'Quiet night — ideal to explore without the queue';

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[color + '22', '#0A0A0F']}
        style={[styles.card, { borderColor: color + '35' }]}
      >
        <View style={[styles.energyBadge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
          <View style={[styles.energyDot, { backgroundColor: color }]} />
          <Text style={[styles.energyLabel, { color }]}>{label}</Text>
        </View>

        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color }]}>{liveSpots > 0 ? liveSpots : '10+'}</Text>
            <Text style={styles.statLabel}>spots live</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color }]}>{scouts > 0 ? scouts : '200+'}</Text>
            <Text style={styles.statLabel}>scouts out</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color }]}>{score}%</Text>
            <Text style={styles.statLabel}>city energy</Text>
          </View>
        </View>

        <View style={styles.ctaRow}>
          <Text style={styles.ctaHint}>↓ Tonight's top spots below</Text>
          <TouchableOpacity
            style={[styles.plannerBtn, { borderColor: color + '50' }]}
            onPress={onPlannerPress}
            activeOpacity={0.75}
          >
            <Ionicons name="sparkles" size={12} color={color} />
            <Text style={[styles.plannerBtnText, { color }]}>Plan my scene</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  energyDot: { width: 6, height: 6, borderRadius: 3 },
  energyLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headline: { fontSize: 20, fontWeight: '800', color: '#FFF', lineHeight: 26, marginBottom: 6 },
  subline: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 16 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D14',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: '#555', marginTop: 2, fontWeight: '500' },
  statDivider: { width: 1, height: 30, backgroundColor: '#252530' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaHint: { fontSize: 12, color: '#555' },
  plannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  plannerBtnText: { fontSize: 11, fontWeight: '700' },
});
