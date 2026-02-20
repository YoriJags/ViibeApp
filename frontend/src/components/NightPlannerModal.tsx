/**
 * NightPlannerModal — AI nightlife concierge chat interface.
 * "Where should my squad go tonight? Afrobeats, Lekki, budget-friendly"
 *
 * Demo mode: scripted 2-turn conversation with pre-loaded venue cards.
 * Live mode: POST /api/planner/chat with rule-based matching (Claude when API key is set).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';
import { DEMO_PLANNER_CONVERSATION, PlannerMessage, PlannerVenueResult } from '../data/demoData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SUGGESTED_PROMPTS = [
  "Best clubs in VI tonight",
  "Afrobeats, Lekki, squad of 6",
  "Chill spots with good food",
  "Free entry options near me",
];

// ── Typing Indicator ──────────────────────────────────────────────────────
function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 200),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - i * 200),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingBubble}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: dot }]} />
      ))}
    </View>
  );
}

// ── Planner Venue Card ────────────────────────────────────────────────────
function PlannerVenueCard({ venue, onPress }: { venue: PlannerVenueResult; onPress: () => void }) {
  const scoreColor = venue.current_vibe_score >= 80 ? '#00E676' : venue.current_vibe_score >= 60 ? '#FFD700' : '#FF9933';
  return (
    <TouchableOpacity style={styles.venueCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.venueCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.venueName}>{venue.name}</Text>
          <Text style={styles.venueArea}>{venue.area}</Text>
        </View>
        <View style={[styles.vibeScoreChip, { borderColor: scoreColor + '60', backgroundColor: scoreColor + '18' }]}>
          <Text style={[styles.vibeScoreText, { color: scoreColor }]}>{venue.current_vibe_score}</Text>
        </View>
      </View>
      <View style={styles.venueMeta}>
        <View style={styles.metaChip}>
          <Text style={styles.metaText}>{venue.entry_fee}</Text>
        </View>
        {venue.music_genre ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>🎵 {venue.music_genre.split('/')[0].trim()}</Text>
          </View>
        ) : null}
      </View>
      {venue.match_reason ? (
        <Text style={styles.matchReason}>{venue.match_reason}</Text>
      ) : null}
      <LinearGradient
        colors={['#FF3366', '#FF6B35']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.pullUpBtn}
      >
        <Text style={styles.pullUpText}>Pull Up</Text>
        <Ionicons name="arrow-forward" size={14} color="#FFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg, onVenuePress }: { msg: PlannerMessage; onVenuePress: (venueId: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>✨</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
        {msg.venues && msg.venues.length > 0 && (
          <View style={styles.venueList}>
            {msg.venues.map((v) => (
              <PlannerVenueCard key={v.venue_id} venue={v} onPress={() => onVenuePress(v.venue_id)} />
            ))}
          </View>
        )}
        {msg.follow_up_prompts && msg.follow_up_prompts.length > 0 && (
          <View style={styles.followUps}>
            {msg.follow_up_prompts.map((p, i) => (
              <View key={i} style={styles.followUpChip}>
                <Text style={styles.followUpText}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
interface NightPlannerModalProps {
  visible: boolean;
  onClose: () => void;
  city: string;
}

export default function NightPlannerModal({ visible, onClose, city }: NightPlannerModalProps) {
  const router = useRouter();
  const { isDemoMode, getAuthHeaders } = useVibeStore();
  const [messages, setMessages] = useState<PlannerMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoStep, setDemoStep] = useState(0); // tracks which scripted turn is next
  const [conversationId] = useState(() => Math.random().toString(36).slice(2));
  const listRef = useRef<FlatList>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setMessages([]);
      setDemoStep(0);
      setInput('');
    }
  }, [visible]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  const handleVenuePress = useCallback((venueId: string) => {
    onClose();
    router.push(`/venue/${venueId}` as any);
  }, [router, onClose]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: PlannerMessage = { id: Date.now().toString(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    if (isDemoMode) {
      // Advance through scripted turns — find next AI response after current demo step
      const nextAIIdx = DEMO_PLANNER_CONVERSATION.findIndex((m, i) => i >= demoStep && m.role === 'assistant');
      await new Promise(r => setTimeout(r, 1200));
      if (nextAIIdx !== -1) {
        const aiMsg = { ...DEMO_PLANNER_CONVERSATION[nextAIIdx], id: Date.now().toString() };
        setMessages(prev => [...prev, aiMsg]);
        setDemoStep(nextAIIdx + 1);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant',
          content: "That's everything I've got for tonight! Tap any venue above to check the live vibe.",
        }]);
      }
      setLoading(false);
      return;
    }

    // Live mode
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API_URL}/api/planner/chat`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, city, conversation_id: conversationId, history }),
      });
      if (res.ok) {
        const data = await res.json();
        const aiMsg: PlannerMessage = {
          id: Date.now().toString(), role: 'assistant',
          content: data.reply,
          venues: data.venues,
          follow_up_prompts: data.follow_up_prompts,
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error('API error');
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'assistant',
        content: "I'm having trouble connecting right now. Try again in a moment.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, isDemoMode, demoStep, city, conversationId, getAuthHeaders]);

  const renderItem = useCallback(({ item }: { item: PlannerMessage }) => (
    <MessageBubble msg={item} onVenuePress={handleVenuePress} />
  ), [handleVenuePress]);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>NIGHT PLANNER</Text>
            <Text style={styles.headerSparkle}>✨</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Empty state */}
          {isEmpty && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ask me anything</Text>
              <Text style={styles.emptySub}>I'll find the best spots in {city.charAt(0).toUpperCase() + city.slice(1)} for you tonight</Text>
              <View style={styles.suggestionsGrid}>
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => handleSend(p)} activeOpacity={0.7}>
                    <Text style={styles.suggestionText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Message list */}
          {!isEmpty && (
            <FlatList
              ref={listRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={loading ? <TypingIndicator /> : null}
            />
          )}

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Plan my night..."
              placeholderTextColor="#555"
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              multiline={false}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              activeOpacity={0.8}
              disabled={!input.trim() || loading}
            >
              <LinearGradient
                colors={input.trim() && !loading ? ['#FF3366', '#FF6B35'] : ['#333', '#444']}
                style={styles.sendBtn}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSparkle: {
    fontSize: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySub: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,51,102,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,51,102,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: {
    color: '#FF3366',
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    flexShrink: 0,
  },
  botAvatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.78,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  bubbleBot: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#FF3366',
    borderTopRightRadius: 4,
  },
  bubbleText: {
    color: '#DDD',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#FFF',
  },
  venueList: {
    gap: 8,
  },
  venueCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    gap: 8,
  },
  venueCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  venueName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  venueArea: {
    color: '#888',
    fontSize: 11,
  },
  vibeScoreChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vibeScoreText: {
    fontSize: 13,
    fontWeight: '800',
  },
  venueMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: {
    color: '#AAA',
    fontSize: 11,
  },
  matchReason: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
  },
  pullUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 8,
  },
  pullUpText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  followUps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  followUpChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  followUpText: {
    color: '#AAA',
    fontSize: 11,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    alignSelf: 'flex-start',
    marginLeft: 40,
    marginBottom: 12,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3366',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
