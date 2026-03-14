import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useVibeStore } from '../../src/store/vibeStore';
import { VibeDynamicIsland } from '../../src/components/VibeDynamicIsland';

export default function TabLayout() {
  const router = useRouter();
  const isInsideVenue  = useVibeStore(s => s.isInsideVenue);
  const activeVenueId  = useVibeStore(s => s.activeVenueId);
  const openCityPicker = useVibeStore(s => s.openCityPicker);

  // Public scout floor is mobile-only — web visitors see download prompt
  if (Platform.OS === 'web') {
    return (
      <View style={styles.mobileOnly}>
        <Text style={styles.mobileEmoji}>📱</Text>
        <Text style={styles.mobileTitle}>VIIBE</Text>
        <Text style={styles.mobileHeading}>Scout floor is mobile-only</Text>
        <Text style={styles.mobileBody}>
          Download the app to discover{'\n'}the scene around you.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ── Persistent Island HUD — floats above all tabs ─────────────── */}
      <View
        style={styles.islandHud}
        pointerEvents="box-none"
      >
        <VibeDynamicIsland
          onPress={() => {
            if (isInsideVenue && activeVenueId) {
              router.push(`/venue/${activeVenueId}`);
            } else {
              openCityPicker();
            }
          }}
        />
      </View>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#FF3366',
          tabBarInactiveTintColor: '#666',
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Map',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Trending',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flame" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pulse"
          options={{
            title: 'Pulse',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileOnly: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  mobileEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  mobileTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 6,
    marginBottom: 12,
  },
  mobileHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  mobileBody: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  islandHud: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 28,
    alignSelf: 'center',
    zIndex: 1000,
    elevation: 20,
  },
  tabBar: {
    backgroundColor: '#151520',
    borderTopColor: '#252530',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
