import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0F' },
            animation: 'slide_from_right',
          }}
        >
          {/* 3-Storey Architecture */}
          <Stack.Screen name="(public)" options={{ headerShown: false }} />
          <Stack.Screen name="(merchant)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          
          {/* Legacy routes - keeping for backward compatibility */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="venue/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="rate/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="merchant/[venue_id]" options={{ headerShown: false }} />
          <Stack.Screen name="merchant/topup/[venue_id]" options={{ headerShown: false }} />
          <Stack.Screen name="admin/treasury" options={{ headerShown: false }} />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
});
