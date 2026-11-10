/**
 * Home: the map, and one sheet with tonight in the city.
 *
 * The redesign (design spec, Nov 2026) replaced fourteen stacked modules and
 * three launch pop-ups with the core loop: where the energy is, what is on,
 * and the next step. Demo mode shows the finished product with sample data,
 * marked once by the Demo pill. Real mode with no readings still shows every
 * venue and event, each with an action, never a dead screen.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useVibeStore } from '../../src/store/vibeStore';
import VibeMap from '../../src/components/VibeMap';
import { MockMap } from '../../src/components/MockMap';
import VenueDiscoverFlow from '../../src/components/VenueDiscoverFlow';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import AutoPresenceToggle from '../../src/components/AutoPresenceToggle';
import { useAutoPresenceSync } from '../../src/hooks/useAutoPresenceSync';
import { isAutoPresenceEnabled, syncWatchedVenues } from '../../src/services/autoPresence';
import {
  Button, Chip, DemoPill, Divider, EnergyDot, EventRow, InviteCard, readingOf, SectionHeader,
  VenueLike, VenueRow,
} from '../../src/components/ui';
import { color, elevation, icon, radius, sheet, sheetHandle, size, space, type } from '../../src/theme/tokens';

const CITIES = [
  { code: 'lagos', name: 'Lagos' },
  { code: 'abuja', name: 'Abuja' },
  { code: 'port_harcourt', name: 'Port Harcourt' },
  { code: 'ibadan', name: 'Ibadan' },
];

const FILTERS: { key: string; label: string; types?: string[]; events?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events', events: true },
  { key: 'clubs', label: 'Clubs', types: ['club'] },
  { key: 'lounges', label: 'Lounges', types: ['lounge', 'bar'] },
  { key: 'music', label: 'Live music', types: ['concert'] },
  { key: 'open', label: 'Open air', types: ['festival', 'rave', 'block_party'] },
];

const TAB_BAR_SPACE = 96;   // the floating tab bar, so the last row is never under it
const SHEET_PEEK = 300;     // header, summary, chips and the first row clear the tab bar

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const params = useLocalSearchParams<{ highlightVenue?: string }>();
  const {
    venues, fetchVenues, selectedCity, setSelectedCity, isDemoMode, fetchCityEnergy,
    pickVenue, followVenue, isInsideVenue, activeVenueId, activeVenueName, user,
  } = useVibeStore();

  // Auto check-in: keep the phone watching the venues nearest to you. This
  // was dropped in the home redesign by mistake, which silently stopped
  // geofences from ever being registered.
  useAutoPresenceSync(isDemoMode ? [] : (venues as any[]));
  const [autoOn, setAutoOn] = useState<boolean | null>(null);
  const [showAuto, setShowAuto] = useState(false);
  useEffect(() => { isAutoPresenceEnabled().then(setAutoOn).catch(() => setAutoOn(false)); }, [showAuto]);
  const closeAuto = async () => {
    setShowAuto(false);
    // Switched on just now: point the geofences at nearby venues straight away.
    if (await isAutoPresenceEnabled().catch(() => false)) syncWatchedVenues(venues as any[]).catch(() => {});
  };

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filter, setFilter] = useState('all');
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const list: VenueLike[] = useMemo(
    () => (isDemoMode ? (require('../../src/data/demoData').DEMO_VENUES as VenueLike[]) : (venues as VenueLike[])),
    [isDemoMode, venues],
  );
  const cityName = CITIES.find((c) => c.code === selectedCity)?.name ?? 'Lagos';

  // ── Location: real or unknown, never invented ──
  useEffect(() => {
    (async () => {
      if (isDemoMode) { setUserLocation({ lat: 6.4316, lng: 3.4223 }); return; }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { /* stays unknown */ }
    })();
  }, [isDemoMode]);

  useEffect(() => {
    if (!isDemoMode) fetchVenues(selectedCity);
    fetchCityEnergy(selectedCity);
  }, [selectedCity, isDemoMode]);

  // Back from a rating with "show on map": centre on that venue.
  useEffect(() => {
    if (params.highlightVenue) { setHighlighted(params.highlightVenue); snapTo('peek'); }
  }, [params.highlightVenue]);

  // ── Sheet ──
  const topY = insets.top + size.topBar + space.md;          // fully open
  const peekY = H - SHEET_PEEK - TAB_BAR_SPACE;              // resting
  const y = useRef(new Animated.Value(peekY)).current;
  const last = useRef(peekY);
  const [open, setOpen] = useState(false);
  const snapTo = (where: 'open' | 'peek') => {
    const to = where === 'open' ? topY : peekY;
    last.current = to;
    setOpen(where === 'open');
    Animated.spring(y, { toValue: to, useNativeDriver: true, tension: 70, friction: 13 }).start();
  };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => y.setValue(Math.min(peekY, Math.max(topY, last.current + g.dy))),
    onPanResponderRelease: (_, g) => {
      const mid = (topY + peekY) / 2;
      const end = last.current + g.dy;
      snapTo(g.vy < -0.5 || (g.vy <= 0.5 && end < mid) ? 'open' : 'peek');
    },
  })).current;

  // ── Content ──
  const f = FILTERS.find((x) => x.key === filter)!;
  const events = useMemo(() => list
    .filter((v) => v.event && v.event.phase !== 'ended')
    .sort((a, b) => String(a.event?.starts_at ?? '').localeCompare(String(b.event?.starts_at ?? ''))), [list]);
  const eventsOnNow = events.some((e) => e.event?.phase === 'live' || e.event?.phase === 'doors');

  const places = useMemo(() => list.filter((v) => !v.event && (!f.types || f.types.includes(v.venue_type ?? ''))), [list, f]);
  const read = places.filter((v) => readingOf(v, isDemoMode).has)
    .sort((a, b) => (b.current_vibe_score ?? 0) - (a.current_vibe_score ?? 0));
  const unread = places.filter((v) => !readingOf(v, isDemoMode).has).sort((a, b) => a.name.localeCompare(b.name));

  const hot = read.filter((v) => (v.current_vibe_score ?? 0) >= 65);
  const freshest = read.map((v) => v.last_rated_mins_ago).filter((m): m is number => m != null).sort((a, b) => a - b)[0];
  const summary = read.length === 0
    ? 'Quiet so far tonight. Readings appear as scouts arrive.'
    : `${hot.length || read.length} ${(hot.length || read.length) === 1 ? 'place' : 'places'} ${hot.length ? 'reading lit or higher' : 'with a reading'}${freshest != null ? `, updated ${freshest < 1 ? 'just now' : `${Math.round(freshest)} min ago`}` : ''}`;

  const openVenue = (id: string) => router.push(`/venue/${id}`);
  const demoInside = isDemoMode ? read[0] : undefined;
  const insideId = isDemoMode ? demoInside?.id : (isInsideVenue ? activeVenueId : null);
  const insideName = isDemoMode ? demoInside?.name : (activeVenueName || list.find((v) => v.id === activeVenueId)?.name);

  return (
    <View style={s.root}>
      {/* Map */}
      <View style={StyleSheet.absoluteFill}>
        <ErrorBoundary label="Map">
          {Platform.OS === 'web' ? (
            <MockMap venues={list as any} userLocation={userLocation} onVenuePress={(v: any) => openVenue(v.id)} highlightedVenueId={highlighted} />
          ) : (
            <VibeMap venues={list as any} userLocation={userLocation} onVenuePress={(v: any) => openVenue(v.id)} highlightedVenueId={highlighted} />
          )}
        </ErrorBoundary>
      </View>

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Pressable onPress={() => setShowCities(true)} style={s.cityBtn} hitSlop={8}
          accessibilityRole="button" accessibilityLabel={`City: ${cityName}. Change city`}>
          <Text style={s.city}>{cityName}</Text>
          <Ionicons name="chevron-down" size={icon.md} color={color.ink} />
        </Pressable>
        {isDemoMode && <DemoPill />}
      </View>

      {/* You're inside */}
      {insideId && insideName ? (
        <Animated.View style={[s.insideBar, { transform: [{ translateY: Animated.subtract(y, 72) }] }]}>
          <EnergyDot state={readingOf(list.find((v) => v.id === insideId) ?? { id: '', name: '' }, isDemoMode).state} />
          <Text style={s.insideText} numberOfLines={1}>You're inside {insideName}</Text>
          <Button label="Take a reading" style={s.insideBtn}
            onPress={() => router.push({ pathname: '/venue/[id]', params: { id: insideId, openRateModal: 'true' } } as any)} />
        </Animated.View>
      ) : null}

      {/* Sheet */}
      <Animated.View style={[s.sheet, { height: H - topY, transform: [{ translateY: y }] }]}>
        <View {...pan.panHandlers}>
          <Pressable onPress={() => snapTo(open ? 'peek' : 'open')} accessibilityRole="button"
            accessibilityLabel={open ? 'Collapse list' : 'Expand list'}>
            <View style={sheetHandle} />
          </Pressable>
          <Text style={s.sheetTitle}>Tonight in {cityName}</Text>
          <Text style={s.summary}>{summary}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {FILTERS.map((x) => <Chip key={x.key} label={x.label} selected={filter === x.key} onPress={() => setFilter(x.key)} />)}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom + space.lg }}
          scrollEnabled={open} showsVerticalScrollIndicator={false}>
          {(f.key === 'all' || f.events) && events.length > 0 && (
            <>
              <SectionHeader title={eventsOnNow ? 'On tonight' : 'This week'}
                action={events.length > 3 ? (showAllEvents ? 'Show less' : 'See all') : undefined}
                onAction={() => setShowAllEvents((x) => !x)} />
              {(showAllEvents ? events : events.slice(0, 3)).map((e) => (
                <EventRow key={e.id} venue={e} isDemo={isDemoMode} onPress={() => openVenue(e.id)} />
              ))}
            </>
          )}

          {!f.events && (
            <>
              {read.length > 0 && <SectionHeader title="Venues" />}
              {read.map((v, i) => (
                <React.Fragment key={v.id}>
                  {i > 0 && <Divider />}
                  <VenueRow venue={v} isDemo={isDemoMode} onPress={() => openVenue(v.id)} />
                </React.Fragment>
              ))}
              {unread.length > 0 && <SectionHeader title={read.length ? 'No reading yet' : 'Venues'} />}
              {unread.map((v, i) => (
                <React.Fragment key={v.id}>
                  {i > 0 && <Divider />}
                  <VenueRow venue={v} isDemo={isDemoMode} onPress={() => openVenue(v.id)}
                    onFollow={() => (isDemoMode ? undefined : followVenue(v.id))} />
                </React.Fragment>
              ))}
            </>
          )}

          {f.events && events.length === 0 && (
            <InviteCard title="No events listed this week" body="Concerts, festivals and raves show here a week before they start."
              action="See venues" onAction={() => setFilter('all')} />
          )}

          {!isDemoMode && user && autoOn === false && (
            <InviteCard title="Check in automatically"
              body="Your phone notices when you walk into a venue, so readings and prompts come to you. You choose, and you can turn it off any time."
              action="Turn on" onAction={() => setShowAuto(true)} />
          )}

          {!f.events && (
            <InviteCard title="Follow places to hear when they heat up"
              body="Swipe through what is near you and keep the ones you like."
              action="Follow places" onAction={() => setShowDeck(true)} />
          )}
        </ScrollView>
      </Animated.View>

      {/* City picker */}
      <Modal visible={showCities} transparent animationType="fade" onRequestClose={() => setShowCities(false)}>
        <Pressable style={s.scrim} onPress={() => setShowCities(false)}>
          <View style={[s.cityMenu, { marginTop: insets.top + size.topBar }]}>
            {CITIES.map((c) => (
              <Pressable key={c.code} style={s.cityRow} accessibilityRole="button"
                onPress={() => { setSelectedCity(c.code); setShowCities(false); }}>
                <Text style={[s.cityRowText, c.code === selectedCity && { color: color.ink }]}>{c.name}</Text>
                {c.code === selectedCity && <Ionicons name="checkmark" size={icon.md} color={color.ink} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Auto check-in explainer: the permission is sensitive, so it is explained first */}
      <Modal visible={showAuto} transparent animationType="slide" onRequestClose={closeAuto}>
        <Pressable style={s.scrim} onPress={closeAuto} accessibilityLabel="Close" />
        <View style={[sheet, s.autoSheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={sheetHandle} />
          <AutoPresenceToggle />
          <Button label="Done" variant="secondary" onPress={closeAuto} style={{ marginTop: space.md }} />
        </View>
      </Modal>

      {/* Follow places: the one swipe deck, opened on request, never on launch */}
      {showDeck && (
        <VenueDiscoverFlow venues={list as any} onFire={(v: any) => { pickVenue(v); }} onComplete={() => setShowDeck(false)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.topBar,
  },
  cityBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, minHeight: size.touch, marginTop: space.xs },
  city: { ...type.headline, color: color.ink },
  insideBar: {
    position: 'absolute', left: space.md, right: space.md, top: 0, height: 56,
    backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line,
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md, paddingRight: space.xxs,
    ...elevation.float,
  },
  insideText: { ...type.bodyStrong, color: color.ink, flex: 1 },
  insideBtn: { height: 44, paddingHorizontal: space.md },
  sheet: { ...sheet, position: 'absolute', left: 0, right: 0, top: 0 },
  sheetTitle: { ...type.title, color: color.ink, paddingHorizontal: space.md, marginTop: space.xxs },
  summary: { ...type.label, color: color.inkSoft, paddingHorizontal: space.md, marginTop: space.xxs },
  chips: { gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm },
  scrim: { flex: 1, backgroundColor: color.scrim },
  autoSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md },
  cityMenu: {
    marginHorizontal: space.md, backgroundColor: color.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: color.line, paddingVertical: space.xxs,
  },
  cityRow: {
    minHeight: size.touch + 4, paddingHorizontal: space.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  cityRowText: { ...type.body, color: color.inkSoft },
});
