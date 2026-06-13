/**
 * VIIBE Internal Analytics Service
 *
 * Lightweight event tracker — stores to our own backend.
 * Built to be PostHog-compatible: when PostHog goes live,
 * swap _flush() to call posthog.capture() instead of our endpoint.
 *
 * Usage:
 *   import analytics from '../services/analytics';
 *   analytics.track('rating_submitted', { venue_id, energy, vibe_score });
 *   analytics.identify(userId);
 */

import { useVibeStore } from '../store/vibeStore';
import { posthog } from './posthog';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// ── Event catalogue ───────────────────────────────────────────────────────────
// Centralised so event names never drift between callers.

export const EVENT = {
  // Session
  SESSION_START:           'session_start',
  // Ratings
  RATING_SUBMITTED:        'rating_submitted',
  QUICK_RATE_OPENED:       'quick_rate_opened',
  SWIPE_RATE_COMPLETED:    'swipe_rate_completed',
  // Venues
  VENUE_VIEWED:            'venue_viewed',
  VENUE_DIRECTIONS:        'venue_directions_clicked',
  VENUE_LOBBY_ADD:         'venue_lobby_add',
  VENUE_LOBBY_REMOVE:      'venue_lobby_remove',
  // Check-ins
  CHECKIN_START:           'checkin_start',
  CHECKIN_END:             'checkin_end',
  // Night journey
  SCENE_MOOD_SET:          'scene_mood_set',
  NIGHT_ARC_STEP:          'night_arc_step_completed',
  // Social
  CREW_CREATED:            'crew_created',
  CREW_JOINED:             'crew_joined',
  CREW_VOTE_CAST:          'crew_vote_cast',
  // Identity
  ZODIAC_SET:              'zodiac_set',
  SKIN_CHANGED:            'skin_changed',
  MUSIC_PREFS_SET:         'music_preferences_set',
  // Intelligence
  DNA_VIEWED:              'dna_viewed',
  COSMIC_READING_VIEWED:   'cosmic_reading_viewed',
  INTEL_SECTION_VIEWED:    'intel_section_viewed',
  // Merchant / monetisation
  PULSE_DROP_INITIATED:    'pulse_drop_initiated',
  VIBE_PLUS_UPGRADE_TAPPED:'vibe_plus_upgrade_tapped',
} as const;

export type EventName = typeof EVENT[keyof typeof EVENT];

// ── Internal queue ────────────────────────────────────────────────────────────

interface QueuedEvent {
  event:      EventName | string;
  properties: Record<string, unknown>;
  user_id?:   string;
  timestamp:  string;
}

class AnalyticsService {
  private queue: QueuedEvent[] = [];
  private userId: string | null = null;
  private sessionId: string;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  identify(userId: string) {
    this.userId = userId;
    // Identify in PostHog so events are tied to the user
    posthog?.identify(userId);
  }

  track(event: EventName | string, properties: Record<string, unknown> = {}) {
    // Pull userId from store lazily so we always get the latest
    const storeUser = useVibeStore.getState().user;
    const uid = this.userId || storeUser?.id;

    this.queue.push({
      event,
      properties: {
        ...properties,
        session_id:  this.sessionId,
        platform:    'mobile',
      },
      user_id:   uid,
      timestamp: new Date().toISOString(),
    });

    // Flush immediately if queue hits 10, otherwise schedule
    if (this.queue.length >= 10) {
      this._flush();
    } else {
      this._scheduleFlush();
    }
  }

  private _scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this._flush();
    }, 5000); // flush every 5s max
  }

  private async _flush() {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];

    // ── PostHog (handles its own batching + retry) ────────────────────────
    if (posthog) {
      for (const ev of batch) {
        posthog.capture(ev.event, {
          ...ev.properties,
          user_id:    ev.user_id ?? null,
          client_ts:  ev.timestamp,
        });
      }
    }

    // ── Our backend (feeds DNA + intelligence pipeline) ───────────────────
    const token = useVibeStore.getState().getAuthHeaders()?.Authorization;
    if (!token) return; // not authenticated — skip our backend silently

    try {
      await fetch(`${API_URL}/api/analytics/events`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      // Non-critical — PostHog already has the events safely
    }
  }

  /** Call on app close / background to flush remaining events */
  flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this._flush();
  }
}

const analytics = new AnalyticsService();
export default analytics;
