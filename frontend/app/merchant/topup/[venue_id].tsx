import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, spacing, borderRadius, typography } from '../../../src/theme';
import { useVibeStore } from '../../../src/store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000];

export default function WalletTopUp() {
  const { venue_id } = useLocalSearchParams<{ venue_id: string }>();
  const router = useRouter();
  const { user } = useVibeStore();
  
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [reference, setReference] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);

  const handleAmountPreset = (preset: number) => {
    setAmount(preset.toString());
  };

  const initializePayment = async () => {
    const numAmount = parseInt(amount);
    if (!numAmount || numAmount < 1000) {
      Alert.alert('Invalid Amount', 'Minimum top-up amount is ₦1,000');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/merchant/wallet/${venue_id}/topup/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || '',
        },
        body: JSON.stringify({
          amount: numAmount,
          email: user?.email || 'merchant@vibeapp.ng',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReference(data.reference);
        setPaymentUrl(data.authorization_url);
        setShowWebView(true);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('Payment init error:', error);
      Alert.alert('Error', 'Failed to connect to payment server');
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNavigation = async (navState: any) => {
    const { url } = navState;
    
    // Check for success callback
    if (url.includes('callback') || url.includes('success') || url.includes('trxref=')) {
      setShowWebView(false);
      setLoading(true);
      
      // Verify the payment
      try {
        const verifyResponse = await fetch(`${API_URL}/api/merchant/wallet/verify/${reference}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': user?.id || '',
          },
        });

        if (verifyResponse.ok) {
          const result = await verifyResponse.json();
          setPaymentStatus('success');
          setTimeout(() => {
            Alert.alert(
              'Payment Successful! 🎉',
              `₦${parseInt(amount).toLocaleString()} has been added to your wallet.\n\nNew Balance: ₦${result.new_balance.toLocaleString()}`,
              [{ text: 'OK', onPress: () => router.back() }]
            );
          }, 500);
        } else {
          setPaymentStatus('failed');
          Alert.alert('Payment Failed', 'Unable to verify payment. Please contact support.');
        }
      } catch (error) {
        console.error('Verify error:', error);
        setPaymentStatus('failed');
        Alert.alert('Error', 'Failed to verify payment');
      } finally {
        setLoading(false);
      }
    }
    
    // Check for cancel/close
    if (url.includes('cancel') || url.includes('close')) {
      setShowWebView(false);
      setPaymentStatus('failed');
      Alert.alert('Payment Cancelled', 'You cancelled the payment.');
    }
  };

  // Show success/failure screen
  if (paymentStatus === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIcon, { backgroundColor: colors.status.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={80} color={colors.status.success} />
          </View>
          <Text style={styles.statusTitle}>Payment Successful!</Text>
          <Text style={styles.statusMessage}>
            ₦{parseInt(amount).toLocaleString()} has been added to your wallet.
          </Text>
          <TouchableOpacity style={styles.successButton} onPress={() => router.back()}>
            <Text style={styles.successButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIcon, { backgroundColor: colors.status.error + '20' }]}>
            <Ionicons name="close-circle" size={80} color={colors.status.error} />
          </View>
          <Text style={styles.statusTitle}>Payment Failed</Text>
          <Text style={styles.statusMessage}>
            Your payment could not be processed. Please try again.
          </Text>
          <TouchableOpacity 
            style={[styles.successButton, { backgroundColor: colors.status.error }]} 
            onPress={() => {
              setPaymentStatus(null);
              setAmount('');
            }}
          >
            <Text style={styles.successButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show WebView for payment
  if (showWebView && paymentUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => {
              setShowWebView(false);
              Alert.alert('Cancel Payment?', 'Are you sure you want to cancel this payment?', [
                { text: 'Continue Payment', style: 'cancel' },
                { text: 'Cancel', style: 'destructive', onPress: () => setShowWebView(false) },
              ]);
            }}
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Secure Payment</Text>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={14} color={colors.status.success} />
            <Text style={styles.secureText}>Secured by Paystack</Text>
          </View>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleWebViewNavigation}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading payment page...</Text>
            </View>
          )}
          style={styles.webView}
        />
      </SafeAreaView>
    );
  }

  // Main top-up form
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Top Up Wallet</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Amount Input */}
          <View style={styles.amountSection}>
            <Text style={styles.sectionLabel}>Enter Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                maxLength={7}
              />
            </View>
            <Text style={styles.minAmount}>Minimum: ₦1,000</Text>
          </View>

          {/* Preset Amounts */}
          <View style={styles.presetsSection}>
            <Text style={styles.sectionLabel}>Quick Select</Text>
            <View style={styles.presetsGrid}>
              {PRESET_AMOUNTS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetButton,
                    amount === preset.toString() && styles.presetButtonActive,
                  ]}
                  onPress={() => handleAmountPreset(preset)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      amount === preset.toString() && styles.presetTextActive,
                    ]}
                  >
                    ₦{preset.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Payment Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.status.success} />
              <Text style={styles.infoText}>Secure payment via Paystack</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="flash" size={20} color={colors.gold} />
              <Text style={styles.infoText}>Instant credit to your wallet</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="card" size={20} color={colors.status.info} />
              <Text style={styles.infoText}>Cards, Bank Transfer, USSD accepted</Text>
            </View>
          </View>

          {/* Test Mode Notice */}
          <View style={styles.testModeCard}>
            <Ionicons name="information-circle" size={20} color={colors.status.warning} />
            <View style={styles.testModeContent}>
              <Text style={styles.testModeTitle}>Test Mode Active</Text>
              <Text style={styles.testModeText}>
                Use test card: 4084 0840 8408 4081{'\n'}
                Any CVV, any future expiry date
              </Text>
            </View>
          </View>

          {/* Pay Button */}
          <TouchableOpacity
            style={[
              styles.payButton,
              (!amount || parseInt(amount) < 1000) && styles.payButtonDisabled,
            ]}
            onPress={initializePayment}
            disabled={loading || !amount || parseInt(amount) < 1000}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Ionicons name="wallet" size={24} color={colors.text.primary} />
                <Text style={styles.payButtonText}>
                  {amount && parseInt(amount) >= 1000
                    ? `Pay ₦${parseInt(amount).toLocaleString()}`
                    : 'Enter Amount'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  amountSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
    marginRight: spacing.sm,
  },
  amountInput: {
    fontSize: 64,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    minWidth: 150,
    textAlign: 'center',
  },
  minAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  presetsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  presetButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  presetText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  presetTextActive: {
    color: colors.primary,
  },
  infoCard: {
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  testModeCard: {
    flexDirection: 'row',
    backgroundColor: colors.status.warning + '20',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  testModeContent: {
    flex: 1,
  },
  testModeTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.status.warning,
    marginBottom: spacing.xs,
  },
  testModeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  payButtonDisabled: {
    backgroundColor: colors.text.muted,
    opacity: 0.5,
  },
  payButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  // WebView styles
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.input,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  secureText: {
    fontSize: typography.fontSize.xs,
    color: colors.status.success,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.dark,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  // Status screens
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  statusIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  statusTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  successButton: {
    backgroundColor: colors.status.success,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  successButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  cancelButton: {
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
  },
});
