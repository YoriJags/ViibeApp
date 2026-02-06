import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
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

  const renderOption = (
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
        styles.optionText,
        isSelected && styles.optionTextSelected,
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
        <View style={styles.modal}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>Rate the Vibe</Text>
          <View style={styles.subtitle}>
            <Text style={styles.venueName}>{venueName}</Text>
            <Text style={styles.separator}> • </Text>
            <Text style={[
              styles.verifiedText,
              { color: isGpsVerified ? '#4CAF50' : '#FF5252' }
            ]}>
              {isGpsVerified ? '50m Radius Verified' : 'Location Required'}
            </Text>
          </View>

          {/* ENERGY Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={16} color="#888" />
              <Text style={styles.sectionLabel}>ENERGY</Text>
            </View>
            <View style={styles.optionsRow}>
              {renderOption('chill', 'CHILL', energy === 'chill', () => setEnergy('chill'), '#E74C3C')}
              {renderOption('popping', 'POPPING', energy === 'popping', () => setEnergy('popping'), '#E74C3C')}
              {renderOption('electric', 'ELECTRIC', energy === 'electric', () => setEnergy('electric'), '#E74C3C')}
            </View>
          </View>

          {/* CAPACITY Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={16} color="#888" />
              <Text style={styles.sectionLabel}>CAPACITY</Text>
            </View>
            <View style={styles.optionsRow}>
              {renderOption('sparse', 'SPARSE', capacity === 'sparse', () => setCapacity('sparse'), '#3498DB')}
              {renderOption('vibrant', 'VIBRANT', capacity === 'vibrant', () => setCapacity('vibrant'), '#3498DB')}
              {renderOption('full', 'FULL', capacity === 'full', () => setCapacity('full'), '#3498DB')}
            </View>
          </View>

          {/* GATE / QUEUE Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="ellipse-outline" size={16} color="#888" />
              <Text style={styles.sectionLabel}>GATE / QUEUE</Text>
            </View>
            <View style={styles.optionsRow}>
              {renderOption('clear', 'CLEAR', gate === 'clear', () => setGate('clear'), '#E67E22')}
              {renderOption('slow', 'SLOW', gate === 'slow', () => setGate('slow'), '#E67E22')}
              {renderOption('blocked', 'BLOCKED', gate === 'blocked', () => setGate('blocked'), '#E67E22')}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {/* Add Photo Button */}
            <TouchableOpacity 
              style={[styles.photoBtn, photo && styles.photoBtnActive]}
              onPress={handlePickPhoto}
            >
              <Ionicons 
                name={photo ? "checkmark" : "camera"} 
                size={18} 
                color={photo ? "#4CAF50" : "#FFF"} 
              />
              <Text style={styles.photoBtnText}>
                {photo ? 'Photo Added' : 'Add Photo'}
              </Text>
              {!photo && <Text style={styles.cloutText}>(+5 Clout)</Text>}
            </TouchableOpacity>

            {/* Update Vibe Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                !canSubmit && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#000" />
                  <Text style={styles.submitBtnText}>Update Vibe</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#000',
    borderRadius: 24,
    padding: 24,
    paddingTop: 32,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  venueName: {
    fontSize: 14,
    color: '#888',
  },
  separator: {
    color: '#555',
  },
  verifiedText: {
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  optionTextSelected: {
    color: '#FFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
  },
  photoBtnActive: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  cloutText: {
    fontSize: 11,
    color: '#888',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});

export default RateVibeModal;
