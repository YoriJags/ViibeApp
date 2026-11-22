/**
 * What the submitter said about their event: host, about, lineup, sound,
 * dress code, price, age, and (certified organisers only) the ticket link.
 * Community hosts are shown as not verified; only VIIBE Certified organisers
 * get the pink check and a ticket button (backend services/events.public_event).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edRadius } from '../theme/editorial';
import { CertifiedPill } from './CertifiedMark';

export interface EventInfo {
  listing?: 'community' | 'official';
  organiser_name?: string | null;
  organiser_verified?: boolean;
  description?: string | null;
  lineup?: string[];
  genres?: string[];
  dress_code?: string | null;
  price_text?: string | null;
  age_limit?: number | null;
  ticket_url?: string | null;
  venue_type?: string;
}

/** Absolute URL for an event cover served by the API (it is stored as a path). */
export function eventCoverUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  return `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}${path}`;
}

export default function EventDetails({ event }: { event: EventInfo }) {
  const facts = [
    event.price_text ? { icon: 'pricetag-outline', text: event.price_text } : null,
    event.dress_code ? { icon: 'shirt-outline', text: event.dress_code } : null,
    event.age_limit ? { icon: 'id-card-outline', text: `${event.age_limit}+ only` } : null,
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  const verified = event.listing === 'official' && event.organiser_verified;
  const hasAnything = event.organiser_name || event.description || event.lineup?.length
    || event.genres?.length || facts.length || (verified && event.ticket_url);
  if (!hasAnything) return null;

  return (
    <View style={styles.card}>
      {event.organiser_name ? (
        <View style={styles.hostRow}>
          <Text style={edType.caption}>Hosted by</Text>
          <Text style={[edType.bodyStrong, { flexShrink: 1 }]} numberOfLines={1}>{event.organiser_name}</Text>
          {verified ? (
            <CertifiedPill />
          ) : (
            <View style={styles.unverified}>
              <Text style={[edType.caption, { color: ed.inkFaint }]}>Not verified</Text>
            </View>
          )}
        </View>
      ) : null}

      {event.description ? <Text style={[edType.body, { marginTop: 14 }]}>{event.description}</Text> : null}

      {event.lineup?.length ? (
        <>
          <Text style={[edType.kicker, { marginTop: 20 }]}>{event.venue_type === 'rave' ? 'DJs' : 'Lineup'}</Text>
          <Text style={[edType.title, { marginTop: 6 }]}>{event.lineup.join('  ·  ')}</Text>
        </>
      ) : null}

      {event.genres?.length ? (
        <View style={styles.tags}>
          {event.genres.map((g) => (
            <View key={g} style={styles.tag}><Text style={edType.label}>{g}</Text></View>
          ))}
        </View>
      ) : null}

      {facts.length ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          {facts.map((f) => (
            <View key={f.text} style={styles.fact}>
              <Ionicons name={f.icon} size={16} color={ed.inkSoft} />
              <Text style={[edType.body, { color: ed.ink, flex: 1 }]}>{f.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {verified && event.ticket_url ? (
        <TouchableOpacity
          style={styles.ticket}
          onPress={() => Linking.openURL(event.ticket_url!)}
          activeOpacity={0.85}
          accessibilityRole="link"
        >
          <Ionicons name="ticket-outline" size={18} color="#FFFFFF" />
          <Text style={styles.ticketText}>Get tickets</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 16, padding: 20, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  unverified: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: edRadius.pill,
    borderWidth: 1, borderColor: ed.line,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: edRadius.pill, backgroundColor: ed.raised },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticket: {
    marginTop: 20, height: 48, borderRadius: edRadius.pill, backgroundColor: ed.pink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ticketText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
