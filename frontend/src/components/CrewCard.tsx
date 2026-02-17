/**
 * CrewCard - Compact crew display for profile page
 * Shows crew name, member avatars, and active count
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';
import AvatarDisplay, { AvatarConfig } from './AvatarDisplay';

const { colors } = publicTheme;

interface MemberDetail {
  user_id: string;
  username: string;
  scout_status: string;
  checked_in?: boolean;
  venue_name?: string;
  avatar_config?: AvatarConfig | null;
}

interface CrewCardProps {
  name: string;
  members: MemberDetail[];
  inviteCode: string;
  isCaptain: boolean;
  onPress: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  newbie: '#888',
  regular: '#4FC3F7',
  scout: '#FF3366',
  elite: '#FFD700',
};

export default function CrewCard({ name, members, inviteCode, isCaptain, onPress }: CrewCardProps) {
  const activeCount = members.filter(m => m.checked_in).length;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Ionicons name="people" size={18} color={colors.primary} />
          <Text style={styles.name}>{name}</Text>
          {isCaptain && (
            <View style={styles.captainBadge}>
              <Ionicons name="star" size={10} color="#FFD700" />
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      </View>

      {/* Member avatars */}
      <View style={styles.avatarRow}>
        {members.slice(0, 6).map((member, index) => (
          <View
            key={member.user_id}
            style={[
              styles.avatarWrap,
              { marginLeft: index > 0 ? -8 : 0, zIndex: members.length - index },
            ]}
          >
            <AvatarDisplay
              config={member.avatar_config || null}
              username={member.username}
              size={32}
              showBorder={member.checked_in}
              borderColor="#00E676"
            />
          </View>
        ))}
        {members.length > 6 && (
          <View style={[styles.avatar, { marginLeft: -8, backgroundColor: colors.background.elevated }]}>
            <Text style={styles.avatarText}>+{members.length - 6}</Text>
          </View>
        )}

        <View style={styles.stats}>
          <Text style={styles.memberCount}>
            {members.length}/8 members
          </Text>
          {activeCount > 0 && (
            <Text style={styles.activeCount}>
              {activeCount} out tonight
            </Text>
          )}
        </View>
      </View>

      {/* Invite code */}
      <View style={styles.codeRow}>
        <Text style={styles.codeLabel}>Code:</Text>
        <Text style={styles.code}>{inviteCode}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  captainBadge: {
    backgroundColor: '#FFD70030',
    padding: 3,
    borderRadius: 4,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  stats: {
    marginLeft: spacing.md,
  },
  memberCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  activeCount: {
    fontSize: typography.fontSize.xs,
    color: '#00E676',
    fontWeight: typography.fontWeight.semibold,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  codeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  code: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: 2,
  },
});
