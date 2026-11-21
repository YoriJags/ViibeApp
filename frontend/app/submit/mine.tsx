/**
 * My submissions: every event and place this person put forward, where each
 * one stands, and the organiser screen link once an event is live.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Linking, TouchableOpacity, Alert } from 'react-native';
import { useVibeStore } from '../../src/store/vibeStore';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edSpace, edRadius } from '../../src/theme/editorial';
import { ScreenHeader, SectionLabel, PrimaryButton, GhostButton } from '../../src/components/submit/ui';
import SignInGate, { useCanSubmit } from '../../src/components/submit/SignInGate';
import {
  SubmittedEvent, SubmittedPlace, EVENT_TYPE_LABELS, PLACE_TYPE_LABELS, mySubmissions, organiserUrl, SubmitError,
} from '../../src/services/submissions';
import { formatLagos } from '../../src/components/submit/ui';

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Waiting for review', color: ed.gold, bg: ed.goldSoft },
  live: { label: 'Live on VIIBE', color: ed.success, bg: 'rgba(123,216,143,0.14)' },
  approved: { label: 'Approved', color: ed.success, bg: 'rgba(123,216,143,0.14)' },
  under_review: { label: 'Taken down for review', color: ed.danger, bg: 'rgba(255,122,107,0.12)' },
  rejected: { label: 'Not approved', color: ed.danger, bg: 'rgba(255,122,107,0.12)' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[edType.caption, { color: s.color, fontWeight: '700' }]}>{s.label}</Text>
    </View>
  );
}

export default function MySubmissionsScreen() {
  const canSubmit = useCanSubmit();
  const isDemoMode = useVibeStore((st) => st.isDemoMode);
  const [events, setEvents] = useState<SubmittedEvent[] | null>(null);
  const [places, setPlaces] = useState<SubmittedPlace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await mySubmissions();
      setEvents(r.events);
      setPlaces(r.places);
      setError(null);
    } catch (e) {
      setError(e instanceof SubmitError ? e.problems.join(' ') : 'No connection. Pull down to try again.');
      setEvents((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (canSubmit) load(); }, [canSubmit, load]));

  if (!canSubmit) return <SignInGate title="My submissions" />;

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const empty = events !== null && events.length === 0 && places.length === 0;

  return (
    <View style={styles.root}>
      <ScreenHeader kicker="Events and places you put forward" title="My submissions" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ed.inkSoft} />}
      >
        {error ? <Text style={[edType.caption, { color: ed.danger, marginBottom: edSpace.md }]}>{error}</Text> : null}

        {events === null ? (
          <Text style={edType.caption}>Loading...</Text>
        ) : empty ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={ed.inkSoft} />
            <Text style={[edType.title, { marginTop: edSpace.md }]}>Nothing yet</Text>
            <Text style={[edType.body, { marginTop: 6, textAlign: 'center' }]}>
              Know about a concert, rave or block party? Put it on the map.
            </Text>
            <View style={{ alignSelf: 'stretch', marginTop: edSpace.lg }}>
              <PrimaryButton label="Add an event" onPress={() => router.push('/submit/event' as any)} />
            </View>
          </View>
        ) : (
          <>
            {events.length ? <SectionLabel>Events</SectionLabel> : null}
            {events.map((item) => (
              <View key={item.event.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={edType.kicker}>{EVENT_TYPE_LABELS[item.event.venue_type] || 'Event'}</Text>
                  {item.event.listing === 'official' ? (
                    <View style={styles.official}>
                      <Ionicons name="checkmark-circle" size={14} color={ed.pink} />
                      <Text style={[edType.caption, { color: ed.pink, fontWeight: '700' }]}>Official</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[edType.title, { marginTop: 6 }]}>{item.event.name}</Text>
                <Text style={[edType.caption, { marginTop: 4 }]}>
                  {formatLagos(Date.parse(item.event.starts_at))}
                  {item.event.area || item.event.address ? ` · ${item.event.area || item.event.address}` : ''}
                </Text>
                <View style={{ marginTop: 12, flexDirection: 'row' }}><StatusPill status={item.status} /></View>
                {item.status === 'rejected' && item.reason ? (
                  <Text style={[edType.body, { marginTop: 10 }]}>{item.reason}</Text>
                ) : null}
                {item.status === 'under_review' ? (
                  <Text style={[edType.caption, { marginTop: 10, color: ed.inkSoft }]}>
                    People reported something about this event. It is off the map while we look.
                  </Text>
                ) : null}
                {item.organiser_link ? (
                  <TouchableOpacity
                    style={styles.organiser}
                    onPress={() => (isDemoMode
                      ? Alert.alert('Organiser screen', 'In the live app this opens the organiser screen: the energy on your ground, minute by minute, and the I am here button that fixes the pin on the night.')
                      : Linking.openURL(organiserUrl(item.organiser_link!)))}
                    accessibilityRole="link"
                  >
                    <Ionicons name="radio-outline" size={18} color={ed.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={edType.label}>Open the organiser screen</Text>
                      <Text style={edType.caption}>Live energy on your ground. Keep this link private.</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={ed.inkSoft} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {places.length ? <SectionLabel>Places</SectionLabel> : null}
            {places.map((item) => (
              <View key={item.place.id} style={styles.card}>
                <Text style={edType.kicker}>
                  {item.place.place_type ? PLACE_TYPE_LABELS[item.place.place_type] : 'Place'}
                </Text>
                <Text style={[edType.title, { marginTop: 6 }]}>{item.place.name}</Text>
                {item.place.area ? <Text style={[edType.caption, { marginTop: 4 }]}>{item.place.area}</Text> : null}
                <View style={{ marginTop: 12, flexDirection: 'row' }}><StatusPill status={item.status} /></View>
                {item.status === 'rejected' && item.reason ? (
                  <Text style={[edType.body, { marginTop: 10 }]}>{item.reason}</Text>
                ) : null}
              </View>
            ))}

            <View style={{ marginTop: edSpace.lg, gap: 10 }}>
              <PrimaryButton label="Add an event" onPress={() => router.push('/submit/event' as any)} />
              <GhostButton label="Add a place" icon="add-circle-outline" onPress={() => router.push('/submit/place' as any)} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ed.bg },
  content: { paddingHorizontal: edSpace.gutter, paddingBottom: edSpace.shelf * 2 },
  card: {
    padding: 16, borderRadius: edRadius.md, backgroundColor: ed.surface,
    borderWidth: 1, borderColor: ed.line, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  official: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: edRadius.pill },
  organiser: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12,
    borderRadius: edRadius.sm, backgroundColor: ed.raised,
  },
  empty: { alignItems: 'center', paddingTop: edSpace.shelf * 2, paddingHorizontal: edSpace.gutter },
});
