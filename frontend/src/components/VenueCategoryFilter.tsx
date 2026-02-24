/**
 * VenueCategoryFilter — Horizontal scrollable category tabs.
 * Active tab: icon + label + colored underline bar.
 * Inactive: muted icon + label, no underline.
 * Shows live count badge per category.
 */
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type VenueCategory =
  | 'all'
  | 'club'
  | 'lounge'
  | 'restaurant'
  | 'bar'
  | 'church'
  | 'concert'
  | 'block_party'
  | 'rave'
  | 'festival';

interface CategoryOption {
  key: VenueCategory;
  label: string;
  icon: string;
  color: string;
}

interface VenueCategoryFilterProps {
  selected: VenueCategory;
  onSelect: (category: VenueCategory) => void;
  counts?: Record<string, number>;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'all',         label: 'All',        icon: 'apps',           color: '#FF3366' },
  { key: 'club',        label: 'Clubs',      icon: 'musical-notes',  color: '#FF3366' },
  { key: 'restaurant',  label: 'Eats',       icon: 'restaurant',     color: '#FF9933' },
  { key: 'lounge',      label: 'Lounges',    icon: 'wine',           color: '#9933FF' },
  { key: 'bar',         label: 'Bars',       icon: 'beer',           color: '#FF6B35' },
  { key: 'concert',     label: 'Concerts',   icon: 'mic',            color: '#FF3366' },
  { key: 'block_party', label: 'Events',     icon: 'people',         color: '#00E676' },
  { key: 'church',      label: 'Worship',    icon: 'heart',          color: '#00D4FF' },
];

function CategoryTab({
  cat,
  isActive,
  count,
  onPress,
}: {
  cat: CategoryOption;
  isActive: boolean;
  count: number;
  onPress: () => void;
}) {
  const underlineScale = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  const handlePress = () => {
    if (!isActive) {
      Animated.spring(underlineScale, {
        toValue: 1,
        tension: 180,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={handlePress}
      activeOpacity={0.65}
    >
      {/* Icon */}
      <Ionicons
        name={cat.icon as any}
        size={15}
        color={isActive ? cat.color : '#444'}
      />

      {/* Label + count badge */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, isActive && { color: '#FFF' }]}>
          {cat.label}
        </Text>
        {count > 0 && cat.key !== 'all' && (
          <View
            style={[
              styles.badge,
              isActive
                ? { backgroundColor: cat.color + '30', borderColor: cat.color + '60' }
                : { backgroundColor: '#1A1A28', borderColor: '#252530' },
            ]}
          >
            <Text style={[styles.badgeText, isActive && { color: cat.color }]}>
              {count}
            </Text>
          </View>
        )}
      </View>

      {/* Underline indicator */}
      <Animated.View
        style={[
          styles.underline,
          {
            backgroundColor: cat.color,
            transform: [{ scaleX: isActive ? 1 : 0 }],
            opacity: isActive ? 1 : 0,
          },
        ]}
      />
    </TouchableOpacity>
  );
}

export default function VenueCategoryFilter({
  selected,
  onSelect,
  counts,
}: VenueCategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
      {CATEGORIES.map((cat) => (
        <CategoryTab
          key={cat.key}
          cat={cat}
          isActive={selected === cat.key}
          count={counts?.[cat.key] ?? 0}
          onPress={() => onSelect(cat.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 0,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 0,
    gap: 4,
    position: 'relative',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#555',
  },
  underline: {
    height: 2,
    borderRadius: 1,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
