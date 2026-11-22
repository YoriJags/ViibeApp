/**
 * Home, Editorial Night (Direction 1, picked 21 Nov 2026; Peak gold, 22 Nov).
 *
 * The sections the home screen is built from, top to bottom:
 *   HomeHero      photo, the city's reading as a headline, score, trend bars
 *   SceneChips    filter by scene (clubs, lounges, raves, festivals...)
 *   ArcRow        Tonight's Arc as one compact row, with the streak
 *   VenueShelf    portrait image cards ("Alive right now", "On this week")
 *   MatchCard     "Made for your night"
 *   SceneTiles    browse by scene
 *   CrewRow       your crew, with Roll Deep
 *   MoreTonight   the long tail, one collapsible row each
 *   SectionHeader the title row every shelf uses
 *
 * Colour means energy (src/theme/energy.ts). Pink is only for the thing to
 * tap. Nothing here shows a score that did not come from a reading: callers
 * pass null when the city or a venue has none.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edRadius } from '../../theme/editorial';
import { energyColor, asEnergyState, ENERGY_LABELS, EnergyState } from '../../theme/energy';
import { usePlacePhoto } from '../../services/usePlacePhoto';
import { eventCoverUrl } from '../EventDetails';

const GUTTER = 20;

// Stock photos (Unsplash licence: free for commercial use). Real venue and
// organiser photos replace these as they join.
const u = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80`;
export const STOCK = {
  hero: u('1566737236500-c8ac43014a67', 1200),
  quiet: u('1514525253161-7a46d19cd819', 1200),
  club: u('1566737236500-c8ac43014a67'),
  lounge: u('1514525253161-7a46d19cd819'),
  rave: u('1470225620780-dba8ba36b745'),
  festival: u('1516450360452-9312f5e86fc7'),
  concert: u('1571266028243-d220c8b77883'),
  block_party: u('1574391884720-bbc3740c59d1'),
  bar: u('1514525253161-7a46d19cd819'),
  restaurant: u('1508997449629-303059a039c0'),
};
const FALLBACKS = [STOCK.club, STOCK.rave, STOCK.festival, STOCK.concert, STOCK.block_party, STOCK.lounge];

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// ── Section header ──────────────────────────────────────────────────────────

export function SectionHeader({ title: t, action, onAction, kicker }: {
  title: string; action?: string; onAction?: () => void; kicker?: string;
}) {
  return (
    <View style={s.sectionHead}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={edType.kicker}>{kicker}</Text> : null}
        <Text style={edType.title}>{t}</Text>
      </View>
      {action ? (
        <Text style={[edType.label, { color: ed.inkFaint }]} onPress={onAction} accessibilityRole="button">{action}</Text>
      ) : null}
    </View>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

export interface CityReading {
  score: number;
  state: EnergyState;
  trend?: string | null;
  scouts?: number | null;
  readings?: number | null;
  hotVenues?: number | null;
  sparkline?: number[] | null;
}

const TREND: Record<string, string> = {
  heating_up: 'Heating up', rising: 'Heating up', cooling: 'Cooling', cooling_down: 'Cooling',
  falling: 'Cooling', stable: 'Holding', steady: 'Holding',
};

function lagosKicker(): string {
  const now = new Date();
  const day = now.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long' });
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${time}`.toUpperCase().replace(' AM', 'AM').replace(' PM', 'PM');
}

export function HomeHero({ cityName, reading, isDemo, modeLabel, topInset, onCity, onMap, onToggleMode, onExitDemo }: {
  cityName: string; reading: CityReading | null; isDemo: boolean; modeLabel: string; topInset: number;
  onCity: () => void; onMap: () => void; onToggleMode: () => void; onExitDemo: () => void;
}) {
  const color = reading ? energyColor(reading.state) : ed.inkFaint;
  const stats = reading ? [
    reading.scouts ? `${reading.scouts.toLocaleString()} scouts out` : null,
    reading.readings ? `${reading.readings.toLocaleString()} readings` : null,
    reading.hotVenues ? `${reading.hotVenues} venues lit` : null,
  ].filter(Boolean).join(' · ') : '';
  const bars = reading?.sparkline?.length ? reading.sparkline.slice(-8) : null;
  const max = bars ? Math.max(...bars, 1) : 1;

  return (
    <ImageBackground source={{ uri: reading ? STOCK.hero : STOCK.quiet }} style={s.hero} resizeMode="cover">
      <LinearGradient
        colors={['rgba(10,9,13,0.55)', 'rgba(10,9,13,0.25)', 'rgba(10,9,13,0.85)', ed.bg]}
        locations={[0, 0.3, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.heroTop, { paddingTop: topInset + 10 }]}>
        <Text style={s.wordmark}>VIIBE</Text>
        {isDemo ? (
          <TouchableOpacity
            style={s.demoTag}
            accessibilityRole="button"
            accessibilityLabel="Demo mode. Tap to leave the demo"
            onPress={() => Alert.alert('Leave the demo?', 'You will see Lagos live, with real readings only.', [
              { text: 'Stay', style: 'cancel' }, { text: 'Leave demo', onPress: onExitDemo },
            ])}
          >
            <Ionicons name="play" size={9} color={ed.gold} />
            <Text style={s.demoText}>DEMO</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onToggleMode} style={s.modePill} accessibilityRole="button"
          accessibilityLabel={`Mode: ${modeLabel}. Tap to switch`}>
          <Text style={[edType.caption, { color: ed.ink, fontWeight: '700' }]}>{modeLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMap} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Open the map">
          <Ionicons name="map-outline" size={22} color={ed.ink} />
        </TouchableOpacity>
      </View>

      <View style={s.heroBody}>
        <Text style={[edType.kicker, { color: ed.inkSoft }]}>{lagosKicker()}</Text>
        <TouchableOpacity onPress={onCity} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Change city">
          <Text style={s.heroTitle}>
            {reading ? `${cityName} is ${title(ENERGY_LABELS[reading.state])}.` : `${cityName} is just getting started.`}
            <Text style={{ fontSize: 22, color: ed.inkFaint }}>  ⌄</Text>
          </Text>
        </TouchableOpacity>

        {reading ? (
          <>
            <View style={s.scoreRow}>
              <Text style={[s.score, { color }]}>{Math.round(reading.score)}</Text>
              <View style={{ flex: 1, paddingBottom: 6 }}>
                <Text style={[s.stateLine, { color }]}>
                  ● {ENERGY_LABELS[reading.state]}{reading.trend && TREND[reading.trend] ? ` · ${TREND[reading.trend].toUpperCase()}` : ''}
                </Text>
              </View>
              {bars ? (
                <View style={s.bars} accessibilityLabel="The city's reading over the last hours">
                  {bars.map((b, i) => (
                    <View key={i} style={[s.bar, { height: 6 + (b / max) * 26, backgroundColor: color,
                      opacity: 0.35 + 0.65 * ((i + 1) / bars.length) }]} />
                  ))}
                </View>
              ) : null}
            </View>
            {stats ? <Text style={[edType.caption, { color: ed.inkSoft, marginTop: 2 }]}>{stats}</Text> : null}
          </>
        ) : (
          <View style={s.quietRow}>
            <View style={s.quietRing}><Ionicons name="moon-outline" size={20} color={ed.inkSoft} /></View>
            <View style={{ flex: 1 }}>
              <Text style={edType.bodyStrong}>No readings yet tonight</Text>
              <Text style={[edType.caption, { color: ed.inkSoft }]}>Scores appear the moment a scout taps in.</Text>
            </View>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

// ── Scene chips ─────────────────────────────────────────────────────────────

export const SCENES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'club', label: 'Clubs', icon: 'musical-notes-outline' },
  { key: 'lounge', label: 'Lounges', icon: 'wine-outline' },
  { key: 'rave', label: 'Raves', icon: 'pulse-outline' },
  { key: 'festival', label: 'Festivals', icon: 'flag-outline' },
  { key: 'concert', label: 'Concerts', icon: 'mic-outline' },
  { key: 'block_party', label: 'Block parties', icon: 'people-outline' },
  { key: 'bar', label: 'Bars', icon: 'beer-outline' },
  { key: 'restaurant', label: 'Eats', icon: 'restaurant-outline' },
];

export function SceneChips({ selected, counts, onSelect }: {
  selected: string; counts: Record<string, number>; onSelect: (key: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {SCENES.filter((c) => c.key === 'all' || (counts[c.key] ?? 0) > 0).map((c) => {
        const on = selected === c.key;
        return (
          <TouchableOpacity key={c.key} onPress={() => onSelect(c.key)} style={[s.chip, on && s.chipOn]}
            accessibilityRole="button" accessibilityState={{ selected: on }}>
            {c.key !== 'all' ? <Ionicons name={c.icon} size={15} color={on ? ed.bg : ed.ink} /> : null}
            <Text style={[edType.label, { color: on ? ed.bg : ed.ink }]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Tonight's Arc ───────────────────────────────────────────────────────────

const ARC = [
  { id: 'mood', label: 'Set the Mood', reward: '+10 clout' },
  { id: 'explore', label: 'Explore', reward: '' },
  { id: 'rate', label: 'Rate a Spot', reward: '+40 clout' },
  { id: 'checkin', label: 'Check In', reward: '+25 clout' },
  { id: 'crew', label: 'Roll Deep', reward: 'crew bonus' },
];

export function ArcRow({ done, streak, onStep }: {
  done: Record<string, boolean>; streak: number; onStep: (id: string) => void;
}) {
  const steps = ARC.map((a) => ({ ...a, done: a.id === 'explore' ? true : !!done[a.id] }));
  const count = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  return (
    <TouchableOpacity style={s.arc} activeOpacity={0.85} onPress={() => next && onStep(next.id)}
      accessibilityRole="button" accessibilityLabel={next ? `Tonight's Arc. Next: ${next.label}` : "Tonight's Arc complete"}>
      <View style={{ flex: 1 }}>
        <Text style={edType.kicker}>TONIGHT'S ARC · {count} OF {steps.length}</Text>
        <Text style={[edType.bodyStrong, { marginTop: 4 }]}>
          {next ? <>Next: {next.label}{next.reward ? <Text style={{ color: ed.inkFaint, fontWeight: '400' }}>  {next.reward}</Text> : null}</> : 'Arc complete. Big night.'}
        </Text>
        <View style={s.arcBar}>
          {steps.map((x) => <View key={x.id} style={[s.arcSeg, x.done && { backgroundColor: ed.pink }]} />)}
        </View>
      </View>
      {streak > 0 ? (
        <View style={s.streak}>
          <Ionicons name="flame-outline" size={14} color={ed.gold} />
          <Text style={[edType.label, { color: ed.gold }]}>{streak} {streak === 1 ? 'night' : 'nights'}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Venue shelf ─────────────────────────────────────────────────────────────

/** A venue's photo: its own, an event cover, a place photo, or a stock picture for its scene. */
export function useVenueImage(v: any): string {
  const own = eventCoverUrl(v?.cover_image_url) || (v?.photo_base64 ? `data:image/jpeg;base64,${v.photo_base64}` : null);
  const place = usePlacePhoto(v?.id, !own && !v?.event && !v?.kind);
  if (own) return own;
  if (place?.url) return place.url;
  const scene = (STOCK as any)[v?.venue_type];
  if (scene) return scene;
  const hash = String(v?.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACKS[hash % FALLBACKS.length];
}

function dateChip(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short' }).toUpperCase(),
    num: d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric' }),
  };
}

function ShelfCard({ v, rank, hasReading, onPress, wide }: {
  v: any; rank?: number; hasReading: boolean; onPress: () => void; wide?: boolean;
}) {
  const img = useVenueImage(v);
  const state = asEnergyState(v.energy_level);
  const color = energyColor(state);
  const date = !hasReading ? dateChip(v.event?.starts_at || v.starts_at) : null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[s.card, wide && { width: 260, height: 170 }]}
      accessibilityRole="button" accessibilityLabel={`${v.name}${hasReading ? `, ${ENERGY_LABELS[state]} ${Math.round(v.current_vibe_score)}` : ''}`}>
      <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(10,9,13,0.1)', 'rgba(10,9,13,0.25)', 'rgba(10,9,13,0.92)']}
        locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      {rank ? <Text style={s.rank}>{rank}</Text> : null}
      {date ? (
        <View style={s.date}>
          <Text style={[edType.caption, { color: ed.pink, fontWeight: '700' }]}>{date.day}</Text>
          <Text style={s.dateNum}>{date.num}</Text>
        </View>
      ) : null}
      <View style={s.cardBody}>
        {hasReading ? (
          <Text style={[s.cardState, { color }]}>● {ENERGY_LABELS[state]} {Math.round(v.current_vibe_score)}</Text>
        ) : null}
        <Text style={s.cardName} numberOfLines={2}>{v.name}</Text>
        {v.area ? <Text style={[edType.caption, { color: ed.inkSoft }]} numberOfLines={1}>{v.area}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function VenueShelf({ venues, ranked, hasReading, onPress, wide }: {
  venues: any[]; ranked?: boolean; hasReading: (v: any) => boolean; onPress: (v: any) => void; wide?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shelf}>
      {venues.map((v, i) => (
        <ShelfCard key={v.id} v={v} rank={ranked ? i + 1 : undefined} hasReading={hasReading(v)}
          onPress={() => onPress(v)} wide={wide} />
      ))}
    </ScrollView>
  );
}

// ── Made for your night ─────────────────────────────────────────────────────

export function MatchCard({ venue, percent, reason, onGo }: {
  venue: any; percent: number; reason?: string; onGo: () => void;
}) {
  const img = useVenueImage(venue);
  const state = asEnergyState(venue.energy_level);
  return (
    <TouchableOpacity onPress={onGo} activeOpacity={0.9} style={s.match} accessibilityRole="button">
      <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(10,9,13,0.92)', 'rgba(10,9,13,0.55)', 'rgba(10,9,13,0.2)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 18, flex: 1, justifyContent: 'flex-end' }}>
        <Text style={[edType.kicker, { color: ed.pink }]}>YOUR MATCH · {percent}%</Text>
        <Text style={s.matchName} numberOfLines={2}>{venue.name}</Text>
        {reason ? <Text style={[edType.caption, { color: ed.inkSoft, marginTop: 4, maxWidth: 230 }]} numberOfLines={2}>{reason}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <View style={s.goBtn}><Text style={[edType.label, { color: ed.bg }]}>Go now</Text></View>
          <Text style={[edType.caption, { color: energyColor(state), fontWeight: '700' }]}>● {ENERGY_LABELS[state]}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Browse by scene ─────────────────────────────────────────────────────────

export function SceneTiles({ counts, onSelect }: { counts: Record<string, number>; onSelect: (key: string) => void }) {
  const tiles = SCENES.filter((c) => c.key !== 'all' && (counts[c.key] ?? 0) > 0);
  return (
    <View style={s.tiles}>
      {tiles.map((t) => (
        <TouchableOpacity key={t.key} onPress={() => onSelect(t.key)} style={s.tile} activeOpacity={0.88} accessibilityRole="button">
          <Image source={{ uri: (STOCK as any)[t.key] || STOCK.club }} style={s.tileImg} resizeMode="cover" />
          <LinearGradient colors={[ed.raised, 'rgba(29,26,35,0.6)', 'rgba(29,26,35,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill} />
          <View style={{ padding: 14 }}>
            <Text style={s.tileTitle}>{t.label}</Text>
            <Text style={[edType.caption, { color: ed.inkSoft }]}>{counts[t.key]} tonight</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Crew ────────────────────────────────────────────────────────────────────

export function CrewRow({ crew, onOpen }: { crew: any; onOpen: () => void }) {
  const members: any[] = crew?.member_details || [];
  const out = members.filter((m) => m.checked_in);
  const lead = out[0];
  return (
    <TouchableOpacity style={s.crew} onPress={onOpen} activeOpacity={0.88} accessibilityRole="button">
      <View style={{ flexDirection: 'row' }}>
        {members.slice(0, 4).map((m, i) => (
          <View key={m.user_id || i} style={[s.avatar, { marginLeft: i ? -8 : 0, backgroundColor: m.avatar_config?.bgColor || ed.raised }]}>
            <Text style={s.avatarText}>{(m.username || '?').charAt(0).toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={edType.bodyStrong}>{out.length} of {members.length} are out</Text>
        <Text style={[edType.caption, { color: ed.inkSoft }]} numberOfLines={1}>
          {lead ? `${lead.username} checked in${lead.venue_name ? ` at ${lead.venue_name}` : ''}` : 'Nobody has checked in yet'}
        </Text>
      </View>
      <View style={s.rollDeep}><Text style={edType.label}>Roll Deep</Text></View>
    </TouchableOpacity>
  );
}

// ── More tonight ────────────────────────────────────────────────────────────

export interface MoreItem {
  key: string; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; render: () => React.ReactNode;
}

export function MoreTonight({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={s.more}>
      {items.map((it, i) => {
        const on = open === it.key;
        return (
          <View key={it.key} style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: ed.line } : null}>
            <TouchableOpacity style={s.moreRow} onPress={() => setOpen(on ? null : it.key)} activeOpacity={0.8}
              accessibilityRole="button" accessibilityState={{ expanded: on }}>
              <View style={s.moreIcon}><Ionicons name={it.icon} size={18} color={ed.inkSoft} /></View>
              <View style={{ flex: 1 }}>
                <Text style={edType.bodyStrong}>{it.title}</Text>
                {it.subtitle ? <Text style={[edType.caption, { color: ed.inkSoft }]} numberOfLines={2}>{it.subtitle}</Text> : null}
              </View>
              <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={18} color={ed.inkFaint} />
            </TouchableOpacity>
            {on ? <View style={{ paddingBottom: 12 }}>{it.render()}</View> : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: GUTTER, marginTop: 32, marginBottom: 12 },

  hero: { width: '100%', minHeight: 380, backgroundColor: ed.bg, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, gap: 10 },
  wordmark: { fontSize: 22, fontWeight: '700', letterSpacing: 4, color: ed.ink },
  demoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: edRadius.pill, backgroundColor: ed.goldSoft, borderWidth: 1, borderColor: 'rgba(255,190,59,0.35)',
  },
  demoText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: ed.gold },
  modePill: {
    paddingHorizontal: 10, height: 30, borderRadius: edRadius.pill, justifyContent: 'center',
    backgroundColor: 'rgba(255,245,222,0.12)',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heroBody: { paddingHorizontal: GUTTER, paddingTop: 40, paddingBottom: 6 },
  heroTitle: { fontSize: 44, lineHeight: 46, fontWeight: '700', letterSpacing: -1.4, color: ed.ink, marginTop: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 6 },
  score: { fontSize: 56, lineHeight: 58, fontWeight: '700', letterSpacing: -2 },
  stateLine: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 34, paddingBottom: 8 },
  bar: { width: 5, borderRadius: 2 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  quietRing: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: ed.inkFaint,
    alignItems: 'center', justifyContent: 'center',
  },

  chips: { paddingHorizontal: GUTTER, gap: 8, paddingTop: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38,
    borderRadius: edRadius.pill, backgroundColor: ed.raised, borderWidth: 1, borderColor: ed.line,
  },
  chipOn: { backgroundColor: ed.ink, borderColor: ed.ink },

  arc: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: GUTTER, marginTop: 18, padding: 16,
    borderRadius: edRadius.md, backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  arcBar: { flexDirection: 'row', gap: 5, marginTop: 10, maxWidth: 220 },
  arcSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: ed.raised },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34,
    borderRadius: edRadius.pill, backgroundColor: ed.goldSoft,
  },

  shelf: { paddingHorizontal: GUTTER, gap: 12 },
  card: { width: 150, height: 210, borderRadius: edRadius.md, overflow: 'hidden', backgroundColor: ed.surface },
  rank: { position: 'absolute', top: 8, left: 12, fontSize: 28, fontWeight: '700', color: ed.ink },
  date: {
    position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: edRadius.sm,
    backgroundColor: 'rgba(10,9,13,0.75)', alignItems: 'center',
  },
  dateNum: { fontSize: 22, lineHeight: 24, fontWeight: '700', color: ed.ink },
  cardBody: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  cardState: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  cardName: { fontSize: 16, lineHeight: 19, fontWeight: '700', color: ed.ink },

  match: { marginHorizontal: GUTTER, height: 200, borderRadius: edRadius.md, overflow: 'hidden', backgroundColor: ed.surface },
  matchName: { fontSize: 28, lineHeight: 30, fontWeight: '700', letterSpacing: -0.6, color: ed.ink, marginTop: 4 },
  goBtn: { paddingHorizontal: 18, height: 36, borderRadius: edRadius.pill, backgroundColor: ed.ink, justifyContent: 'center' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: GUTTER },
  tile: { width: '48.4%', height: 88, borderRadius: edRadius.md, overflow: 'hidden', backgroundColor: ed.raised },
  tileImg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%' },
  tileTitle: { fontSize: 20, lineHeight: 24, fontWeight: '700', color: ed.ink },

  crew: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: GUTTER, padding: 16,
    borderRadius: edRadius.md, backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: ed.surface },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  rollDeep: { paddingHorizontal: 14, height: 36, borderRadius: edRadius.pill, backgroundColor: ed.raised, justifyContent: 'center' },

  more: { marginHorizontal: GUTTER, borderRadius: edRadius.md, backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line, paddingHorizontal: 14 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  moreIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: ed.raised, alignItems: 'center', justifyContent: 'center' },
});
