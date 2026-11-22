/**
 * Review: everything people put forward that waits on a person at VIIBE.
 *
 *   Events         new submissions, events taken down by reports, and
 *                  organisers' on-site moves too far to apply by themselves
 *   Places         new grounds (theatres, parks, beaches)
 *   Certification  organisers and venues asking for VIIBE Certified
 *
 * There is no map library in the app, so each spot opens in Google Maps to be
 * checked, and the pin or ground size can be corrected by typing.
 * Routes: backend/app/routes/events.py, places.py, certification.py.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Linking, RefreshControl, Image, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edRadius } from '../../src/theme/editorial';
import { useVibeStore } from '../../src/store/vibeStore';
import CertifiedMark from '../../src/components/CertifiedMark';
import { EVENT_TYPE_LABELS, PLACE_TYPE_LABELS } from '../../src/services/submissions';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';
type Tab = 'events' | 'places' | 'certification';

const METHODS: { key: string; label: string }[] = [
  { key: 'link_and_contact_confirmed', label: 'Confirmed through the contact on their page' },
  { key: 'ticketing_partner', label: 'Confirmed by the ticketing partner' },
  { key: 'in_person', label: 'Met in person' },
];

const headers = () => useVibeStore.getState().getAuthHeaders();

// ── Demo ────────────────────────────────────────────────────────────────────
// The demo walks the same queue with invented submissions. Decisions only
// clear the card; nothing is sent.

/** A whole hour, h hours from the top of the current hour (demo times read like real ones). */
const hoursAhead = (h: number) => {
  const top = Math.floor(Date.now() / 3600_000) * 3600_000;
  return new Date(top + h * 3600_000).toISOString();
};
const DEMO_QUEUE: Record<string, any> = {
  '/admin/submissions': { events: [
    { state: 'pending', submitted_by: 'demo_user_007', claimed_organiser: 'Waterside Crew',
      claimed_ticket_url: null, reports: [], possible_duplicate: null,
      event: { id: 'demo-q-1', name: 'Waterside Sessions', venue_type: 'block_party', entry: 'door',
        listing: 'community', address: 'Admiralty Way, Lekki Phase 1', area: 'Lekki', geofence_radius_m: 200,
        coordinates: { lat: 6.4474, lng: 3.4725 }, starts_at: hoursAhead(30), ends_at: hoursAhead(36),
        description: 'Street party by the lagoon. DJs, suya stands and a dance-off at midnight.',
        lineup: ['DJ Lagoon', 'MC Tobi'] } },
    { state: 'pending', submitted_by: 'demo_user_011', claimed_organiser: 'Kemi Adé',
      claimed_ticket_url: 'https://tix.example/kemi', reports: [],
      possible_duplicate: { id: 'demo-sub-1', name: 'Kemi Adé Live' },
      event: { id: 'demo-q-2', name: 'Kemi Adé Live at the National Theatre', venue_type: 'concert', entry: 'ticketed',
        listing: 'community', address: 'National Theatre, Iganmu', area: 'Iganmu', geofence_radius_m: 350,
        coordinates: { lat: 6.4766, lng: 3.37 }, starts_at: hoursAhead(48), ends_at: hoursAhead(53) } },
    { state: 'move_requested', submitted_by: 'demo_user_007', claimed_organiser: 'Night Shift Collective',
      pending_location: { lat: 6.4251, lng: 3.4562, distance_m: 820 }, reports: [], possible_duplicate: null,
      event: { id: 'demo_venue_rave', name: 'Night Shift Rave', venue_type: 'rave', entry: 'door',
        listing: 'community', address: 'Landmark Beach, Oniru', area: 'Oniru', geofence_radius_m: 400,
        coordinates: { lat: 6.4228, lng: 3.4489 }, starts_at: hoursAhead(-2), ends_at: hoursAhead(8) } },
  ] },
  '/admin/places': { places: [
    { id: 'demo-qp-1', name: 'Muri Okunola Park', place_type: 'park', area: 'Victoria Island',
      address: 'Muri Okunola Park, Victoria Island, Lagos', location_source: 'openstreetmap',
      coordinates: { lat: 6.4321, lng: 3.422 }, ground_radius_m: 300, submitted_by: 'demo_user_011' },
  ] },
  '/admin/certification': { applications: [
    { id: 'demo-qc-1', kind: 'organiser', name: 'Night Shift Collective',
      links: ['https://tix.example/nightshift', 'https://instagram.com/nightshift.example'],
      contact: 'hello@nightshift.example', note: 'We run the monthly beach rave at Landmark.' },
  ] },
};
const demoDone = new Set<string>();

function demoCall(path: string, method: string) {
  if (method === 'GET') {
    const base = DEMO_QUEUE[path];
    if (path === '/admin/submissions') return { events: base.events.filter((q: any) => !demoDone.has(q.event.id)) };
    if (path === '/admin/places') return { places: base.places.filter((p: any) => !demoDone.has(p.id)) };
    return { applications: base.applications.filter((a: any) => !demoDone.has(a.id)) };
  }
  const id = path.split('/')[3];   // /admin/<kind>/<id>/<action>
  if (id) demoDone.add(id);
  return {};
}

async function call(path: string, method = 'GET', body?: unknown) {
  if (useVibeStore.getState().isDemoMode) return demoCall(path, method);
  const res = await fetch(`${API}/api${path}`, {
    method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const d = data?.detail;
    const msg = Array.isArray(d?.problems) ? d.problems.join(' ') : typeof d === 'string' ? d : `Failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

const mapsUrl = (c?: { lat: number; lng: number }) => (c ? `https://maps.google.com/?q=${c.lat},${c.lng}` : '');
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  hour12: true,
}) : '');

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, p, c] = await Promise.all([
        call('/admin/submissions'), call('/admin/places'), call('/admin/certification'),
      ]);
      setEvents(e.events || []);
      setPlaces(p.places || []);
      setApps(c.applications || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Could not load the queue.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); await load(); } catch (err: any) { Alert.alert('Not done', err.message); }
  };

  const counts = { events: events.length, places: places.length, certification: apps.length };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={[edType.kicker, styles.gutter]}>WAITING ON US</Text>
      <Text style={[edType.headline, styles.gutter, { marginTop: 4 }]}>Review</Text>
      <View style={[styles.tabs, styles.gutter]}>
        {(['events', 'places', 'certification'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}
            accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[edType.label, { color: tab === t ? ed.bg : ed.ink }]}>
              {t === 'certification' ? 'Certified' : t[0].toUpperCase() + t.slice(1)}
              {counts[t] ? ` ${counts[t]}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.gutter, { paddingBottom: 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={ed.inkSoft}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {error ? <Text style={[edType.body, { color: ed.danger, marginTop: 12 }]}>{error}</Text> : null}
        {tab === 'events' && (events.length ? events.map((q) => <EventCard key={q.event.id + q.state} q={q} act={act} />)
          : <Empty text="No events waiting." />)}
        {tab === 'places' && (places.length ? places.map((p) => <PlaceCard key={p.id} p={p} act={act} />)
          : <Empty text="No places waiting." />)}
        {tab === 'certification' && (apps.length ? apps.map((a) => <CertCard key={a.id} a={a} act={act} />)
          : <Empty text="No applications waiting." />)}
      </ScrollView>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <Ionicons name="checkmark-done-outline" size={36} color={ed.inkFaint} />
      <Text style={[edType.body, { marginTop: 8 }]}>{text}</Text>
    </View>
  );
}

// ── Shared pieces ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={edType.caption}>{label}</Text>
      <Text style={[edType.body, { color: ed.ink }]}>{value}</Text>
    </View>
  );
}

function Btn({ label, onPress, tone = 'plain' }: { label: string; onPress: () => void; tone?: 'go' | 'stop' | 'plain' }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button"
      style={[styles.btn, tone === 'go' && { backgroundColor: ed.pink, borderColor: ed.pink },
        tone === 'stop' && { borderColor: ed.danger }]}>
      <Text style={[edType.label, { color: tone === 'go' ? '#FFFFFF' : tone === 'stop' ? ed.danger : ed.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Reject needs a reason the submitter will read. */
function RejectBox({ onReject }: { onReject: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) return <Btn label="Reject" tone="stop" onPress={() => setOpen(true)} />;
  return (
    <View style={{ width: '100%', marginTop: 8 }}>
      <TextInput value={reason} onChangeText={setReason} placeholder="Reason they will see" placeholderTextColor={ed.inkFaint}
        style={styles.input} maxLength={500} multiline />
      <View style={styles.actions}>
        <Btn label="Cancel" onPress={() => setOpen(false)} />
        <Btn label="Send rejection" tone="stop" onPress={() => reason.trim() && onReject(reason.trim())} />
      </View>
    </View>
  );
}

/** Optional pin and ground-size correction, sent with the approval. */
function FixBox({ coords, radius, onChange }: {
  coords?: { lat: number; lng: number }; radius?: number;
  onChange: (fix: { coordinates?: { lat: number; lng: number }; radius?: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(coords ? String(coords.lat) : '');
  const [lng, setLng] = useState(coords ? String(coords.lng) : '');
  const [r, setR] = useState(radius ? String(Math.round(radius)) : '');
  const update = (a: string, b: string, c: string) => {
    const la = parseFloat(a), lo = parseFloat(b), ra = parseFloat(c);
    const moved = coords && Number.isFinite(la) && Number.isFinite(lo) && (la !== coords.lat || lo !== coords.lng);
    const resized = Number.isFinite(ra) && ra !== radius;
    onChange(moved || resized ? { coordinates: moved ? { lat: la, lng: lo } : undefined, radius: resized ? ra : undefined } : null);
  };
  if (!open) {
    return (
      <Text style={[edType.label, { color: ed.pink, marginTop: 10 }]} onPress={() => setOpen(true)} accessibilityRole="button">
        Correct the pin or ground size
      </Text>
    );
  }
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={edType.caption}>Copy the spot from Google Maps (long-press, then tap the numbers).</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <TextInput value={lat} onChangeText={(t) => { setLat(t); update(t, lng, r); }} placeholder="lat"
          placeholderTextColor={ed.inkFaint} keyboardType="numeric" style={[styles.input, { flex: 1, minWidth: 0 }]} />
        <TextInput value={lng} onChangeText={(t) => { setLng(t); update(lat, t, r); }} placeholder="lng"
          placeholderTextColor={ed.inkFaint} keyboardType="numeric" style={[styles.input, { flex: 1, minWidth: 0 }]} />
        <TextInput value={r} onChangeText={(t) => { setR(t); update(lat, lng, t); }} placeholder="m"
          placeholderTextColor={ed.inkFaint} keyboardType="numeric" style={[styles.input, { flex: 0.6, minWidth: 0 }]} />
      </View>
      <Text style={[edType.caption, { marginTop: 4 }]}>Ground radius in metres, 60 to 1500.</Text>
    </View>
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

const STATE_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: 'New submission', color: ed.gold },
  taken_down: { text: 'Taken down by reports', color: ed.danger },
  move_requested: { text: 'Organiser asked to move the pin', color: ed.gold },
};

function EventCard({ q, act }: { q: any; act: (fn: () => Promise<unknown>) => void }) {
  const e = q.event;
  const [fix, setFix] = useState<any>(null);
  const state = STATE_LABEL[q.state] || STATE_LABEL.pending;
  const cover = e.cover_image_url && !useVibeStore.getState().isDemoMode
    ? { uri: `${API}/api/admin/events/${e.id}/cover`, headers: headers() } : null;
  const approve = () => act(() => call(`/admin/events/${e.id}/approve`, 'POST', {
    ...(fix?.coordinates ? { coordinates: fix.coordinates } : {}),
    ...(fix?.radius ? { geofence_radius_m: fix.radius } : {}),
  }));

  return (
    <View style={styles.card}>
      <Text style={[edType.kicker, { color: state.color }]}>{state.text}</Text>
      {cover ? <Image source={cover} style={styles.cover} resizeMode="cover" /> : null}
      <Text style={[edType.title, { marginTop: 8 }]}>{e.name}</Text>
      <Text style={edType.caption}>
        {EVENT_TYPE_LABELS[e.venue_type as keyof typeof EVENT_TYPE_LABELS] || e.venue_type} · {e.entry === 'door' ? 'Door' : 'Ticketed'}
        {e.listing === 'official' ? ' · Official' : ' · Community'}
      </Text>
      {e.listing === 'official' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <CertifiedMark size={14} /><Text style={[edType.caption, { color: ed.pink }]}>By a certified organiser</Text>
        </View>
      ) : null}

      <Row label="When" value={`${when(e.starts_at)} to ${when(e.ends_at)}`} />
      <Row label="Where" value={`${e.address || ''}${e.area ? ` · ${e.area}` : ''} · ground ${Math.round(e.geofence_radius_m)} m`} />
      <Row label="Host they named" value={q.claimed_organiser} />
      <Row label="Ticket link they gave (not shown unless certified)" value={q.claimed_ticket_url} />
      <Row label="About" value={e.description} />
      <Row label="Lineup" value={(e.lineup || []).join(', ')} />
      <Row label="Submitted by (user id)" value={q.submitted_by} />
      {q.possible_duplicate ? (
        <Text style={[edType.label, { color: ed.danger, marginTop: 10 }]}>Looks like a duplicate of "{q.possible_duplicate.name}"</Text>
      ) : null}
      {q.reports?.length ? (
        <View style={{ marginTop: 10 }}>
          <Text style={[edType.label, { color: ed.danger }]}>{q.reports.length} report{q.reports.length > 1 ? 's' : ''}</Text>
          {q.reports.slice(0, 5).map((r: any, i: number) => (
            <Text key={i} style={edType.caption}>· {r.reason || r.kind || 'No reason given'}</Text>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.mapLink} onPress={() => Linking.openURL(mapsUrl(e.coordinates))} accessibilityRole="link">
        <Ionicons name="map-outline" size={16} color={ed.ink} />
        <Text style={edType.label}>Check the pin in Google Maps</Text>
      </TouchableOpacity>

      {q.state === 'move_requested' ? (
        <>
          <Row label="They asked to move it to"
            value={`${q.pending_location.lat.toFixed(5)}, ${q.pending_location.lng.toFixed(5)}${q.pending_location.distance_m ? ` (${q.pending_location.distance_m} m away)` : ''}`} />
          <TouchableOpacity style={styles.mapLink} onPress={() => Linking.openURL(mapsUrl(q.pending_location))} accessibilityRole="link">
            <Ionicons name="navigate-outline" size={16} color={ed.ink} />
            <Text style={edType.label}>See where they are standing</Text>
          </TouchableOpacity>
          <View style={styles.actions}>
            <Btn label="Keep the pin" onPress={() => act(() => call(`/admin/events/${e.id}/move/dismiss`, 'POST'))} />
            <Btn label="Move it there" tone="go" onPress={() => act(() => call(`/admin/events/${e.id}/move`, 'POST', {
              lat: q.pending_location.lat, lng: q.pending_location.lng, reason: 'organiser on site, checked by admin',
            }))} />
          </View>
        </>
      ) : (
        <>
          <FixBox coords={e.coordinates} radius={e.geofence_radius_m} onChange={setFix} />
          <View style={styles.actions}>
            <RejectBox onReject={(reason) => act(() => call(`/admin/events/${e.id}/reject`, 'POST', { reason }))} />
            <Btn label={q.state === 'taken_down' ? 'Put it back up' : fix ? 'Approve with fix' : 'Approve'} tone="go" onPress={approve} />
          </View>
        </>
      )}
    </View>
  );
}

// ── Places ──────────────────────────────────────────────────────────────────

function PlaceCard({ p, act }: { p: any; act: (fn: () => Promise<unknown>) => void }) {
  const [fix, setFix] = useState<any>(null);
  return (
    <View style={styles.card}>
      <Text style={[edType.kicker, { color: ed.gold }]}>New place</Text>
      <Text style={[edType.title, { marginTop: 8 }]}>{p.name}</Text>
      <Text style={edType.caption}>
        {PLACE_TYPE_LABELS[p.place_type as keyof typeof PLACE_TYPE_LABELS] || p.place_type} · {p.area || p.address}
        {' · '}{p.location_source === 'openstreetmap' ? 'from OpenStreetMap' : 'pinned by the person'}
      </Text>
      <Row label="Address" value={p.address} />
      <Row label="Ground" value={`${Math.round(p.ground_radius_m)} m radius`} />
      <Row label="Submitted by (user id)" value={p.submitted_by} />
      <TouchableOpacity style={styles.mapLink} onPress={() => Linking.openURL(mapsUrl(p.coordinates))} accessibilityRole="link">
        <Ionicons name="map-outline" size={16} color={ed.ink} />
        <Text style={edType.label}>Check the pin in Google Maps</Text>
      </TouchableOpacity>
      <FixBox coords={p.coordinates} radius={p.ground_radius_m} onChange={setFix} />
      <View style={styles.actions}>
        <RejectBox onReject={(reason) => act(() => call(`/admin/places/${p.id}/reject`, 'POST', { reason }))} />
        <Btn label={fix ? 'Approve with fix' : 'Approve'} tone="go" onPress={() => act(() => call(`/admin/places/${p.id}/approve`, 'POST', {
          ...(fix?.coordinates ? { coordinates: fix.coordinates } : {}),
          ...(fix?.radius ? { ground_radius_m: fix.radius } : {}),
        }))} />
      </View>
    </View>
  );
}

// ── Certification ───────────────────────────────────────────────────────────

function CertCard({ a, act }: { a: any; act: (fn: () => Promise<unknown>) => void }) {
  const [method, setMethod] = useState<string | null>(null);
  return (
    <View style={styles.card}>
      <Text style={[edType.kicker, { color: ed.gold }]}>{a.kind === 'vendor' ? 'Venue' : 'Organiser'} wants VIIBE Certified</Text>
      <Text style={[edType.title, { marginTop: 8 }]}>{a.name}</Text>
      <Row label="Contact they gave" value={a.contact} />
      <Row label="Note" value={a.note} />
      <Text style={[edType.caption, { marginTop: 8 }]}>Proof links</Text>
      {(a.links || []).map((l: string) => (
        <Text key={l} style={[edType.label, { color: ed.pink, marginTop: 4 }]} onPress={() => Linking.openURL(l)}
          accessibilityRole="link" numberOfLines={1}>{l}</Text>
      ))}
      <View style={styles.checklist}>
        <Text style={edType.label}>Before certifying</Text>
        <Text style={edType.caption}>1. Open each link. Is it really their ticketing page or website?</Text>
        <Text style={edType.caption}>2. Find the contact that page lists (email, phone, official account).</Text>
        <Text style={edType.caption}>3. Reach them there, not through the contact typed above, and confirm this application is theirs.</Text>
      </View>
      <Text style={[edType.caption, { marginTop: 12 }]}>How it was checked</Text>
      {METHODS.map((m) => (
        <TouchableOpacity key={m.key} onPress={() => setMethod(m.key)} style={styles.method} accessibilityRole="radio"
          accessibilityState={{ selected: method === m.key }}>
          <Ionicons name={method === m.key ? 'radio-button-on' : 'radio-button-off'} size={18}
            color={method === m.key ? ed.pink : ed.inkSoft} />
          <Text style={[edType.body, { color: ed.ink, flex: 1 }]}>{m.label}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.actions}>
        <RejectBox onReject={(reason) => act(() => call(`/admin/certification/${a.id}/reject`, 'POST', { reason }))} />
        <Btn label="Certify for a year" tone="go" onPress={() => {
          if (!method) { Alert.alert('Say how it was checked', 'Pick how you confirmed this is really them.'); return; }
          act(() => call(`/admin/certification/${a.id}/certify`, 'POST', { method }));
        }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ed.bg },
  gutter: { paddingHorizontal: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 6 },
  tab: {
    paddingHorizontal: 14, height: 36, borderRadius: edRadius.pill, backgroundColor: ed.raised,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ed.line,
  },
  tabOn: { backgroundColor: ed.ink, borderColor: ed.ink },
  card: {
    marginTop: 14, padding: 16, borderRadius: edRadius.md, backgroundColor: ed.surface,
    borderWidth: 1, borderColor: ed.line,
  },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: edRadius.sm, marginTop: 10, backgroundColor: ed.raised },
  mapLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: edRadius.sm, backgroundColor: ed.raised, alignSelf: 'flex-start',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'flex-end' },
  btn: {
    paddingHorizontal: 16, height: 40, borderRadius: edRadius.pill, borderWidth: 1, borderColor: ed.lineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    minHeight: 44, borderRadius: edRadius.sm, backgroundColor: ed.raised, borderWidth: 1, borderColor: ed.line,
    paddingHorizontal: 12, paddingVertical: 10, color: ed.ink, fontSize: 15,
  },
  checklist: { marginTop: 12, padding: 12, borderRadius: edRadius.sm, backgroundColor: ed.raised, gap: 4 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
});
