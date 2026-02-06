import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useVibeStore } from '../../src/store/vibeStore';
import CloutReward from '../../src/components/CloutReward';

type EnergyLevel = 'chill' | 'popping' | 'electric';
type CapacityLevel = 'sparse' | 'vibrant' | 'full';
type GateLevel = 'clear' | 'slow' | 'blocked';

const ENERGY_OPTIONS: { value: EnergyLevel; label: string; icon: string; color: string }[] = [
  { value: 'chill', label: 'Chill', icon: 'snow', color: '#3399FF' },
  { value: 'popping', label: 'Popping', icon: 'flame', color: '#FF9933' },
  { value: 'electric', label: 'Electric', icon: 'flash', color: '#FF3366' },
];

const CAPACITY_OPTIONS: { value: CapacityLevel; label: string; icon: string; color: string }[] = [
  { value: 'sparse', label: 'Sparse', icon: 'person', color: '#4CAF50' },
  { value: 'vibrant', label: 'Vibrant', icon: 'people', color: '#FF9800' },
  { value: 'full', label: 'Full', icon: 'people-circle', color: '#F44336' },
];

const GATE_OPTIONS: { value: GateLevel; label: string; icon: string; color: string }[] = [
  { value: 'clear', label: 'Clear', icon: 'checkmark-circle', color: '#4CAF50' },
  { value: 'slow', label: 'Slow', icon: 'time', color: '#FF9800' },
  { value: 'blocked', label: 'Blocked', icon: 'close-circle', color: '#F44336' },
];

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchVenue, submitRating, user, getUserRatingStatus } = useVibeStore();

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCorrection, setIsCorrection] = useState(false);
  const [showCloutReward, setShowCloutReward] = useState(false);

  // Rating selections
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [capacity, setCapacity] = useState<CapacityLevel | null>(null);
  const [gate, setGate] = useState<GateLevel | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    requestLocationPermission();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const venueData = await fetchVenue(id || '');
    setVenue(venueData);

    if (user) {
      const status = await getUserRatingStatus(id || '');
      setIsCorrection(status.is_correction_available);
    }

    setLoading(false);
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission required to rate');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (error) {
      setLocationError('Could not get location');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3, // Low quality for data optimization
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const handleSubmit = async () => {
    if (!energy || !capacity || !gate) {
      Alert.alert('Incomplete', 'Please select all three vibe attributes');
      return;
    }

    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location to rate');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to rate venues');
      router.push('/profile');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitRating(
        id || '',
        energy,
        capacity,
        gate,
        userLocation,
        photo || undefined
      );

      Alert.alert(
        isCorrection ? 'Vibe Updated!' : 'Vibe Rated!',
        `Score: ${Math.round(result.venue_vibe_score)}. ${result.remaining_ratings > 0 ? 'You have 1 correction left.' : ''}
+${Math.round(result.rating.vibe_score / 10)} Clout points earned!`,
        [
          {
            text: 'Great!',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3366" />
        </View>
      </SafeAreaView>
    );
  }

  if (!venue || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF5252" />
          <Text style={styles.errorText}>
            {!user ? 'Please sign in to rate' : 'Venue not found'}
          </Text>
          <TouchableOpacity
            style={styles.backButtonLarge}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isCorrection ? 'Update Vibe' : 'Rate the Vibe'}
          </Text>
          <Text style={styles.headerSubtitle}>{venue.name}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Location Status */}
        <View style={styles.locationStatus}>
          <Ionicons
            name={userLocation ? 'location' : 'location-outline'}
            size={20}
            color={userLocation ? '#4CAF50' : '#FF9800'}
          />
          <Text
            style={[
              styles.locationText,
              { color: userLocation ? '#4CAF50' : '#FF9800' },
            ]}
          >
            {userLocation
              ? 'Location verified'
              : locationError || 'Getting location...'}
          </Text>
        </View>

        {/* Energy Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#FFD700" />
            <Text style={styles.sectionTitle}>Energy</Text>
          </View>
          <View style={styles.optionsRow}>
            {ENERGY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  energy === option.value && {
                    borderColor: option.color,
                    backgroundColor: option.color + '20',
                  },
                ]}
                onPress={() => setEnergy(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={32}
                  color={energy === option.value ? option.color : '#666'}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    energy === option.value && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Capacity Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Crowd</Text>
          </View>
          <View style={styles.optionsRow}>
            {CAPACITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  capacity === option.value && {
                    borderColor: option.color,
                    backgroundColor: option.color + '20',
                  },
                ]}
                onPress={() => setCapacity(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={32}
                  color={capacity === option.value ? option.color : '#666'}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    capacity === option.value && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gate Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="enter" size={20} color="#2196F3" />
            <Text style={styles.sectionTitle}>Gate/Queue</Text>
          </View>
          <View style={styles.optionsRow}>
            {GATE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  gate === option.value && {
                    borderColor: option.color,
                    backgroundColor: option.color + '20',
                  },
                ]}
                onPress={() => setGate(option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={32}
                  color={gate === option.value ? option.color : '#666'}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    gate === option.value && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Photo (Optional) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera" size={20} color="#9C27B0" />
            <Text style={styles.sectionTitle}>Photo (Optional)</Text>
            <Text style={styles.optionalBadge}>+5 Clout</Text>
          </View>
          {photo ? (
            <View style={styles.photoPreview}>
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setPhoto(null)}
              >
                <Ionicons name="close-circle" size={28} color="#FF3366" />
              </TouchableOpacity>
              <Text style={styles.photoAddedText}>Photo added!</Text>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                <Ionicons name="camera" size={24} color="#FF3366" />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                <Ionicons name="images" size={24} color="#FF3366" />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!energy || !capacity || !gate || !userLocation) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!energy || !capacity || !gate || !userLocation || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.submitButtonText}>
                {isCorrection ? 'Update Vibe' : 'Submit Rating'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonLarge: {
    backgroundColor: '#FF3366',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#151520',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#151520',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151520',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  optionalBadge: {
    fontSize: 12,
    color: '#9C27B0',
    backgroundColor: '#9C27B020',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#151520',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151520',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#252530',
    borderStyle: 'dashed',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3366',
  },
  photoPreview: {
    backgroundColor: '#151520',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  photoAddedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A0F',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#151520',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3366',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
});
