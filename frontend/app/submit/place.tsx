/**
 * Add a place: a permanent ground that hosts events (a theatre, a park, a
 * beach). It waits for review like an event (backend/app/routes/places.py).
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edSpace } from '../../src/theme/editorial';
import {
  ScreenHeader, SectionLabel, Footer, PrimaryButton, GhostButton, Chip, Field, Problems, PlaceCard, PlacePicker,
} from '../../src/components/submit/ui';
import SignInGate, { useCanSubmit } from '../../src/components/submit/SignInGate';
import {
  PlaceResult, PlaceType, PLACE_TYPE_LABELS, submitPlace, SubmitError,
} from '../../src/services/submissions';
import { useVibeStore } from '../../src/store/vibeStore';

const TYPES = Object.keys(PLACE_TYPE_LABELS) as PlaceType[];

export default function AddPlaceScreen() {
  const canSubmit = useCanSubmit();
  const city = useVibeStore((st) => st.selectedCity) || 'lagos';
  const [location, setLocation] = useState<PlaceResult | null>(null);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [type, setType] = useState<PlaceType | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!canSubmit) return <SignInGate title="Add a place" />;

  const pick = (p: PlaceResult) => {
    setLocation(p);
    // A map result brings its name and kind; standing somewhere does not.
    if (p.source !== 'here') {
      if (!name) setName(p.name);
      if (!type && p.place_type) setType(p.place_type);
      if (!area && p.area) setArea(p.area);
    }
  };

  const send = async () => {
    if (!location || !type) return;
    setBusy(true);
    setProblems([]);
    try {
      await submitPlace({ name, place_type: type, area, location }, city);
      setSent(true);
    } catch (e) {
      setProblems(e instanceof SubmitError ? e.problems : ['No connection. Check your data and try again.']);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="" />
        <View style={styles.sent}>
          <View style={styles.sentIcon}><Ionicons name="checkmark" size={36} color={ed.bg} /></View>
          <Text style={[edType.kicker, { marginTop: edSpace.lg }]}>SENT FOR REVIEW</Text>
          <Text style={[edType.headline, { marginTop: 6, textAlign: 'center' }]}>{name.trim()}</Text>
          <Text style={[edType.body, { marginTop: edSpace.md, textAlign: 'center' }]}>
            It shows up in place search once we have checked the pin. Track it in My submissions.
          </Text>
        </View>
        <Footer>
          <PrimaryButton label="Done" onPress={() => router.back()} />
        </Footer>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader kicker="A ground that hosts events" title="Add a place" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={edType.body}>
          For theatres, parks, beaches, fields and streets. Clubs and lounges join through Claim your venue.
        </Text>

        <SectionLabel>Where it is</SectionLabel>
        {location ? <PlaceCard place={location} onClear={() => setLocation(null)} /> : <PlacePicker city={city} onPick={pick} />}

        {location ? (
          <>
            <SectionLabel>Name</SectionLabel>
            <Field value={name} onChangeText={setName} placeholder="What people call it" maxLength={120}
              autoCapitalize="words" />
            <SectionLabel>Area</SectionLabel>
            <Field value={area} onChangeText={setArea} placeholder="e.g. Iganmu" maxLength={80} autoCapitalize="words" />
            <SectionLabel>Kind of place</SectionLabel>
            <View style={styles.wrap}>
              {TYPES.map((t) => (
                <Chip key={t} label={PLACE_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
              ))}
            </View>
          </>
        ) : null}

        <Problems items={problems} />
        {location ? null : (
          <View style={{ marginTop: edSpace.lg }}>
            <GhostButton label="Cancel" onPress={() => router.back()} />
          </View>
        )}
      </ScrollView>
      {location ? (
        <Footer>
          <PrimaryButton label="Send for review" onPress={send} busy={busy}
            disabled={name.trim().length < 2 || !type} />
        </Footer>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ed.bg },
  content: { paddingHorizontal: edSpace.gutter, paddingBottom: edSpace.shelf },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: edSpace.gutter * 1.5 },
  sentIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: ed.success,
    alignItems: 'center', justifyContent: 'center',
  },
});
