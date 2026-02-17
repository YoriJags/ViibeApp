/**
 * FloorSwitcher - Floating pill to navigate between the 3 storeys
 * Shows when user has access to multiple floors (merchant/admin roles)
 * Always visible in demo mode since demo user has all roles
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';

interface Floor {
  key: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
  requiredRole?: string;
}

const FLOORS: Floor[] = [
  {
    key: 'public',
    label: 'Public Floor',
    route: '/(public)',
    icon: 'map',
    color: '#FF2D92',
    description: 'Discover venues & rate vibes',
  },
  {
    key: 'merchant',
    label: 'Merchant Floor',
    route: '/(merchant)',
    icon: 'analytics',
    color: '#FFD700',
    description: 'Manage your venue & analytics',
    requiredRole: 'is_merchant',
  },
  {
    key: 'admin',
    label: 'Admin Floor',
    route: '/(admin)',
    icon: 'shield',
    color: '#4A90D9',
    description: 'Platform oversight & treasury',
    requiredRole: 'is_super_admin',
  },
];

interface FloorSwitcherProps {
  currentFloor: 'public' | 'merchant' | 'admin';
}

export default function FloorSwitcher({ currentFloor }: FloorSwitcherProps) {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const { user, isDemoMode } = useVibeStore();

  // Determine which floors the user can access
  // In demo mode, show all floors since demo user has all roles
  const accessibleFloors = FLOORS.filter((floor) => {
    if (floor.key === 'public') return true;
    if (isDemoMode) return true;
    if (floor.requiredRole === 'is_merchant') return user?.is_merchant;
    if (floor.requiredRole === 'is_super_admin') return user?.is_super_admin;
    return false;
  });

  // Don't show if user only has access to one floor
  if (accessibleFloors.length <= 1) return null;

  const current = FLOORS.find((f) => f.key === currentFloor)!;

  const handleNavigate = (floor: Floor) => {
    setShowMenu(false);
    if (floor.key !== currentFloor) {
      router.replace(floor.route as any);
    }
  };

  return (
    <>
      {/* Floating pill button */}
      <TouchableOpacity
        style={[styles.fab, { borderColor: current.color + '60' }]}
        onPress={() => setShowMenu(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="layers" size={18} color={current.color} />
        <Text style={[styles.fabText, { color: current.color }]}>
          Switch Floor
        </Text>
      </TouchableOpacity>

      {/* Floor selection modal */}
      <Modal transparent visible={showMenu} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Switch Floor</Text>
            <Text style={styles.menuSubtitle}>
              Navigate between the 3 storeys
            </Text>

            {accessibleFloors.map((floor) => {
              const isActive = floor.key === currentFloor;
              return (
                <TouchableOpacity
                  key={floor.key}
                  style={[
                    styles.floorOption,
                    isActive && {
                      borderColor: floor.color + '60',
                      backgroundColor: floor.color + '10',
                    },
                  ]}
                  onPress={() => handleNavigate(floor)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.floorIcon,
                      { backgroundColor: floor.color + '20' },
                    ]}
                  >
                    <Ionicons name={floor.icon} size={24} color={floor.color} />
                  </View>
                  <View style={styles.floorInfo}>
                    <Text style={styles.floorLabel}>{floor.label}</Text>
                    <Text style={styles.floorDesc}>{floor.description}</Text>
                  </View>
                  {isActive && (
                    <View
                      style={[
                        styles.activeBadge,
                        { backgroundColor: floor.color },
                      ]}
                    >
                      <Text style={styles.activeBadgeText}>HERE</Text>
                    </View>
                  )}
                  {!isActive && (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#666"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  fabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menu: {
    backgroundColor: '#13131F',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  floorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    marginBottom: 10,
  },
  floorIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  floorInfo: {
    flex: 1,
  },
  floorLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  floorDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
});
