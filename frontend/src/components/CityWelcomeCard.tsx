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
  cityEnergy: {
    energy_score: number;
    energy_label: string;
    energy_source?: string;
    active_scouts: number;
    live_venues: number;
  } | null;
  cityName: string;
  onPlannerPress: () => void;
  callName?: string;
}

export default function CityWelcomeCard({ cityEnergy, cityName, onPlannerPress, callName }: CityWelcomeProps) {
  // Only a reading built from real scouts may describe the city. This card used
  // to default to a score of 42 and the word "BUZZING" when it had no data, and
  // it branched on ELECTRIC / POPPING / BUZZING, words the city label is never
  // given, so a LIT or PEAK city fell through and was described as quiet.
  const realReading = cityEnergy?.energy_source === 'scouts';
  const score = realReading ? (cityEnergy?.energy_score ?? 0) : 0;
  const label = realReading ? String(cityEnergy?.energy_label ?? '').toUpperCase() : 'NONE';
  const scouts = cityEnergy?.active_scouts ?? 0;
  const liveSpots = realReading ? (cityEnergy?.live_venues ?? 0) : 0;

  const color =
    score >= 85 ? '#FF3366' :
    score >= 65 ? '#FF9933' :
    score >= 45 ? '#9933FF' :
    '#3399FF';

  const greeting = callName ? `${callName}, ` : '';
  const headline =
    label === 'PEAK'    ? `🔥 ${greeting}${cityName} is at peak right now` :
    label === 'LIT'     ? `🎉 ${greeting}${cityName} is lit right now` :
    label === 'WARMING' ? `✨ ${greeting}${cityName} is warming up` :
    label === 'CHILL'   ? `🌙 ${greeting}${cityName} is out, but easy tonight` :
    label === 'QUIET'   ? `🌙 ${greeting}${cityName} is quiet right now` :
    `📍 ${greeting}no live readings in ${cityName} yet tonight`;

  const subline =
    label === 'PEAK'    ? "Don't sleep. The best spots are filling fast" :
    label === 'LIT'     ? 'Good timing. Pick your spot before it maxes out' :
    label === 'WARMING' ? 'Night is young. Get in early' :
    label === 'CHILL'   ? 'Easy night. Good for exploring without the queue' :
    label === 'QUIET'   ? 'Quiet night. Ideal to explore without the queue' :
    'Be the first. Your reading puts the city on the map';

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
