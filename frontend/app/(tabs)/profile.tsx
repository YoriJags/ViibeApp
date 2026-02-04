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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../../src/store/vibeStore';

export default function ProfileScreen() {
  const { user, fetchUser, createUser, loading } = useVibeStore();
  const [showSignup, setShowSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    // Try to load existing user
    fetchUser();
  }, []);

  const handleSignup = async () => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'elite':
        return '#FFD700';
      case 'scout':
        return '#E91E63';
      case 'regular':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'elite':
        return 'shield-checkmark';
      case 'scout':
        return 'eye';
      case 'regular':
        return 'person';
      default:
        return 'person-outline';
    }
  };

  if (loading && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user && !showSignup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>VIBE</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Vibe</Text>
          <Text style={styles.welcomeSubtitle}>
            Your real-time Lagos nightlife guide
          </Text>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => setShowSignup(true)}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            Join the Lagos nightlife community
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
            onPress={handleSignup}
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase()}
            </Text>
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
          <Text style={styles.userName}>{user?.username}</Text>
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
            <Ionicons name="ticket" size={28} color="#9C27B0" />
            <Text style={styles.statValue}>{user?.fast_lane_passes || 0}</Text>
            <Text style={styles.statLabel}>Fast Lane</Text>
          </View>
        </View>

        {/* Fast Lane QR */}
        {(user?.fast_lane_passes || 0) > 0 && (
          <View style={styles.fastLaneCard}>
            <View style={styles.fastLaneHeader}>
              <Ionicons name="flash" size={24} color="#FFD700" />
              <Text style={styles.fastLaneTitle}>Fast Lane Pass</Text>
            </View>
            <Text style={styles.fastLaneDesc}>
              Show this at venue entry for priority access
            </Text>
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code" size={120} color="#333" />
              <Text style={styles.qrText}>
                {user?.fast_lane_passes} passes available
              </Text>
            </View>
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
    marginBottom: 32,
    textAlign: 'center',
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3366',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
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
  userStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3366',
    marginTop: 4,
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
  },
  statCardInner: {
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
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
});
