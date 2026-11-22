/**
 * A venue in the home list, Editorial Night style (Direction 1).
 *
 * Photo on the left, the room on the right: state and score in its energy
 * colour, then what is true about it right now. A venue with no current
 * reading says so; it never shows "QUIET 0%", a momentum chip or an old
 * narrative, because none of those would be backed by anything.
 *
 * In the demo every venue counts as read (it walks a fully read city).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { hapticVibe } from '../utils/hapticVibe';
import SignalDensityStrip, { SignalDensityData } from './SignalDensityStrip';
import SignalDensitySheet from './SignalDensitySheet';
import { ENERGY_COLORS, ENERGY_LABELS, energyStateFor } from '../theme/energy';
import { ed, edType, edRadius } from '../theme/editorial';
import { useVibeStore } from '../store/vibeStore';
import { useVenueImage } from './home/HomeSections';
import CertifiedMark, { venueIsCertified } from './CertifiedMark';
import { photoCredit, usePlacePhoto } from '../services/usePlacePhoto';

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  current_vibe_score: number;
  // 'demo' when the score comes only from the ambient demo engine.
  energy_source?: 'scouts' | 'demo' | 'none';
  // Present on concerts, festivals and raves: a dated event, not a venue.
  event?: { phase: 'upcoming' | 'doors' | 'live' | 'ended'; entry: 'ticketed' | 'door'; event_type?: string; starts_at?: string | null };
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  is_featured: boolean;
  active_pulse_tier?: string | null;
  entry_fee?: string;
  music_genre?: string;
  signal_density?: SignalDensityData;
  viibe_certified?: boolean;
  is_open_now?: boolean | null;
  next_open?: string;
  vibe_tier?: string;
  venue_narrative?: string;
  icon_spotted?: { username: string; icon_tier: string; icon_label?: string } | null;
  last_rated_mins_ago?: number | null;
}

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
  showBoostBadge?: boolean;
  isNearby?: boolean;
  onRatePress?: () => void;
  dnaMatch?: number;
}

// One gate vocabulary everywhere: Clear, Slow, Jammed.
const GATE: Record<string, string> = { blocked: 'Gate jammed', slow: 'Gate slow', clear: 'Gate clear' };

function Chip({ icon, text, color }: { icon?: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={[styles.chip, color ? { borderColor: color + '55' } : null]}>
      {icon ? <Ionicons name={icon} size={11} color={color || ed.inkSoft} /> : null}
      <Text style={[styles.chipText, color ? { color } : null]}>{text}</Text>
    </View>
  );
}

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onPress, showBoostBadge = true, isNearby, onRatePress, dnaMatch }) => {
  const isDemoMode = useVibeStore((s) => s.isDemoMode);
  const img = useVenueImage(venue);
  const photo = usePlacePhoto(venue.id, !venue.event);
  const [showDensitySheet, setShowDensitySheet] = useState(false);

  const isPulseBoosted = venue.active_pulse_tier !== null && venue.active_pulse_tier !== undefined;
  const score = venue.current_vibe_score ?? 0;
  const hasReading = score > 0 && (isDemoMode || venue.energy_source === 'scouts' || venue.energy_source === 'demo');
  const state = energyStateFor(score, venue.capacity_level ?? 'sparse');
  const color = ENERGY_COLORS[state];

  // fresh < 45 min | stale 45 to 90 min | expired > 90 min
  const minsAgo = venue.last_rated_mins_ago;
  const decay: 'fresh' | 'stale' | 'expired' = minsAgo == null || minsAgo < 45 ? 'fresh' : minsAgo < 90 ? 'stale' : 'expired';
  const ago = minsAgo == null ? null : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

  // Momentum words only when there is a fresh reading behind them. "Holding
  // high" (not "Peak now") so it never contradicts the energy state.
  const momentum = !hasReading || decay !== 'fresh' ? null
    : venue.vibe_velocity === 'heating_up' ? 'rising'
    : venue.vibe_velocity === 'cooling_down' && score >= 55 ? 'fading'
    : score >= 70 ? 'holding' : null;

  return (
    <View style={styles.outer}>
      <TouchableOpacity
        style={[styles.card, isPulseBoosted && styles.cardBoosted, hasReading && state === 'peak' && { borderColor: color + '66' }]}
        onPress={() => { hapticVibe(venue.energy_level); onPress(); }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${venue.name}, ${venue.area}. ${hasReading ? `${ENERGY_LABELS[state]} ${Math.round(score)}` : 'No reading yet'}`}
      >
        <Image source={{ uri: img }} style={styles.thumb} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
            {venueIsCertified(venue) ? <CertifiedMark size={14} /> : null}
            {venue.is_featured && !isPulseBoosted ? <Ionicons name="star" size={12} color={ed.gold} /> : null}
          </View>
          <Text style={styles.area} numberOfLines={1}>
            {venue.area}{venue.music_genre ? ` · ${venue.music_genre}` : ''}
          </Text>

          {/* Event: what it is and when */}
          {venue.event ? (
            <View style={styles.eventRow}>
              <View style={[styles.eventPill, venue.event.phase === 'live' && styles.eventPillLive]}>
                <Text style={[styles.eventPillText, venue.event.phase === 'live' && { color: ed.bg }]}>{eventWhen(venue.event)}</Text>
              </View>
              <Text style={styles.eventMeta} numberOfLines={1}>
                {[titleCase(venue.event.event_type), venue.event.entry === 'ticketed' ? 'Ticketed' : 'Door entry'].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginTop: 8 }}>
            {venue.is_open_now === true ? <Chip text="Open" color={ed.success} /> : null}
            {venue.is_open_now === false && venue.next_open ? <Chip icon="time-outline" text={venue.next_open} /> : null}
            {hasReading && venue.capacity_level && venue.capacity_level !== 'sparse'
              ? <Chip icon="people-outline" text={venue.capacity_level === 'full' ? 'Packed' : 'Filling up'} /> : null}
            {hasReading && venue.gate_level && venue.gate_level !== 'clear' ? <Chip icon="enter-outline" text={GATE[venue.gate_level]} /> : null}
            {venue.entry_fee ? <Chip icon="ticket-outline" text={venue.entry_fee} /> : null}
            {venue.viibe_certified ? <Chip icon="ribbon-outline" text="Vibe Certified" color={ed.gold} /> : null}
            {venue.vibe_tier === 'Elite' ? <Chip icon="diamond-outline" text="Elite" color={ed.gold} /> : null}
            {venue.icon_spotted ? <Chip icon="star-outline" text={`${venue.icon_spotted.icon_label || 'Icon'} spotted`} color={ed.gold} /> : null}
            {hasReading && decay !== 'fresh' && ago ? <Chip icon="time-outline" text={decay === 'expired' ? 'No recent reading' : ago} /> : null}
            {momentum === 'rising' ? <Chip icon="trending-up" text="Rising" color={ed.success} /> : null}
            {momentum === 'fading' ? <Chip icon="trending-down" text="Fading" color={ed.danger} /> : null}
            {momentum === 'holding' ? <Chip icon="pulse-outline" text="Holding high" color={color} /> : null}
            {dnaMatch !== undefined && dnaMatch >= 60 ? <Chip icon="sparkles-outline" text={`${dnaMatch}% your match`} color={ed.pink} /> : null}
          </ScrollView>

          {/* The server's one-line story, only while a reading backs it. */}
          {hasReading && venue.venue_narrative ? (
            <Text style={styles.narrative} numberOfLines={1}>{venue.venue_narrative}</Text>
          ) : null}

          {isPulseBoosted && showBoostBadge ? (
            <View style={styles.pulseRow}>
              <View style={styles.pulseBadge}>
                <Ionicons name="flash" size={11} color={ed.gold} />
                <Text style={styles.pulseText}>PULSE DROP · 2× CLOUT</Text>
              </View>
            </View>
          ) : null}

          {venue.signal_density && hasReading ? (
            <View style={{ marginTop: 8 }}>
              <SignalDensityStrip density={venue.signal_density} onPress={() => setShowDensitySheet(true)} />
            </View>
          ) : null}

          {/* Google requires its photos to carry the author's name. */}
          {photo ? <Text style={styles.credit} numberOfLines={1}>{photoCredit(photo)}</Text> : null}
        </View>

        <View style={styles.right}>
          {hasReading ? (
            <View style={[styles.scoreBox, decay === 'expired' && { opacity: 0.4 }]}>
              <Text style={[styles.state, { color }]}>
                {ENERGY_LABELS[state]}{venue.energy_source === 'demo' && !isDemoMode ? ' · DEMO' : ''}
              </Text>
              <Text style={[styles.score, { color }]}>{Math.round(score)}</Text>
            </View>
          ) : (
            <View style={styles.scoreBox}>
              <View style={styles.noReadingRing} />
              <Text style={styles.noReading}>No reading{'\n'}yet</Text>
            </View>
          )}
          {isNearby && onRatePress ? (
            <TouchableOpacity
              style={styles.rate}
              onPress={(e) => { e.stopPropagation(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onRatePress(); }}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${venue.name}`}
            >
              <Text style={styles.rateText}>Rate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      {venue.signal_density ? (
        <SignalDensitySheet
          visible={showDensitySheet}
          onClose={() => setShowDensitySheet(false)}
          venueName={venue.name}
          density={venue.signal_density}
          onRatePress={() => { setShowDensitySheet(false); onRatePress?.(); }}
        />
      ) : null}
    </View>
  );
};

const titleCase = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ') : '');

/** "Live now", "Doors opening", "Finished", or the start time in Lagos. */
function eventWhen(e: { phase: string; starts_at?: string | null }): string {
  if (e.phase === 'live') return 'Live now';
  if (e.phase === 'doors') return 'Doors opening';
  if (e.phase === 'ended') return 'Finished';
  if (!e.starts_at) return 'Coming up';
  try {
    return new Intl.DateTimeFormat('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      timeZone: 'Africa/Lagos',
    }).format(new Date(e.starts_at));
  } catch {
    return 'Coming up';
  }
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: 20, marginBottom: 10 },
  card: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  cardBoosted: { borderColor: 'rgba(255,190,59,0.45)' },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: ed.raised },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: ed.ink, flexShrink: 1 },
  area: { fontSize: 13, lineHeight: 18, color: ed.inkSoft, marginTop: 1 },
  chips: { gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 24,
    borderRadius: edRadius.pill, borderWidth: 1, borderColor: ed.line,
  },
  chipText: { fontSize: 12, color: ed.inkSoft, fontWeight: '600' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  eventPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: edRadius.pill, backgroundColor: ed.raised },
  eventPillLive: { backgroundColor: ed.gold },
  eventPillText: { fontSize: 12, fontWeight: '700', color: ed.ink },
  eventMeta: { fontSize: 12, color: ed.inkFaint, flexShrink: 1 },
  narrative: { fontSize: 12, color: ed.inkSoft, fontStyle: 'italic', marginTop: 8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pulseBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22,
    borderRadius: edRadius.pill, backgroundColor: ed.goldSoft,
  },
  pulseText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: ed.gold },
  credit: { fontSize: 11, color: ed.inkFaint, marginTop: 6 },
  right: { alignItems: 'flex-end', justifyContent: 'space-between', minWidth: 58 },
  scoreBox: { alignItems: 'flex-end' },
  state: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  score: { fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  noReadingRing: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ed.inkFaint,
    marginBottom: 4,
  },
  noReading: { fontSize: 11, lineHeight: 14, color: ed.inkFaint, textAlign: 'right', fontWeight: '600' },
  rate: { paddingHorizontal: 12, height: 30, borderRadius: edRadius.pill, backgroundColor: ed.pink, justifyContent: 'center', marginTop: 8 },
  rateText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
