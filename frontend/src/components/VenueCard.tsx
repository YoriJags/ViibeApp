import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
}

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
}

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onPress }) => {
  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366';
    if (score >= 60) return '#FF9933';
    if (score >= 40) return '#9933FF';
    return '#3399FF';
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

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: vibeColor }]} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{venue.name}</Text>
            {venue.is_featured && (
              <Ionicons name="star" size={14} color="#FFD700" />
            )}
          </View>
          <View style={styles.scoreContainer}>
            <Text style={[styles.score, { color: vibeColor }]}>
              {Math.round(venue.current_vibe_score)}
            </Text>
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
            <Ionicons name="flash" size={12} color="#888" />
            <Text style={styles.chipText}>{venue.energy_level}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="people" size={12} color="#888" />
            <Text style={styles.chipText}>{venue.capacity_level}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="enter" size={12} color="#888" />
            <Text style={styles.chipText}>{venue.gate_level}</Text>
          </View>
        </View>
      </View>

      {/* Arrow */}
      <Ionicons name="chevron-forward" size={20} color="#444" />
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
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  score: {
    fontSize: 24,
    fontWeight: '800',
  },
  area: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
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
});
