/**
 * WeekendCard — Friday 6PM+ and Saturday only. Dismissable per session.
 * Previously an inline function inside (public)/index.tsx.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface WeekendCardProps {
  onDismiss: () => void;
  pulseScore: number;
  onExplore: () => void;
}

export default function WeekendCard({ onDismiss, pulseScore, onExplore }: WeekendCardProps) {
  const day = new Date().getDay();
  const isFriday = day === 5;

  const label    = isFriday ? 'TGIF 🔥' : 'WEEKEND 🎉';
  const headline = isFriday ? "It's Friday. No dulling tonight." : "Saturday night. Lagos is yours.";
  const subline  = isFriday
    ? 'Weekend starts NOW — find your spot before the queues build up.'
    : 'Peak night. The city is at max energy. Go claim your moment.';

  return (
    <LinearGradient colors={['#1C0A22', '#100A18']} style={styles.card}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onDismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="close" size={14} color="#444" />
      </TouchableOpacity>

      <View style={styles.topRow}>
        <LinearGradient
          colors={['#FF3366', '#FF9933']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.labelBadge}
        >
          <Text style={styles.labelText}>{label}</Text>
        </LinearGradient>
        <View style={styles.energyRow}>
          <View style={styles.energyDot} />
          <Text style={styles.energyText}>{pulseScore}% city energy</Text>
        </View>
      </View>

      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.subline}>{subline}</Text>

      <TouchableOpacity style={styles.cta} onPress={onExplore} activeOpacity={0.75}>
        <Text style={styles.ctaText}>See what's popping</Text>
        <Ionicons name="arrow-forward" size={12} color="#FF9933" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FF336622',
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  labelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  labelText: { fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  energyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF9933' },
  energyText: { fontSize: 10, color: '#FF993388', fontWeight: '700' },
  headline: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: -0.3, marginBottom: 6 },
  subline: { fontSize: 12, color: '#888', lineHeight: 17, marginBottom: 14 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  ctaText: { fontSize: 12, color: '#FF9933', fontWeight: '700' },
});
