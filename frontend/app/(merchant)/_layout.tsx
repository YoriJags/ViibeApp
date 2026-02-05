/**
 * MERCHANT FLOOR - Layout
 * The Business Experience - Fintech/Gold Theme
 * 
 * Navigation: Overview | Wallet | Pulse | Settings
 * Access: Users with is_merchant = true
 */
import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, typography } from '../../src/theme/floors';
import { useVibeStore } from '../../src/store/vibeStore';

const { colors } = merchantTheme;

export default function MerchantLayout() {
  const router = useRouter();
  const { user, isAuthenticated } = useVibeStore();

  // Navigation guard - redirect non-merchants to public floor
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(public)');
      return;
    }
    
    if (!user?.is_merchant) {
      // Show message and redirect
      router.replace('/(public)');
    }
  }, [isAuthenticated, user?.is_merchant]);

  // Show loading while checking permissions
  if (!isAuthenticated || !user?.is_merchant) {
    return (
      <View style={styles.guardContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.guardText}>Verifying merchant access...</Text>
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
          title: 'Overview',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pulse"
        options={{
          title: 'Pulse',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
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
