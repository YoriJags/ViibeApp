/**
 * VoteCard - Real-time venue voting for crew mode
 * Shows venue options with animated vote bars
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;

interface VoteOption {
  id: string;
  name: string;
  area: string;
  current_vibe_score: number;
  energy_level: string;
  votes: number;
  voters: string[];
}

interface VoteCardProps {
  options: VoteOption[];
  totalVotes: number;
  hasVoted: boolean;
  userId: string;
  onVote: (venueId: string) => void;
  winner?: VoteOption | null;
}

function getVibeColor(score: number): string {
  if (score >= 80) return '#FF3366';
  if (score >= 60) return '#FF9933';
  if (score >= 40) return '#9933FF';
  return '#3399FF';
}

export default function VoteCard({ options, totalVotes, hasVoted, userId, onVote, winner }: VoteCardProps) {
  const maxVotes = Math.max(...options.map(o => o.votes), 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={18} color={colors.primary} />
        <Text style={styles.title}>
          {winner ? 'Winner!' : 'Where tonight?'}
        </Text>
        <Text style={styles.voteCount}>{totalVotes} votes</Text>
      </View>

      {options.map((option) => {
        const isWinner = winner?.id === option.id;
        const userVoted = option.voters.includes(userId);
        const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
        const barWidth = `${Math.max(percentage, 2)}%`;
        const vibeColor = getVibeColor(option.current_vibe_score);

        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.option,
              isWinner && styles.winnerOption,
              userVoted && styles.votedOption,
            ]}
            onPress={() => !hasVoted && onVote(option.id)}
            disabled={hasVoted}
            activeOpacity={hasVoted ? 1 : 0.7}
          >
            {/* Background fill bar */}
            <View
              style={[
                styles.fillBar,
                {
                  width: barWidth as any,
                  backgroundColor: isWinner ? `${colors.primary}25` : `${vibeColor}15`,
                },
              ]}
            />

            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                <Text style={styles.optionName} numberOfLines={1}>{option.name}</Text>
                <Text style={styles.optionArea}>{option.area}</Text>
              </View>
              <View style={styles.optionRight}>
                {hasVoted && (
                  <Text style={[styles.percentage, { color: vibeColor }]}>
                    {Math.round(percentage)}%
                  </Text>
                )}
                {userVoted && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                )}
                {isWinner && (
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  voteCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  option: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
  },
  winnerOption: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  votedOption: {
    borderColor: colors.primary,
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: borderRadius.lg,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionLeft: {
    flex: 1,
  },
  optionName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  optionArea: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  percentage: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
});
