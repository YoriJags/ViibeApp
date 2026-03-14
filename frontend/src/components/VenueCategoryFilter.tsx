/**
 * VenueCategoryFilter — Horizontal scrollable category tabs.
 * Active tab: icon + label + colored underline bar.
 * Inactive: muted icon + label, no underline.
 * Shows live count badge per category.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

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

const CATEGORY_EMOJI: Record<string, string> = {
  all:         '✦',
  club:        '🎵',
  bar:         '🥃',
  lounge:      '🌙',
  restaurant:  '🍽️',
  concert:     '🎤',
  block_party: '🌆',
  church:      '●',
  rave:        '🎤',
  festival:    '🌆',
};

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
  const handlePress = () => {
    onPress();
  };

  const emoji = CATEGORY_EMOJI[cat.key] ?? '●';

  return (
    <TouchableOpacity
      style={[
        styles.tab,
        isActive ? [styles.tabActive, { backgroundColor: cat.color }] : styles.tabInactive,
      ]}
      onPress={handlePress}
      activeOpacity={0.65}
    >
      {/* Emoji prefix + Label */}
      <View style={styles.labelRow}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.label, isActive && { color: '#FFF' }]}>
          {cat.label}
        </Text>
        {count > 0 && cat.key !== 'all' && (
          <View
            style={[
              styles.badge,
              isActive
                ? { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }
                : { backgroundColor: '#1A1A28', borderColor: '#252530' },
            ]}
          >
            <Text style={[styles.badgeText, isActive && { color: '#FFF' }]}>
              {count}
            </Text>
          </View>
        )}
      </View>
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
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  tabActive: {
    // backgroundColor set inline with cat.color
  },
  tabInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 12,
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
});
