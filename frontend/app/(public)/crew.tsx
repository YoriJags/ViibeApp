/**
 * Crew (design spec, Nov 2026): go out together.
 * No crew: one invitation with Create and Join. With a crew: who is where,
 * the vote, the invite code. Replaces the hero glow, battery chip, feature
 * trio, radar and clout promises. Create, join, leave and vote logic unchanged.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert, Clipboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../../src/store/vibeStore';
import VoteCard from '../../src/components/VoteCard';
import AvatarDisplay from '../../src/components/AvatarDisplay';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import { Button, Chip, DemoPill, Divider, SectionHeader } from '../../src/components/ui';
import { card, color, icon, listRow, radius, sheet, sheetHandle, size, space, type } from '../../src/theme/tokens';

export default function CrewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useVibeStore((s) => s.user);
  const crew = useVibeStore((s) => s.crew);
  const isDemoMode = useVibeStore((s) => s.isDemoMode);
  const activeVote = useVibeStore((s) => s.activeVote);
  const lobbyVenues = useVibeStore((s) => s.lobbyVenues);
  const { fetchCrew, createCrew, joinCrew, leaveCrew, startVote, castVote, fetchLobby } = useVibeStore();

  const [sheetMode, setSheetMode] = useState<'create' | 'join' | null>(null);
  const [crewName, setCrewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchCrew(); fetchLobby(); }, []);

  const run = async (fn: () => Promise<any>) => {
    setLoading(true);
    try { await fn(); setSheetMode(null); setCrewName(''); setInviteCode(''); }
    catch (e: any) { Alert.alert('That did not work', e?.message || 'Try again in a moment.'); }
    setLoading(false);
  };

  const leave = () => {
    if (!crew) return;
    Alert.alert('Leave crew', crew.is_captain ? 'You are the captain, so leaving closes the crew for everyone.' : 'Leave this crew?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveCrew(crew.id) },
    ]);
  };

  const copy = () => {
    if (!crew) return;
    Clipboard.setString(crew.invite_code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p));

  const signedOut = !user && !isDemoMode;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <Text style={s.title}>{crew?.name || 'Crew'}</Text>
          {isDemoMode && <DemoPill />}
        </View>

        {!crew ? (
          <View style={[card, s.block, s.empty]}>
            <View style={s.emptyIcon}><Ionicons name="people-outline" size={icon.lg} color={color.ink} /></View>
            <Text style={s.emptyTitle}>Go out together</Text>
            <Text style={s.muted}>Make a crew to see where your friends are and vote on where to go.</Text>
            {signedOut ? (
              <Button label="Sign in to make a crew" onPress={() => router.push('/(public)/profile')} style={s.full} />
            ) : (
              <>
                <Button label="Create a crew" onPress={() => setSheetMode('create')} style={s.full} />
                <Button label="Join with a code" variant="secondary" onPress={() => setSheetMode('join')} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
              </>
            )}
          </View>
        ) : (
          <>
            <Pressable onPress={copy} style={s.codeRow} accessibilityRole="button" accessibilityLabel={`Invite code ${crew.invite_code}. Copy`}>
              <Text style={s.muted}>Invite code</Text>
              <Text style={s.code}>{crew.invite_code}</Text>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={icon.sm} color={color.inkSoft} />
            </Pressable>

            <SectionHeader title={`Members, ${(crew.member_details ?? []).length}`} />
            {(crew.member_details ?? []).map((m: any, i: number) => (
              <React.Fragment key={m.user_id}>
                {i > 0 && <Divider />}
                <View style={listRow}>
                  <AvatarDisplay config={m.avatar_config || null} username={m.username} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {m.username}{m.user_id === crew.captain_id ? '  ' : ''}
                      {m.user_id === crew.captain_id && <Text style={s.captain}>Captain</Text>}
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>{m.checked_in && m.venue_name ? `At ${m.venue_name}` : 'Not out yet'}</Text>
                  </View>
                  {m.checked_in && <View style={s.liveDot} />}
                </View>
              </React.Fragment>
            ))}

            {activeVote && user && (
              <>
                <SectionHeader title="Where to go" />
                <View style={s.block}>
                  <ErrorBoundary label="Vote">
                    <VoteCard options={(activeVote.options ?? []) as any} totalVotes={activeVote.total_votes ?? 0}
                      hasVoted={activeVote.has_voted || false} userId={user.id}
                      onVote={(venueId) => castVote(crew.id, activeVote.id, venueId).catch((e: any) => Alert.alert('Vote not counted', e?.message || ''))}
                      winner={(activeVote.status === 'completed' ? activeVote.winner : null) as any} />
                  </ErrorBoundary>
                </View>
              </>
            )}

            {crew.is_captain && !activeVote && (
              <View style={[card, s.block]}>
                <Text style={s.blockTitle}>Start a vote</Text>
                <Text style={s.muted}>Pick two to four places from your lobby and let the crew choose.</Text>
                {picking ? (
                  <>
                    <View style={s.chips}>
                      {(lobbyVenues ?? []).map((v: any) => (
                        <Chip key={v.id || v.venue_id} label={v.name || v.venue_name}
                          selected={picked.includes(v.id || v.venue_id)} onPress={() => togglePick(v.id || v.venue_id)} />
                      ))}
                    </View>
                    {!(lobbyVenues ?? []).length && <Text style={[s.muted, { marginTop: space.sm }]}>Save places to your lobby from their pages first.</Text>}
                    <Button label={`Start vote${picked.length ? `, ${picked.length} places` : ''}`} disabled={picked.length < 2 || loading}
                      onPress={() => run(async () => { await startVote(crew.id, picked); setPicking(false); setPicked([]); })}
                      style={{ marginTop: space.md }} />
                  </>
                ) : (
                  <Button label="Choose places" variant="secondary" onPress={() => setPicking(true)} style={{ marginTop: space.md }} />
                )}
              </View>
            )}

            <Pressable onPress={leave} style={s.leave} accessibilityRole="button">
              <Text style={s.leaveText}>{crew.is_captain ? 'Close this crew' : 'Leave crew'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal visible={!!sheetMode} transparent animationType="slide" onRequestClose={() => setSheetMode(null)}>
        <Pressable style={s.scrim} onPress={() => setSheetMode(null)} accessibilityLabel="Close" />
        <View style={[sheet, s.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={sheetHandle} />
          <Text style={s.sheetTitle}>{sheetMode === 'create' ? 'Name your crew' : 'Enter the invite code'}</Text>
          {sheetMode === 'create' ? (
            <TextInput value={crewName} onChangeText={setCrewName} maxLength={20} placeholder="Crew name"
              placeholderTextColor={color.inkFaint} style={s.input} autoFocus />
          ) : (
            <TextInput value={inviteCode} onChangeText={(t) => setInviteCode(t.toUpperCase())} maxLength={8}
              placeholder="6 letters or numbers" placeholderTextColor={color.inkFaint} autoCapitalize="characters"
              style={[s.input, s.codeInput]} autoFocus />
          )}
          <Button label={sheetMode === 'create' ? 'Create crew' : 'Join crew'}
            disabled={loading || (sheetMode === 'create' ? crewName.trim().length < 2 : inviteCode.length < 6)}
            onPress={() => run(() => (sheetMode === 'create' ? createCrew(crewName.trim()) : joinCrew(inviteCode)))}
            style={{ marginTop: space.md }} />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: size.topBar },
  title: { ...type.headline, color: color.ink, flexShrink: 1 },
  block: { marginHorizontal: space.md, marginTop: space.md },
  blockTitle: { ...type.bodyStrong, color: color.ink, marginBottom: space.xxs },
  empty: { alignItems: 'center', paddingVertical: space.xl },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.raised, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...type.title, color: color.ink, marginTop: space.md },
  muted: { ...type.label, color: color.inkSoft, textAlign: 'left' },
  full: { alignSelf: 'stretch', marginTop: space.lg },
  codeRow: {
    ...card, marginHorizontal: space.md, marginTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm,
  },
  code: { ...type.title, color: color.ink, flex: 1, letterSpacing: 2 },
  rowTitle: { ...type.bodyStrong, color: color.ink },
  rowMeta: { ...type.caption, color: color.inkSoft, marginTop: 2 },
  captain: { ...type.captionStrong, color: color.inkSoft },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.success },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  leave: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: space.xl },
  leaveText: { ...type.labelStrong, color: color.danger },
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md },
  sheetTitle: { ...type.title, color: color.ink, marginTop: space.xs },
  input: {
    ...type.body, color: color.ink, backgroundColor: color.raised, borderRadius: radius.sm,
    paddingHorizontal: space.md, height: 52, marginTop: space.md,
  },
  codeInput: { ...type.title, letterSpacing: 4, textAlign: 'center' },
});
