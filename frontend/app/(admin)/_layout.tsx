/**
 * ADMIN FLOOR - Layout
 * The Authority Experience - Slate/Royal Blue Theme
 * 
 * Navigation: Treasury | Venues | Users | Logs
 * Access: Users with is_super_admin = true
 */
import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminTheme, spacing, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = adminTheme;

export default function AdminLayout() {
  const router = useRouter();
  const { user, isAuthenticated } = useVibeStore();

  // Navigation guard - redirect non-admins to public floor
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(public)');
      return;
    }
    
    if (!user?.is_super_admin) {
      // Show message and redirect
      router.replace('/(public)');
    }
  }, [isAuthenticated, user?.is_super_admin]);

  // Show loading while checking permissions
  if (!isAuthenticated || !user?.is_super_admin) {
    return (
      <View style={styles.guardContainer}>
        <Ionicons name="shield" size={48} color={colors.primary} />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
        <Text style={styles.guardText}>Verifying admin access...</Text>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.background.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Treasury',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="venues"
        options={{
          title: 'Venues',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Logs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="economy"
        options={{
          title: 'Economy',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  guardContainer: {
    flex: 1,
    backgroundColor: colors.background.dark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  guardText: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
});
