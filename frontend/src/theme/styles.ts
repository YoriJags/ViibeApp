/**
 * Vibe App Common Styles
 * 
 * Reusable style patterns used across the app.
 * Import these to maintain consistency.
 */

import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, borderRadius, typography } from './index';

export const commonStyles = StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.dark,
  },
  
  scrollView: {
    flex: 1,
  },
  
  // Cards
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  
  cardElevated: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  // Headers
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  
  headerTitle: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
  },
  
  headerSubtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  
  // Buttons
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  
  buttonPrimaryText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.md,
  },
  
  buttonSecondaryText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  
  buttonDisabled: {
    backgroundColor: colors.text.disabled,
  },
  
  buttonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Inputs
  inputContainer: {
    marginBottom: spacing.xl,
  },
  
  inputLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  
  input: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  // Text
  textPrimary: {
    color: colors.text.primary,
  },
  
  textSecondary: {
    color: colors.text.secondary,
  },
  
  textMuted: {
    color: colors.text.muted,
  },
  
  // Badges
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  
  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  
  // Dividers
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontSize: typography.fontSize.lg,
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  
  modalContent: {
    backgroundColor: colors.background.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  
  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  
  statCard: {
    width: '50%',
    padding: spacing.sm,
    alignItems: 'center',
  },
});

export default commonStyles;
