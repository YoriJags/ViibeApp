import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../src/store/vibeStore';
import { logger } from '../src/utils/logger';
import { OfflineBanner, Toast } from '../src/components/ErrorComponents';
import NetInfo from '@react-native-community/netinfo';

// Global Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to our logging system
    logger.error('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    logger.info('User initiated app restart from error boundary');
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrapper}>
            <Ionicons name="warning" size={64} color="#FF4757" />
          </View>
          
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            We're sorry, but something unexpected happened. Please try again.
          </Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retryButtonText}>Restart App</Text>
          </TouchableOpacity>
          
          {__DEV__ && this.state.error && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Info (Dev Only)</Text>
              <Text style={styles.debugText}>{this.state.error.toString()}</Text>
              <Text style={styles.debugStack} numberOfLines={10}>
                {this.state.error.stack}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

// Loading Screen Component
function LoadingScreen({ message }: { message?: string }) {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingContent}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>V</Text>
        </View>
        <ActivityIndicator size="large" color="#FF2D92" style={styles.spinner} />
        <Text style={styles.loadingText}>{message || 'Loading Vibe Scout...'}</Text>
      </View>
    </View>
  );
}

// Network Status Provider
function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const { setIsOnline } = useVibeStore();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      const nowOffline = !state.isConnected;
      
      setIsOffline(nowOffline);
      setIsOnline(!nowOffline);
      
      // Show reconnected toast
      if (wasOffline && !nowOffline) {
        logger.info('Network reconnected');
        setShowReconnected(true);
      }
      
      if (nowOffline) {
        logger.warn('Network disconnected');
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  return (
    <>
      <OfflineBanner visible={isOffline} />
      {children}
      <Toast
        visible={showReconnected}
        message="Back online!"
        type="success"
        onHide={() => setShowReconnected(false)}
      />
    </>
  );
}

// App Initializer - Handles loading state and initial data fetch
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { hasHydrated, fetchVenues, fetchCities, connectSocket } = useVibeStore();
  const [initState, setInitState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info('App initialization started');
        
        // Wait for store hydration
        if (!hasHydrated) {
          setLoadingMessage('Restoring session...');
          logger.debug('Waiting for store hydration');
          return;
        }

        setLoadingMessage('Connecting to server...');
        
        // Fetch initial data with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        );

        const fetchPromise = Promise.all([
          fetchVenues('lagos'),
          fetchCities(),
        ]);

        await Promise.race([fetchPromise, timeoutPromise]);
        
        logger.info('Initial data loaded successfully');
        setLoadingMessage('Almost ready...');

        // Connect socket for real-time updates
        connectSocket();
        
        // Small delay for smooth transition
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setInitState('ready');
        logger.info('App initialization complete');
        
      } catch (error) {
        const err = error as Error;
        logger.error('App initialization failed', err);
        
        // Still show the app even if initial fetch fails
        // The user can retry later
        setInitState('ready');
      }
    };

    initializeApp();
  }, [hasHydrated]);

  if (initState === 'loading') {
    return <LoadingScreen message={loadingMessage} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  logger.info('RootLayout mounted');
  
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NetworkStatusProvider>
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
            </View>
          </AppInitializer>
        </NetworkStatusProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FF2D92',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFF',
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    color: '#8B8B9E',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,71,87,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8B8B9E',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF2D92',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#12141A',
    borderRadius: 12,
    width: '100%',
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFA502',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#FF4757',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  debugStack: {
    fontSize: 9,
    color: '#8B8B9E',
    fontFamily: 'monospace',
  },
});
