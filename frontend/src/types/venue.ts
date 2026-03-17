/**
 * Canonical Venue type — single source of truth.
 * Used by: VenueCard, vibeStore, venue detail, Intel, map, etc.
 * Import from here, never re-declare locally.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface VenuePulse {
  tier: string;
  label: string;
  source?: string;
  boosted_at?: string;
}

export interface IconSpotted {
  username: string;
  icon_tier: string;
  icon_label?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  city?: string;
  venue_type?: 'club' | 'lounge' | 'restaurant' | 'bar' | 'church' | 'concert' | 'rave' | 'block_party' | 'festival' | 'event' | 'other';
  coordinates?: Coordinates;

  // Live state
  current_vibe_score: number;
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  last_snapshot_time?: string;
  last_snapshot_url?: string;

  // Meta
  is_featured: boolean;
  is_verified?: boolean;
  viibe_certified?: boolean;
  vibe_certified?: boolean;    // alias used in some API responses
  certified_since?: string;
  vibe_tier?: string;

  // Pulse drop
  active_pulse_tier?: string | null;
  glow_boost?: number;

  // Access / logistics
  entry_fee?: string;
  music_genre?: string;
  is_open_now?: boolean | null;
  next_open?: string;
  geofence_radius_m?: number;

  // Ratings
  total_ratings_24h?: number;
  ratings_last_30m?: number;
  profile_views?: number;
  direction_clicks?: number;

  // Score transparency
  active_scouts?: number;
  last_rated_mins_ago?: number | null;
  score_confidence?: 'high' | 'medium' | 'low';

  // Dwell
  long_dwell_count?: number;
  avg_dwell_minutes?: number;

  // Scout consensus
  consensus_count?: number;
  consensus_rate?: number;
  consensus_label?: string;

  // Ambient sound
  ambient_db_avg?: number | null;
  ambient_scout_count?: number;

  // Rich display
  pulse?: VenuePulse;
  icon_spotted?: IconSpotted | null;
  custom_icon?: string;
}
