/**
 * SkinSelector — Bottom sheet skin picker with conversion spotlight.
 *
 * When focusSkinId is set (tapped from FeatureStoryStrip or SkinContainer):
 *   — Sheet opens taller showing a full spotlight section at the top
 *   — Spotlight: large skin card (blurred preview for locked) + skin info
 *   — Paystack CTA directly beneath: "UNLOCK [SKIN] + 4 MORE PREMIUM SKINS"
 *   — Grid below shows all 8 skins for context
 *
 * When no focusSkinId: default grid view with generic upsell strip.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import { SKINS, SkinId } from './skins/skinTypes';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_H_DEFAULT  = 420;
const SHEET_H_FOCUSED  = SCREEN_H * 0.85;

interface Props {
  visible:        boolean;
  isPlus:         boolean;
  focusSkinId?:   SkinId | null;
  onClose:        () => void;
  onUnlockPress:  () => void;
}

export default function SkinSelector({
  visible, isPlus, focusSkinId, onClose, onUnlockPress,
}: Props) {
  const { selectedSkin, setSkin } = useVibeStore();
  const sheetH   = focusSkinId ? SHEET_H_FOCUSED : SHEET_H_DEFAULT;
  const slideAnim = useRef(new Animated.Value(sheetH)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : sheetH,
      tension: 70, friction: 14,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleSelect = (id: SkinId, isPremium: boolean) => {
    if (isPremium && !isPlus) {
      // Don't dismiss — open paystack from within sheet
      onUnlockPress();
      return;
    }
    setSkin(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  if (!visible) return null;

  const focusSkin = focusSkinId ? SKINS.find(s => s.id === focusSkinId) : null;
  const otherSkins = focusSkinId ? SKINS.filter(s => s.id !== focusSkinId) : SKINS;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { height: sheetH, transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient colors={['#0C0C1A', '#08080F']} style={StyleSheet.absoluteFill} />
        <View style={styles.handle} />

        {/* ── SPOTLIGHT MODE: focused premium skin ── */}
        {focusSkin && !isPlus ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Back row */}
            <View style={styles.spotlightHeader}>
              <TouchableOpacity style={styles.backBtn} onPress={onClose}>
                <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.backText}>ALL SKINS</Text>
              </TouchableOpacity>
            </View>

            {/* Skin spotlight card */}
            <View style={[styles.spotlightCard, { borderColor: focusSkin.accentColor + '55' }]}>
              {/* Blurred preview area */}
              <View style={styles.spotlightPreview}>
                <LinearGradient
                  colors={[focusSkin.accentColor + '30', focusSkin.accentColor + '08']}
                  style={StyleSheet.absoluteFill}
                />
                <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                {/* Ghosted icon */}
                <Text style={styles.spotlightGhostIcon}>{focusSkin.icon}</Text>
                <View style={styles.spotlightLockPill}>
                  <Ionicons name="lock-closed" size={12} color="#FFD700" />
                  <Text style={styles.spotlightLockText}>VIBE+ EXCLUSIVE</Text>
                </View>
              </View>

              {/* Skin info */}
              <View style={styles.spotlightInfo}>
                <Text style={[styles.spotlightIcon]}>{focusSkin.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.spotlightName, { color: focusSkin.accentColor }]}>
                    {focusSkin.name}
                  </Text>
                  <Text style={styles.spotlightDesc}>{focusSkin.desc}</Text>
                </View>
                <View style={[styles.usageChip, { backgroundColor: focusSkin.accentColor + '18' }]}>
                  <Text style={[styles.usageChipText, { color: focusSkin.accentColor }]}>
                    {focusSkin.usagePercent}% use this
                  </Text>
                </View>
              </View>
            </View>

            {/* Paystack CTA */}
            <View style={styles.paystackSection}>
              <Text style={styles.paystackTitle}>
                Unlock <Text style={{ color: focusSkin.accentColor }}>{focusSkin.name}</Text> + 4 more premium skins
              </Text>
              <Text style={styles.paystackSub}>
                AURA · TERRAIN · RADAR · MATRIX · PULSE — all yours with VIBE+
              </Text>

              <TouchableOpacity style={styles.paystackBtn} onPress={onUnlockPress} activeOpacity={0.85}>
                <LinearGradient
                  colors={[focusSkin.accentColor, focusSkin.accentColor + 'CC']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.paystackBtnGrad}
                >
                  <Ionicons name="flash" size={16} color="#000" />
                  <Text style={styles.paystackBtnText}>UNLOCK WITH VIBE+</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.paystackHint}>Powered by Paystack · Cancel anytime</Text>
            </View>

            {/* All other skins preview */}
            <Text style={styles.alsoSection}>ALL SKINS</Text>
            <View style={[styles.row, { paddingHorizontal: 16 }]}>
              {SKINS.map(skin => <MiniCard key={skin.id} skin={skin} isPlus={isPlus} selectedSkin={selectedSkin} onSelect={handleSelect} />)}
            </View>
          </ScrollView>
        ) : (
          /* ── DEFAULT MODE ── */
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>YOUR REACTOR SKIN</Text>
                <Text style={styles.sub}>Choose how you see the scene</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
              <View style={styles.row}>
                {SKINS.map(skin => <MiniCard key={skin.id} skin={skin} isPlus={isPlus} selectedSkin={selectedSkin} onSelect={handleSelect} />)}
              </View>
            </ScrollView>

            {!isPlus && (
              <TouchableOpacity style={styles.upsell} onPress={onUnlockPress} activeOpacity={0.8}>
                <LinearGradient
                  colors={['rgba(255,215,0,0.12)', 'rgba(255,140,0,0.08)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.upsellGrad}
                >
                  <Ionicons name="flash" size={14} color="#FFD700" />
                  <Text style={styles.upsellText}>Unlock 5 premium skins with VIBE+</Text>
                  <Ionicons name="chevron-forward" size={12} color="#FFD70080" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Mini card (shared between modes) ────────────────────────────────────────

function MiniCard({ skin, isPlus, selectedSkin, onSelect }: {
  skin: typeof SKINS[0];
  isPlus: boolean;
  selectedSkin: SkinId;
  onSelect: (id: SkinId, isPremium: boolean) => void;
}) {
  const isSelected = selectedSkin === skin.id;
  const isLocked   = skin.isPremium && !isPlus;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && { borderColor: skin.accentColor, borderWidth: 2 },
        isLocked && styles.cardLocked,
      ]}
      onPress={() => onSelect(skin.id, skin.isPremium)}
      activeOpacity={0.75}
    >
      {isSelected && (
        <View style={[StyleSheet.absoluteFill, styles.cardSelectedBg, { backgroundColor: skin.accentColor + '12' }]} />
      )}
      <Text style={styles.cardIcon}>{skin.icon}</Text>
      <Text style={[styles.cardName, isSelected && { color: skin.accentColor }]}>{skin.name}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{skin.desc}</Text>
      <View style={styles.usageRow}>
        {isSelected ? (
          <View style={[styles.activePill, { backgroundColor: skin.accentColor }]}>
            <Text style={styles.activePillText}>ACTIVE</Text>
          </View>
        ) : (
          <Text style={styles.usageText}>
            {skin.usagePercent > 5 ? `🔥 ${skin.usagePercent}%` : `✦ ${skin.usagePercent}%`} of scouts
          </Text>
        )}
      </View>
      {isLocked && (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={9} color="#FFD700" />
          <Text style={styles.lockText}>VIBE+</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  // Spotlight mode
  spotlightHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1 },

  spotlightCard: {
    marginHorizontal: 16, marginTop: 8,
    borderRadius: 18, borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  spotlightPreview: {
    height: 140, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#05050F',
  },
  spotlightGhostIcon: { fontSize: 64, opacity: 0.25 },
  spotlightLockPill: {
    position: 'absolute', bottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: '#FFD70033',
  },
  spotlightLockText: { fontSize: 10, fontWeight: '900', color: '#FFD700', letterSpacing: 1.5 },
  spotlightInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  spotlightIcon: { fontSize: 28 },
  spotlightName: { fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  spotlightDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginTop: 2 },
  usageChip:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  usageChipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  paystackSection: { marginHorizontal: 16, marginTop: 16, gap: 8 },
  paystackTitle:   { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  paystackSub:     { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  paystackBtn:     { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  paystackBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  paystackBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  paystackHint:    { fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontWeight: '500' },

  alsoSection: {
    fontSize: 9, fontWeight: '800', letterSpacing: 2,
    color: 'rgba(255,255,255,0.2)', paddingHorizontal: 16,
    marginTop: 20, marginBottom: 10,
  },

  // Default mode
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12,
  },
  title:    { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  sub:      { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginTop: 2 },
  closeBtn: { padding: 4 },
  grid:     { paddingHorizontal: 16, paddingBottom: 8 },
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  card: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14, gap: 5, position: 'relative', overflow: 'hidden', minHeight: 120,
  },
  cardLocked:     { opacity: 0.75 },
  cardSelectedBg: { borderRadius: 14 },
  cardIcon:       { fontSize: 24 },
  cardName:       { fontSize: 12, fontWeight: '900', color: '#FFF', letterSpacing: 1.5 },
  cardDesc:       { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500', lineHeight: 14 },
  usageRow:       { marginTop: 2 },
  usageText:      { fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: '600' },
  activePill:     { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  activePillText: { fontSize: 9, fontWeight: '900', color: '#000' },
  lockBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  lockText: { fontSize: 8, fontWeight: '900', color: '#FFD700' },

  upsell:     { marginHorizontal: 16, marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  upsellGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#FFD70022',
  },
  upsellText: { flex: 1, fontSize: 12, color: '#FFD700', fontWeight: '700' },
});
