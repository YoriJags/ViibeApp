/**
 * VenueCategoryFilter - Horizontal scrollable category pills
 *
 * Filters venues by type: All, Clubs, Lounges, Restaurants, Bars, Churches, Events
 * Each pill has icon + label. Selected = gradient fill.
 * Also shows trending count per category.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export type VenueCategory = 'all' | 'club' | 'lounge' | 'restaurant' | 'bar' | 'church' | 'concert' | 'block_party' | 'rave' | 'festival';

interface CategoryOption {
  key: VenueCategory;
  label: string;
  icon: string;
  gradient: [string, string];
}

interface VenueCategoryFilterProps {
  selected: VenueCategory;
  onSelect: (category: VenueCategory) => void;
  counts?: Record<string, number>;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'all', label: 'All', icon: 'grid', gradient: ['#FF3366', '#FF6B35'] },
  { key: 'club', label: 'Clubs', icon: 'musical-notes', gradient: ['#FF3366', '#9933FF'] },
  { key: 'lounge', label: 'Lounges', icon: 'wine', gradient: ['#9933FF', '#6B1FCC'] },
  { key: 'restaurant', label: 'Restaurants', icon: 'restaurant', gradient: ['#FF9933', '#FFD700'] },
  { key: 'bar', label: 'Bars', icon: 'beer', gradient: ['#FF6B35', '#FF9933'] },
  { key: 'church', label: 'Churches', icon: 'heart', gradient: ['#00D4FF', '#9933FF'] },
  { key: 'concert', label: 'Concerts', icon: 'mic', gradient: ['#FF3366', '#FF69B4'] },
  { key: 'block_party', label: 'Events', icon: 'people', gradient: ['#00E676', '#00D4FF'] },
];

export default function VenueCategoryFilter({ selected, onSelect, counts }: VenueCategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
      {CATEGORIES.map((cat) => {
        const isActive = selected === cat.key;
        const count = counts?.[cat.key] || 0;

        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.7}
          >
            {isActive ? (
              <LinearGradient
                colors={cat.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pill}
              >
                <Ionicons name={cat.icon as any} size={14} color="#FFF" />
                <Text style={styles.pillTextActive}>{cat.label}</Text>
                {count > 0 && cat.key !== 'all' && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
              </LinearGradient>
            ) : (
              <View style={styles.pill}>
                <Ionicons name={cat.icon as any} size={14} color="#888" />
                <Text style={styles.pillText}>{cat.label}</Text>
                {count > 0 && cat.key !== 'all' && (
                  <View style={[styles.countBadge, styles.countBadgeInactive]}>
                    <Text style={[styles.countText, styles.countTextInactive]}>{count}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A28',
    borderWidth: 1,
    borderColor: '#252530',
    gap: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  pillTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeInactive: {
    backgroundColor: '#252530',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  countTextInactive: {
    color: '#666',
  },
});
