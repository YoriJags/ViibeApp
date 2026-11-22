/**
 * The VIIBE Certified emblem (option B, picked 22 Nov 2026): a tick whose long
 * stroke is the double I of VIIBE, on brand pink. Means a person at VIIBE
 * checked who this organiser or venue is (routes/certification.py).
 *
 * Not the automatic "Vibe Certified" energy badge in CertifiedBadge.tsx.
 * The printed sticker and certificate versions live in docs/brand/.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const PINK = '#FF3366';
const INK = '#FFF5DE';

export default function CertifiedMark({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="VIIBE Certified">
      <Circle cx="50" cy="50" r="46" fill={PINK} />
      <Path d="M26 52 L40 66" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M40 66 L66 28" stroke={INK} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d="M50 70 L76 32" stroke={INK} strokeWidth={7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** The emblem with its name, as a pill: next to a host, on a venue, on an application. */
export function CertifiedPill({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const md = size === 'md';
  return (
    <View style={[styles.pill, md && styles.pillMd]} accessibilityRole="text" accessibilityLabel="VIIBE Certified">
      <CertifiedMark size={md ? 18 : 14} />
      <Text style={[styles.text, md && { fontSize: 13 }]}>VIIBE Certified</Text>
    </View>
  );
}

/** True while a venue's VIIBE Certified status is current (it lasts a year). */
export function venueIsCertified(venue: any): boolean {
  if (!venue?.business_certified) return false;
  const until = venue.business_certified_until ? Date.parse(venue.business_certified_until) : NaN;
  return Number.isFinite(until) && until > Date.now();
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingLeft: 4, paddingRight: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,51,102,0.14)',
  },
  pillMd: { paddingLeft: 5, paddingRight: 12, paddingVertical: 5, gap: 6 },
  text: { fontSize: 12, fontWeight: '700', color: PINK },
});
