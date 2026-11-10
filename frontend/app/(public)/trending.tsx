/**
 * Tonight: the events home (design spec, Nov 2026).
 * Tonight / This week > events by day > hottest right now > by area.
 * Replaces "Trending": the stock ticker, the "exchange" board with % gains,
 * the podium and the Intel carousel. "By area" absorbs Intel's City Zones,
 * built from the selected city's own venues (the old zones feed listed an
 * Abuja district under Lagos).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVibeStore } from '../../src/store/vibeStore';
import VenueDiscoverFlow from '../../src/components/VenueDiscoverFlow';
import {
  DemoPill, Divider, EnergyDot, EventRow, InviteCard, readingOf, SectionHeader, VenueLike, VenueRow,
} from '../../src/components/ui';
import { color, energy, EnergyState, listRow, radius, size, space, type } from '../../src/theme/tokens';
import { ENERGY_ORDER } from '../../src/theme/energy';

const CITY_NAMES: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt', ibadan: 'Ibadan' };

function lagosDay(iso?: string | null): { key: string; label: string } {
  if (!iso) return { key: 'zz', label: 'Date to be announced' };
  const d = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...o }).format(d);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(d);
  const label = key === today ? 'Today' : `${fmt({ weekday: 'long' })}, ${fmt({ day: 'numeric', month: 'short' })}`;
  return { key, label };
}

export default function TonightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { venues, fetchVenues, selectedCity, isDemoMode, pickVenue } = useVibeStore();
  const [range, setRange] = useState<'tonight' | 'week'>('tonight');
  const [showDeck, setShowDeck] = useState(false);

  useEffect(() => { if (!isDemoMode && !venues.length) fetchVenues(selectedCity); }, [selectedCity, isDemoMode]);

  const list: VenueLike[] = useMemo(
    () => (isDemoMode ? (require('../../src/data/demoData').DEMO_VENUES as VenueLike[]) : (venues as VenueLike[])),
    [isDemoMode, venues],
  );
  const cityName = CITY_NAMES[selectedCity] ?? 'Lagos';
  const openVenue = (id: string) => router.push(`/venue/${id}`);

  // Events grouped by Lagos day.
  const groups = useMemo(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
    const evs = list
      .filter((v) => v.event && v.event.phase !== 'ended')
      .filter((v) => range === 'week' || v.event!.phase === 'live' || v.event!.phase === 'doors' || lagosDay(v.event!.starts_at).key === today)
      .sort((a, b) => String(a.event?.starts_at ?? '').localeCompare(String(b.event?.starts_at ?? '')));
    const map = new Map<string, { label: string; items: VenueLike[] }>();
    for (const e of evs) {
      const d = lagosDay(e.event!.starts_at);
      if (!map.has(d.key)) map.set(d.key, { label: d.label, items: [] });
      map.get(d.key)!.items.push(e);
    }
    return [...map.values()];
  }, [list, range]);

  const hottest = useMemo(() => list
    .filter((v) => !v.event && readingOf(v, isDemoMode).has)
    .sort((a, b) => (b.current_vibe_score ?? 0) - (a.current_vibe_score ?? 0))
    .slice(0, 5), [list, isDemoMode]);

  const areas = useMemo(() => {
    const map = new Map<string, { count: number; best: EnergyState | null }>();
    for (const v of list) {
      if (!v.area || v.event) continue;
      const r = readingOf(v, isDemoMode);
      const cur = map.get(v.area) ?? { count: 0, best: null };
      cur.count += 1;
      if (r.has && (!cur.best || ENERGY_ORDER.indexOf(r.state!) > ENERGY_ORDER.indexOf(cur.best))) cur.best = r.state!;
      map.set(v.area, cur);
    }
    const rank = (b: EnergyState | null) => (b ? ENERGY_ORDER.indexOf(b) : -1);
    return [...map.entries()].sort((a, b) => rank(b[1].best) - rank(a[1].best) || b[1].count - a[1].count);
  }, [list, isDemoMode]);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <Text style={s.title}>Tonight</Text>
          {isDemoMode && <DemoPill />}
        </View>
        <Text style={s.sub}>{cityName}</Text>

        <View style={s.segment}>
          {(['tonight', 'week'] as const).map((k) => (
            <Pressable key={k} onPress={() => setRange(k)} style={[s.segItem, range === k && s.segOn]}
              accessibilityRole="tab" accessibilityState={{ selected: range === k }}>
              <Text style={[s.segText, range === k && s.segTextOn]}>{k === 'tonight' ? 'Tonight' : 'This week'}</Text>
            </Pressable>
          ))}
        </View>

        {groups.length ? groups.map((g) => (
          <View key={g.label}>
            <SectionHeader title={g.label} />
            {g.items.map((e, i) => (
              <React.Fragment key={e.id}>
                {i > 0 && <Divider />}
                <EventRow venue={e} isDemo={isDemoMode} onPress={() => openVenue(e.id)} />
              </React.Fragment>
            ))}
          </View>
        )) : (
          <InviteCard
            title={range === 'tonight' ? 'No events listed for tonight' : 'No events listed this week'}
            body="Concerts, festivals and raves show here a week before they start."
            action={range === 'tonight' ? 'See this week' : 'Follow places'}
            onAction={() => (range === 'tonight' ? setRange('week') : setShowDeck(true))} />
        )}

        <SectionHeader title="Hottest right now" />
        {hottest.length ? hottest.map((v, i) => (
          <React.Fragment key={v.id}>
            {i > 0 && <Divider />}
            <VenueRow venue={v} isDemo={isDemoMode} onPress={() => openVenue(v.id)} />
          </React.Fragment>
        )) : (
          <InviteCard title="Nothing reading lit yet tonight" body="Follow places and we will tell you when they heat up."
            action="Follow places" onAction={() => setShowDeck(true)} />
        )}

        {areas.length > 0 && (
          <>
            <SectionHeader title="By area" />
            {areas.map(([area, a], i) => (
              <React.Fragment key={area}>
                {i > 0 && <Divider />}
                <View style={listRow}>
                  <View style={s.thumb}><EnergyDot state={a.best} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{area}</Text>
                    <Text style={s.rowMeta}>{a.count} {a.count === 1 ? 'venue' : 'venues'}</Text>
                  </View>
                  <Text style={[s.rowMeta, a.best ? { color: energy[a.best].ink } : null]}>
                    {a.best ? `Up to ${energy[a.best].label.toLowerCase()}` : 'No readings'}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </>
        )}
      </ScrollView>

      {showDeck && (
        <VenueDiscoverFlow venues={list as any} onFire={(v: any) => { pickVenue(v); }} onComplete={() => setShowDeck(false)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: size.topBar },
  title: { ...type.headline, color: color.ink },
  sub: { ...type.label, color: color.inkSoft, paddingHorizontal: space.md },
  segment: {
    flexDirection: 'row', backgroundColor: color.raised, borderRadius: radius.pill, padding: 4, gap: 4,
    marginHorizontal: space.md, marginTop: space.md,
  },
  segItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.accent },
  segText: { ...type.labelStrong, color: color.inkSoft },
  segTextOn: { color: color.inkOnAccent },
  thumb: { width: size.thumb, height: size.thumb, borderRadius: radius.sm, backgroundColor: color.raised, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...type.bodyStrong, color: color.ink },
  rowMeta: { ...type.caption, color: color.inkSoft, marginTop: 2 },
});
