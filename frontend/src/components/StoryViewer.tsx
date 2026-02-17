/**
 * StoryViewer - Full-screen story viewing modal
 * Auto-advances with progress bar, tap sides for prev/next
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publicTheme, typography, spacing } from '../theme/floors';

const { colors } = publicTheme;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

interface Story {
  id: string;
  username: string;
  scout_status: string;
  venue_name: string;
  media_url: string;
  caption: string;
  views: number;
  created_at: string;
}

interface StoryViewerProps {
  visible: boolean;
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  onView?: (storyId: string) => void;
}

export default function StoryViewer({ visible, stories, initialIndex = 0, onClose, onView }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const story = stories[currentIndex];

  useEffect(() => {
    if (visible && story) {
      startTimer();
      onView?.(story.id);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      progress.setValue(0);
    };
  }, [currentIndex, visible]);

  const startTimer = () => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start();

    timerRef.current = setTimeout(() => {
      goNext();
    }, STORY_DURATION);
  };

  const goNext = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      startTimer();
    }
  };

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  if (!story) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Progress bars */}
          <View style={styles.progressRow}>
            {stories.map((_, i) => (
              <View key={i} style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: i < currentIndex ? '100%' :
                        i === currentIndex ? progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }) : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{story.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.username}>{story.username}</Text>
                <Text style={styles.time}>{story.venue_name} · {timeAgo(story.created_at)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Story image */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: story.media_url }} style={styles.image} resizeMode="contain" />

            {/* Tap zones */}
            <TouchableOpacity style={styles.tapLeft} onPress={goPrev} activeOpacity={1} />
            <TouchableOpacity style={styles.tapRight} onPress={goNext} activeOpacity={1} />
          </View>

          {/* Caption + views */}
          {(story.caption || story.views > 0) && (
            <View style={styles.footer}>
              {story.caption ? <Text style={styles.caption}>{story.caption}</Text> : null}
              <Text style={styles.views}>{story.views} views</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: 3,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: typography.fontWeight.bold,
    fontSize: 14,
  },
  username: {
    color: '#FFF',
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  time: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: typography.fontSize.xs,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  caption: {
    color: '#FFF',
    fontSize: typography.fontSize.md,
    marginBottom: spacing.sm,
  },
  views: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: typography.fontSize.xs,
  },
});
