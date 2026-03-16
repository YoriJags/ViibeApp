/**
 * SkinPicker — Reactor skin selection sheet.
 *
 * Shows preset color skins + custom hex input for VIBE+ users.
 * Instantly previews the selected skin via the animated orb swatch.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, TextInput, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  SKIN_PRESETS, resolveSkinPalette, SkinPreset,
} from '../config/skins';

interface SkinPickerProps {
  visible:       boolean;
  currentSkin?:  string;
  isVibePlus?:   boolean;
  onSelect:      (skinKey: string) => void;
  onClose:       () => void;
}

function SkinSwatch({
  preset,
  isActive,
  isVibePlus,
  onPress,
}: {
  preset:    SkinPreset;
  isActive:  boolean;
  isVibePlus?: boolean;
  onPress:   () => void;
}) {
  const palette = resolveSkinPalette(preset.key === 'custom' ? undefined : preset.key);
  const locked  = preset.vibePlus && !isVibePlus;

  return (
    <TouchableOpacity
      style={[s.swatch, isActive && s.swatchActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Mini reactor preview */}
      <View style={[s.swatchOrb, { borderColor: palette[3] + '60' }]}>
        <LinearGradient
          colors={[palette[4] + '30', palette[2] + '18', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        {/* Mini ring arc */}
        <View style={[s.swatchRing, { borderColor: palette[3] + '50' }]} />
        <View style={[s.swatchCore, { backgroundColor: palette[3] }]} />
        {locked && (
          <View style={s.swatchLock}>
            <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>

      <Text style={[s.swatchName, isActive && { color: '#FFF' }]}>{preset.name}</Text>

      {isActive && (
        <View style={[s.swatchCheck, { backgroundColor: palette[3] }]}>
          <Ionicons name="checkmark" size={10} color="#000" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SkinPicker({
  visible, currentSkin, isVibePlus, onSelect, onClose,
}: SkinPickerProps) {
  const insets = useSafeAreaInsets();
  const [customHex, setCustomHex] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(
    currentSkin?.startsWith('custom:') ?? false,
  );

  const handlePresetPress = (preset: SkinPreset) => {
    if (preset.vibePlus && !isVibePlus) {
      Alert.alert('VIBE+ Only', 'Custom skins are exclusive to VIBE+ members.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (preset.key === 'custom') {
      setShowCustomInput(true);
      return;
    }
    setShowCustomInput(false);
    onSelect(preset.key);
  };

  const applyCustomHex = () => {
    const hex = customHex.trim().replace(/^#?/, '#').toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex)) {
      Alert.alert('Invalid color', 'Enter a valid 6-digit hex code, e.g. #FF6D00');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(`custom:${hex}`);
  };

  const activeSkinKey = currentSkin?.startsWith('custom:') ? 'custom' : (currentSkin ?? 'default');
  const activePreview = resolveSkinPalette(currentSkin);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={[s.container, { paddingBottom: insets.bottom + 16 }]}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>REACTOR SKIN</Text>
            <Text style={s.subtitle}>Choose your color signature</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Live preview strip */}
        <View style={s.previewStrip}>
          {activePreview.map((col, i) => (
            <LinearGradient
              key={i}
              colors={[col, col + '80']}
              style={s.previewBlock}
            />
          ))}
          <View style={s.previewLabels}>
            {['DORMANT', 'STIRRING', 'BUZZING', 'POPPING', 'ELECTRIC'].map((l, i) => (
              <Text key={l} style={[s.previewLabel, { color: activePreview[i] }]}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Swatch grid */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.grid}>
          <View style={s.swatchRow}>
            {SKIN_PRESETS.map(preset => (
              <SkinSwatch
                key={preset.key}
                preset={preset}
                isActive={activeSkinKey === preset.key}
                isVibePlus={isVibePlus}
                onPress={() => handlePresetPress(preset)}
              />
            ))}
          </View>

          {/* Custom hex input — VIBE+ only */}
          {showCustomInput && (
            <View style={s.customSection}>
              <Text style={s.customLabel}>HEX COLOR</Text>
              <View style={s.customInputRow}>
                <View style={[s.hexPreview, { backgroundColor: customHex.length === 7 ? customHex : '#1A1A2E' }]} />
                <TextInput
                  style={s.hexInput}
                  value={customHex}
                  onChangeText={t => setCustomHex(t.startsWith('#') ? t : `#${t}`)}
                  placeholder="#FF6D00"
                  placeholderTextColor="#333"
                  maxLength={7}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[s.applyBtn, { opacity: customHex.length === 7 ? 1 : 0.4 }]}
                  onPress={applyCustomHex}
                  disabled={customHex.length !== 7}
                >
                  <Text style={s.applyBtnText}>APPLY</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.customHint}>Any 6-digit hex — your reactor becomes it.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 12,
    color: '#444',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Live preview
  previewStrip: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    height: 54,
  },
  previewBlock: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '20%',
  },
  previewLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: 4,
  },
  previewLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Swatch grid
  grid: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: '21%',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: '#0E0E1C',
    borderWidth: 0.5,
    borderColor: '#1A1A28',
    position: 'relative',
  },
  swatchActive: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: '#14142A',
  },
  swatchOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(4,4,12,0.98)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swatchRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  swatchCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.9,
  },
  swatchLock: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
  },
  swatchName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#444',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  swatchCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Custom hex
  customSection: {
    marginTop: 20,
    backgroundColor: '#0E0E1C',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  customLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 2,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hexPreview: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hexInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#0A0A18',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  applyBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  applyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1.5,
  },
  customHint: {
    fontSize: 11,
    color: '#333',
    fontStyle: 'italic',
  },
});
