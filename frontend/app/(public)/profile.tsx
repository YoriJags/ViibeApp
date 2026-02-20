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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../../src/store/vibeStore';
import StreakBadge from '../../src/components/StreakBadge';
import CrewCard from '../../src/components/CrewCard';
import DemoModeBanner from '../../src/components/DemoModeBanner';
import AvatarDisplay from '../../src/components/AvatarDisplay';
import AvatarBuilder from '../../src/components/AvatarBuilder';
import AchievementBadge from '../../src/components/AchievementBadge';
import { DEMO_BADGES } from '../../src/data/demoData';
import VibeDNACard from '../../src/components/VibeDNACard';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user, fetchUser, fetchAuthUser, createUser, logout, loading, processGoogleAuth,
    streak, fetchStreak, crew, fetchCrew, isDemoMode, toggleDemoMode, restartDemoTutorial,
    avatarConfig, updateAvatar, locationSharingEnabled, toggleLocationSharing,
  } = useVibeStore();
  const [showSignup, setShowSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);

  useEffect(() => {
    // Check for existing session
    fetchAuthUser().then((authUser) => {
      if (!authUser) {
        fetchUser();
      }
    });
    fetchStreak();
    fetchCrew();
    if (user?.id) useVibeStore.getState().fetchVibeDNA(user.id);
  }, []);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      // Build redirect URL using Expo Linking for proper deep linking support
      const redirectUrl = Linking.createURL('/profile');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      // Open browser for auth
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      if (result.type === 'success' && result.url) {
        // Extract session_id from URL fragment
        const urlParts = result.url.split('#');
        if (urlParts.length > 1) {
          const params = new URLSearchParams(urlParts[1]);
          const sessionId = params.get('session_id');
          
          if (sessionId) {
            const success = await processGoogleAuth(sessionId);
            if (!success) {
              Alert.alert('Error', 'Failed to complete sign in');
            }
          }
        }
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', 'Failed to sign in with Google');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLocalSignup = async () => {
    if (!username.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const success = await createUser(username.trim(), phone.trim());
    if (success) {
      setShowSignup(false);
    } else {
      Alert.alert('Error', 'Username might already exist. Try another.');
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
  if (!user && !showSignup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>VIBE</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Vibe</Text>
          <Text style={styles.welcomeSubtitle}>
            Nigeria's real-time nightlife pulse
          </Text>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={authLoading}
          >
            <Ionicons name="logo-google" size={20} color="#FFF" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Local Signup */}
          <TouchableOpacity
            style={styles.localButton}
            onPress={() => setShowSignup(true)}
          >
            <Ionicons name="phone-portrait" size={20} color="#FF3366" />
            <Text style={styles.localButtonText}>Sign up with Phone</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By signing in, you agree to our Terms & Privacy Policy
          </Text>

          {/* Demo Mode - Developer Only */}
          <TouchableOpacity
            style={styles.demoButton}
            onPress={toggleDemoMode}
          >
            <Ionicons name="flask" size={16} color="#D4A017" />
            <Text style={styles.demoButtonText}>Enter Demo Mode</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Local Signup Form
  if (showSignup && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.signupContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowSignup(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.signupTitle}>Create Profile</Text>
          <Text style={styles.signupSubtitle}>
            Join Nigeria's nightlife community
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  // User Profile Screen
  return (
    <SafeAreaView style={styles.container}>
      <DemoModeBanner />
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
            <AvatarDisplay
              config={avatarConfig || null}
              username={user?.name || user?.username || '?'}
              size={80}
            />
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
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={() => setShowAvatarBuilder(true)}
          >
            <Ionicons name="color-palette" size={14} color="#FF3366" />
            <Text style={styles.editAvatarText}>
              {avatarConfig ? 'Edit Avatar' : 'Create Avatar'}
            </Text>
          </TouchableOpacity>
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

        {/* Vibe DNA */}
        {user && <VibeDNACard userId={user.id} />}

        {/* Streak Card */}
        {streak && streak.current_streak > 0 && (
          <View style={styles.streakCard}>
            <View style={styles.streakHeader}>
              <StreakBadge
                streak={streak.current_streak}
                multiplier={streak.multiplier}
                size="lg"
              />
              <View style={styles.streakInfo}>
                <Text style={styles.streakTitle}>{streak.current_streak}-Day Streak</Text>
                <Text style={styles.streakSubtitle}>
                  {streak.multiplier > 1 ? `${streak.multiplier.toFixed(1)}x clout multiplier active` : 'Keep it up!'}
                </Text>
              </View>
            </View>
            {streak.next_milestone && (
              <View style={styles.milestoneRow}>
                <Text style={styles.milestoneText}>
                  Next milestone: {streak.next_milestone} days
                </Text>
                <View style={styles.milestoneBar}>
                  <View style={[
                    styles.milestoneFill,
                    { width: `${Math.min((streak.current_streak / streak.next_milestone) * 100, 100)}%` },
                  ]} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* My Cartel */}
        {crew ? (
          <View style={styles.crewSection}>
            <CrewCard
              name={crew.name}
              members={crew.member_details || []}
              inviteCode={crew.invite_code}
              isCaptain={crew.is_captain}
              onPress={() => router.push('/(public)/crew')}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.joinCrewCard}
            onPress={() => router.push('/(public)/crew')}
          >
            <Ionicons name="people" size={24} color="#FF3366" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.joinCrewTitle}>Start Your Cartel</Text>
              <Text style={styles.joinCrewDesc}>Create or join a Cartel to vote on venues together</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {/* Notification Settings */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => router.push('/(public)/crew')}
        >
          <View style={[styles.dashboardIcon, { backgroundColor: '#FF336620' }]}>
            <Ionicons name="notifications-outline" size={24} color="#FF3366" />
          </View>
          <View style={styles.dashboardContent}>
            <Text style={styles.dashboardTitle}>After Dark Alerts</Text>
            <Text style={styles.dashboardDesc}>Get notified when your spots go electric</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Location Sharing Toggle */}
        <View style={styles.settingsRow}>
          <View style={[styles.dashboardIcon, { backgroundColor: '#00E67620' }]}>
            <Ionicons name="location" size={24} color="#00E676" />
          </View>
          <View style={styles.dashboardContent}>
            <Text style={styles.dashboardTitle}>Share Location with Crew</Text>
            <Text style={styles.dashboardDesc}>Let your squad see which venue you're at</Text>
          </View>
          <Switch
            value={locationSharingEnabled}
            onValueChange={toggleLocationSharing}
            trackColor={{ false: '#333', true: '#00E67660' }}
            thumbColor={locationSharingEnabled ? '#00E676' : '#888'}
          />
        </View>

        {/* Achievement Badges */}
        {isDemoMode && (
          <AchievementBadge badges={DEMO_BADGES as any} />
        )}

        {/* Restart Demo Tutorial */}
        {isDemoMode && (
          <TouchableOpacity
            style={styles.restartTutorialBtn}
            onPress={restartDemoTutorial}
          >
            <Ionicons name="refresh" size={18} color="#FF3366" />
            <Text style={styles.restartTutorialText}>Restart Demo Tutorial</Text>
          </TouchableOpacity>
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

      {/* Avatar Builder Modal */}
      <AvatarBuilder
        visible={showAvatarBuilder}
        onClose={() => setShowAvatarBuilder(false)}
        onSave={(config) => {
          updateAvatar(config);
          setShowAvatarBuilder(false);
        }}
        initialConfig={avatarConfig}
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
  termsText: {
    fontSize: 12,
    color: '#666',
    marginTop: 24,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  editAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FF336618',
    marginBottom: 10,
  },
  editAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3366',
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

  // ====== STREAK ======
  streakCard: {
    backgroundColor: '#151520',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  streakSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  milestoneRow: {
    marginTop: 16,
  },
  milestoneText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  milestoneBar: {
    height: 4,
    backgroundColor: '#252530',
    borderRadius: 2,
  },
  milestoneFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 2,
  },

  // ====== CREW ======
  crewSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  joinCrewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  joinCrewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  joinCrewDesc: {
    fontSize: 13,
    color: '#888',
  },

  // ====== DEMO MODE ======
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D4A01740',
    backgroundColor: '#D4A01710',
  },
  demoButtonText: {
    color: '#D4A017',
    fontWeight: '600',
    fontSize: 14,
  },

  // ====== RESTART TUTORIAL ======
  restartTutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.2)',
    backgroundColor: 'rgba(255,51,102,0.06)',
  },
  restartTutorialText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3366',
  },

  // ====== SETTINGS ROW ======
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
});
