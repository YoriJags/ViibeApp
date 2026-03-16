// ─── Shared domain types for VIIBE store ─────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface City {
  name: string;
  code: string;
  center: Coordinates;
  radius_km: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  city: string;
  venue_type: 'club' | 'lounge' | 'restaurant' | 'bar' | 'church' | 'concert' | 'rave' | 'block_party' | 'festival' | 'event' | 'other';
  coordinates: Coordinates;
  current_vibe_score: number;
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  total_ratings_24h: number;
  is_featured: boolean;
  is_verified: boolean;
  profile_views: number;
  direction_clicks: number;
  active_pulse_tier?: 'spark' | 'flare' | 'supernova' | null;
  glow_boost: number;
  custom_icon?: string;
  ratings_last_30m?: number;
  geofence_radius_m?: number;
  vibe_certified?: boolean;
  certified_since?: string;
}

export interface User {
  id: string;
  username: string;
  phone: string;
  email?: string;
  name?: string;
  display_name?: string;
  picture?: string;
  auth_provider: 'local' | 'google' | 'apple';
  clout_points: number;
  total_ratings: number;
  scout_status: 'regular' | 'scout' | 'elite';
  is_vibe_plus?: boolean;
  vibe_plus_expires_at?: string;
  rank?: number;
  weekly_ratings?: number;
  streak_days?: number;
  // Merchant / admin roles
  is_merchant?: boolean;
  is_super_admin?: boolean;
  merchant_venue_id?: string;
  token?: string;
  rating_accuracy_score?: number;
  reactor_skin?: string;      // preset key or 'custom:#RRGGBB'
  zodiac_sign?: string;       // optional, set during onboarding
  call_name?: string;         // what they want to be called in the app
}

export interface PendingRating {
  id: string;
  venue_id: string;
  energy: string;
  capacity: string;
  gate: string;
  coordinates: Coordinates;
  photo_base64?: string;
  timestamp: number;
}

export interface PulseDrop {
  id: string;
  venue_id: string;
  venue_name: string;
  user_id: string;
  timestamp: number;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_rating_date: string;
  streak_status: 'active' | 'at_risk' | 'broken';
  next_milestone: number;
  clout_multiplier: number;
  streak_shield_active?: boolean;
  total_ratings: number;
  weekly_count: number;
}

export interface ActiveCheckin {
  user_id: string;
  venue_id: string;
  venue_name: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export interface StoryListItem {
  id: string;
  venue_id: string;
  user_id: string;
  username: string;
  media_url: string;
  caption?: string;
  views: number;
  created_at: string;
  expires_at: string;
  scout_status?: string;
}

export interface TimelinePoint {
  hour: string;
  hour_label: string;
  avg_vibe_score: number;
  peak_score: number;
  energy_level: string;
  rating_count: number;
  checkin_count: number;
}

export interface Crew {
  id: string;
  name: string;
  invite_code: string;
  members: CrewMember[];
  active_vote?: CrewVote;
  captain_id?: string;
  is_captain?: boolean;
  member_details?: CrewMember[];
}

export interface CrewMember {
  id: string;
  user_id?: string;
  username: string;
  avatar?: string;
  clout_points: number;
  scout_status?: string;
}

export interface CrewMemberLocation {
  user_id: string;
  username: string;
  venue_id?: string;
  venue_name?: string;
  lat?: number;
  lng?: number;
  updated_at: string;
  avatar_config?: { emoji: string; bgColor: string; accentColor: string } | null;
  battery_level?: number;
}

export interface CrewVote {
  id: string;
  crew_id: string;
  venues: { id: string; name: string; votes: number }[];
  options?: { venue_id: string; venue_name: string; votes: number }[];
  total_votes?: number;
  has_voted?: boolean;
  winner?: string | null;
  expires_at: string;
  status: 'active' | 'completed';
}

export interface AlertPrefs {
  energy_alerts: boolean;
  crew_alerts: boolean;
  surge_alerts: boolean;
  min_vibe_score: number;
  preferred_venue_types: string[];
}

export interface ActiveCampaign {
  id: string;
  venue_id: string;
  venue_name: string;
  title: string;
  description: string;
  reward_type: 'clout' | 'discount' | 'freebie';
  reward_value: number;
  expires_at: string;
}

export interface LobbyVenue extends Venue {
  lobby_added_at: string;
  lobby_entry_id: string;
}

export interface LobbyNudge {
  type: 'go_here' | 'quiet_night';
  venue_id: string | null;
  venue_name?: string;
  score?: number;
  message: string;
  energy?: string;
  margin?: number;
}

export interface LivePush {
  venue_id: string;
  venue_name: string;
  venue_category: string;
  message: string;
  push_id: string;
  sent_at: string;
  heading_count?: number;
}

export type CityPulseLabel = 'QUIET' | 'CHILL' | 'WARMING' | 'LIT' | 'PEAK';

export type VibeSignature = 'HIGH_VELOCITY' | 'STEADY_GROOVE' | 'ATMOSPHERIC_CHILL';

export interface CityPulseData {
  city: string;
  pulse_score: number;
  pulse_label: CityPulseLabel;
  trend: 'heating_up' | 'cooling_down' | 'stable';
  active_scouts: number;
  live_venues: number;
  hot_venues: number;
  pulses_tonight: number;
  trending_venue?: { name: string; score: number };
  sparkline: number[];
  /** Majority-vote Vibe DNA from all active venues — drives Dynamic Island liquid color */
  city_vibe_signature?: VibeSignature;
  updated_at?: string;
}

export interface VenueAffinity {
  venue_type: string;
  score: number;
  rating_count: number;
  label: string;
}

export interface VibeDNA {
  user_id: string;
  affinities: VenueAffinity[];
  tap_affinities?: { venue_type: string; tap_count: number; share: number }[];
  dominant_type: string;
  night_style: 'early_bird' | 'night_owl' | 'midnight_crew';
  night_style_label: string;
  total_ratings_analyzed: number;
  computed_at: string;
  insufficient_data?: boolean;
}

export type NightPhase = 'planning' | 'locked_in' | 'recap';

export function getNightPhase(activeCheckin: ActiveCheckin | null, isDemoMode: boolean): NightPhase {
  if (activeCheckin) return 'locked_in';
  const hour = new Date().getHours();
  if (hour >= 18 || hour < 4) return 'planning';
  if (isDemoMode) return 'planning';
  return 'recap';
}
