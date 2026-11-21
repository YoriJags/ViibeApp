/**
 * Shown on the submit screens when nobody is signed in (live mode). Every
 * submission is tied to an account so limits and reports can work.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ed, edType, edSpace } from '../../theme/editorial';
import { ScreenHeader, PrimaryButton } from './ui';
import { useVibeStore } from '../../store/vibeStore';

/** True when this person can submit: signed in, or walking the demo. */
export function useCanSubmit(): boolean {
  const isDemoMode = useVibeStore((st) => st.isDemoMode);
  const sessionToken = useVibeStore((st) => st.sessionToken);
  return isDemoMode || !!sessionToken;
}

export default function SignInGate({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <ScreenHeader title={title} />
      <View style={styles.body}>
        <Ionicons name="person-circle-outline" size={48} color={ed.inkSoft} />
        <Text style={[edType.title, { marginTop: edSpace.md, textAlign: 'center' }]}>Sign in first</Text>
        <Text style={[edType.body, { marginTop: 8, textAlign: 'center' }]}>
          Everything put on the map is tied to an account, so we can reach you about it and keep fakes off.
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: edSpace.lg }}>
          <PrimaryButton label="Go to sign in" onPress={() => router.replace('/(public)/profile' as any)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ed.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: edSpace.gutter * 2 },
});
