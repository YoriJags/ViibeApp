import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useVibeStore } from '../src/store/vibeStore';
import OnboardingFlow from '../src/components/OnboardingFlow';
import SplashAnimation from '../src/components/SplashAnimation';
import DemoTutorial from '../src/components/DemoTutorial';
import ErrorBoundary from '../src/components/ErrorBoundary';

// Keep native splash visible until we're ready to show our animated one
SplashScreen.preventAutoHideAsync().catch(() => {});

// App Initializer Component — manages splash → content transition
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { hasHydrated, fetchCities, connectSocket, hasSeenOnboarding, completeOnboarding, fetchFeatureFlags } = useVibeStore();
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  // Hide native splash once our animated splash mounts
  useEffect(() => {
    if (!nativeSplashHidden) {
      SplashScreen.hideAsync().catch(() => {});
      setNativeSplashHidden(true);
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (!hasHydrated) return;

        // fetchVenues is handled by the home screen (respects selectedCity)
        await Promise.all([fetchCities(), fetchFeatureFlags()]);
        connectSocket();
        setIsReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, [hasHydrated]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Show splash overlay while loading
  if (showSplash) {
    return (
      <SplashAnimation
        isReady={isReady}
        onAnimationComplete={handleSplashComplete}
      />
    );
  }

  // After splash exits, show onboarding or main app
  if (!hasSeenOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary variant="screen" label="App">
      <SafeAreaProvider>
        <AppInitializer>
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
              
              {/* Direct routes */}
              <Stack.Screen name="venue/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="rate/[id]" options={{ headerShown: false }} />
            </Stack>
            <DemoTutorial />
          </View>
        </AppInitializer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
});
