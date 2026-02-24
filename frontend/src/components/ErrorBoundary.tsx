/**
 * ErrorBoundary — reusable component-level error boundary.
 *
 * Two variants:
 *   variant="inline"  — small fallback card in place of the crashed component
 *   variant="screen"  — full-screen fallback (used by root _layout.tsx)
 *
 * Usage:
 *   <ErrorBoundary label="Map">
 *     <MockMap ... />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary variant="screen">
 *     <EntireApp />
 *   </ErrorBoundary>
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
  /** Label shown in the fallback UI, e.g. "Map" → "Map couldn't load" */
  label?: string;
  /** 'inline' shows a small in-place card. 'screen' fills the whole screen. */
  variant?: 'inline' | 'screen';
  /** Optional custom fallback to render instead of the default */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  static defaultProps: Partial<Props> = {
    variant: 'inline',
    label: 'Component',
  };

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return <>{this.props.fallback}</>;
    }

    const { label = 'Component', variant = 'inline' } = this.props;

    if (variant === 'screen') {
      return (
        <View style={styles.screen}>
          <Ionicons name="warning-outline" size={48} color="#FF4444" />
          <Text style={styles.screenTitle}>Something went wrong</Text>
          <Text style={styles.screenMessage}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleReset}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
          <Text style={styles.screenHint}>If this keeps happening, please restart the app.</Text>
        </View>
      );
    }

    // inline variant — small card in place of the component
    return (
      <View style={styles.inline}>
        <Ionicons name="alert-circle-outline" size={18} color="#FF6B6B" />
        <Text style={styles.inlineText}>{label} couldn't load</Text>
        <TouchableOpacity onPress={this.handleReset} style={styles.inlineRetry}>
          <Text style={styles.inlineRetryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // Screen variant
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  screenTitle: {
    color: '#FF4444',
    fontSize: 20,
    fontWeight: '700',
  },
  screenMessage: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  screenHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
  },

  // Inline variant
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 4,
  },
  inlineText: {
    flex: 1,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  inlineRetry: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 8,
  },
  inlineRetryText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '700',
  },
});
