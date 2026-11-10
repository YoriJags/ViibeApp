/**
 * Venue screen. One scrolling page (design spec, Nov 2026):
 *   hero (real photo, or the room's heat as an ironbow field, or flat when there
 *   is no reading) > the energy block (score once, with its age) > crowd, door,
 *   entry > when to leave (ticketed events) > tonight so far > details >
 *   one action at the bottom.
 * Replaces a 2,300-line screen that showed the score four times beside
 * contradictions, inner tabs, stories, a reactor and celebration overlays.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVibeStore } from '../../src/store/vibeStore';
import { usePlacePhoto, photoCredit } from '../../src/services/usePlacePhoto';
import { sampleArrivalSound } from '../../src/services/arrivalSample';
import { calculateDistance } from '../../src/utils/geo';
import { getBoltCoordinates } from '../../src/utils/boltLocation';
import { useDwellTracker } from '../../src/hooks/useDwellTracker';
import { useAudioSensor } from '../../src/hooks/useAudioSensor';
import WhenToLeaveCard from '../../src/components/WhenToLeaveCard';
import TonightCurve from '../../src/components/TonightCurve';
import AmbientOptInModal from '../../src/components/AmbientOptInModal';
import ReadingSheet, { ReadingData } from '../../src/components/ReadingSheet';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import analytics, { EVENT } from '../../src/services/analytics';
import { Button, DemoPill, readingOf } from '../../src/components/ui';
import {
  card, color, energy, icon, ironbowStops, listRow, radius, size, space, type,
} from '../../src/theme/tokens';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const HERO_H = 280;

const CROWD: Record<string, string> = { sparse: 'Sparse', vibrant: 'Filling up', full: 'Packed' };
const DOOR: Record<string, string> = { clear: 'Walk in', slow: 'Slow', blocked: 'Jammed' };
const titleCase = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');

function eventLine(e: any): string {
  try {
    const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...o }).format(new Date(d));
    const when = e.phase === 'live' ? 'On now' : e.phase === 'doors' ? 'Doors open'
      : e.starts_at ? `${f(e.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })}, ${f(e.starts_at, { hour: 'numeric', minute: '2-digit' })}` : 'Coming up';
    return `${when}, ${e.entry === 'ticketed' ? 'ticketed' : 'door entry'}`;
  } catch { return e.entry === 'ticketed' ? 'Ticketed' : 'Door entry'; }
}

export default function VenueScreen() {
  const { id, openRateModal, arrival } = useLocalSearchParams<{ id: string; openRateModal?: string; arrival?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    fetchVenue, getUserRatingStatus, user, isDemoMode, recordDirectionClick, setVenueGeofence,
    setLastRatedVenueId, updateUserClout, fetchTimeline, venueTimeline, timelinePeakHour, socket,
    getAuthHeaders, followVenue, unfollowVenue,
  } = useVibeStore();

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inside, setInside] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ratingStatus, setRatingStatus] = useState<any>(null);
  const [callsRemaining, setCallsRemaining] = useState(0);
  const [following, setFollowing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ambientOptedIn, setAmbientOptedIn] = useState(false);
  const [showAmbientModal, setShowAmbientModal] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const placePhoto = usePlacePhoto(id, !!venue && !venue.last_snapshot_url && !venue.event);
  useDwellTracker(id as string, inside);
  useAudioSensor(id as string, inside, ambientOptedIn);

  // Opened from the arrival prompt: take its one ten-second sound sample.
  const sampled = useRef(false);
  useEffect(() => {
    if (arrival !== '1' || !id || sampled.current) return;
    sampled.current = true;
    const st = useVibeStore.getState() as any;
    sampleArrivalSound(String(id), st.sessionToken ?? null, !!st.sensorPrefs?.ambientSound);
  }, [arrival, id]);

  const load = useCallback(async () => {
    if (isDemoMode) {
      const { DEMO_VENUES } = require('../../src/data/demoData');
      const v = DEMO_VENUES.find((x: any) => x.id === id);
      if (v) { setVenue(v); setLoading(false); return; }
    }
    const v = await fetchVenue(id || '');
    setVenue(v);
    setLoading(false);
    if (user && !isDemoMode) setRatingStatus(await getUserRatingStatus(id || ''));
  }, [id, isDemoMode, user?.id]);

  useEffect(() => {
    load();
    if (id) { fetchTimeline(id); analytics.track(EVENT.VENUE_VIEWED, { venue_id: id }); }
  }, [id]);

  // Live updates while the screen is open.
  useEffect(() => {
    if (!socket || !venue?.id) return;
    socket.emit('join_venue', { venue_id: venue.id });
    const onUpdate = (u: any) => { if (u?.id === venue.id) setVenue((p: any) => (p ? { ...p, ...u, event: p.event } : u)); };
    socket.on('venue_update', onUpdate);
    return () => { socket.off('venue_update', onUpdate); };
  }, [socket, venue?.id]);

  // Watching: the venue sees how many people are following its energy now.
  useEffect(() => {
    if (!id || isDemoMode) return;
    let alive = true;
    const ping = async () => {
      try {
        const coordinates = await getBoltCoordinates();
        if (alive) await fetch(`${API_URL}/api/venues/${id}/orbit/ping`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ coordinates }) });
      } catch {}
    };
    ping();
    const t = setInterval(ping, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [id, isDemoMode]);

  // Inside the venue? Needs the venue's coordinates, so it runs once loaded.
  useEffect(() => {
    if (!venue?.id) return;
    (async () => {
      if (isDemoMode) {
        setInside(true);
        setVenueGeofence(venue.id, venue.name, venue.coordinates ?? null, true);
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !venue.coordinates) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(here);
        const within = calculateDistance(here.lat, here.lng, venue.coordinates.lat, venue.coordinates.lng) <= (venue.geofence_radius_m || 100);
        setInside(within);
        setVenueGeofence(venue.id, venue.name, venue.coordinates, within);
      } catch { /* stays outside */ }
    })();
    return () => setVenueGeofence(null, null, null, false);
  }, [venue?.id]);

  // Ambient sound: ask once, the first time someone is inside.
  useEffect(() => {
    if (!inside || isDemoMode) return;
    AsyncStorage.getItem('ambient_opt_in').then((v) => {
      if (v === 'true') setAmbientOptedIn(true);
      else if (v !== 'false') setShowAmbientModal(true);
    }).catch(() => {});
  }, [inside]);

  // The Call budget and follow state.
  useEffect(() => {
    if (!user || isDemoMode || !id) return;
    fetch(`${API_URL}/api/me/calls`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => setCallsRemaining(d?.remaining ?? 0)).catch(() => {});
    fetch(`${API_URL}/api/venues/${id}/follow-status`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => setFollowing(!!d?.following)).catch(() => {});
  }, [id, user?.id, isDemoMode]);

  // Opened from the arrival prompt or the "You're inside" bar.
  useEffect(() => {
    if (openRateModal === 'true' && venue && inside && user) setShowSheet(true);
  }, [openRateModal, venue?.id, inside]);

  const showToast = (msg: string) => {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const submit = async (d: ReadingData) => {
    if (!user || !venue) return;
    if (isDemoMode) {
      setShowSheet(false);
      showToast(`Demo reading, not sent. ${energy[d.energy].label} at ${venue.name}.`);
      return;
    }
    if (!userLocation) throw new Error('Turn on location to take a reading. It has to come from inside the venue.');
    const r = await fetch(`${API_URL}/api/ratings`, {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: user.id, venue_id: venue.id, energy: d.energy, capacity: d.capacity, gate: d.gate,
        coordinates: userLocation, staked: !!d.staked,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || 'That reading did not go through. Try again.');
    updateUserClout(data.clout_earned || 10);
    setLastRatedVenueId(venue.id);
    setShowSheet(false);
    showToast(`Reading sent. ${energy[d.energy].label} at ${venue.name}.`);
    load();
  };

  const toggleFollow = async () => {
    if (!user) { router.push('/(public)/profile'); return; }
    if (isDemoMode) { setFollowing((f) => !f); return; }
    if (following) { await unfollowVenue(venue.id); setFollowing(false); }
    else if (await followVenue(venue.id)) setFollowing(true);
  };

  const share = () => {
    const link = `https://vibeapp-production-1835.up.railway.app/venue/${venue.id}`;
    Share.share({ message: `${venue.name} on VIIBE: ${link}`, url: link }).catch(() => {});
  };

  const directions = () => {
    if (!venue?.coordinates) return;
    recordDirectionClick(venue.id);
    const { lat, lng } = venue.coordinates;
    const label = encodeURIComponent(venue.name);
    Linking.openURL(Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    }) as string).catch(() => {});
  };

  if (loading || !venue) {
    return (
      <View style={[s.root, s.center]}>
        {loading ? <ActivityIndicator color={color.inkSoft} /> : <Text style={s.muted}>This venue could not be found.</Text>}
      </View>
    );
  }

  const r = readingOf(venue, isDemoMode);
  const look = r.has ? energy[r.state!] : null;
  const photo = venue.last_snapshot_url || placePhoto?.url;
  const ticketed = venue.event?.entry === 'ticketed';
  const meta = venue.event ? eventLine(venue.event) : [titleCase(venue.venue_type), venue.area].filter(Boolean).join(', ');
  const scouts = venue.total_ratings_24h;
  const details = [
    venue.address || venue.area ? { icon: 'location-outline', label: 'Address', value: venue.address || venue.area, action: directions } : null,
    venue.music_genre ? { icon: 'musical-notes-outline', label: 'Music', value: venue.music_genre } : null,
    venue.dress_code ? { icon: 'shirt-outline', label: 'Dress code', value: venue.dress_code } : null,
    venue.hours ? { icon: 'time-outline', label: 'Hours', value: venue.hours } : null,
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; action?: () => void }[];
  const canRead = !!user && (inside || isDemoMode);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : look ? (
            <LinearGradient colors={[look.fill, color.bg]} start={{ x: 0.9, y: 0.95 }} end={{ x: 0.1, y: 0.05 }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color.surface }]} />
          )}
          <LinearGradient colors={['transparent', color.bg]} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[s.heroTop, { top: insets.top + space.xs }]}>
            <Pressable onPress={() => router.back()} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={icon.md} color={color.ink} />
            </Pressable>
            <View style={s.heroActions}>
              {isDemoMode && <DemoPill />}
              <Pressable onPress={share} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Share">
                <Ionicons name="share-outline" size={icon.md} color={color.ink} />
              </Pressable>
              <Pressable onPress={toggleFollow} style={s.iconBtn} accessibilityRole="button"
                accessibilityLabel={following ? 'Following. Tap to stop' : 'Follow for alerts'}>
                <Ionicons name={following ? 'notifications' : 'notifications-outline'} size={icon.md} color={color.ink} />
              </Pressable>
            </View>
          </View>
          <View style={s.heroBottom}>
            <Text style={s.name} numberOfLines={2}>{venue.name}</Text>
            {!!meta && <Text style={s.meta}>{meta}</Text>}
            {photo && placePhoto && !venue.last_snapshot_url && <Text style={s.credit} numberOfLines={1}>{photoCredit(placePhoto)}</Text>}
          </View>
        </View>

        {/* Energy */}
        <View style={[card, s.block]}>
          {r.has ? (
            <>
              <View style={s.energyRow}>
                <Text style={[s.energyWord, { color: look!.ink }]}>{look!.label}</Text>
                <Text style={[s.energyScore, { color: look!.ink }]}>{r.score}</Text>
              </View>
              <Text style={s.muted}>
                {[r.age, scouts ? `by ${scouts} ${scouts === 1 ? 'scout' : 'scouts'}` : ''].filter(Boolean).join(' ')}
              </Text>
              <View style={s.scale}>
                <LinearGradient colors={ironbowStops as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.scaleBar} />
                <View style={[s.marker, { left: `${Math.min(98, Math.max(2, r.score))}%` }]} />
              </View>
            </>
          ) : (
            <View style={s.emptyRow}>
              <View style={s.ring} />
              <View style={{ flex: 1 }}>
                <Text style={s.blockTitle}>No reading yet tonight</Text>
                <Text style={s.muted}>Readings appear when someone inside taps one.</Text>
              </View>
            </View>
          )}
        </View>

        {/* Crowd, door, entry */}
        <View style={[card, s.block, s.trio]}>
          {[
            { label: 'Crowd', value: r.has ? CROWD[venue.capacity_level] : undefined },
            { label: 'Door', value: r.has ? DOOR[venue.gate_level] : undefined },
            { label: 'Entry', value: venue.entry_fee || (ticketed ? 'Ticketed' : undefined) },
          ].map((x, i) => (
            <View key={x.label} style={[s.trioItem, i > 0 && s.trioDivider]}>
              <Text style={x.value ? s.trioValue : s.trioNone} numberOfLines={1}>{x.value || 'No report'}</Text>
              <Text style={s.caption}>{x.label}</Text>
            </View>
          ))}
        </View>

        {/* When to leave: ticketed events */}
        {ticketed && (
          <ErrorBoundary label="When to leave">
            <WhenToLeaveCard venueId={venue.id} />
          </ErrorBoundary>
        )}

        {/* Tonight so far */}
        <View style={[card, s.block]}>
          <Text style={s.blockTitle}>Tonight so far</Text>
          {venueTimeline && venueTimeline.length >= 3 ? (
            <ErrorBoundary label="Timeline">
              <TonightCurve points={venueTimeline as any} />
            </ErrorBoundary>
          ) : (
            <Text style={s.muted}>The curve fills in as readings arrive.</Text>
          )}
        </View>

        {/* Details */}
        {details.length > 0 && (
          <View style={[card, s.block, { paddingHorizontal: 0, paddingVertical: space.xxs }]}>
            {details.map((d, i) => (
              <Pressable key={d.label} onPress={d.action} disabled={!d.action}
                style={[listRow, { minHeight: 56 }, i > 0 && s.rowLine]} accessibilityRole={d.action ? 'button' : undefined}>
                <Ionicons name={d.icon} size={icon.md} color={color.inkSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={s.caption}>{d.label}</Text>
                  <Text style={s.detailValue} numberOfLines={2}>{d.value}</Text>
                </View>
                {d.action && <Text style={s.link}>Directions</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* One action */}
      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]}>
        {!user ? (
          <Button label="Sign in to take readings" onPress={() => router.push('/(public)/profile')} />
        ) : canRead ? (
          <Button label="Take a reading" icon="radio-outline" onPress={() => setShowSheet(true)} />
        ) : (
          <>
            <Button label={following ? 'Following' : 'Follow'} icon={following ? 'checkmark' : 'notifications-outline'}
              variant={following ? 'secondary' : 'primary'} onPress={toggleFollow} />
            <Text style={[s.caption, s.footNote]}>Go inside to take a reading. We will tell you when it heats up.</Text>
          </>
        )}
      </View>

      {toast && (
        <Animated.View pointerEvents="none" style={[s.toast, { top: insets.top + space.xs, opacity: toastAnim }]}>
          <View style={s.toastDot} />
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}

      <ReadingSheet visible={showSheet} venueName={venue.name} onClose={() => setShowSheet(false)} onSubmit={submit}
        cooldownSeconds={ratingStatus?.cooldown_remaining_seconds || 0} callsRemaining={callsRemaining} isDemo={isDemoMode} />

      <AmbientOptInModal
        visible={showAmbientModal}
        onAccept={async () => { await AsyncStorage.setItem('ambient_opt_in', 'true'); setAmbientOptedIn(true); setShowAmbientModal(false); }}
        onDecline={async () => { await AsyncStorage.setItem('ambient_opt_in', 'false'); setShowAmbientModal(false); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: { height: HERO_H, justifyContent: 'flex-end' },
  heroTop: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  iconBtn: { width: size.touch, height: size.touch, borderRadius: radius.pill, backgroundColor: color.scrim, alignItems: 'center', justifyContent: 'center' },
  heroBottom: { paddingHorizontal: space.md, paddingBottom: space.md },
  name: { ...type.headline, color: color.ink },
  meta: { ...type.label, color: color.inkSoft, marginTop: space.xxs },
  credit: { ...type.caption, color: color.inkFaint, marginTop: space.xxs },
  block: { marginHorizontal: space.md, marginTop: space.md },
  blockTitle: { ...type.bodyStrong, color: color.ink, marginBottom: space.xxs },
  energyRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  energyWord: { ...type.title },
  energyScore: { ...type.display },
  muted: { ...type.label, color: color.inkSoft },
  caption: { ...type.caption, color: color.inkSoft },
  scale: { height: 16, justifyContent: 'center', marginTop: space.md },
  scaleBar: { height: 6, borderRadius: 3 },
  marker: { position: 'absolute', width: 4, height: 16, borderRadius: 2, backgroundColor: color.ink, marginLeft: -2 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ring: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: color.inkFaint },
  trio: { flexDirection: 'row', paddingHorizontal: 0 },
  trioItem: { flex: 1, paddingHorizontal: space.sm, alignItems: 'center' },
  trioDivider: { borderLeftWidth: 1, borderLeftColor: color.line },
  trioValue: { ...type.bodyStrong, color: color.ink },
  trioNone: { ...type.bodyStrong, color: color.inkFaint },
  rowLine: { borderTopWidth: 1, borderTopColor: color.line },
  detailValue: { ...type.body, color: color.ink },
  link: { ...type.labelStrong, color: color.ink },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.surface,
    borderTopWidth: 1, borderTopColor: color.line, paddingHorizontal: space.md, paddingTop: space.md,
  },
  footNote: { textAlign: 'center', marginTop: space.xs },
  toast: {
    position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs,
    backgroundColor: color.raised, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  toastDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.success },
  toastText: { ...type.label, color: color.ink, flex: 1 },
});
