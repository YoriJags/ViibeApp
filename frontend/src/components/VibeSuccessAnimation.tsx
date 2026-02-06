import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VibeSuccessAnimationProps {
  visible: boolean;
  cloutEarned: number;
  hasPhoto: boolean;
  venueName: string;
  onComplete: () => void;
}

// Confetti particle component
const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  
  const colors = ['#FF3366', '#FFD700', '#4CAF50', '#00D4FF', '#9933FF', '#FF9933'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 8 + Math.random() * 8;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT + 100,
        duration: 2500 + Math.random() * 1000,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: (Math.random() - 0.5) * 150,
          duration: 1200,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: (Math.random() - 0.5) * 100,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotate, {
        toValue: 720 + Math.random() * 360,
        duration: 3000,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2500,
        delay: delay + 500,
        useNativeDriver: true,
      }),
    ]);
    
    animation.start();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          left: startX,
          width: size,
          height: size,
          backgroundColor: color,
          transform: [
            { translateY },
            { translateX },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}
    />
  );
};

const VibeSuccessAnimation: React.FC<VibeSuccessAnimationProps> = ({
  visible,
  cloutEarned,
  hasPhoto,
  venueName,
  onComplete,
}) => {
  const [showContent, setShowContent] = useState(false);
  
  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cloutScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      setShowContent(true);
      
      // Reset animations
      overlayOpacity.setValue(0);
      cardScale.setValue(0.3);
      cardOpacity.setValue(0);
      iconScale.setValue(0);
      iconRotate.setValue(0);
      pulseAnim.setValue(1);
      cloutScale.setValue(0);
      ringScale.setValue(0);
      ringOpacity.setValue(0.8);

      // Sequence of animations
      Animated.sequence([
        // 1. Fade in overlay
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // 2. Pop in card
        Animated.parallel([
          Animated.spring(cardScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // 3. Pop in checkmark with rotation
        Animated.parallel([
          Animated.spring(iconScale, {
            toValue: 1,
            tension: 150,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(iconRotate, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        // 4. Expanding ring effect
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        // 5. Pop in clout text
        Animated.spring(cloutScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Auto dismiss after 2.5 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(cardScale, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowContent(false);
          onComplete();
        });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const iconRotateInterpolate = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible && !showContent) return null;

  // Generate confetti particles
  const confettiParticles = [];
  for (let i = 0; i < 50; i++) {
    confettiParticles.push(
      <ConfettiParticle 
        key={i} 
        delay={Math.random() * 500} 
        startX={Math.random() * SCREEN_WIDTH}
      />
    );
  }

  const totalClout = hasPhoto ? cloutEarned + 5 : cloutEarned;

  return (
    <Modal transparent visible={visible || showContent} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {/* Confetti */}
        {confettiParticles}

        {/* Success Card */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: cardScale }],
              opacity: cardOpacity,
            },
          ]}
        >
          {/* Expanding Ring Effect */}
          <Animated.View
            style={[
              styles.expandingRing,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />

          {/* Checkmark Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: iconScale },
                  { rotate: iconRotateInterpolate },
                ],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark" size={40} color="#FFF" />
              </View>
            </Animated.View>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>Vibe Verified!</Text>
          
          {/* Venue Name */}
          <Text style={styles.venueName}>{venueName}</Text>

          {/* Clout Earned */}
          <Animated.View style={[styles.cloutContainer, { transform: [{ scale: cloutScale }] }]}>
            <View style={styles.cloutBadge}>
              <Ionicons name="flash" size={28} color="#FFD700" />
              <Text style={styles.cloutAmount}>+{totalClout}</Text>
              <Text style={styles.cloutLabel}>Clout Earned</Text>
            </View>
            {hasPhoto && (
              <View style={styles.bonusTag}>
                <Ionicons name="camera" size={12} color="#4CAF50" />
                <Text style={styles.bonusText}>+5 Photo Bonus!</Text>
              </View>
            )}
          </Animated.View>

          {/* Impact Message */}
          <Text style={styles.impactText}>
            Your contribution just updated the city's pulse! 🎉
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetti: {
    position: 'absolute',
    top: -50,
    borderRadius: 2,
  },
  card: {
    backgroundColor: '#0A0A0F',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#1A1A25',
    overflow: 'hidden',
  },
  expandingRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#4CAF50',
    top: 52,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  venueName: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  cloutContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cloutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70015',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD70030',
    gap: 8,
  },
  cloutAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFD700',
  },
  cloutLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  bonusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
    gap: 4,
  },
  bonusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  impactText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default VibeSuccessAnimation;
