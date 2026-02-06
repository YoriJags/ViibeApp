import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

type EnergyLevel = 'chill' | 'popping' | 'electric';
type CapacityLevel = 'sparse' | 'vibrant' | 'full';
type GateLevel = 'clear' | 'slow' | 'blocked';

interface RateVibeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    energy: EnergyLevel;
    capacity: CapacityLevel;
    gate: GateLevel;
    photoBase64?: string;
  }) => Promise<void>;
  venueName: string;
  isGpsVerified: boolean;
}

const RateVibeModal: React.FC<RateVibeModalProps> = ({
  visible,
  onClose,
  onSubmit,
  venueName,
  isGpsVerified,
}) => {
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [capacity, setCapacity] = useState<CapacityLevel | null>(null);
  const [gate, setGate] = useState<GateLevel | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = energy && capacity && gate && isGpsVerified;

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setSubmitting(true);
    try {
      await onSubmit({
        energy: energy!,
        capacity: capacity!,
        gate: gate!,
        photoBase64: photo || undefined,
      });
      // Reset form
      setEnergy(null);
      setCapacity(null);
      setGate(null);
      setPhoto(null);
      onClose();
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderOptionButton = (
    value: string,
    label: string,
    isSelected: boolean,
    onPress: () => void,
    selectedColor: string
  ) => (
    <TouchableOpacity
      style={[
        styles.optionButton,
        isSelected && { backgroundColor: selectedColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.optionButtonText,
        isSelected && styles.optionButtonTextSelected,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Rate the Vibe</Text>
            <View style={styles.venueInfo}>
              <Text style={styles.venueName}>{venueName}</Text>
              <Text style={styles.dot}> • </Text>
              <Text style={[
                styles.verifiedText,
                { color: isGpsVerified ? '#4CAF50' : '#FF5252' }
              ]}>
                {isGpsVerified ? '50m Radius Verified' : 'Location Required'}
              </Text>
            </View>
          </View>

          {/* Energy Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={16} color="#888" />
              <Text style={styles.sectionTitle}>ENERGY</Text>
            </View>
            <View style={styles.optionsRow}>
              {renderOptionButton('chill', 'CHILL', energy === 'chill', () => setEnergy('chill'), '#E74C3C')}
              {renderOptionButton('popping', 'POPPING', energy === 'popping', () => setEnergy('popping'), '#E74C3C')}
              {renderOptionButton('electric', 'ELECTRIC', energy === 'electric', () => setEnergy('electric'), '#E74C3C')}
            </View>
          </View>

          {/* Capacity Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={16} color="#888" />
              <Text style={styles.sectionTitle}>CAPACITY</Text>
            </View>
            <View style={styles.optionsRow}>
              {renderOptionButton('sparse', 'SPARSE', capacity === 'sparse', () => setCapacity('sparse'), '#3498DB')}
              {renderOptionButton('vibrant', 'VIBRANT', capacity === 'vibrant', () => setCapacity('vibrant'), '#3498DB')}
              {renderOptionButton('full', 'FULL', capacity === 'full', () => setCapacity('full'), '#3498DB')}
            </View>
          </View>

          {/* Gate / Queue Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-outline" size={16} color="#888" />
              <Text style={styles.sectionTitle}>GATE / QUEUE</Text>
            </View>
            <View style={styles.optionsRow}>
              {renderOptionButton('clear', 'CLEAR', gate === 'clear', () => setGate('clear'), '#E67E22')}
              {renderOptionButton('slow', 'SLOW', gate === 'slow', () => setGate('slow'), '#E67E22')}
              {renderOptionButton('blocked', 'BLOCKED', gate === 'blocked', () => setGate('blocked'), '#E67E22')}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {/* Add Photo Button */}
            <TouchableOpacity 
              style={[styles.photoButton, photo && styles.photoButtonActive]}
              onPress={handlePickPhoto}
            >
              <Ionicons 
                name={photo ? "checkmark-circle" : "camera-outline"} 
                size={20} 
                color={photo ? "#4CAF50" : "#FFF"} 
              />
              <Text style={styles.photoButtonText}>
                {photo ? 'Photo Added' : 'Add Photo (+5 Clout)'}
              </Text>
            </TouchableOpacity>

            {/* Update Vibe Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                  <Text style={styles.submitButtonText}>Update Vibe</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0A0A0F',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A25',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  venueName: {
    fontSize: 14,
    color: '#888',
  },
  dot: {
    color: '#555',
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#1A1A25',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
  },
  optionButtonTextSelected: {
    color: '#FFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A25',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  photoButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF5015',
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});

export default RateVibeModal;
