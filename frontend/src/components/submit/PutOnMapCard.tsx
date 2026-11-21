/**
 * Profile entry to the submit screens: add an event, add a place, see what
 * you have sent. Editorial Night style.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edRadius } from '../../theme/editorial';

export default function PutOnMapCard() {
  return (
    <View style={styles.card}>
      <Text style={edType.kicker}>PUT IT ON THE MAP</Text>
      <Text style={[edType.title, { marginTop: 6 }]}>Know about a concert, rave or block party?</Text>
      <Text style={[edType.caption, { marginTop: 6, color: ed.inkSoft }]}>
        Add it and we check it, then everyone sees the energy on the ground.
      </Text>
      <TouchableOpacity
        style={styles.primary}
        onPress={() => router.push('/submit/event' as any)}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.primaryText}>Add an event</Text>
      </TouchableOpacity>
      <View style={styles.links}>
        <Row icon="location-outline" label="Add a place" onPress={() => router.push('/submit/place' as any)} />
        <Row icon="list-outline" label="My submissions" onPress={() => router.push('/submit/mine' as any)} last />
      </View>
    </View>
  );
}

function Row({ icon, label, onPress, last }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: ed.line }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={18} color={ed.inkSoft} />
      <Text style={[edType.bodyStrong, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={ed.inkFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 20, padding: 20, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  primary: {
    marginTop: 16, height: 48, borderRadius: edRadius.pill, backgroundColor: ed.pink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  links: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
