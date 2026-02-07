/**
 * Graceful Error UI Components
 * Beautiful, user-friendly error screens and components
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorType, AppError } from '../utils/logger';

const colors = {
  background: '#0A0A0F',
  card: '#12141A',
  primary: '#FF2D92',
  error: '#FF4757',
  warning: '#FFA502',
  success: '#2ED573',
  text: '#FFFFFF',
  textSecondary: '#8B8B9E',
  border: '#1E1E2E',
};

interface ErrorScreenProps {
  error: AppError;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export function ErrorScreen({ error, onRetry, onGoBack }: ErrorScreenProps) {
  const getErrorIcon = () => {
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'cloud-offline';
      case ErrorType.AUTH:
        return 'lock-closed';
      case ErrorType.PERMISSION:
        return 'shield';
      default:
        return 'alert-circle';
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case ErrorType.NETWORK:
        return colors.warning;
      case ErrorType.AUTH:
        return colors.primary;
      default:
        return colors.error;
    }
  };

  return (
    <View style={styles.errorScreen}>
      <View style={[styles.errorIconContainer, { backgroundColor: getErrorColor() + '20' }]}>
        <Ionicons name={getErrorIcon()} size={48} color={getErrorColor()} />
      </View>
      
      <Text style={styles.errorTitle}>Oops!</Text>
      <Text style={styles.errorMessage}>{error.userMessage}</Text>
      
      <View style={styles.errorActions}>
        {error.retryable && onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        
        {onGoBack && (
          <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugText}>Type: {error.type}</Text>
          <Text style={styles.debugText}>Message: {error.message}</Text>
        </View>
      )}
    </View>
  );
}

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;
  
  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline" size={16} color="#FFF" />
      <Text style={styles.offlineBannerText}>No internet connection</Text>
    </View>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;
  
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message && <Text style={styles.loadingText}>{message}</Text>}
      </View>
    </View>
  );
}

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onHide: () => void;
}

export function Toast({ visible, message, type, onHide }: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  const getToastStyle = () => {
    switch (type) {
      case 'success': return { backgroundColor: colors.success };
      case 'error': return { backgroundColor: colors.error };
      case 'warning': return { backgroundColor: colors.warning };
      default: return { backgroundColor: colors.primary };
    }
  };

  const getToastIcon = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      default: return 'information-circle';
    }
  };

  return (
    <Animated.View style={[styles.toast, getToastStyle(), { opacity }]}>
      <Ionicons name={getToastIcon()} size={20} color="#FFF" />
      <Text style={styles.toastText}>{message}</Text>
      <TouchableOpacity onPress={onHide}>
        <Ionicons name="close" size={20} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name={icon as any} size={48} color={colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface RetryableViewProps {
  loading: boolean;
  error: AppError | null;
  onRetry: () => void;
  children: React.ReactNode;
}

export function RetryableView({ loading, error, onRetry, children }: RetryableViewProps) {
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingStateText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={onRetry} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  debugInfo: {
    marginTop: 32,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text,
    fontSize: 14,
    marginTop: 16,
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    zIndex: 1000,
  },
  toastText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyAction: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingStateText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 16,
  },
});

export default {
  ErrorScreen,
  OfflineBanner,
  LoadingOverlay,
  Toast,
  EmptyState,
  RetryableView,
};
