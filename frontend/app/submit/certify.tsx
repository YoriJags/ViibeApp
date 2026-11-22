/**
 * Apply for VIIBE Certified (organisers and vendors). Not the automatic
 * "Vibe Certified" energy badge: this one means a person at VIIBE checked
 * the proofs. The proof is a ticketing page or website link, confirmed
 * through the contact that page itself lists (routes/certification.py).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edSpace, edRadius } from '../../src/theme/editorial';
import {
  ScreenHeader, SectionLabel, Footer, PrimaryButton, GhostButton, ChoiceCard, Field, Problems,
} from '../../src/components/submit/ui';
import SignInGate, { useCanSubmit } from '../../src/components/submit/SignInGate';
import {
  CertApplication, CertKind, applyForCertification, myCertifications, SubmitError,
} from '../../src/services/submissions';
import { useVibeStore } from '../../src/store/vibeStore';
import CertifiedMark, { CertifiedPill } from '../../src/components/CertifiedMark';

const MAX_LINKS = 5;
const isLink = (l: string) => /^https:\/\/\S+\.\S+/.test(l.trim());

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CertifyScreen() {
  const canSubmit = useCanSubmit();
  const venueId = useVibeStore((st) => (st.user as any)?.merchant_venue_id as string | undefined);
  const [apps, setApps] = useState<CertApplication[] | null>(null);
  const [kind, setKind] = useState<CertKind>('organiser');
  const [name, setName] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try { setApps(await myCertifications()); } catch { setApps([]); }
  }, []);
  useFocusEffect(useCallback(() => { if (canSubmit) load(); }, [canSubmit, load]));

  if (!canSubmit) return <SignInGate title="VIIBE Certified" />;

  const filled = links.filter((l) => l.trim());
  const linksOk = filled.length >= 1 && filled.every(isLink);
  const ready = name.trim().length >= 2 && linksOk && contact.trim().length >= 5;
  const waiting = (apps || []).some((a) => a.kind === kind && a.status === 'pending');

  const send = async () => {
    setBusy(true);
    setProblems([]);
    try {
      await applyForCertification({ kind, name, links: filled, contact, note,
        venue_id: kind === 'vendor' ? venueId : undefined });
      setApplying(false);
      setName(''); setLinks(['']); setContact(''); setNote('');
      await load();
    } catch (e) {
      setProblems(e instanceof SubmitError ? e.problems : ['No connection. Check your data and try again.']);
    } finally {
      setBusy(false);
    }
  };

  const showForm = applying || (apps !== null && apps.length === 0);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader kicker="For organisers and venues" title="VIIBE Certified" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.badgeRow}>
          <CertifiedMark size={56} />
        </View>
        <Text style={edType.body}>
          Means a person at VIIBE checked who you are. Certified organisers list events as Official, with their name and ticket link. Certified venues carry the badge for a year.
        </Text>

        {apps && apps.length > 0 ? (
          <>
            <SectionLabel>Your applications</SectionLabel>
            {apps.map((a) => <AppCard key={a.id} app={a} />)}
          </>
        ) : null}

        {showForm ? (
          <>
            <SectionLabel>Applying as</SectionLabel>
            <ChoiceCard icon="megaphone-outline" title="Event organiser"
              body="You put on concerts, raves, festivals or block parties."
              selected={kind === 'organiser'} onPress={() => setKind('organiser')} />
            {venueId ? (
              <ChoiceCard icon="storefront-outline" title="Venue"
                body="The club, lounge or bar you manage on VIIBE."
                selected={kind === 'vendor'} onPress={() => setKind('vendor')} />
            ) : (
              <Text style={[edType.caption, { marginTop: 2 }]}>
                Run a venue? Claim it first, then certify it from here.
              </Text>
            )}

            {waiting ? (
              <Problems items={['You already have an application waiting. We will reply to the contact you gave.']} />
            ) : (
              <>
                <SectionLabel hint="Exactly as it appears on your tickets or signage.">
                  {kind === 'vendor' ? 'Venue name' : 'Organiser or brand name'}
                </SectionLabel>
                <Field value={name} onChangeText={setName} placeholder="e.g. Eko Sound Co." maxLength={120}
                  autoCapitalize="words" />

                <SectionLabel hint="Your ticketing page, website or official social page. 1 to 5 links.">Proof links</SectionLabel>
                {links.map((l, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Field
                      value={l}
                      onChangeText={(t) => setLinks(links.map((x, j) => (j === i ? t : x)))}
                      placeholder="https://"
                      maxLength={500}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    {l.trim() && !isLink(l) ? (
                      <Text style={[edType.caption, { color: ed.danger, marginTop: 4 }]}>Needs to be a full https:// link.</Text>
                    ) : null}
                  </View>
                ))}
                {links.length < MAX_LINKS ? (
                  <TouchableOpacity onPress={() => setLinks([...links, ''])} accessibilityRole="button">
                    <Text style={[edType.label, { color: ed.pink, paddingVertical: 6 }]}>+ Add another link</Text>
                  </TouchableOpacity>
                ) : null}

                <SectionLabel hint="Email or phone.">Business contact</SectionLabel>
                <Field value={contact} onChangeText={setContact} placeholder="bookings@yourbrand.com" maxLength={200}
                  autoCapitalize="none" />

                <SectionLabel hint="Optional.">Anything we should know</SectionLabel>
                <Field value={note} onChangeText={setNote} placeholder="e.g. we also run @handle on Instagram"
                  maxLength={1000} />

                <View style={styles.how}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={ed.inkSoft} />
                  <Text style={[edType.caption, { flex: 1, color: ed.inkSoft }]}>
                    Anyone can paste a real ticket page, so a link alone is not enough. We contact you through the email, phone or official account that page itself lists before we certify.
                  </Text>
                </View>
              </>
            )}
            <Problems items={problems} />
          </>
        ) : apps !== null ? (
          <View style={{ marginTop: edSpace.lg }}>
            <GhostButton label="Start another application" icon="add-circle-outline" onPress={() => setApplying(true)} />
          </View>
        ) : (
          <Text style={[edType.caption, { marginTop: edSpace.lg }]}>Loading...</Text>
        )}
      </ScrollView>
      {showForm && !waiting ? (
        <Footer>
          <PrimaryButton label="Send application" onPress={send} busy={busy} disabled={!ready} />
        </Footer>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Waiting for review', color: ed.gold, bg: ed.goldSoft },
  certified: { label: 'Certified', color: ed.pink, bg: ed.pinkSoft },
  rejected: { label: 'Not certified', color: ed.danger, bg: 'rgba(255,122,107,0.12)' },
  lapsed: { label: 'Lapsed, apply again', color: ed.inkSoft, bg: ed.raised },
};

function AppCard({ app }: { app: CertApplication }) {
  const s = STATUS[app.status] || STATUS.pending;
  return (
    <View style={styles.card}>
      <Text style={edType.kicker}>{app.kind === 'vendor' ? 'Venue' : 'Organiser'}</Text>
      <Text style={[edType.title, { marginTop: 6 }]}>{app.name}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {app.status === 'certified' ? <CertifiedPill size="md" /> : (
          <View style={[styles.pill, { backgroundColor: s.bg }]}>
            <Text style={[edType.caption, { color: s.color, fontWeight: '700' }]}>{s.label}</Text>
          </View>
        )}
      </View>
      {app.status === 'certified' && app.expires_at ? (
        <Text style={[edType.caption, { marginTop: 8 }]}>Until {formatDate(app.expires_at)}</Text>
      ) : null}
      {app.status === 'pending' ? (
        <Text style={[edType.caption, { marginTop: 8, color: ed.inkSoft }]}>
          We will reach you through {app.contact} or the contact on your links.
        </Text>
      ) : null}
      {app.status === 'rejected' && app.review?.reason ? (
        <Text style={[edType.body, { marginTop: 8 }]}>{app.review.reason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ed.bg },
  content: { paddingHorizontal: edSpace.gutter, paddingBottom: edSpace.shelf },
  badgeRow: { flexDirection: 'row', marginBottom: edSpace.md },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: edRadius.pill, backgroundColor: ed.pinkSoft,
  },
  how: {
    flexDirection: 'row', gap: 10, marginTop: edSpace.lg, padding: 14,
    borderRadius: edRadius.sm, backgroundColor: ed.surface,
  },
  card: {
    padding: 16, borderRadius: edRadius.md, backgroundColor: ed.surface,
    borderWidth: 1, borderColor: ed.line, marginBottom: 12,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: edRadius.pill },
});
