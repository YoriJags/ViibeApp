import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../../src/store/vibeStore';
import VibePlusModal from '../../src/components/VibePlusModal';
import ScoutAuraCard from '../../src/components/ScoutAuraCard';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const DEMO_DEBRIEF = {
  debrief: "You hit 3 spots tonight and kept the energy electric the whole way through — that's certified scout behaviour right there.",
  night_title: "Electric VI Run",
  stats: { spots_visited: 3, ratings_dropped: 3, avg_vibe_given: 87 },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, fetchUser, fetchAuthUser, createUser, loginUser, logout, loading, toggleDemoMode, isDemoMode, isFeatureEnabled, isVibePlus } = useVibeStore();
  const [authMode, setAuthMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [debrief, setDebrief] = useState<{ debrief: string; night_title?: string; stats?: any } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showVibePlus, setShowVibePlus] = useState(false);

  useEffect(() => {
    // Check for existing session
    fetchAuthUser().then((authUser) => {
      if (!authUser) {
        fetchUser();
      }
    });
  }, []);

  useEffect(() => {
    if (isDemoMode) { setDebrief(DEMO_DEBRIEF); return; }
    if (!user?.id) return;
    fetch(`${API_URL}/api/users/${user.id}/night-debrief`)
      .then(r => r.json())
      .then(d => { if (d.debrief) setDebrief(d); })
      .catch(() => {});
  }, [user?.id, isDemoMode]);

  const handleLocalSignup = async () => {
    if (!username.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const success = await createUser(username.trim(), phone.trim());
    if (success) {
      setAuthMode('welcome');
    } else {
      Alert.alert('Error', 'Username might already exist. Try another.');
    }
  };

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    const result = await loginUser(phone.trim());
    if (result.success) {
      setAuthMode('welcome');
    } else {
      Alert.alert('Login Failed', result.error || 'User not found. Please sign up first.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'elite': return '#FFD700';
      case 'scout': return '#E91E63';
      case 'regular': return '#2196F3';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'elite': return 'shield-checkmark';
      case 'scout': return 'eye';
      case 'regular': return 'person';
      default: return 'person-outline';
    }
  };

  if ((loading || authLoading) && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Welcome / Sign-in Screen
  if (!user && authMode === 'welcome') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>VIIBE</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Viibe</Text>
          <Text style={styles.welcomeSubtitle}>
            Nigeria's live scene intelligence
          </Text>

          {/* Login with Phone */}
          <TouchableOpacity
            style={styles.localButton}
            onPress={() => setAuthMode('login')}
          >
            <Ionicons name="log-in-outline" size={20} color="#FF3366" />
            <Text style={styles.localButtonText}>Login with Phone</Text>
          </TouchableOpacity>

          {/* Sign up with Phone */}
          <TouchableOpacity
            style={[styles.localButton, { marginTop: 12, backgroundColor: 'transparent', borderColor: '#333' }]}
            onPress={() => setAuthMode('signup')}
          >
            <Ionicons name="person-add-outline" size={20} color="#888" />
            <Text style={[styles.localButtonText, { color: '#888' }]}>Create New Account</Text>
          </TouchableOpacity>

          {/* Demo Mode */}
          <TouchableOpacity
            style={styles.demoButton}
            onPress={toggleDemoMode}
          >
            <Ionicons name="sparkles" size={16} color="#888" />
            <Text style={styles.demoButtonText}>Try Demo Mode</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By signing in, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Login Form
  if (authMode === 'login' && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.signupContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { setAuthMode('welcome'); setPhone(''); }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.signupTitle}>Login</Text>
          <Text style={styles.signupSubtitle}>
            Enter your phone number to continue
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+2341234567890"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.signupButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 20, alignItems: 'center' }}
            onPress={() => { setAuthMode('signup'); setPhone(''); }}
          >
            <Text style={{ color: '#888' }}>
              Don't have an account? <Text style={{ color: '#FF3366' }}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Local Signup Form
  if (authMode === 'signup' && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.signupContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { setAuthMode('welcome'); setUsername(''); setPhone(''); }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.signupTitle}>Create Profile</Text>
          <Text style={styles.signupSubtitle}>
            Join Nigeria's live scene
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+234..."
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={handleLocalSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.signupButtonText}>Create Profile</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 20, alignItems: 'center' }}
            onPress={() => { setAuthMode('login'); setUsername(''); setPhone(''); }}
          >
            <Text style={{ color: '#888' }}>
              Already have an account? <Text style={{ color: '#FF3366' }}>Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // User Profile Screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF3366" />
          </TouchableOpacity>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            {user?.picture ? (
              <View style={styles.avatarImage}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0).toUpperCase()}
              </Text>
            )}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(user?.scout_status || 'newbie') },
              ]}
            >
              <Ionicons
                name={getStatusIcon(user?.scout_status || 'newbie') as any}
                size={12}
                color="#FFF"
              />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || user?.username}</Text>
          {user?.email && (
            <Text style={styles.userEmail}>{user.email}</Text>
          )}
          <View style={styles.authBadge}>
            <Ionicons 
              name={user?.auth_provider === 'google' ? 'logo-google' : 'phone-portrait'} 
              size={12} 
              color="#888" 
            />
            <Text style={styles.authText}>
              {user?.auth_provider === 'google' ? 'Google' : 'Phone'} Account
            </Text>
          </View>
          <Text style={styles.userStatus}>
            {user?.scout_status?.toUpperCase()} SCOUT
          </Text>

          {/* Vibe+ badge or upgrade CTA */}
          {isVibePlus() ? (
            <View style={styles.vibePlusBadge}>
              <Ionicons name="star" size={11} color="#FFD700" />
              <Text style={styles.vibePlusBadgeText}>VIIBE+</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.vibePlusUpgrade} onPress={() => setShowVibePlus(true)} activeOpacity={0.8}>
              <Ionicons name="lock-open-outline" size={13} color="#FFD700" />
              <Text style={styles.vibePlusUpgradeText}>✦ Upgrade to Viibe+ — ₦1,500/mo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={28} color="#FF3366" />
            <Text style={styles.statValue}>{user?.clout_points || 0}</Text>
            <Text style={styles.statLabel}>Clout Points</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={28} color="#FFD700" />
            <Text style={styles.statValue}>{user?.total_ratings || 0}</Text>
            <Text style={styles.statLabel}>Ratings</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="analytics" size={28} color="#4CAF50" />
            <Text style={styles.statValue}>
              {Math.round(user?.rating_accuracy_score || 0)}%
            </Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="ribbon" size={28} color="#9C27B0" />
            <Text style={styles.statValue}>{user?.scout_status || 'newbie'}</Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {/* Scout Aura */}
        <ScoutAuraCard isDemoMode={isDemoMode} />

        {/* Night Debrief */}
        {isFeatureEnabled('night_debrief') && (
          isVibePlus() ? (
            debrief && (
              <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(255,153,51,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,153,51,0.2)', gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#FF9933', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>NIGHT DEBRIEF</Text>
                  {debrief.night_title && <Text style={{ color: '#FF9933', fontSize: 11, fontWeight: '700' }}>{debrief.night_title}</Text>}
                </View>
                <Text style={{ color: '#EEE', fontSize: 14, lineHeight: 21, fontStyle: 'italic' }}>{debrief.debrief}</Text>
                {debrief.stats && (
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                    <Text style={{ color: '#888', fontSize: 11 }}>{debrief.stats.spots_visited} spots</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>{debrief.stats.ratings_dropped} ratings</Text>
                    {debrief.stats.avg_vibe_given > 0 && <Text style={{ color: '#888', fontSize: 11 }}>avg {debrief.stats.avg_vibe_given}/100</Text>}
                  </View>
                )}
              </View>
            )
          ) : (
            <TouchableOpacity
              style={styles.debriefLocked}
              onPress={() => setShowVibePlus(true)}
              activeOpacity={0.8}
            >
              <View style={styles.debriefLockedLeft}>
                <Text style={styles.debriefLockedLabel}>NIGHT DEBRIEF</Text>
                <Text style={styles.debriefLockedDesc}>Your AI-powered recap of the night — what you hit, how the vibes held up, and your scout read.</Text>
              </View>
              <View style={styles.debriefLockedRight}>
                <Ionicons name="lock-closed" size={18} color="#FFD700" />
                <Text style={styles.debriefLockedChip}>VIIBE+</Text>
              </View>
            </TouchableOpacity>
          )
        )}

        {/* Dashboard Access Section - Only show if user has permissions */}
        {(user?.is_merchant || user?.is_super_admin) && (
          <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>Switch Floor</Text>
            
            {/* Merchant Floor - Only for merchants */}
            {user?.is_merchant && (
              <TouchableOpacity
                style={styles.dashboardCard}
                onPress={() => router.replace('/(merchant)')}
              >
                <View style={[styles.dashboardIcon, { backgroundColor: '#D4AF3720' }]}>
                  <Ionicons name="storefront" size={24} color="#D4AF37" />
                </View>
                <View style={styles.dashboardContent}>
                  <Text style={styles.dashboardTitle}>Merchant Floor</Text>
                  <Text style={styles.dashboardDesc}>Business dashboard, wallet, and Pulse Drop controls</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            {/* Admin Floor - Only for super admins */}
            {user?.is_super_admin && (
              <TouchableOpacity
                style={styles.dashboardCard}
                onPress={() => router.replace('/(admin)')}
              >
                <View style={[styles.dashboardIcon, { backgroundColor: '#4169E120' }]}>
                  <Ionicons name="shield-checkmark" size={24} color="#4169E1" />
                </View>
                <View style={styles.dashboardContent}>
                  <Text style={styles.dashboardTitle}>Admin Floor</Text>
                  <Text style={styles.dashboardDesc}>Global treasury, venue management, system logs</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Scout Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Scout Progress</Text>
          <View style={styles.progressLevels}>
            {['newbie', 'regular', 'scout', 'elite'].map((level, index) => (
              <View key={level} style={styles.progressLevel}>
                <View
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor:
                        ['newbie', 'regular', 'scout', 'elite'].indexOf(
                          user?.scout_status || 'newbie'
                        ) >= index
                          ? getStatusColor(level)
                          : '#333',
                    },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(level) as any}
                    size={16}
                    color="#FFF"
                  />
                </View>
                <Text style={styles.progressLevelText}>{level}</Text>
              </View>
            ))}
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    (['newbie', 'regular', 'scout', 'elite'].indexOf(
                      user?.scout_status || 'newbie'
                    ) +
                      1) *
                      25,
                    100
                  )}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#2196F3" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>How to level up</Text>
              <Text style={styles.infoText}>
                Rate venues accurately to earn Clout and become a Scout!
              </Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Scout Benefits</Text>
              <Text style={styles.infoText}>
                Scouts get Fast Lane passes for priority entry at venues.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <VibePlusModal
        visible={showVibePlus}
        onClose={() => setShowVibePlus(false)}
        onSuccess={() => setShowVibePlus(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FF3366',
    letterSpacing: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    marginHorizontal: 16,
    fontSize: 14,
  },
  localButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF3366',
  },
  localButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3366',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 10,
  },
  demoButtonText: {
    fontSize: 14,
    color: '#888',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  signupContainer: {
    padding: 24,
  },
  backButton: {
    marginBottom: 24,
  },
  signupTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  signupSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#151520',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#252530',
  },
  signupButton: {
    backgroundColor: '#FF3366',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: '#151520',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3366',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#151520',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#252530',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  authText: {
    fontSize: 12,
    color: '#888',
  },
  userStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3366',
    marginTop: 8,
    letterSpacing: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '50%',
    padding: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fastPassSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  fastPassCard: {
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  fastPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  fastPassVenue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    borderRadius: 12,
    padding: 16,
  },
  qrCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3366',
    marginTop: 8,
    letterSpacing: 2,
  },
  fastLaneCard: {
    backgroundColor: '#151520',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  fastLaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fastLaneTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
  },
  fastLaneDesc: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  qrPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    borderRadius: 16,
    padding: 24,
  },
  qrText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  progressCard: {
    backgroundColor: '#151520',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
  },
  progressLevels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLevel: {
    alignItems: 'center',
  },
  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLevelText: {
    fontSize: 10,
    color: '#666',
    textTransform: 'capitalize',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#252530',
    borderRadius: 3,
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF3366',
    borderRadius: 3,
  },
  infoSection: {
    paddingHorizontal: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  dashboardSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  dashboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  dashboardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dashboardContent: {
    flex: 1,
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  dashboardDesc: {
    fontSize: 13,
    color: '#888',
  },
  vibePlusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  vibePlusBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  vibePlusUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
  },
  vibePlusUpgradeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  debriefLocked: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,153,51,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,153,51,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debriefLockedLeft: {
    flex: 1,
    gap: 6,
  },
  debriefLockedLabel: {
    color: '#FF9933',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  debriefLockedDesc: {
    color: 'rgba(238,238,238,0.45)',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  debriefLockedRight: {
    alignItems: 'center',
    gap: 4,
  },
  debriefLockedChip: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
