/**
 * ZodiacPicker — Optional zodiac sign selection.
 *
 * Used at signup (post-account creation) and from the profile screen to change sign.
 * Always skippable — zodiac is an optional personality layer, never required.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ZODIAC_SIGNS, ZodiacSign } from '../config/zodiac';

interface ZodiacPickerProps {
  visible:      boolean;
  currentSign?: string;
  /** When true, shows onboarding copy ("just joined") vs edit copy */
  isOnboarding?: boolean;
  onSelect:     (signKey: string) => void;
  onSkip:       () => void;
  onClose:      () => void;
}

function SignCard({
  sign,
  isActive,
  onPress,
}: {
  sign: ZodiacSign;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.card, isActive && s.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <LinearGradient
        colors={isActive ? [sign.elementColor + '22', sign.elementColor + '08'] : ['transparent', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      {isActive && (
        <View style={[s.cardCheck, { backgroundColor: sign.elementColor }]}>
          <Ionicons name="checkmark" size={9} color="#000" />
        </View>
      )}
      <Text style={s.cardSymbol}>{sign.symbol}</Text>
      <Text style={[s.cardName, isActive && { color: sign.elementColor }]}>{sign.name}</Text>
      <Text style={s.cardDates}>{sign.dateRange}</Text>
      <View style={[s.elementPill, { borderColor: sign.elementColor + '40' }]}>
        <Text style={[s.elementText, { color: sign.elementColor }]}>{sign.element}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ZodiacPicker({
  visible, currentSign, isOnboarding, onSelect, onSkip, onClose,
}: ZodiacPickerProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | undefined>(currentSign);

  const handlePress = (sign: ZodiacSign) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(sign.key);
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
  };

  const activeSign = selected ? ZODIAC_SIGNS.find(z => z.key === selected) : undefined;

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
            <Text style={s.title}>COSMIC SIGN</Text>
            <Text style={s.subtitle}>
              {isOnboarding ? 'Optional — shapes your vibe reading' : 'Your zodiac personality'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Selected preview */}
        {activeSign ? (
          <View style={[s.preview, { borderColor: activeSign.elementColor + '30' }]}>
            <Text style={[s.previewSymbol, { color: activeSign.elementColor }]}>
              {activeSign.symbol}
            </Text>
            <View>
              <Text style={[s.previewName, { color: activeSign.elementColor }]}>
                {activeSign.name}
              </Text>
              <Text style={s.previewTagline}>{activeSign.tagline}</Text>
            </View>
          </View>
        ) : (
          <View style={s.previewEmpty}>
            <Text style={s.previewEmptyText}>Choose your sign below</Text>
          </View>
        )}

        {/* Sign grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.grid}
        >
          <View style={s.gridRow}>
            {ZODIAC_SIGNS.map(sign => (
              <SignCard
                key={sign.key}
                sign={sign}
                isActive={selected === sign.key}
                onPress={() => handlePress(sign)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.confirmBtn, !selected && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={selected && activeSign
                ? [activeSign.elementColor, activeSign.elementColor + 'AA']
                : ['#1A1A2E', '#1A1A2E']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text style={[s.confirmText, !selected && { color: '#444' }]}>
              {selected ? `CONFIRM ${activeSign?.name.toUpperCase()}` : 'SELECT A SIGN'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.skipBtn} onPress={onSkip} activeOpacity={0.7}>
            <Text style={s.skipText}>
              {isOnboarding ? 'Skip for now' : 'Clear sign'}
            </Text>
          </TouchableOpacity>
        </View>
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

  // Preview strip
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#0E0E1C',
    borderRadius: 14,
    borderWidth: 0.5,
  },
  previewSymbol: {
    fontSize: 32,
  },
  previewName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  previewTagline: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  previewEmpty: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#0A0A18',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },
  previewEmptyText: {
    fontSize: 13,
    color: '#333',
    letterSpacing: 0.3,
  },

  // Sign grid
  grid: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  card: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#0E0E1C',
    borderWidth: 0.5,
    borderColor: '#1A1A28',
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cardActive: {
    borderColor: 'rgba(255,255,255,0.20)',
  },
  cardCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSymbol: {
    fontSize: 22,
    color: '#FFF',
  },
  cardName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.5,
  },
  cardDates: {
    fontSize: 8,
    color: '#333',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  elementPill: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  elementText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Actions
  actions: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 8,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 13,
    color: '#444',
    letterSpacing: 0.3,
  },
});
