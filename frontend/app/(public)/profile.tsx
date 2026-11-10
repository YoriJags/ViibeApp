/**
 * You (design spec, Nov 2026).
 * Signed out: one welcome, phone log in or sign up, or look around (demo).
 * Signed in: identity, one stat row, then settings rows: auto check-in, prompt
 * rhythm, crew, your name, the venue dashboard for merchants (replaces the
 * floating floor switcher), exit demo, sign out.
 * Retired: cosmic sign, the three coloured header icons, the boxed dividers,
 * the night debrief, passport and after-party overlays, heat level-up ceremony.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../../src/store/vibeStore';
import AvatarDisplay from '../../src/components/AvatarDisplay';
import AvatarBuilder from '../../src/components/AvatarBuilder';
import AutoPresenceToggle from '../../src/components/AutoPresenceToggle';
import PromptCadencePicker from '../../src/components/PromptCadencePicker';
import { Button, DemoPill } from '../../src/components/ui';
import { card, color, icon, listRow, radius, sheet, sheetHandle, size, space, type } from '../../src/theme/tokens';

const STATUS: Record<string, string> = { newbie: 'New scout', regular: 'Regular', scout: 'Scout', elite: 'Elite scout' };

function Row({ icon: name, label, value, onPress, danger }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [listRow, { minHeight: 56 }, pressed && { backgroundColor: color.raised }]} accessibilityRole="button">
      <Ionicons name={name} size={icon.md} color={danger ? color.danger : color.inkSoft} />
      <Text style={[s.rowLabel, danger && { color: color.danger }]}>{label}</Text>
      {!!value && <Text style={s.rowValue} numberOfLines={1}>{value}</Text>}
      {!danger && <Ionicons name="chevron-forward" size={icon.sm} color={color.inkFaint} />}
    </Pressable>
  );
}

export default function YouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user, fetchUser, fetchAuthUser, createUser, loginUser, logout, loading, toggleDemoMode, isDemoMode,
    avatarConfig, updateAvatar, crew, fetchCrew, updateCallName,
  } = useVibeStore();
  const [mode, setMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showName, setShowName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => { fetchAuthUser().then((u) => { if (!u) fetchUser(); }); }, []);
  useEffect(() => { if (user?.id && !isDemoMode) fetchCrew(); }, [user?.id]);

  const doLogin = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    const r = await loginUser(phone.trim());
    setBusy(false);
    if (r.success) setMode('welcome');
    else Alert.alert('Could not log in', r.error || 'No account with that number. Create one instead.');
  };
  const doSignup = async () => {
    if (!username.trim() || !phone.trim()) return;
    setBusy(true);
    const ok = await createUser(username.trim(), phone.trim());
    setBusy(false);
    if (ok) setMode('welcome');
    else Alert.alert('Could not create the account', 'That name may be taken, or the number already has an account. Try logging in.');
  };
  const signOut = () => Alert.alert('Sign out', 'Sign out of VIIBE on this phone?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => logout() },
  ]);
  const saveName = async () => {
    const ok = await updateCallName(nameDraft.trim() || null);
    if (ok) setShowName(false);
    else Alert.alert('Name not saved', 'Try again in a moment.');
  };

  // ── Signed out ──
  if (!user) {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 96 }]}>
        <View style={s.authBody}>
          <Text style={s.mark}>VIIBE</Text>
          {mode === 'welcome' && (
            <>
              <Text style={s.headline}>Sign in to take readings and follow places.</Text>
              <Button label="Log in with phone" onPress={() => setMode('login')} style={s.authBtn} />
              <Button label="Create an account" variant="secondary" onPress={() => setMode('signup')} style={{ marginTop: space.sm }} />
              <Pressable onPress={toggleDemoMode} style={s.textBtn} accessibilityRole="button">
                <Text style={s.textBtnText}>Look around first</Text>
              </Pressable>
              <Text style={s.fine}>By continuing you agree to the Terms and Privacy Policy.</Text>
            </>
          )}
          {mode !== 'welcome' && (
            <>
              <Text style={s.headline}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
              {mode === 'signup' && (
                <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={color.inkFaint}
                  autoCapitalize="none" style={s.input} />
              )}
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={color.inkFaint}
                keyboardType="phone-pad" style={s.input} />
              <Button label={busy || loading ? 'Please wait' : mode === 'login' ? 'Log in' : 'Create account'}
                disabled={busy || (mode === 'signup' ? !username.trim() || !phone.trim() : !phone.trim())}
                onPress={mode === 'login' ? doLogin : doSignup} style={s.authBtn} />
              <Pressable onPress={() => setMode('welcome')} style={s.textBtn} accessibilityRole="button">
                <Text style={s.textBtnText}>Back</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Signed in ──
  const name = user.call_name || user.username;
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <Text style={s.title}>You</Text>
          {isDemoMode && <DemoPill />}
        </View>

        <View style={s.identity}>
          <Pressable onPress={() => setShowAvatar(true)} accessibilityRole="button" accessibilityLabel="Change avatar">
            <AvatarDisplay config={avatarConfig} username={user.username || ''} size={64} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            <Text style={s.handle}>@{user.username}</Text>
          </View>
          <View style={s.chip}><Text style={s.chipText}>{STATUS[user.scout_status] || 'Scout'}</Text></View>
        </View>

        <View style={[card, s.block, s.stats]}>
          {[
            { label: 'Readings', value: String(user.total_ratings ?? 0) },
            { label: 'Accuracy', value: user.rating_accuracy_score ? `${Math.round(user.rating_accuracy_score)}%` : 'New' },
            { label: 'Clout', value: String(user.clout_points ?? 0) },
          ].map((x, i) => (
            <View key={x.label} style={[s.stat, i > 0 && s.statLine]}>
              <Text style={s.statValue}>{x.value}</Text>
              <Text style={s.caption}>{x.label}</Text>
            </View>
          ))}
        </View>

        {!isDemoMode && (
          <View style={s.block}>
            <AutoPresenceToggle />
          </View>
        )}
        {!isDemoMode && (
          <View style={s.block}>
            <PromptCadencePicker getAuthHeaders={() => useVibeStore.getState().getAuthHeaders()} />
          </View>
        )}

        <View style={[card, s.block, s.rows]}>
          <Row icon="people-outline" label="Crew" value={crew?.name || 'None yet'} onPress={() => router.push('/(public)/crew' as any)} />
          <View style={s.line} />
          <Row icon="create-outline" label="Your name" value={user.call_name || 'Add'} onPress={() => { setNameDraft(user.call_name || ''); setShowName(true); }} />
          {user.is_merchant && (
            <>
              <View style={s.line} />
              <Row icon="storefront-outline" label="Venue dashboard" onPress={() => router.push('/(merchant)' as any)} />
            </>
          )}
          {user.is_super_admin && (
            <>
              <View style={s.line} />
              <Row icon="shield-outline" label="Admin" onPress={() => router.push('/(admin)' as any)} />
            </>
          )}
          {isDemoMode && (
            <>
              <View style={s.line} />
              <Row icon="exit-outline" label="Leave demo" onPress={toggleDemoMode} />
            </>
          )}
        </View>

        {!isDemoMode && (
          <View style={[card, s.block, s.rows]}>
            <Row icon="log-out-outline" label="Sign out" onPress={signOut} danger />
          </View>
        )}
      </ScrollView>

      <AvatarBuilder visible={showAvatar} onClose={() => setShowAvatar(false)} initialConfig={avatarConfig}
        onSave={(cfg) => { updateAvatar(cfg as any); setShowAvatar(false); }} />

      <Modal visible={showName} transparent animationType="slide" onRequestClose={() => setShowName(false)}>
        <Pressable style={s.scrim} onPress={() => setShowName(false)} accessibilityLabel="Close" />
        <View style={[sheet, s.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={sheetHandle} />
          <Text style={s.sheetTitle}>Your name</Text>
          <Text style={s.caption}>Shown to your crew and on readings you make public.</Text>
          <TextInput value={nameDraft} onChangeText={setNameDraft} maxLength={30} placeholder="Name" placeholderTextColor={color.inkFaint}
            style={s.input} autoFocus />
          <Button label="Save" onPress={saveName} style={{ marginTop: space.md }} />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: size.topBar },
  title: { ...type.headline, color: color.ink },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, marginTop: space.sm },
  name: { ...type.title, color: color.ink },
  handle: { ...type.label, color: color.inkSoft, marginTop: 2 },
  chip: { height: 28, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: color.raised, justifyContent: 'center' },
  chipText: { ...type.captionStrong, color: color.inkSoft },
  block: { marginHorizontal: space.md, marginTop: space.md },
  stats: { flexDirection: 'row', paddingHorizontal: 0 },
  stat: { flex: 1, alignItems: 'center' },
  statLine: { borderLeftWidth: 1, borderLeftColor: color.line },
  statValue: { ...type.title, color: color.ink },
  caption: { ...type.caption, color: color.inkSoft, marginTop: 2 },
  rows: { paddingHorizontal: 0, paddingVertical: space.xxs },
  rowLabel: { ...type.body, color: color.ink, flex: 1 },
  rowValue: { ...type.label, color: color.inkSoft, maxWidth: '45%' },
  line: { height: 1, backgroundColor: color.line, marginLeft: space.md + icon.md + space.sm },
  authBody: { flex: 1, justifyContent: 'center', paddingHorizontal: space.md },
  mark: { ...type.title, color: color.ink, letterSpacing: 2, marginBottom: space.lg },
  headline: { ...type.headline, color: color.ink },
  authBtn: { marginTop: space.lg },
  textBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  textBtnText: { ...type.labelStrong, color: color.inkSoft },
  fine: { ...type.caption, color: color.inkFaint, textAlign: 'center', marginTop: space.md },
  input: {
    ...type.body, color: color.ink, backgroundColor: color.raised, borderRadius: radius.sm,
    paddingHorizontal: space.md, height: 52, marginTop: space.md,
  },
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md },
  sheetTitle: { ...type.title, color: color.ink, marginTop: space.xs },
});
