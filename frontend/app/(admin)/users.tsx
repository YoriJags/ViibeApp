/**
 * ADMIN FLOOR - Users Management
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme, spacing, typography } from '../../src/theme/floors';

const { colors } = adminTheme;

export default function AdminUsers() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Management</Text>
      </View>
      <View style={styles.placeholder}>
        <Ionicons name="people" size={64} color={colors.data.users} />
        <Text style={styles.placeholderText}>User management coming soon</Text>
        <Text style={styles.placeholderDesc}>View user activity and manage accounts</Text>
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  placeholderText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  placeholderDesc: {
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
