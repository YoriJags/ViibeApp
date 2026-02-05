/**
 * MERCHANT FLOOR - Pulse Drop Controller
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = merchantTheme;

export default function MerchantPulse() {
  const { user } = useVibeStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pulse Drops</Text>
        <Text style={styles.headerSubtitle}>Boost your venue visibility</Text>
      </View>

      <View style={styles.content}>
        {/* Spark Tier */}
        <TouchableOpacity style={styles.pulseCard}>
          <View style={[styles.pulseIcon, { backgroundColor: '#FFD70030' }]}>
            <Ionicons name="flash" size={32} color="#FFD700" />
          </View>
          <View style={styles.pulseInfo}>
            <Text style={styles.pulseName}>Spark</Text>
            <Text style={styles.pulseDesc}>15 minutes of boosted visibility</Text>
            <Text style={styles.pulsePrice}>₦5,000</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
        </TouchableOpacity>

        {/* Flare Tier */}
        <TouchableOpacity style={styles.pulseCard}>
          <View style={[styles.pulseIcon, { backgroundColor: '#FF630030' }]}>
            <Ionicons name="flame" size={32} color="#FF6300" />
          </View>
          <View style={styles.pulseInfo}>
            <Text style={styles.pulseName}>Flare</Text>
            <Text style={styles.pulseDesc}>1 hour of enhanced placement</Text>
            <Text style={styles.pulsePrice}>₦15,000</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
        </TouchableOpacity>

        {/* Supernova Tier */}
        <TouchableOpacity style={[styles.pulseCard, styles.premiumCard]}>
          <View style={[styles.pulseIcon, { backgroundColor: '#FF336630' }]}>
            <Ionicons name="rocket" size={32} color="#FF3366" />
          </View>
          <View style={styles.pulseInfo}>
            <Text style={styles.pulseName}>Supernova</Text>
            <Text style={styles.pulseDesc}>4 hours of priority placement</Text>
            <Text style={styles.pulsePrice}>₦50,000</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.text.muted} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  pulseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  premiumCard: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pulseIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pulseName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  pulseDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  pulsePrice: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});
