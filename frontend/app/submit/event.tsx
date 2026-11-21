/**
 * Add an event: what, where, when, details. It goes to review, never straight
 * onto the map (backend/app/routes/events.py submit_event).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edSpace, edRadius } from '../../src/theme/editorial';
import {
  ScreenHeader, StepBar, SectionLabel, Footer, PrimaryButton, GhostButton, Chip, ChoiceCard, Field,
  Problems, PlaceCard, PlacePicker, WhenPicker, WhenValue, lagosIso, formatLagos,
} from '../../src/components/submit/ui';
import SignInGate, { useCanSubmit } from '../../src/components/submit/SignInGate';
import {
  EventType, Entry, PlaceResult, EVENT_TYPE_LABELS, submitEvent, SubmitError, organiserCertifiedName,
} from '../../src/services/submissions';
import { useVibeStore } from '../../src/store/vibeStore';

const TYPES: { type: EventType; icon: keyof typeof Ionicons.glyphMap; body: string }[] = [
  { type: 'concert', icon: 'mic-outline', body: 'An artist on a stage. Theatres, arenas, halls.' },
  { type: 'festival', icon: 'flag-outline', body: 'Several acts, often over more than one day.' },
  { type: 'rave', icon: 'pulse-outline', body: 'DJs through the night, often at a borrowed ground.' },
  { type: 'block_party', icon: 'people-outline', body: 'A street or compound party, open to the area.' },
];

const STEPS = ['What', 'Where', 'When', 'Details'];

export default function AddEventScreen() {
  const canSubmit = useCanSubmit();
  const city = useVibeStore((st) => st.selectedCity) || 'lagos';

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState<EventType | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [when, setWhen] = useState<WhenValue | null>(null);
  const [organiser, setOrganiser] = useState('');
  const [ticket, setTicket] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [certifiedAs, setCertifiedAs] = useState<string | null>(null);

  useEffect(() => {
    if (canSubmit) organiserCertifiedName().then(setCertifiedAs);
  }, [canSubmit]);

  const back = () => {
    setProblems([]);
    if (step > 0 && !sent) { setStep(step - 1); return true; }
    router.back();
    return true;
  };

  // Android's back button walks back through the steps, like the header arrow.
  useFocusEffect(React.useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [step, sent]));

  if (!canSubmit) return <SignInGate title="Add an event" />;
  if (sent) return <Sent name={name.trim()} />;

  const ticketBad = ticket.trim().length > 0 && !/^https:\/\/\S+\.\S+/.test(ticket.trim());
  const ready = [
    name.trim().length >= 2 && !!type && !!entry,
    !!place,
    !!when && when.startMs > Date.now() - 30 * 60000,
    !ticketBad,
  ][step];

  const next = async () => {
    setProblems([]);
    if (step < STEPS.length - 1) { setStep(step + 1); return; }
    if (!type || !entry || !place || !when) return;
    setBusy(true);
    try {
      await submitEvent({
        name, venue_type: type, entry, place,
        starts_at: lagosIso(when.startMs),
        ends_at: lagosIso(when.startMs + when.hours * 3600_000),
        organiser_name: organiser, ticket_url: ticket,
      }, city);
      setSent(true);
    } catch (e) {
      if (e instanceof SubmitError) {
        setProblems(e.existing ? [...e.problems, `It is listed as "${e.existing.name}".`] : e.problems);
      } else {
        setProblems(['No connection. Check your data and try again.']);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        kicker={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
        title={['What is on?', 'Where is it?', 'When is it?', 'Last details'][step]}
        onBack={back}
      />
      <StepBar step={step} total={STEPS.length} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <SectionLabel>Event name</SectionLabel>
            <Field value={name} onChangeText={setName} placeholder="e.g. Afro Nation Lagos" maxLength={120}
              autoCapitalize="words" />
            <SectionLabel>Kind of event</SectionLabel>
            {TYPES.map((t) => (
              <ChoiceCard key={t.type} title={EVENT_TYPE_LABELS[t.type]} body={t.body} icon={t.icon}
                selected={type === t.type} onPress={() => setType(t.type)} />
            ))}
            <SectionLabel>Getting in</SectionLabel>
            <View style={styles.row}>
              <Chip label="Ticketed" selected={entry === 'ticketed'} onPress={() => setEntry('ticketed')} />
              <Chip label="Pay at the door" selected={entry === 'door'} onPress={() => setEntry('door')} />
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[edType.body, { marginTop: edSpace.sm }]}>
              Events at a borrowed ground, like a concert at the National Theatre, are pinned to that place, not to the organiser.
            </Text>
            <View style={{ marginTop: edSpace.lg }}>
              {place ? (
                <PlaceCard place={place} onClear={() => setPlace(null)} />
              ) : (
                <PlacePicker city={city} onPick={setPlace} />
              )}
            </View>
            {place ? (
              <View style={styles.note}>
                <Ionicons name="shield-checkmark-outline" size={18} color={ed.inkSoft} />
                <Text style={[edType.caption, { flex: 1, color: ed.inkSoft }]}>
                  Only phones inside the ground count towards the event's energy, so the pin has to be right. We check it before the event goes live.
                </Text>
              </View>
            ) : null}
            <View style={{ marginTop: edSpace.lg }}>
              <GhostButton label="The place is not listed? Add it" icon="add-circle-outline"
                onPress={() => router.push('/submit/place' as any)} />
            </View>
          </>
        )}

        {step === 2 && <WhenPicker value={when} onChange={setWhen} />}

        {step === 3 && (
          <>
            {certifiedAs ? null : (
              <>
                <SectionLabel hint="Optional. Shown on Official listings only.">Organiser</SectionLabel>
                <Field value={organiser} onChangeText={setOrganiser} placeholder="Who is putting it on" maxLength={120}
                  autoCapitalize="words" />
              </>
            )}
            <SectionLabel hint="Optional. Must start with https://">Ticket link</SectionLabel>
            <Field value={ticket} onChangeText={setTicket} placeholder="https://" maxLength={500}
              autoCapitalize="none" keyboardType="url" />
            {ticketBad ? (
              <Text style={[edType.caption, { color: ed.danger, marginTop: 6 }]}>That does not look like a full https:// link.</Text>
            ) : null}

            {certifiedAs ? (
              <View style={[styles.listing, { borderColor: ed.pink }]}>
                <Text style={edType.kicker}>HOW IT WILL SHOW</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color={ed.pink} />
                  <Text style={edType.bodyStrong}>Official listing by {certifiedAs}</Text>
                </View>
                <Text style={[edType.caption, { marginTop: 4, color: ed.inkSoft }]}>
                  You are VIIBE Certified, so your name and ticket link show on the event.
                </Text>
              </View>
            ) : (
              <View style={styles.listing}>
                <Text style={edType.kicker}>HOW IT WILL SHOW</Text>
                <Text style={[edType.bodyStrong, { marginTop: 8 }]}>Community listing</Text>
                <Text style={[edType.caption, { marginTop: 4, color: ed.inkSoft }]}>
                  Name, place and time, without an organiser name or ticket link. Anyone could claim to be the organiser, so those show only once the organiser is VIIBE Certified.
                </Text>
                <Text style={[edType.label, { color: ed.pink, marginTop: 10 }]} accessibilityRole="link"
                  onPress={() => router.push('/submit/certify' as any)}>
                  Are you the organiser? Get certified
                </Text>
              </View>
            )}

            <SectionLabel>Check it</SectionLabel>
            <View style={styles.review}>
              <ReviewRow label="Event" value={`${name.trim()}${type ? ` · ${EVENT_TYPE_LABELS[type]}` : ''}`} onEdit={() => setStep(0)} />
              <ReviewRow label="Entry" value={entry === 'door' ? 'Pay at the door' : 'Ticketed'} onEdit={() => setStep(0)} />
              <ReviewRow label="Place" value={place ? place.name : ''} onEdit={() => setStep(1)} />
              <ReviewRow
                label="Time"
                value={when ? `${formatLagos(when.startMs)} to ${formatLagos(when.startMs + when.hours * 3600_000)}` : ''}
                onEdit={() => setStep(2)}
                last
              />
            </View>
          </>
        )}

        <Problems items={problems} />
      </ScrollView>

      <Footer>
        <PrimaryButton
          label={step === STEPS.length - 1 ? 'Send for review' : 'Continue'}
          onPress={next}
          disabled={!ready}
          busy={busy}
        />
      </Footer>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value, onEdit, last }: { label: string; value: string; onEdit: () => void; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, !last && { borderBottomWidth: 1, borderBottomColor: ed.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={edType.caption}>{label}</Text>
        <Text style={[edType.bodyStrong, { marginTop: 2 }]}>{value}</Text>
      </View>
      <Text style={[edType.label, { color: ed.pink }]} onPress={onEdit} accessibilityRole="button">Edit</Text>
    </View>
  );
}

function Sent({ name }: { name: string }) {
  const isDemoMode = useVibeStore((st) => st.isDemoMode);
  return (
    <View style={styles.root}>
      <ScreenHeader title="" onBack={() => router.back()} />
      <View style={styles.sent}>
        <View style={styles.sentIcon}>
          <Ionicons name="checkmark" size={36} color={ed.bg} />
        </View>
        <Text style={[edType.kicker, { marginTop: edSpace.lg }]}>SENT FOR REVIEW</Text>
        <Text style={[edType.headline, { marginTop: 6, textAlign: 'center' }]}>{name}</Text>
        <Text style={[edType.body, { marginTop: edSpace.md, textAlign: 'center' }]}>
          We check the place and the details, then it goes on the map. Most events are checked within a day.
          {isDemoMode ? ' In the demo it stays pending.' : ''}
        </Text>
      </View>
      <Footer>
        <PrimaryButton label="See my submissions" onPress={() => router.replace('/submit/mine' as any)} />
        <View style={{ height: 10 }} />
        <GhostButton label="Done" onPress={() => router.back()} />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ed.bg },
  content: { paddingHorizontal: edSpace.gutter, paddingBottom: edSpace.shelf },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  note: {
    flexDirection: 'row', gap: 10, marginTop: edSpace.md, padding: 14,
    borderRadius: edRadius.sm, backgroundColor: ed.surface,
  },
  listing: {
    marginTop: edSpace.lg, padding: 16, borderRadius: edRadius.md,
    backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
  },
  review: {
    borderRadius: edRadius.md, backgroundColor: ed.surface, borderWidth: 1, borderColor: ed.line,
    paddingHorizontal: 16,
  },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: edSpace.gutter * 1.5 },
  sentIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: ed.success,
    alignItems: 'center', justifyContent: 'center',
  },
});
