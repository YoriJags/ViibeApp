import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  current_vibe_score: number;
  energy_level: 'chill' | 'popping' | 'electric';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  is_featured: boolean;
  active_pulse_tier?: 'spark' | 'flare' | 'supernova' | null;
  entry_fee?: string;
  music_genre?: string;
}

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
  showBoostBadge?: boolean;
}

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onPress, showBoostBadge = true }) => {
  const isPulseBoosted = venue.active_pulse_tier !== null && venue.active_pulse_tier !== undefined;
  
  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366';
    if (score >= 60) return '#FF9933';
    if (score >= 40) return '#9933FF';
    return '#3399FF';
  };

  const getEnergyLabel = (level: string) => {
    switch (level) {
      case 'electric': return 'Electric';
      case 'popping': return 'Popping';
      case 'chill': return 'Quiet';
      default: return 'Quiet';
    }
  };

  const getVelocityIcon = (velocity: string) => {
    switch (velocity) {
      case 'heating_up':
        return { name: 'trending-up', color: '#4CAF50' };
      case 'cooling_down':
        return { name: 'trending-down', color: '#FF5252' };
      default:
        return { name: 'remove', color: '#888' };
    }
  };

  const velocityIcon = getVelocityIcon(venue.vibe_velocity);
  const vibeColor = getVibeColor(venue.current_vibe_score);
  const isLowEnergy = venue.current_vibe_score < 40;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isPulseBoosted && styles.cardBoosted,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Gold Border for Pulse Drop venues */}
      {isPulseBoosted && (
        <View style={styles.goldBorderOverlay}>
          <LinearGradient
            colors={['#FFD700', '#FFA500', '#FFD700']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.goldGradientBorder}
          />
        </View>
      )}

      {/* Left accent bar - Shows REAL vibe color */}
      <View style={[styles.accentBar, { backgroundColor: vibeColor }]} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.nameContainer}>
            <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
            {venue.is_featured && !isPulseBoosted && (
              <Ionicons name="star" size={14} color="#FFD700" />
            )}
          </View>
          
          {/* PROMINENT Energy Score - Always honest */}
          <View style={styles.scoreContainer}>
            <View style={styles.scoreBox}>
              <Text style={[styles.energyLabel, { color: vibeColor }]}>
                {getEnergyLabel(venue.energy_level)}
              </Text>
              <Text style={[styles.score, { color: vibeColor }]}>
                {Math.round(venue.current_vibe_score)}%
              </Text>
            </View>
            <Ionicons
              name={velocityIcon.name as any}
              size={16}
              color={velocityIcon.color}
            />
          </View>
        </View>

        <Text style={styles.area}>{venue.area}</Text>

        {/* Status chips */}
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Ionicons name="people" size={12} color="#888" />
            <Text style={styles.chipText}>{venue.capacity_level}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="enter" size={12} color="#888" />
            <Text style={styles.chipText}>{venue.gate_level}</Text>
          </View>
          {venue.entry_fee && (
            <View style={styles.chip}>
              <Ionicons name="ticket-outline" size={12} color="#888" />
              <Text style={styles.chipText}>{venue.entry_fee}</Text>
            </View>
          )}
        </View>

        {/* Pulse Drop Badge - Clearly labeled as sponsored */}
        {isPulseBoosted && showBoostBadge && (
          <View style={styles.pulseBadgeContainer}>
            <View style={styles.pulseBadge}>
              <Ionicons name="flash" size={12} color="#FFD700" />
              <Text style={styles.pulseBadgeText}>PULSE</Text>
            </View>
            <Text style={styles.cloutBonusText}>2x Clout for check-ins!</Text>
          </View>
        )}

        {/* Transparency: Show low energy warning even if boosted */}
        {isPulseBoosted && isLowEnergy && (
          <View style={styles.lowEnergyWarning}>
            <Ionicons name="information-circle" size={12} color="#888" />
            <Text style={styles.lowEnergyText}>
              Low activity right now
            </Text>
          </View>
        )}
      </View>

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={20} color={isPulseBoosted ? '#FFD700' : '#444'} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    paddingRight: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardBoosted: {
    backgroundColor: '#1A1815',
    borderColor: '#FFD70050',
    borderWidth: 2,
  },
  goldBorderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    opacity: 0.1,
  },
  goldGradientBorder: {
    flex: 1,
  },
  accentBar: {
    width: 4,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  energyLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  score: {
    fontSize: 22,
    fontWeight: '800',
  },
  area: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252530',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    color: '#888',
    textTransform: 'capitalize',
  },
  pulseBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD70040',
    gap: 4,
  },
  pulseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
  cloutBonusText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  lowEnergyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  lowEnergyText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
});
