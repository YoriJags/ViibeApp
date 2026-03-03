/**
 * VibePlusModal — Viibe+ subscription paywall.
 * Opens when a user taps any AI-gated feature without an active subscription.
 * Handles full Paystack payment flow: initialize → browser → verify → activate.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useVibeStore } from '../store/vibeStore';

type ModalState = 'paywall' | 'processing' | 'awaiting_verify' | 'success' | 'error';

interface VibePlusModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AI_FEATURES = [
  { icon: 'cash', label: 'Earn cashable coins', desc: 'Rate at participating venues, cash out direct to your bank' },
  { icon: 'ribbon', label: 'Verified Scout badge', desc: 'Venues recognise you — early access, priority at the door' },
  { icon: 'flash', label: 'No rating cooldowns', desc: 'Rate venues back-to-back, build your reputation faster' },
  { icon: 'eye', label: 'Oracle AI Prediction', desc: 'Claude-powered peak time forecast' },
  { icon: 'newspaper', label: 'Vibe Brief', desc: 'Daily AI city briefing at home' },
  { icon: 'chatbubbles', label: 'Roast & Toast', desc: 'Punchy AI venue personality card' },
  { icon: 'git-branch', label: 'DNA Narrative', desc: 'AI-written taste fingerprint story' },
  { icon: 'map', label: 'AI Night Planner', desc: 'Conversational venue planning' },
];

export default function VibePlusModal({ visible, onClose, onSuccess }: VibePlusModalProps) {
  const { initializeVibePlus, verifyVibePlus } = useVibeStore();

  const [state, setState] = useState<ModalState>('paywall');
  const [reference, setReference] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleClose = () => {
    setState('paywall');
    setReference('');
    setAuthUrl('');
    setErrorMessage('');
    onClose();
  };

  const handleSubscribe = async () => {
    setState('processing');
    try {
      const { authorization_url, reference: ref } = await initializeVibePlus();
      setReference(ref);
      setAuthUrl(authorization_url);
      setState('awaiting_verify');

      if (Platform.OS === 'web') {
        // Web: open new tab, then show "I've Paid" button
        if (typeof window !== 'undefined') {
          window.open(authorization_url, '_blank');
        }
      } else {
        // Native: in-app browser (SFSafariViewController / Chrome Custom Tab)
        await WebBrowser.openBrowserAsync(authorization_url, {
          toolbarColor: '#0D0A1F',
          dismissButtonStyle: 'done',
        });
        // Browser dismissed — attempt verify immediately
        await handleVerify(ref);
      }
    } catch (err: any) {
      setState('error');
      setErrorMessage(err?.message || 'Could not start payment. Please try again.');
    }
  };

  const handleVerify = async (ref?: string) => {
    const refToUse = ref || reference;
    if (!refToUse) return;

    setState('processing');
    try {
      const result = await verifyVibePlus(refToUse);
      if (result.success && result.is_vibe_plus) {
        setState('success');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2200);
      } else {
        // Payment not confirmed yet — stay on verify screen
        setState('awaiting_verify');
      }
    } catch (err: any) {
      setState('error');
      setErrorMessage(
        err?.message?.includes('not found')
          ? 'Payment reference not found. Please try again.'
          : "Could not verify payment. If you paid, tap \"I've Paid\" to retry."
      );
    }
  };

  const handleOpenAgain = async () => {
    if (!authUrl) return;
    if (Platform.OS === 'web') {
      window.open(authUrl, '_blank');
    } else {
      await WebBrowser.openBrowserAsync(authUrl, { toolbarColor: '#0D0A1F', dismissButtonStyle: 'done' });
      await handleVerify();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <BlurView intensity={30} style={styles.backdrop} tint="dark">
        <View style={styles.sheet}>
          <LinearGradient colors={['#1A0A2E', '#0D0A1F', '#0A0614']} style={styles.gradient}>

            {/* ── Paywall View ─────────────────────────────────────────── */}
            {state === 'paywall' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.vibePlusBadge}>
                    <Text style={styles.vibePlusBadgeText}>✦ VIIBE+</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.headline}>The Scout's Earning Toolkit</Text>
                <Text style={styles.subheadline}>
                  Rate venues, earn cashable coins, and get AI-powered scene intel — all in one.
                </Text>

                {/* Feature list */}
                <View style={styles.featureList}>
                  {AI_FEATURES.map((feature) => (
                    <View key={feature.label} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#00E676" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureLabel}>{feature.label}</Text>
                        <Text style={styles.featureDesc}>{feature.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Price block */}
                <View style={styles.priceBlock}>
                  <Text style={styles.priceAmount}>₦1,500</Text>
                  <Text style={styles.pricePeriod}>/ month</Text>
                  <View style={styles.claudeBadge}>
                    <Text style={styles.claudeBadgeText}>✦ Powered by Claude AI</Text>
                  </View>
                </View>

                {/* CTA */}
                <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.subscribeBtnGradient}
                  >
                    <Text style={styles.subscribeBtnText}>Subscribe Now — ₦1,500</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleClose} style={styles.maybeLater}>
                  <Text style={styles.maybeLaterText}>Maybe Later</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* ── Processing View ──────────────────────────────────────── */}
            {state === 'processing' && (
              <View style={styles.centeredContent}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.processingText}>Setting up payment...</Text>
              </View>
            )}

            {/* ── Awaiting Verify View ─────────────────────────────────── */}
            {state === 'awaiting_verify' && (
              <View style={styles.content}>
                <View style={styles.header}>
                  <View style={styles.vibePlusBadge}>
                    <Text style={styles.vibePlusBadgeText}>✦ VIIBE+</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                <View style={styles.awaitingIcon}>
                  <Ionicons name="card" size={48} color="#FFD700" />
                </View>

                <Text style={styles.awaitingTitle}>Complete Your Payment</Text>
                <Text style={styles.awaitingDesc}>
                  The Paystack payment page was opened. Once you complete the payment, tap below to activate Viibe+.
                </Text>

                <TouchableOpacity style={styles.subscribeBtn} onPress={() => handleVerify()} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.subscribeBtnGradient}
                  >
                    <Text style={styles.subscribeBtnText}>I've Paid — Verify Now</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenAgain} activeOpacity={0.8}>
                  <Text style={styles.secondaryBtnText}>Open Payment Page Again</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleClose} style={styles.maybeLater}>
                  <Text style={styles.maybeLaterText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Success View ─────────────────────────────────────────── */}
            {state === 'success' && (
              <View style={styles.centeredContent}>
                <View style={styles.successIcon}>
                  <Text style={styles.successStar}>✦</Text>
                </View>
                <Text style={styles.successTitle}>Viibe+ Activated!</Text>
                <Text style={styles.successDesc}>
                  Your AI suite is now unlocked. Welcome to the inner circle.
                </Text>
              </View>
            )}

            {/* ── Error View ───────────────────────────────────────────── */}
            {state === 'error' && (
              <View style={styles.content}>
                <View style={styles.header}>
                  <View style={[styles.vibePlusBadge, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' }]}>
                    <Text style={[styles.vibePlusBadgeText, { color: '#EF4444' }]}>Payment Error</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                <View style={styles.awaitingIcon}>
                  <Ionicons name="alert-circle" size={48} color="#EF4444" />
                </View>

                <Text style={styles.awaitingTitle}>Something Went Wrong</Text>
                <Text style={styles.awaitingDesc}>{errorMessage}</Text>

                {reference ? (
                  <TouchableOpacity style={styles.subscribeBtn} onPress={() => handleVerify()} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.subscribeBtnGradient}
                    >
                      <Text style={styles.subscribeBtnText}>Try Verify Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.subscribeBtn} onPress={() => setState('paywall')} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.subscribeBtnGradient}
                    >
                      <Text style={styles.subscribeBtnText}>Try Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={handleClose} style={styles.maybeLater}>
                  <Text style={styles.maybeLaterText}>Close</Text>
                </TouchableOpacity>

                <Text style={styles.supportNote}>
                  Persistent issues? DM us on Instagram @viibe.app
                </Text>
              </View>
            )}

          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  gradient: {
    minHeight: 400,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  centeredContent: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
    minHeight: 300,
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vibePlusBadge: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  vibePlusBadgeText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },

  // Headline
  headline: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  subheadline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
  },

  // Feature list
  featureList: {
    gap: 12,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  featureDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 1,
  },

  // Price block
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 12,
    padding: 14,
  },
  priceAmount: {
    color: '#FFD700',
    fontSize: 26,
    fontWeight: '800',
  },
  pricePeriod: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    marginRight: 8,
  },
  claudeBadge: {
    backgroundColor: 'rgba(153,51,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(153,51,255,0.35)',
  },
  claudeBadgeText: {
    color: '#CC88FF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Subscribe button
  subscribeBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  subscribeBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  subscribeBtnText: {
    color: '#0A0614',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  secondaryBtnText: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '600',
  },
  maybeLater: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  maybeLaterText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
  },
  supportNote: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },

  // Processing
  processingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    marginTop: 12,
  },

  // Awaiting verify
  awaitingIcon: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  awaitingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  awaitingDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Success
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successStar: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: '800',
  },
  successTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  successDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
