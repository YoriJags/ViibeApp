/**
 * Follow places: the one swipe deck (design spec, Nov 2026).
 *
 * Opened on request only (home, Tonight), never on launch. Right or "Follow"
 * follows the place, and for an event that is on now also says "maybe"; left
 * or "Skip" moves on. It is intent, never a reading: a swipe from anywhere says
 * nothing about the room, so nothing here calls it rating.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePlacePhoto } from '../services/usePlacePhoto';
import { Button, readingOf, VenueLike } from './ui';
import { color, energy, radius, space, type } from '../theme/tokens';
import { useVibeStore } from '../store/vibeStore';

const { width: W } = Dimensions.get('window');
const SWIPE = W * 0.28;

type Venue = VenueLike & { cover_image_url?: string; photo_base64?: string };

interface Props {
  venues: Venue[];
  /** A Follow: intent (follow, "maybe" for an event on now), never a reading. */
  onFire: (venue: Venue) => void;
  onComplete: () => void;
}

function Card({ venue }: { venue: Venue }) {
  const isDemo = useVibeStore((s) => s.isDemoMode);
  const own = venue.cover_image_url || (venue.photo_base64 ? `data:image/jpeg;base64,${venue.photo_base64}` : null);
  const photo = usePlacePhoto(venue.id, !own && !venue.event);
  const r = readingOf(venue, isDemo);
  const look = r.has ? energy[r.state!] : null;
  const src = own || photo?.url;
  const meta = [venue.area, venue.event ? (venue.event.entry === 'ticketed' ? 'ticketed event' : 'event') : venue.venue_type?.replace(/_/g, ' ')]
    .filter(Boolean).join(', ');
  return (
    <View style={s.card}>
      <View style={s.media}>
        {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : look ? <LinearGradient colors={[look.fill, color.surface]} start={{ x: 0.8, y: 1 }} end={{ x: 0.2, y: 0 }} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: color.raised }]} />}
      </View>
      <View style={s.cardBody}>
        <Text style={s.name} numberOfLines={2}>{venue.name}</Text>
        {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
        <Text style={[s.reading, look && { color: look.ink }]}>
          {r.has ? `${look!.label} ${r.score}${r.age ? `, ${r.age.toLowerCase()}` : ''}` : 'No reading yet'}
        </Text>
      </View>
    </View>
  );
}

export default function VenueDiscoverFlow({ venues, onFire, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const deck = useMemo(() => {
    const arr = venues.filter((v) => v.event?.phase !== 'ended');
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr.slice(0, 15);
  }, []);
  const [idx, setIdx] = useState(0);
  const [followed, setFollowed] = useState(0);
  const pos = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false);
  const handlers = useRef({ follow: () => {}, skip: () => {} });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onComplete(); return true; });
    return () => sub.remove();
  }, []);

  const current = deck[idx];
  const advance = (follow: boolean) => {
    if (follow && current) { onFire(current); setFollowed((n) => n + 1); }
    pos.setValue({ x: 0, y: 0 });
    busy.current = false;
    setIdx((i) => i + 1);
  };
  const fly = (follow: boolean) => {
    if (busy.current || !current) return;
    busy.current = true;
    Haptics.selectionAsync().catch(() => {});
    Animated.timing(pos, { toValue: { x: (follow ? 1 : -1) * W * 1.5, y: 0 }, duration: 240, useNativeDriver: true })
      .start(() => advance(follow));
  };
  handlers.current = { follow: () => fly(true), skip: () => fly(false) };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => pos.setValue({ x: g.dx, y: 0 }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE || g.vx > 0.8) handlers.current.follow();
      else if (g.dx < -SWIPE || g.vx < -0.8) handlers.current.skip();
      else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
    },
  })).current;

  const rotate = pos.x.interpolate({ inputRange: [-W, 0, W], outputRange: ['-8deg', '0deg', '8deg'] });
  const followOpacity = pos.x.interpolate({ inputRange: [0, SWIPE], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = pos.x.interpolate({ inputRange: [-SWIPE, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={[s.root, { paddingTop: insets.top + space.xs, paddingBottom: insets.bottom + space.md }]}>
      <View style={s.top}>
        <Text style={s.title}>Follow places</Text>
        <Pressable onPress={onComplete} hitSlop={10} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={s.closeText}>{current ? 'Close' : ''}</Text>
        </Pressable>
      </View>

      {current ? (
        <>
          <Text style={s.count}>{idx + 1} of {deck.length}</Text>
          <View style={s.stage}>
            <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: pos.x }, { rotate }] }}>
              <Card venue={current} />
              <Animated.View style={[s.stamp, s.stampRight, { opacity: followOpacity }]}><Text style={s.stampText}>Follow</Text></Animated.View>
              <Animated.View style={[s.stamp, s.stampLeft, { opacity: skipOpacity }]}><Text style={s.stampText}>Skip</Text></Animated.View>
            </Animated.View>
          </View>
          <View style={s.actions}>
            <Button label="Skip" variant="secondary" onPress={() => handlers.current.skip()} style={{ flex: 1 }} />
            <Button label="Follow" icon="notifications-outline" onPress={() => handlers.current.follow()} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <View style={s.done}>
          <Text style={s.doneTitle}>{followed ? `Following ${followed} ${followed === 1 ? 'place' : 'places'}` : 'Nothing followed this time'}</Text>
          <Text style={s.doneBody}>{followed ? "We'll tell you when they heat up." : 'You can follow any venue from its page.'}</Text>
          <Button label="Done" onPress={onComplete} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, backgroundColor: color.bg, paddingHorizontal: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  title: { ...type.headline, color: color.ink },
  close: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  closeText: { ...type.labelStrong, color: color.inkSoft },
  count: { ...type.caption, color: color.inkSoft },
  stage: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, overflow: 'hidden' },
  media: { height: 240, backgroundColor: color.raised },
  cardBody: { padding: space.md, gap: space.xxs },
  name: { ...type.title, color: color.ink },
  meta: { ...type.label, color: color.inkSoft },
  reading: { ...type.bodyStrong, color: color.inkFaint, marginTop: space.xs },
  stamp: { position: 'absolute', top: space.md, paddingHorizontal: space.sm, paddingVertical: space.xxs, borderRadius: radius.pill, backgroundColor: color.accent },
  stampRight: { left: space.md },
  stampLeft: { right: space.md, backgroundColor: color.raised },
  stampText: { ...type.labelStrong, color: color.inkOnAccent },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  doneTitle: { ...type.title, color: color.ink, textAlign: 'center' },
  doneBody: { ...type.body, color: color.inkSoft, textAlign: 'center', marginTop: space.xs },
});
