/**
 * The VIIBE component kit. Every screen composes from these, and every value
 * comes from src/theme/tokens.ts. No hex, no emoji, no gradients in here.
 * See the design spec (DESIGN_SYSTEM.md) for the rules behind each piece.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  buttonPrimary, buttonPrimaryText, buttonSecondary, buttonSecondaryText, card,
  chip, chipSelected, chipSelectedText, chipText, color, energy, EnergyState,
  hairline, icon, listRow, radius, readingAge, size, space, type,
} from '../../theme/tokens';
import { asEnergyState, energyStateFor } from '../../theme/energy';

// ─── Venue reading, decided once ─────────────────────────────────────────────

export type VenueLike = {
  id: string;
  name: string;
  area?: string;
  venue_type?: string;
  current_vibe_score?: number;
  energy_level?: string;
  vibe_state?: string;
  capacity_level?: string;
  energy_source?: 'scouts' | 'demo' | 'none';
  last_rated_mins_ago?: number | null;
  event?: { phase: string; entry?: string; event_type?: string; starts_at?: string | null };
};

const READING_LIFE_MIN = 90; // matches the decay window: older than this is no reading

/**
 * What a venue's reading is, if it has one. A score counts only when it comes
 * from scouts or is clearly demo; an expired or absent reading is "no reading".
 */
export function readingOf(v: VenueLike, isDemo: boolean) {
  const score = Math.round(v.current_vibe_score ?? 0);
  const real = v.energy_source === 'scouts';
  const demo = isDemo || v.energy_source === 'demo';
  const expired = v.last_rated_mins_ago != null && v.last_rated_mins_ago > READING_LIFE_MIN;
  if (!(real || demo) || score <= 0 || expired) {
    return { has: false as const, state: null, score: 0, age: 'No reading yet', demo };
  }
  const state: EnergyState = v.vibe_state || v.energy_level
    ? asEnergyState(v.vibe_state || v.energy_level)
    : energyStateFor(score, v.capacity_level);
  // A reading with no known time: say what we know, never "No reading yet"
  // next to a score.
  const age = v.last_rated_mins_ago != null ? readingAge(v.last_rated_mins_ago) : (demo && !real ? 'Demo reading' : '');
  return { has: true as const, state, score, age, demo: demo && !real };
}

const titleCase = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');

// ─── Energy dot ──────────────────────────────────────────────────────────────

export function EnergyDot({ state, sizePx = size.dot }: { state: EnergyState | null; sizePx?: number }) {
  if (!state) {
    return <View style={{ width: sizePx, height: sizePx, borderRadius: sizePx, borderWidth: 1.5, borderColor: color.inkFaint }} />;
  }
  return <View style={{ width: sizePx, height: sizePx, borderRadius: sizePx, backgroundColor: energy[state].fill }} />;
}

// ─── Rows ────────────────────────────────────────────────────────────────────

export function VenueRow({ venue, isDemo, onPress, onFollow }: {
  venue: VenueLike; isDemo: boolean; onPress: () => void; onFollow?: () => void;
}) {
  const r = readingOf(venue, isDemo);
  const meta = [venue.area, titleCase(venue.venue_type)].filter(Boolean).join(', ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [listRow, pressed && s.pressed]}
      accessibilityRole="button" accessibilityLabel={`${venue.name}, ${r.has ? `${energy[r.state!].label} ${r.score}` : 'no reading yet'}`}>
      <View style={s.thumb}><EnergyDot state={r.state} /></View>
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>{venue.name}</Text>
        {!!meta && <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text>}
      </View>
      {r.has ? (
        <View style={s.rowEnd}>
          <Text style={[s.score, { color: energy[r.state!].ink }]}>{energy[r.state!].label} {r.score}</Text>
          <Text style={s.rowMeta}>{r.age}</Text>
        </View>
      ) : onFollow ? (
        <Pressable onPress={onFollow} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Follow ${venue.name}`}>
          <Text style={s.textAction}>Follow</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function eventWhen(e: NonNullable<VenueLike['event']>): { day: string; mon: string; when: string } {
  const d = e.starts_at ? new Date(e.starts_at) : null;
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try { return d ? new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...o }).format(d) : ''; } catch { return ''; }
  };
  const when = e.phase === 'live' ? 'Live now' : e.phase === 'doors' ? 'Doors open'
    : `${fmt({ weekday: 'short' })} ${fmt({ hour: 'numeric', minute: '2-digit' })}`.trim();
  return { day: fmt({ day: 'numeric' }), mon: fmt({ month: 'short' }), when };
}

export function EventRow({ venue, isDemo, onPress }: { venue: VenueLike; isDemo: boolean; onPress: () => void }) {
  const e = venue.event!;
  const w = eventWhen(e);
  const r = readingOf(venue, isDemo);
  const on = e.phase === 'live' || e.phase === 'doors';
  const meta = [venue.area, e.entry === 'ticketed' ? 'ticketed' : e.entry === 'door' ? 'door entry' : ''].filter(Boolean).join(', ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [listRow, pressed && s.pressed]} accessibilityRole="button">
      <View style={s.dateTile}>
        <Text style={s.dateDay}>{w.day}</Text>
        <Text style={s.dateMon}>{w.mon}</Text>
      </View>
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>{venue.name}</Text>
        {!!meta && <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text>}
      </View>
      <View style={s.rowEnd}>
        {on && r.has ? (
          <>
            <Text style={[s.score, { color: energy[r.state!].ink }]}>{energy[r.state!].label} {r.score}</Text>
            <Text style={s.rowMeta}>{r.age}</Text>
          </>
        ) : (
          <Text style={[s.rowMeta, on && { color: color.ink }]}>{w.when}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[chip, selected && chipSelected, s.chipTouch]}
      accessibilityRole="button" accessibilityState={{ selected: !!selected }}>
      <Text style={[chipText, selected && chipSelectedText]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={s.textAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Divider() {
  return <View style={hairline} />;
}

export function Button({ label, onPress, variant = 'primary', icon: iconName, style, disabled }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary';
  icon?: keyof typeof Ionicons.glyphMap; style?: ViewStyle; disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [primary ? buttonPrimary : buttonSecondary, pressed && s.pressed, disabled && s.disabled, style]}>
      {iconName && <Ionicons name={iconName} size={icon.md} color={primary ? color.inkOnAccent : color.ink} />}
      <Text style={primary ? buttonPrimaryText : buttonSecondaryText}>{label}</Text>
    </Pressable>
  );
}

export function DemoPill() {
  return (
    <View style={s.demoPill} accessibilityLabel="Demo mode">
      <Text style={s.demoText}>Demo</Text>
    </View>
  );
}

/** The invitation that ends a list: never a dead end. */
export function InviteCard({ title, body, action, onAction }: { title: string; body?: string; action: string; onAction: () => void }) {
  return (
    <View style={[card, s.invite]}>
      <Text style={s.inviteTitle}>{title}</Text>
      {!!body && <Text style={s.inviteBody}>{body}</Text>}
      <Button label={action} variant="secondary" onPress={onAction} style={{ marginTop: space.sm }} />
    </View>
  );
}

const s = StyleSheet.create({
  pressed: { backgroundColor: color.raised },
  disabled: { opacity: 0.4 },
  thumb: {
    width: size.thumb, height: size.thumb, borderRadius: radius.sm, backgroundColor: color.raised,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.bodyStrong, color: color.ink },
  rowMeta: { ...type.caption, color: color.inkSoft, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', flexShrink: 0 },
  score: { ...type.title, fontSize: 16, lineHeight: 20 },
  textAction: { ...type.labelStrong, color: color.inkSoft },
  dateTile: {
    width: size.thumb, height: size.thumb, borderRadius: radius.sm, backgroundColor: color.raised,
    alignItems: 'center', justifyContent: 'center',
  },
  dateDay: { ...type.title, fontSize: 18, lineHeight: 20, color: color.ink },
  dateMon: { ...type.caption, color: color.inkSoft, marginTop: 0 },
  chipTouch: { minHeight: 32 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.md, marginTop: space.lg, marginBottom: space.xxs,
  },
  sectionTitle: { ...type.labelStrong, color: color.ink },
  demoPill: {
    paddingHorizontal: space.sm, height: 28, borderRadius: radius.pill, backgroundColor: color.raised,
    justifyContent: 'center',
  },
  demoText: { ...type.captionStrong, color: color.inkSoft },
  invite: { marginHorizontal: space.md, marginTop: space.lg },
  inviteTitle: { ...type.bodyStrong, color: color.ink },
  inviteBody: { ...type.label, color: color.inkSoft, marginTop: space.xxs },
});
