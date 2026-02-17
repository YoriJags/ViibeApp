import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useVibeStore } from '../src/store/vibeStore';
import OnboardingFlow from '../src/components/OnboardingFlow';
import SplashAnimation from '../src/components/SplashAnimation';
import DemoTutorial from '../src/components/DemoTutorial';

// Keep native splash visible until we're ready to show our animated one
SplashScreen.preventAutoHideAsync().catch(() => {});

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
          <Text style={styles.errorHint}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// App Initializer Component — manages splash → content transition
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { hasHydrated, fetchVenues, fetchCities, connectSocket, hasSeenOnboarding, completeOnboarding } = useVibeStore();
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

        await Promise.all([
          fetchVenues('lagos'),
          fetchCities(),
        ]);

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
    <ErrorBoundary>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#FF4444',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorHint: {
    color: '#888888',
    fontSize: 12,
  },
});
