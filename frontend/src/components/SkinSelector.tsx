/**
 * SkinSelector — Bottom sheet skin picker.
 *
 * Horizontal grid of skin cards. Free skins activate instantly.
 * VIBE+ skins show a lock + usage % social proof. Tap locked → unlock CTA.
 * Selected skin has an accent ring. Slides up from bottom.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import { SKINS, SkinId } from './skins/skinTypes';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = 420;

interface Props {
  visible:        boolean;
  isPlus:         boolean;
  onClose:        () => void;
  onUnlockPress:  () => void;
}

export default function SkinSelector({ visible, isPlus, onClose, onUnlockPress }: Props) {
  const { selectedSkin, setSkin } = useVibeStore();
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SHEET_H,
      tension: 70, friction: 14,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleSelect = (id: SkinId, isPremium: boolean) => {
    if (isPremium && !isPlus) {
      onUnlockPress();
      return;
    }
    setSkin(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      {/* Scrim */}
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient colors={['#0C0C1A', '#08080F']} style={StyleSheet.absoluteFill} />

        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>YOUR REACTOR SKIN</Text>
            <Text style={styles.sub}>Choose how you see the scene</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* Skin grid */}
        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          <View style={styles.row}>
            {SKINS.map(skin => {
              const isSelected = selectedSkin === skin.id;
              const isLocked   = skin.isPremium && !isPlus;

              return (
                <TouchableOpacity
                  key={skin.id}
                  style={[
                    styles.card,
                    isSelected && { borderColor: skin.accentColor, borderWidth: 2 },
                    isLocked && styles.cardLocked,
                  ]}
                  onPress={() => handleSelect(skin.id, skin.isPremium)}
                  activeOpacity={0.75}
                >
                  {/* Background tint for selected */}
                  {isSelected && (
                    <View style={[StyleSheet.absoluteFill, styles.cardSelectedBg, { backgroundColor: skin.accentColor + '12' }]} />
                  )}

                  {/* Icon */}
                  <Text style={styles.cardIcon}>{skin.icon}</Text>

                  {/* Name */}
                  <Text style={[styles.cardName, isSelected && { color: skin.accentColor }]}>
                    {skin.name}
                  </Text>

                  {/* Desc */}
                  <Text style={styles.cardDesc} numberOfLines={2}>{skin.desc}</Text>

                  {/* Social proof */}
                  <View style={styles.usageRow}>
                    {isSelected ? (
                      <View style={[styles.activePill, { backgroundColor: skin.accentColor }]}>
                        <Text style={styles.activePillText}>ACTIVE</Text>
                      </View>
                    ) : skin.usagePercent > 5 ? (
                      <Text style={styles.usageText}>🔥 {skin.usagePercent}% of scouts</Text>
                    ) : (
                      <Text style={styles.usageText}>✦ {skin.usagePercent}% use this</Text>
                    )}
                  </View>

                  {/* Premium lock */}
                  {isLocked && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={9} color="#FFD700" />
                      <Text style={styles.lockText}>VIBE+</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* VIBE+ upsell strip */}
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
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 28,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  title: { fontSize: 14, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  sub:   { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginTop: 2 },
  closeBtn: { padding: 4 },

  grid: { paddingHorizontal: 16, paddingBottom: 8 },
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  card: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    gap: 5,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 120,
  },
  cardLocked:      { opacity: 0.75 },
  cardSelectedBg:  { borderRadius: 14 },
  cardIcon:        { fontSize: 24 },
  cardName:        { fontSize: 12, fontWeight: '900', color: '#FFF', letterSpacing: 1.5 },
  cardDesc:        { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500', lineHeight: 14 },

  usageRow: { marginTop: 2 },
  usageText: { fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: '600' },
  activePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
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
