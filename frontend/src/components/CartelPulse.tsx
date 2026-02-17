/**
 * CartelPulse — Compact "Vibez Cartel" activity card.
 * Shows cartel members with their check-in status in a premium glass card.
 * Staggered member row entrance for visual polish.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarDisplay from './AvatarDisplay';

interface CartelMember {
  user_id: string;
  username: string;
  scout_status: string;
  checked_in?: boolean;
  venue_name?: string;
  avatar_config?: {
    emoji: string;
    bgColor: string;
    accentColor: string;
  } | null;
}

interface CartelPulseProps {
  cartelName: string;
  members: CartelMember[];
  onPress: () => void;
}

function MemberRow({ member, index }: { member: CartelMember; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.memberRow,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <AvatarDisplay
        config={member.avatar_config || null}
        username={member.username}
        size={28}
        showBorder={member.checked_in}
        borderColor="#00E676"
      />
      <Text
        style={[s.memberName, !member.checked_in && s.memberOffline]}
        numberOfLines={1}
      >
        {member.username}
      </Text>
      <Text
        style={[
          s.memberStatus,
          member.checked_in ? s.statusActive : s.statusOffline,
        ]}
        numberOfLines={1}
      >
        {member.checked_in ? `📍 ${member.venue_name}` : '💤 Offline'}
      </Text>
    </Animated.View>
  );
}

export default function CartelPulse({ cartelName, members, onPress }: CartelPulseProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const activeCount = members.filter((m) => m.checked_in).length;

  return (
    <Animated.View
      style={[
        s.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandLabel}>VIBEZ CARTEL</Text>
            <Text style={s.cartelName} numberOfLines={1}>
              {cartelName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#555" />
        </View>

        {/* Member list */}
        <View style={s.memberList}>
          {members.slice(0, 4).map((member, index) => (
            <MemberRow key={member.user_id} member={member} index={index} />
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.separator} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>
              <Text style={s.footerActive}>{activeCount}</Text>
              <Text style={s.footerMuted}>/{members.length} out tonight</Text>
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(20, 20, 35, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.12)',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#FF3366',
    marginBottom: 2,
  },
  cartelName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  memberList: {
    gap: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  memberOffline: {
    opacity: 0.5,
  },
  memberStatus: {
    fontSize: 12,
    maxWidth: 160,
  },
  statusActive: {
    color: '#00E676',
    fontWeight: '500',
  },
  statusOffline: {
    color: '#555',
  },
  footer: {
    marginTop: 6,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerActive: {
    color: '#00E676',
  },
  footerMuted: {
    color: '#888',
  },
});
