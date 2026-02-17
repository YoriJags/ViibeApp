/**
 * AvatarBuilder - Modal for creating/editing emoji-based avatar
 *
 * Pick a face emoji + vibe color. Live preview updates in real-time.
 * On save, persists to Zustand store (AsyncStorage).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';
import AvatarDisplay, { AvatarConfig } from './AvatarDisplay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { colors } = publicTheme;

interface AvatarBuilderProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: AvatarConfig) => void;
  initialConfig?: AvatarConfig | null;
}

const EMOJI_OPTIONS = [
  { emoji: '\u{1F60E}', label: 'Cool' },
  { emoji: '\u{1F525}', label: 'Fire' },
  { emoji: '\u{1F608}', label: 'Devil' },
  { emoji: '\u{1F976}', label: 'Ice' },
  { emoji: '\u{1F480}', label: 'Skull' },
  { emoji: '\u{1F451}', label: 'Crown' },
  { emoji: '\u{1F981}', label: 'Lion' },
  { emoji: '\u{1F43A}', label: 'Wolf' },
];

const COLOR_OPTIONS = [
  { color: '#FF3366', label: 'Neon Pink' },
  { color: '#FF6B35', label: 'Orange' },
  { color: '#FFD700', label: 'Gold' },
  { color: '#00E676', label: 'Green' },
  { color: '#00D4FF', label: 'Cyan' },
  { color: '#9C27B0', label: 'Purple' },
  { color: '#1A1A28', label: 'Dark' },
  { color: '#FF69B4', label: 'Hot Pink' },
];

const DEFAULT_CONFIG: AvatarConfig = {
  emoji: '\u{1F60E}',
  bgColor: '#FF3366',
  accentColor: '#FF6B35',
};

export default function AvatarBuilder({
  visible,
  onClose,
  onSave,
  initialConfig,
}: AvatarBuilderProps) {
  const [selectedEmoji, setSelectedEmoji] = useState(
    initialConfig?.emoji || DEFAULT_CONFIG.emoji,
  );
  const [selectedColor, setSelectedColor] = useState(
    initialConfig?.bgColor || DEFAULT_CONFIG.bgColor,
  );

  const previewConfig: AvatarConfig = {
    emoji: selectedEmoji,
    bgColor: selectedColor,
    accentColor: selectedColor,
  };

  const handleEmojiSelect = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEmoji(emoji);
  };

  const handleColorSelect = (color: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedColor(color);
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(previewConfig);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Vibe</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Preview */}
            <View style={styles.previewSection}>
              <AvatarDisplay
                config={previewConfig}
                username=""
                size={120}
                showBorder
                borderColor={selectedColor}
              />
            </View>

            {/* Face picker */}
            <Text style={styles.sectionLabel}>FACE</Text>
            <View style={styles.optionsGrid}>
              {EMOJI_OPTIONS.map((option) => {
                const isSelected = selectedEmoji === option.emoji;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.emojiOption,
                      isSelected && {
                        borderColor: selectedColor,
                        backgroundColor: selectedColor + '20',
                      },
                    ]}
                    onPress={() => handleEmojiSelect(option.emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.emojiLabel,
                        isSelected && { color: selectedColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color picker */}
            <Text style={styles.sectionLabel}>VIBE COLOR</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((option) => {
                const isSelected = selectedColor === option.color;
                return (
                  <TouchableOpacity
                    key={option.color}
                    style={styles.colorOption}
                    onPress={() => handleColorSelect(option.color)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: option.color },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.colorLabel,
                        isSelected && { color: option.color },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Save button */}
            <TouchableOpacity onPress={handleSave} activeOpacity={0.8}>
              <LinearGradient
                colors={[selectedColor, '#FF6B35']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                <Ionicons name="sparkles" size={20} color="#FFF" />
                <Text style={styles.saveText}>Save My Avatar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.dark,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  previewSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.lg,
  },
  emojiOption: {
    width: (SCREEN_WIDTH - 48 - 30) / 4,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emojiText: {
    fontSize: 28,
  },
  emojiLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.xl,
  },
  colorOption: {
    width: (SCREEN_WIDTH - 48 - 30) / 4,
    alignItems: 'center',
    paddingVertical: 8,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  colorLabel: {
    fontSize: 9,
    color: colors.text.muted,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.xl,
    gap: 8,
  },
  saveText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
});
