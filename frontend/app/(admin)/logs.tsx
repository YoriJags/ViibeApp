/**
 * ADMIN FLOOR - System Logs
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme, spacing, typography } from '../../src/theme/floors';

const { colors } = adminTheme;

export default function AdminLogs() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>System Logs</Text>
      </View>
      <View style={styles.placeholder}>
        <Ionicons name="list" size={64} color={colors.data.activity} />
        <Text style={styles.placeholderText}>System logs coming soon</Text>
        <Text style={styles.placeholderDesc}>Real-time activity and error tracking</Text>
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
