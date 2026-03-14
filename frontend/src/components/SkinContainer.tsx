/**
 * SkinContainer — renders the user's chosen reactor skin.
 *
 * When REACTOR is selected → renders VibeReactor (tap-to-charge, full props).
 * For all other skins → renders the visual-only skin with shared Reanimated values.
 *
 * Includes the "CHANGE SKIN" affordance button that opens SkinSelector.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SharedValue } from 'react-native-reanimated';
import { useVibeStore } from '../store/vibeStore';
import VibeReactor from './VibeReactor';
import VibeOscillator, { triggerOscillatorSurge } from './VibeOscillator';
import SkinAura    from './skins/SkinAura';
import SkinTerrain from './skins/SkinTerrain';
import SkinRadar   from './skins/SkinRadar';
import SkinMatrix  from './skins/SkinMatrix';
import SkinSelector from './SkinSelector';
import { SKINS } from './skins/skinTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  // VibeReactor pass-through
  venueId:            string;
  venueName:          string;
  venueCoordinates?:  { lat: number; lng: number } | null;
  userLocation?:      { lat: number; lng: number } | null;
  isDemoMode?:        boolean;
  onElectric?:        (tapCount: number) => void;
  onReact?:           () => void;
  onQuestSucceeded?:  (participants: number) => void;
  onBpmUpdate?:       (bpm: number) => void;
  // Shared values for visual skins
  bpmShared:          SharedValue<number>;
  vibeScore:          SharedValue<number>;
  surgeValue:         SharedValue<number>;
  vibeColor:          string;
  isPlus:             boolean;
  socket:             any | null;
  onUnlockPress:      () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SkinContainer({
  venueId, venueName, venueCoordinates, userLocation, isDemoMode,
  onElectric, onReact, onQuestSucceeded, onBpmUpdate,
  bpmShared, vibeScore, surgeValue,
  vibeColor, isPlus, socket, onUnlockPress,
}: Props) {
  const { selectedSkin } = useVibeStore();
  const [selectorOpen, setSelectorOpen] = useState(false);

  const meta = SKINS.find(s => s.id === selectedSkin) ?? SKINS[0];
  const skinProps = { bpmShared, vibeScore, surgeValue, color: vibeColor };

  const renderSkin = () => {
    switch (selectedSkin) {
      case 'reactor':
        return (
          <VibeReactor
            venueId={venueId}
            venueName={venueName}
            venueCoordinates={venueCoordinates}
            userLocation={userLocation}
            isDemoMode={isDemoMode}
            onElectric={onElectric}
            onReact={onReact}
            onQuestSucceeded={onQuestSucceeded}
            onBpmUpdate={onBpmUpdate}
          />
        );

      case 'wave':
        return (
          <VibeOscillator
            bpmShared={bpmShared} vibeScore={vibeScore} surgeValue={surgeValue}
            isPlus={true} mode="WAVE" onUnlockPress={onUnlockPress}
          />
        );

      case 'bars':
        return (
          <VibeOscillator
            bpmShared={bpmShared} vibeScore={vibeScore} surgeValue={surgeValue}
            isPlus={true} mode="BARS" onUnlockPress={onUnlockPress}
          />
        );

      case 'pulse':
        return (
          <VibeOscillator
            bpmShared={bpmShared} vibeScore={vibeScore} surgeValue={surgeValue}
            isPlus={isPlus} mode="PULSE" onUnlockPress={onUnlockPress}
          />
        );

      case 'aura':
        return isPlus
          ? <SkinAura    {...skinProps} />
          : <LockedSkin  meta={meta} onUnlock={onUnlockPress} />;

      case 'terrain':
        return isPlus
          ? <SkinTerrain {...skinProps} />
          : <LockedSkin  meta={meta} onUnlock={onUnlockPress} />;

      case 'radar':
        return isPlus
          ? <SkinRadar   {...skinProps} />
          : <LockedSkin  meta={meta} onUnlock={onUnlockPress} />;

      case 'matrix':
        return isPlus
          ? <SkinMatrix  {...skinProps} />
          : <LockedSkin  meta={meta} onUnlock={onUnlockPress} />;

      default:
        return null;
    }
  };

  return (
    <View style={styles.wrapper}>
      {renderSkin()}

      {/* Change skin affordance */}
      <TouchableOpacity
        style={styles.changeSkinBtn}
        onPress={() => setSelectorOpen(true)}
        activeOpacity={0.75}
      >
        <Text style={styles.changeSkinIcon}>{meta.icon}</Text>
        <Text style={styles.changeSkinLabel}>{meta.name}</Text>
        <Ionicons name="chevron-down" size={10} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>

      <SkinSelector
        visible={selectorOpen}
        isPlus={isPlus}
        onClose={() => setSelectorOpen(false)}
        onUnlockPress={onUnlockPress}
      />
    </View>
  );
}

// ─── Locked placeholder for premium skins ────────────────────────────────────

function LockedSkin({ meta, onUnlock }: { meta: any; onUnlock: () => void }) {
  return (
    <TouchableOpacity style={styles.lockedWrap} onPress={onUnlock} activeOpacity={0.8}>
      <Text style={styles.lockedIcon}>{meta.icon}</Text>
      <Text style={styles.lockedName}>{meta.name}</Text>
      <View style={styles.lockedBadge}>
        <Ionicons name="lock-closed" size={11} color="#FFD700" />
        <Text style={styles.lockedBadgeText}>VIBE+ EXCLUSIVE</Text>
      </View>
      <Text style={styles.lockedCta}>Tap to unlock</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },

  changeSkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  changeSkinIcon:  { fontSize: 12 },
  changeSkinLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },

  lockedWrap: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#08080F',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD70022',
  },
  lockedIcon:  { fontSize: 40 },
  lockedName:  { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  lockedBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFD700', letterSpacing: 1 },
  lockedCta:   { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
});
