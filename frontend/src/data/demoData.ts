/**
 * Demo Mode Data - Realistic mock data for investor presentations
 * Used by Public floor and Merchant floor when isDemoMode is true.
 * Admin floor has its own built-in demo data.
 */

// ===== DEMO USER =====
// Has all roles so you can navigate all 3 floors
export const DEMO_USER = {
  id: 'demo_user_001',
  username: 'VibeDemo',
  phone: '+2348000000000',
  email: 'demo@vibeapp.ng',
  name: 'Vibe Demo',
  picture: null,
  auth_provider: 'local' as const,
  clout_points: 4250,
  scout_status: 'elite' as const,
  rating_accuracy_score: 92,
  total_ratings: 187,
  home_city: 'lagos',
  is_admin: true,
  is_super_admin: true,
  is_merchant: true,
  merchant_venue_id: 'demo_venue_quilox',
  wallet_balance: 125000,
  avatar_config: { emoji: '\u{1F60E}', bgColor: '#FF3366', accentColor: '#FF6B35' },
};

// ===== DEMO VENUES (12 venues across Lagos & Abuja) =====
export const DEMO_VENUES = [
  {
    id: 'demo_venue_quilox',
    name: 'Quilox Nightclub',
    address: '8 Ozumba Mbadiwe Ave, Victoria Island',
    area: 'Victoria Island',
    city: 'lagos',
    venue_type: 'club' as const,
    coordinates: { lat: 6.4316, lng: 3.4223 },
    current_vibe_score: 87,
    energy_level: 'peak' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 47,
    ratings_last_30m: 23,
    is_featured: true,
    is_verified: true,
    profile_views: 2340,
    direction_clicks: 187,
    active_pulse_tier: 'flare',
    glow_boost: 40,
    geofence_radius_m: 150,
    vibe_certified: true,
    certified_since: '2025-11-01T00:00:00Z',
    pulse: { count: 82, total: 100, tier: 'max_pulse' as const, next_tier_at: 100 },
  },
  {
    id: 'demo_venue_hardrock',
    name: 'Hard Rock Cafe',
    address: 'Landmark Village, Victoria Island',
    area: 'Victoria Island',
    city: 'lagos',
    venue_type: 'restaurant' as const,
    coordinates: { lat: 6.4281, lng: 3.4245 },
    current_vibe_score: 72,
    energy_level: 'lit' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'stable' as const,
    total_ratings_24h: 31,
    is_featured: false,
    is_verified: true,
    profile_views: 1560,
    direction_clicks: 93,
    glow_boost: 0,
    geofence_radius_m: 100,
    vibe_certified: false,
    pulse: { count: 43, total: 100, tier: 'charged' as const, next_tier_at: 60 },
  },
  {
    id: 'demo_venue_escape',
    name: 'Escape Nightclub',
    address: 'Plot 3, Block 65 Adeola Odeku',
    area: 'Victoria Island',
    city: 'lagos',
    venue_type: 'club' as const,
    coordinates: { lat: 6.4350, lng: 3.4180 },
    current_vibe_score: 94,
    energy_level: 'peak' as const,
    capacity_level: 'full' as const,
    gate_level: 'slow' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 63,
    ratings_last_30m: 41,
    is_featured: true,
    is_verified: true,
    profile_views: 3100,
    direction_clicks: 245,
    glow_boost: 0,
    geofence_radius_m: 100,
    vibe_certified: true,
    certified_since: '2025-10-15T00:00:00Z',
    pulse: { count: 100, total: 100, tier: 'source' as const, next_tier_at: 0 },
  },
  {
    id: 'demo_venue_shiro',
    name: 'Shiro Lagos',
    address: 'Victoria Island',
    area: 'Victoria Island',
    city: 'lagos',
    venue_type: 'lounge' as const,
    coordinates: { lat: 6.4295, lng: 3.4200 },
    current_vibe_score: 65,
    energy_level: 'chill' as const,
    capacity_level: 'sparse' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'stable' as const,
    total_ratings_24h: 14,
    is_featured: false,
    is_verified: true,
    profile_views: 890,
    direction_clicks: 45,
    glow_boost: 0,
    geofence_radius_m: 100,
  },
  {
    id: 'demo_venue_reddoor',
    name: 'Red Door Lounge',
    address: 'Lekki Phase 1',
    area: 'Lekki',
    city: 'lagos',
    venue_type: 'lounge' as const,
    coordinates: { lat: 6.4401, lng: 3.4735 },
    current_vibe_score: 78,
    energy_level: 'lit' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 28,
    is_featured: false,
    is_verified: true,
    profile_views: 1100,
    direction_clicks: 72,
    glow_boost: 0,
    geofence_radius_m: 100,
  },
  {
    id: 'demo_venue_cova',
    name: 'Cova Lounge',
    address: 'Ikeja GRA',
    area: 'Ikeja',
    city: 'lagos',
    venue_type: 'bar' as const,
    coordinates: { lat: 6.5850, lng: 3.3470 },
    current_vibe_score: 58,
    energy_level: 'chill' as const,
    capacity_level: 'sparse' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'cooling_down' as const,
    total_ratings_24h: 9,
    is_featured: false,
    is_verified: false,
    profile_views: 430,
    direction_clicks: 18,
    glow_boost: 0,
    geofence_radius_m: 100,
  },
  {
    id: 'demo_venue_house70',
    name: 'House 70',
    address: 'Admiralty Way, Lekki Phase 1',
    area: 'Lekki',
    city: 'lagos',
    venue_type: 'club' as const,
    coordinates: { lat: 6.4380, lng: 3.4690 },
    current_vibe_score: 83,
    energy_level: 'peak' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'slow' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 42,
    is_featured: true,
    is_verified: true,
    profile_views: 1800,
    direction_clicks: 156,
    glow_boost: 20,
    active_pulse_tier: 'spark',
    geofence_radius_m: 150,
  },
  {
    id: 'demo_venue_church',
    name: 'Daystar Christian Centre',
    address: 'Oregun, Ikeja',
    area: 'Ikeja',
    city: 'lagos',
    venue_type: 'church' as const,
    coordinates: { lat: 6.6010, lng: 3.3625 },
    current_vibe_score: 71,
    energy_level: 'lit' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'stable' as const,
    total_ratings_24h: 22,
    is_featured: false,
    is_verified: true,
    profile_views: 1200,
    direction_clicks: 89,
    glow_boost: 0,
    geofence_radius_m: 200,
  },
  // Abuja venues
  {
    id: 'demo_venue_play',
    name: 'Play Abuja',
    address: 'Wuse 2',
    area: 'Wuse',
    city: 'abuja',
    venue_type: 'club' as const,
    coordinates: { lat: 9.0680, lng: 7.4880 },
    current_vibe_score: 81,
    energy_level: 'peak' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 35,
    is_featured: true,
    is_verified: true,
    profile_views: 1450,
    direction_clicks: 112,
    glow_boost: 0,
    geofence_radius_m: 100,
  },
  {
    id: 'demo_venue_cube',
    name: 'The Cube Lounge',
    address: 'Maitama District',
    area: 'Maitama',
    city: 'abuja',
    venue_type: 'lounge' as const,
    coordinates: { lat: 9.0820, lng: 7.4950 },
    current_vibe_score: 69,
    energy_level: 'lit' as const,
    capacity_level: 'vibrant' as const,
    gate_level: 'clear' as const,
    vibe_velocity: 'stable' as const,
    total_ratings_24h: 17,
    is_featured: false,
    is_verified: true,
    profile_views: 780,
    direction_clicks: 41,
    glow_boost: 0,
    geofence_radius_m: 100,
  },
  {
    id: 'demo_venue_blockparty',
    name: 'Detty December Block Party',
    address: 'Tafawa Balewa Square, Lagos Island',
    area: 'Lagos Island',
    city: 'lagos',
    venue_type: 'block_party' as const,
    coordinates: { lat: 6.4490, lng: 3.3980 },
    current_vibe_score: 96,
    energy_level: 'peak' as const,
    capacity_level: 'full' as const,
    gate_level: 'slow' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 89,
    is_featured: true,
    is_verified: true,
    profile_views: 5200,
    direction_clicks: 430,
    glow_boost: 100,
    active_pulse_tier: 'supernova',
    geofence_radius_m: 300,
  },
  {
    id: 'demo_venue_concert',
    name: 'Burna Boy Live Concert',
    address: 'Eko Energy City, Victoria Island',
    area: 'Victoria Island',
    city: 'lagos',
    venue_type: 'concert' as const,
    coordinates: { lat: 6.4260, lng: 3.4150 },
    current_vibe_score: 91,
    energy_level: 'peak' as const,
    capacity_level: 'full' as const,
    gate_level: 'blocked' as const,
    vibe_velocity: 'heating_up' as const,
    total_ratings_24h: 74,
    is_featured: true,
    is_verified: true,
    profile_views: 4500,
    direction_clicks: 380,
    glow_boost: 0,
    geofence_radius_m: 250,
  },
];

// ===== DEMO DARK HORSES — heating venues under the radar =====
export const DEMO_DARK_HORSES = [
  {
    id: 'dh1', name: 'Zinnia Rooftop', area: 'Lekki Phase 1', city: 'lagos',
    venue_type: 'lounge', current_vibe_score: 48, energy_level: 'warming' as const,
    capacity_level: 'vibrant' as const, gate_level: 'clear' as const,
    vibe_velocity: 'heating_up' as const, is_featured: false,
  },
  {
    id: 'dh2', name: 'Contrast Bar', area: 'Surulere', city: 'lagos',
    venue_type: 'bar', current_vibe_score: 54, energy_level: 'warming' as const,
    capacity_level: 'vibrant' as const, gate_level: 'clear' as const,
    vibe_velocity: 'heating_up' as const, is_featured: false,
  },
  {
    id: 'dh3', name: 'Club Voltage', area: 'Ikeja GRA', city: 'lagos',
    venue_type: 'club', current_vibe_score: 41, energy_level: 'chill' as const,
    capacity_level: 'sparse' as const, gate_level: 'clear' as const,
    vibe_velocity: 'heating_up' as const, is_featured: false,
  },
];

// ===== DEMO COSMIC VIBE READING =====
export const DEMO_COSMIC_READING = {
  reading: "Lagos is charging up and the frequency tonight is in your favour. Trust the pull — the city has something lined up for scouts who move with purpose.",
  zodiac_sign: null,
  city: 'lagos',
  hot_venue: 'Quilox',
  city_mood: 'heating up fast',
  powered_by: 'demo',
};

// ===== MERCHANT DEMO DATA =====
export const DEMO_VENUE_STATS = {
  venue: DEMO_VENUES[0], // Quilox
  stats: {
    ratings_1h: 12,
    ratings_24h: 47,
    ratings_7d: 312,
    profile_views: 2340,
    direction_clicks: 187,
    current_rank: 3,
    total_area_venues: 28,
  },
  heatmap_delta: {
    venue_score: 87,
    district_average: 62,
    delta: 25,
  },
  wallet_balance: 125000,
};

export const DEMO_SENTIMENT = {
  sentiment: {
    gate: { dominant: 'clear', wait_estimate: '< 5 min', percentage: 78 },
    capacity: { dominant: 'vibrant', percentage: 65 },
    energy: { dominant: 'peak', percentage: 82 },
  },
  total_checks_24h: 47,
};

export const DEMO_PULSE_STATUS = {
  is_active: true,
  current_tier: 'flare',
  time_remaining: { hours: 2, minutes: 45, seconds: 30, total_seconds: 9930 },
  available_tiers: {
    spark: { price: 5000, duration_hours: 2, glow_boost: 20 },
    flare: { price: 15000, duration_hours: 4, glow_boost: 40 },
    supernova: { price: 50000, duration_hours: 8, glow_boost: 100 },
  },
};

export const DEMO_ACTIVE_CAMPAIGN = {
  id: 'demo_campaign_001',
  venue_id: 'demo_venue_quilox',
  venue_name: 'Quilox Nightclub',
  multiplier: 2,
  duration_hours: 4,
  price_paid: 5000,
  status: 'active',
  ratings_during: 23,
  clout_distributed: 460,
  expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3h from now
  created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
};

// ===== STREAK DATA =====
export const DEMO_STREAK = {
  current_streak: 7,
  longest_streak: 14,
  multiplier: 1.5,
  last_activity_date: new Date().toISOString().split('T')[0],
  milestones_claimed: [3, 5, 7],
  next_milestone: 14,
  next_milestone_clout: 200,
};

// ===== CREW DATA =====
export const DEMO_CREW = {
  id: 'demo_crew_001',
  name: 'Lagos Night Owls',
  captain_id: 'demo_user_001',
  members: ['demo_user_001', 'demo_user_002', 'demo_user_003', 'demo_user_004'],
  member_details: [
    { user_id: 'demo_user_001', username: 'VibeDemo', scout_status: 'elite', checked_in: true, venue_name: 'Quilox Nightclub', avatar_config: { emoji: '\u{1F60E}', bgColor: '#FF3366', accentColor: '#FF6B35' } },
    { user_id: 'demo_user_002', username: 'AdaObi', scout_status: 'scout', checked_in: true, venue_name: 'Escape Nightclub', avatar_config: { emoji: '\u{1F525}', bgColor: '#FFD700', accentColor: '#FF9800' } },
    { user_id: 'demo_user_003', username: 'TundeWave', scout_status: 'regular', checked_in: false, avatar_config: { emoji: '\u{1F981}', bgColor: '#00E676', accentColor: '#00D4FF' } },
    { user_id: 'demo_user_004', username: 'ChimaVibes', scout_status: 'newbie', checked_in: false, avatar_config: { emoji: '\u{1F480}', bgColor: '#1A1A28', accentColor: '#FF3366' } },
  ],
  invite_code: 'OWLS2026',
  is_captain: true,
  active_vote: null,
};

// ===== STORIES =====
export const DEMO_STORIES = [
  {
    id: 'demo_story_1',
    username: 'AdaObi',
    scout_status: 'scout',
    venue_id: 'demo_venue_quilox',
    venue_name: 'Quilox Nightclub',
    caption: 'Energy is UNREAL tonight',
    views: 142,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo_story_2',
    username: 'TundeWave',
    scout_status: 'regular',
    venue_id: 'demo_venue_escape',
    venue_name: 'Escape Nightclub',
    caption: 'DJ just dropped Wizkid',
    views: 89,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo_story_3',
    username: 'ChimaVibes',
    scout_status: 'newbie',
    venue_id: 'demo_venue_blockparty',
    venue_name: 'Detty December Block Party',
    caption: 'This block party is MAD',
    views: 310,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

// ===== ACTIVE CAMPAIGNS (public view) =====
export const DEMO_ACTIVE_CAMPAIGNS = [
  {
    id: 'demo_campaign_001',
    venue_id: 'demo_venue_quilox',
    venue_name: 'Quilox Nightclub',
    multiplier: 2,
    expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo_campaign_002',
    venue_id: 'demo_venue_blockparty',
    venue_name: 'Detty December Block Party',
    multiplier: 3,
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  },
];

// ===== TRENDING LEADERBOARD (derived from DEMO_VENUES) =====
const velocityToTrend = (v: string): 'up' | 'down' | 'stable' => {
  if (v === 'heating_up') return 'up';
  if (v === 'cooling_down') return 'down';
  return 'stable';
};

const lagosVenuesSorted = DEMO_VENUES
  .filter((v) => v.city === 'lagos')
  .sort((a, b) => b.current_vibe_score - a.current_vibe_score);

export const DEMO_TRENDING = {
  city: 'lagos',
  venues: lagosVenuesSorted.map((v, i) => ({
    venue: {
      id: v.id,
      name: v.name,
      area: v.area,
      current_vibe_score: v.current_vibe_score,
      coordinates: v.coordinates,
    },
    rank: i + 1,
    trending_score: v.current_vibe_score + Math.floor(Math.random() * 10),
    energy_percent: v.current_vibe_score,
    check_in_velocity: Math.floor(Math.random() * 20) + 5,
    scout_count: Math.floor(Math.random() * 12) + 3,
    trend: velocityToTrend(v.vibe_velocity),
    last_rating: new Date(Date.now() - Math.floor(Math.random() * 60) * 60000).toISOString(),
  })),
  sponsored: DEMO_VENUES
    .filter((v) => v.active_pulse_tier && v.city === 'lagos')
    .map((v, i) => ({
      venue: {
        id: v.id,
        name: v.name,
        area: v.area,
        current_vibe_score: v.current_vibe_score,
        coordinates: v.coordinates,
      },
      rank: 0,
      trending_score: v.current_vibe_score + 20,
      energy_percent: v.current_vibe_score,
      check_in_velocity: Math.floor(Math.random() * 25) + 10,
      scout_count: Math.floor(Math.random() * 15) + 5,
      trend: 'up' as const,
      last_rating: new Date(Date.now() - 5 * 60000).toISOString(),
    })),
  last_updated: new Date().toISOString(),
};

// ===== TOP SCOUTS =====
export const DEMO_TOP_SCOUTS = {
  city: 'lagos',
  scouts: [
    {
      rank: 1,
      user_id: 'demo_user_001',
      username: 'VibeDemo',
      avatar: null,
      check_count: 23,
      venues_visited: 8,
      tier: 'elite',
      ring_color: '#FF3366',
      is_elite: true,
      clout_points: 4250,
    },
    {
      rank: 2,
      user_id: 'demo_user_002',
      username: 'AdaObi',
      avatar: null,
      check_count: 19,
      venues_visited: 6,
      tier: 'scout',
      ring_color: '#FF6B35',
      is_elite: false,
      clout_points: 2180,
    },
    {
      rank: 3,
      user_id: 'demo_user_003',
      username: 'TundeWave',
      avatar: null,
      check_count: 14,
      venues_visited: 5,
      tier: 'regular',
      ring_color: '#9933FF',
      is_elite: false,
      clout_points: 1350,
    },
    {
      rank: 4,
      user_id: 'demo_user_004',
      username: 'ChimaVibes',
      avatar: null,
      check_count: 9,
      venues_visited: 4,
      tier: 'newbie',
      ring_color: '#3399FF',
      is_elite: false,
      clout_points: 620,
    },
    {
      rank: 5,
      user_id: 'demo_user_005',
      username: 'ZainabLagos',
      avatar: null,
      check_count: 7,
      venues_visited: 3,
      tier: 'newbie',
      ring_color: '#3399FF',
      is_elite: false,
      clout_points: 410,
    },
  ],
  last_updated: new Date().toISOString(),
};

// ===== SCOUT PROFILE (for modal) =====
export const DEMO_SCOUT_PROFILE = {
  user: {
    id: 'demo_user_002',
    username: 'AdaObi',
    avatar: null,
    clout_points: 2180,
    scout_status: 'scout',
    total_ratings: 94,
    tier: 'scout',
    tier_color: '#FF6B35',
  },
  activity_heatmap: [
    { venue_id: 'demo_venue_escape', venue_name: 'Escape Nightclub', venue_area: 'Victoria Island', vibe_score: 94, energy: 'peak', time_ago: '25 min ago' },
    { venue_id: 'demo_venue_quilox', venue_name: 'Quilox Nightclub', venue_area: 'Victoria Island', vibe_score: 87, energy: 'peak', time_ago: '2 hours ago' },
    { venue_id: 'demo_venue_house70', venue_name: 'House 70', venue_area: 'Lekki', vibe_score: 83, energy: 'peak', time_ago: '5 hours ago' },
  ],
  stats: {
    checks_24h: 19,
    checks_7d: 67,
    unique_venues_7d: 12,
  },
  last_seen: {
    venue_name: 'Escape Nightclub',
    time_ago: '25 min ago',
  },
};

// ===== LOBBY DEMO DATA =====
export const DEMO_LOBBY = {
  venues: [
    {
      id: 'demo_venue_escape',
      venue_id: 'demo_venue_escape',
      name: 'Escape Nightclub',
      area: 'Victoria Island',
      current_vibe_score: 94,
      vibe_velocity: 'heating_up',
      energy_level: 'peak',
      capacity_level: 'full',
      gate_level: 'slow',
      active_pulse_tier: null,
    },
    {
      id: 'demo_venue_quilox',
      venue_id: 'demo_venue_quilox',
      name: 'Quilox Nightclub',
      area: 'Victoria Island',
      current_vibe_score: 87,
      vibe_velocity: 'heating_up',
      energy_level: 'peak',
      capacity_level: 'vibrant',
      gate_level: 'clear',
      active_pulse_tier: 'flare',
    },
    {
      id: 'demo_venue_reddoor',
      venue_id: 'demo_venue_reddoor',
      name: 'Red Door Lounge',
      area: 'Lekki',
      current_vibe_score: 78,
      vibe_velocity: 'heating_up',
      energy_level: 'lit',
      capacity_level: 'vibrant',
      gate_level: 'clear',
      active_pulse_tier: null,
    },
    {
      id: 'demo_venue_shiro',
      venue_id: 'demo_venue_shiro',
      name: 'Shiro Lagos',
      area: 'Victoria Island',
      current_vibe_score: 65,
      vibe_velocity: 'stable',
      energy_level: 'lit',
      capacity_level: 'sparse',
      gate_level: 'clear',
      active_pulse_tier: null,
    },
    {
      id: 'demo_venue_cova',
      venue_id: 'demo_venue_cova',
      name: 'Cova Lounge',
      area: 'Ikeja',
      current_vibe_score: 58,
      vibe_velocity: 'cooling_down',
      energy_level: 'warming',
      capacity_level: 'sparse',
      gate_level: 'clear',
      active_pulse_tier: null,
    },
  ],
  nudge: {
    type: 'go_here',
    venue_id: 'demo_venue_escape',
    message: 'Escape is the #1 spot tonight! 94% energy and rising fast. Pull up now!',
  },
};

// ===== LIVE ACTIVITY FEED "THE PULSE" =====
export const DEMO_ACTIVITY_FEED = [
  { id: 'act_1', type: 'checkin' as const, username: 'AdaObi', venueName: 'Quilox Nightclub', message: 'checked in at Quilox Nightclub', timeAgo: '2 min ago' },
  { id: 'act_2', type: 'rating' as const, username: 'TundeWave', venueName: 'Escape Nightclub', message: 'rated Escape Nightclub 94%', timeAgo: '5 min ago' },
  { id: 'act_3', type: 'pulse' as const, username: 'Quilox', venueName: 'Quilox Nightclub', message: 'dropped a FLARE Pulse!', timeAgo: '8 min ago' },
  { id: 'act_4', type: 'streak' as const, username: 'ChimaVibes', venueName: '', message: 'hit a 7-day streak!', timeAgo: '12 min ago' },
  { id: 'act_5', type: 'achievement' as const, username: 'VibeDemo', venueName: '', message: 'unlocked Night Owl badge', timeAgo: '15 min ago' },
  { id: 'act_6', type: 'checkin' as const, username: 'ZainabLagos', venueName: 'House 70', message: 'checked in at House 70', timeAgo: '18 min ago' },
  { id: 'act_7', type: 'rating' as const, username: 'AdaObi', venueName: 'Hard Rock Cafe', message: 'rated Hard Rock Cafe 72%', timeAgo: '22 min ago' },
];

// ===== ACHIEVEMENT BADGES =====
export const DEMO_BADGES = [
  { id: 'badge_nightowl', emoji: '\u{1F989}', name: 'Night Owl', description: 'Check in after midnight 5 times', unlocked: true, tier: 'gold' as const },
  { id: 'badge_trailblazer', emoji: '\u{1F525}', name: 'Trailblazer', description: 'Be first to rate a new venue', unlocked: true, tier: 'silver' as const },
  { id: 'badge_socialite', emoji: '\u{1F451}', name: 'Socialite', description: 'Visit 10 different venues', unlocked: true, tier: 'gold' as const },
  { id: 'badge_streak7', emoji: '\u{26A1}', name: '7-Day Streak', description: 'Rate 7 days in a row', unlocked: true, tier: 'bronze' as const },
  { id: 'badge_elite', emoji: '\u{1F48E}', name: 'Elite Scout', description: 'Reach Elite scout status', unlocked: true, tier: 'diamond' as const },
  { id: 'badge_crew', emoji: '\u{1F91D}', name: 'Squad Up', description: 'Join or create a crew', unlocked: true, tier: 'bronze' as const },
  { id: 'badge_streak30', emoji: '\u{1F31F}', name: '30-Day Legend', description: 'Rate 30 days in a row', unlocked: false, tier: 'diamond' as const, progress: 0.47 },
  { id: 'badge_100ratings', emoji: '\u{1F3AF}', name: 'Centurion', description: 'Submit 100 ratings', unlocked: false, tier: 'gold' as const, progress: 0.87 },
];

// ===== VIBE MATCH =====
export const DEMO_VIBE_MATCH = {
  venueName: 'Escape Nightclub',
  venueId: 'demo_venue_escape',
  venueArea: 'Victoria Island',
  matchPercent: 94,
  vibeScore: 94,
  energyLevel: 'Electric',
  reason: 'Your Cartel member AdaObi is here + you love Electric vibes',
};

// ===== TONIGHT HERO DATA =====
export const DEMO_TONIGHT = {
  phase: 'planning' as const,
  currentHour: '10PM',
  cityEnergy: 'peak' as const,
  cityEnergyScore: 87,
  cartelOutCount: 2,
  cartelTotal: 4,
  matchVenue: 'Escape Nightclub',
  matchVenueId: 'demo_venue_escape',
  matchPercent: 94,
  matchArea: 'Victoria Island',
};

// ===== CONNECTIVE PROMPTS =====
export type VibePromptType = 'streak_active' | 'badge_proximity' | 'cartel_activity' | 'leaderboard_impact' | 'clout_milestone';

export interface VibePromptData {
  id: string;
  type: VibePromptType;
  message: string;
  emoji: string;
}

export const DEMO_PROMPTS: VibePromptData[] = [
  { id: 'p1', type: 'streak_active', message: 'Day 7 streak! 1.5x clout multiplier active', emoji: '⚡' },
  { id: 'p2', type: 'badge_proximity', message: '2 more midnight check-ins for Night Owl badge', emoji: '🦉' },
  { id: 'p3', type: 'cartel_activity', message: 'AdaObi just checked in at Escape Nightclub', emoji: '👥' },
  { id: 'p4', type: 'leaderboard_impact', message: 'Quilox moved to #2 in Clubs tonight', emoji: '🏆' },
  { id: 'p5', type: 'clout_milestone', message: '750 more clout to Diamond tier', emoji: '💎' },
];

// ===== TRENDING BY CATEGORY =====
export const DEMO_CATEGORY_TRENDING = {
  club: [
    { rank: 1, name: 'Escape Nightclub', score: 94, trend: 'up' as const },
    { rank: 2, name: 'Quilox Nightclub', score: 87, trend: 'up' as const },
    { rank: 3, name: 'House 70', score: 83, trend: 'up' as const },
  ],
  lounge: [
    { rank: 1, name: 'Red Door Lounge', score: 78, trend: 'up' as const },
    { rank: 2, name: 'Shiro Lagos', score: 65, trend: 'stable' as const },
    { rank: 3, name: 'The Cube Lounge', score: 69, trend: 'stable' as const },
  ],
  restaurant: [
    { rank: 1, name: 'Hard Rock Cafe', score: 72, trend: 'stable' as const },
  ],
  bar: [
    { rank: 1, name: 'Cova Lounge', score: 58, trend: 'down' as const },
  ],
  church: [
    { rank: 1, name: 'Daystar Christian Centre', score: 71, trend: 'stable' as const },
  ],
  block_party: [
    { rank: 1, name: 'Detty December Block Party', score: 96, trend: 'up' as const },
  ],
  concert: [
    { rank: 1, name: 'Burna Boy Live Concert', score: 91, trend: 'up' as const },
  ],
};

// Demo crew locations for CartelRadarMap
export const DEMO_CREW_LOCATIONS = [
  {
    user_id: 'demo_crew_1',
    username: 'Tunde_V',
    venue_name: 'Quilox Nightclub',
    venue_id: 'demo_venue_quilox',
    lat: 6.4281,
    lng: 3.4219,
    avatar_config: { emoji: '🔥', bgColor: '#FF3366', accentColor: '#FF6B35' },
    checked_in_at: new Date().toISOString(),
    is_out: true,
    battery_level: 0.87,
  },
  {
    user_id: 'demo_crew_2',
    username: 'AdeVibe',
    venue_name: 'Hard Rock Cafe',
    venue_id: 'demo_venue_hardrock',
    lat: 6.4301,
    lng: 3.4245,
    avatar_config: { emoji: '💎', bgColor: '#7C3AED', accentColor: '#A855F7' },
    checked_in_at: new Date().toISOString(),
    is_out: true,
    battery_level: 0.54,
  },
  {
    user_id: 'demo_crew_3',
    username: 'Zara_Scout',
    venue_name: 'Escape Nightclub',
    venue_id: 'demo_venue_escape',
    lat: 6.4265,
    lng: 3.4198,
    avatar_config: { emoji: '⚡', bgColor: '#059669', accentColor: '#34D399' },
    checked_in_at: new Date().toISOString(),
    is_out: true,
    battery_level: 0.21,
  },
  {
    user_id: 'demo_crew_4',
    username: 'Kemi_Lux',
    venue_name: 'Ocean View Lounge',
    venue_id: 'demo_venue_ocean',
    lat: 6.4318,
    lng: 3.4261,
    avatar_config: { emoji: '🌙', bgColor: '#0EA5E9', accentColor: '#38BDF8' },
    checked_in_at: new Date().toISOString(),
    is_out: true,
    battery_level: 0.72,
  },
  {
    user_id: 'demo_crew_5',
    username: 'Nonso_Out',
    venue_name: 'Rumors Bar',
    venue_id: 'demo_venue_rumors',
    lat: 6.4252,
    lng: 3.4232,
    avatar_config: { emoji: '👑', bgColor: '#B45309', accentColor: '#F59E0B' },
    checked_in_at: new Date().toISOString(),
    is_out: true,
    battery_level: 0.13,
  },
];

// ===== DEMO TOP SCOUTS PER VENUE =====
// Reused for any venue in demo mode
export const DEMO_VENUE_TOP_SCOUTS = [
  { rank: 1, user_id: 'scout_001', username: 'TundeElite', scout_status: 'elite', ratings_count: 34, clout_earned: 680, tier_color: '#FFD700' },
  { rank: 2, user_id: 'scout_002', username: 'AdeVibe', scout_status: 'scout', ratings_count: 21, clout_earned: 420, tier_color: '#C0C0C0' },
  { rank: 3, user_id: 'scout_003', username: 'Zara_Scout', scout_status: 'scout', ratings_count: 18, clout_earned: 360, tier_color: '#C0C0C0' },
  { rank: 4, user_id: 'scout_004', username: 'LagosNight', scout_status: 'regular', ratings_count: 12, clout_earned: 240, tier_color: '#CD7F32' },
  { rank: 5, user_id: 'scout_005', username: 'VIScout', scout_status: 'regular', ratings_count: 9, clout_earned: 180, tier_color: '#CD7F32' },
];

// ===== VIBE ORACLE — Demo predictions per venue =====
interface OracleSignal { icon: string; label: string; type: string; }
interface OraclePrediction {
  venue_id: string; headline: string; confidence: number;
  peak_window_start: string; peak_window_end: string;
  best_arrival: string; current_trajectory: 'rising'|'peaking'|'fading'|'quiet';
  signals: OracleSignal[]; generated_at: string;
}

const _now = new Date().toISOString();
export const DEMO_ORACLE_PREDICTIONS: Record<string, OraclePrediction> = {
  'demo_venue_quilox': {
    venue_id: 'demo_venue_quilox', confidence: 89,
    headline: "Quilox will be electric by 12:30am tonight",
    peak_window_start: "12:30am", peak_window_end: "2:00am",
    best_arrival: "11:45pm", current_trajectory: 'rising',
    signals: [{ icon:"🌙", label:"Friday Night", type:"day_of_week"}, {icon:"📈", label:"Heating Up", type:"velocity"}, {icon:"🎵", label:"Afrobeats", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_escape': {
    venue_id: 'demo_venue_escape', confidence: 92,
    headline: "Escape is already peaking — go now",
    peak_window_start: "11:30pm", peak_window_end: "1:30am",
    best_arrival: "Now", current_trajectory: 'peaking',
    signals: [{icon:"🌙", label:"Friday Night", type:"day_of_week"}, {icon:"⚡", label:"Peak Window", type:"activity"}, {icon:"✅", label:"Vibe Certified", type:"certification"}],
    generated_at: _now,
  },
  'demo_venue_house70': {
    venue_id: 'demo_venue_house70', confidence: 85,
    headline: "House 70 will be electric by 1:00am tonight",
    peak_window_start: "1:00am", peak_window_end: "3:00am",
    best_arrival: "12:15am", current_trajectory: 'rising',
    signals: [{icon:"🌙", label:"Saturday Night", type:"day_of_week"}, {icon:"🎵", label:"Afrobeats", type:"genre"}, {icon:"📈", label:"Heating Up", type:"velocity"}],
    generated_at: _now,
  },
  'demo_venue_shiro': {
    venue_id: 'demo_venue_shiro', confidence: 80,
    headline: "Shiro Lagos will be popping by 10:00pm",
    peak_window_start: "10:00pm", peak_window_end: "12:00am",
    best_arrival: "9:15pm", current_trajectory: 'rising',
    signals: [{icon:"🌙", label:"Friday Night", type:"day_of_week"}, {icon:"🍸", label:"Lounge Night", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_reddoor': {
    venue_id: 'demo_venue_reddoor', confidence: 76,
    headline: "Red Door will be popping from 11:00pm",
    peak_window_start: "11:00pm", peak_window_end: "1:00am",
    best_arrival: "10:15pm", current_trajectory: 'rising',
    signals: [{icon:"📅", label:"Weeknight", type:"day_of_week"}, {icon:"🍸", label:"Lounge Vibes", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_cova': {
    venue_id: 'demo_venue_cova', confidence: 74,
    headline: "Cova Lounge heats up from 9:00pm",
    peak_window_start: "9:00pm", peak_window_end: "11:30pm",
    best_arrival: "8:15pm", current_trajectory: 'rising',
    signals: [{icon:"📅", label:"Friday Night", type:"day_of_week"}, {icon:"🎵", label:"Amapiano", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_hardrock': {
    venue_id: 'demo_venue_hardrock', confidence: 82,
    headline: "Hard Rock Cafe peaks around 7:30pm tonight",
    peak_window_start: "7:00pm", peak_window_end: "9:30pm",
    best_arrival: "6:15pm", current_trajectory: 'rising',
    signals: [{icon:"🌅", label:"Dinner Rush", type:"day_of_week"}, {icon:"🍽️", label:"Restaurant", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_church': {
    venue_id: 'demo_venue_church', confidence: 93,
    headline: "Daystar Sunday service peaks at 9:00am",
    peak_window_start: "9:00am", peak_window_end: "12:00pm",
    best_arrival: "8:15am", current_trajectory: 'rising',
    signals: [{icon:"⛪", label:"Sunday Service", type:"day_of_week"}, {icon:"✅", label:"Verified Venue", type:"certification"}],
    generated_at: _now,
  },
  'demo_venue_play': {
    venue_id: 'demo_venue_play', confidence: 84,
    headline: "Play Abuja will be electric by 1:00am",
    peak_window_start: "1:00am", peak_window_end: "3:00am",
    best_arrival: "12:15am", current_trajectory: 'rising',
    signals: [{icon:"🌙", label:"Saturday Night", type:"day_of_week"}, {icon:"🎵", label:"Afrobeats", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_cube': {
    venue_id: 'demo_venue_cube', confidence: 77,
    headline: "The Cube Lounge is the place to be from 10pm",
    peak_window_start: "10:00pm", peak_window_end: "12:00am",
    best_arrival: "9:15pm", current_trajectory: 'rising',
    signals: [{icon:"🌙", label:"Friday Night", type:"day_of_week"}, {icon:"🍸", label:"Lounge Night", type:"genre"}],
    generated_at: _now,
  },
  'demo_venue_blockparty': {
    venue_id: 'demo_venue_blockparty', confidence: 91,
    headline: "Detty December Block Party peaks from 6:00pm",
    peak_window_start: "6:00pm", peak_window_end: "10:00pm",
    best_arrival: "5:15pm", current_trajectory: 'rising',
    signals: [{icon:"🎉", label:"Detty December", type:"day_of_week"}, {icon:"📈", label:"Crowd Building", type:"activity"}],
    generated_at: _now,
  },
  'demo_venue_concert': {
    venue_id: 'demo_venue_concert', confidence: 96,
    headline: "Burna Boy Live hits peak energy by 8:00pm",
    peak_window_start: "8:00pm", peak_window_end: "11:00pm",
    best_arrival: "7:15pm", current_trajectory: 'rising',
    signals: [{icon:"🎤", label:"Live Concert", type:"day_of_week"}, {icon:"📈", label:"Selling Out", type:"activity"}, {icon:"🎵", label:"Afrobeats", type:"genre"}],
    generated_at: _now,
  },
};

// Fallback for any venue not in the dict above
export const DEMO_ORACLE_DEFAULT: OraclePrediction = {
  venue_id: 'default', confidence: 78,
  headline: "This spot will be popping by midnight tonight",
  peak_window_start: "12:00am", peak_window_end: "2:00am",
  best_arrival: "11:15pm", current_trajectory: 'rising',
  signals: [{icon:"🌙", label:"Tonight", type:"day_of_week"}, {icon:"📈", label:"Heating Up", type:"velocity"}],
  generated_at: _now,
};

// ===== VIBE DNA — Demo user fingerprint =====
export interface VenueAffinity { venue_type: string; score: number; rating_count: number; label: string; }
export interface VibeDNA {
  user_id: string; affinities: VenueAffinity[]; dominant_type: string;
  night_style: 'early_bird'|'night_owl'|'midnight_crew'; night_style_label: string;
  total_ratings_analyzed: number; computed_at: string; insufficient_data?: boolean;
}

export const DEMO_VIBE_DNA: VibeDNA = {
  user_id: 'demo_user_001',
  dominant_type: 'club',
  night_style: 'night_owl',
  night_style_label: "Night Owl — you peak after midnight",
  total_ratings_analyzed: 187,
  computed_at: _now,
  affinities: [
    { venue_type: 'club',        score: 91, rating_count: 89, label: 'Electric' },
    { venue_type: 'concert',     score: 85, rating_count: 28, label: 'Electric' },
    { venue_type: 'lounge',      score: 68, rating_count: 34, label: 'Popping'  },
    { venue_type: 'bar',         score: 55, rating_count: 19, label: 'Chill'    },
    { venue_type: 'restaurant',  score: 47, rating_count: 12, label: 'Chill'    },
    { venue_type: 'block_party', score: 96, rating_count: 5,  label: 'Electric' },
  ],
};

// ===== NIGHT PLANNER — Scripted demo conversation =====
export interface PlannerVenueResult {
  venue_id: string; name: string; area: string;
  current_vibe_score: number; energy_level: string;
  entry_fee: string; music_genre: string;
  match_reason: string; match_score: number;
}
export interface PlannerMessage {
  id: string; role: 'user'|'assistant'; content: string;
  venues?: PlannerVenueResult[]; follow_up_prompts?: string[];
}

export const DEMO_PLANNER_CONVERSATION: PlannerMessage[] = [
  {
    id: 'demo_msg_1', role: 'user',
    content: "Where should my squad of 6 go tonight? Afrobeats, Lekki, budget-friendly",
  },
  {
    id: 'demo_msg_2', role: 'assistant',
    content: "Your squad is set for a mad night! I found 2 perfect spots in Lekki right now — both Afrobeats, both accessible. Escape is already heating up and House 70 peaks later if you want to make a night of it.",
    venues: [
      { venue_id: 'demo_venue_escape', name: 'Escape Nightclub', area: 'Victoria Island',
        current_vibe_score: 88, energy_level: 'peak', entry_fee: '₦5,000',
        music_genre: 'Afrobeats', match_reason: 'Afrobeats · VI · Capacity for groups', match_score: 94 },
      { venue_id: 'demo_venue_house70', name: 'House 70', area: 'Lekki Phase 1',
        current_vibe_score: 76, energy_level: 'lit', entry_fee: 'Free before 11pm',
        music_genre: 'Afrobeats / Amapiano', match_reason: 'Free entry · Afrobeats · Lekki', match_score: 89 },
    ],
    follow_up_prompts: ["What's the gate like at Escape?", "Any free entry spots?", "Show me VI options"],
  },
  {
    id: 'demo_msg_3', role: 'user',
    content: "What's the gate looking like at Escape?",
  },
  {
    id: 'demo_msg_4', role: 'assistant',
    content: "Escape's gate is currently slow — scouts are reporting about a 15-minute wait. Get there before 11pm to walk straight in. 52 scouts have checked in tonight so the vibe is confirmed electric. Your squad will love it.",
    venues: [],
    follow_up_prompts: ["Navigate to Escape", "Book a table at House 70"],
  },
];

// ===== CITY PULSE — Live city heartbeat demo data =====
export const DEMO_CITY_PULSE = {
  city: 'lagos',
  pulse_score: 82,
  pulse_label: 'LIT' as const,
  trend: 'heating_up' as const,
  active_scouts: 247,
  live_venues: 34,
  hot_venues: 9,
  pulses_tonight: 1143,
  trending_venue: { name: 'Quilox', score: 96 },
  sparkline: [41, 53, 62, 70, 78, 82],
  updated_at: new Date().toISOString(),
};

// ===== BLAST ATTRIBUTION — Merchant ROI proof =====
export const DEMO_BLAST_ATTRIBUTION = {
  venue_id: 'demo_venue_quilox',
  blasts: [
    {
      blast_id: 'blast_001',
      message: 'Floor is packed 🔥 Free entry till 1am — DJ Spinall just dropped in',
      sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      followers_reached: 340,
      visits_2h: 23,
      conversion_rate: 6.8,
      estimated_revenue_ngn: 184000,
    },
    {
      blast_id: 'blast_002',
      message: 'Wednesday vibes 🎶 Open bar for ladies till midnight. Come through',
      sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      followers_reached: 280,
      visits_2h: 14,
      conversion_rate: 5.0,
      estimated_revenue_ngn: 112000,
    },
    {
      blast_id: 'blast_003',
      message: 'Tonight is different. Table service from ₦50k. Limited spots left',
      sent_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      followers_reached: 310,
      visits_2h: 31,
      conversion_rate: 10.0,
      estimated_revenue_ngn: 248000,
    },
  ],
  summary: {
    total_blasts: 3,
    total_verified_visits: 68,
    total_estimated_revenue_ngn: 544000,
    avg_conversion_rate: 7.3,
  },
};

// ===== DEMO BOOKINGS =====
export const DEMO_BOOKINGS = {
  venue_id: 'demo_venue_quilox',
  bookings: [
    { id: 'bk_001', venue_name: 'Quilox', user_name: 'Tunde Adewale', user_phone: '+2348012345678', party_size: 4, booking_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], booking_time: '22:00', notes: 'Birthday celebration', status: 'confirmed', amount_paid: 500 },
    { id: 'bk_002', venue_name: 'Quilox', user_name: 'Chioma Obi', user_phone: '+2348098765432', party_size: 2, booking_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], booking_time: '21:00', notes: '', status: 'confirmed', amount_paid: 500 },
    { id: 'bk_003', venue_name: 'Quilox', user_name: 'Emeka Eze', user_phone: '+2348055544433', party_size: 6, booking_date: new Date(Date.now() + 172800000).toISOString().split('T')[0], booking_time: '23:00', notes: 'Need VIP section', status: 'confirmed', amount_paid: 500 },
  ],
  summary: { today_count: 2, total_guests_today: 6, upcoming_count: 3 },
};

// ===== SCOUT ACTIVITY FEED — Merchant "who's rating me" widget =====
export const DEMO_SCOUT_ACTIVITY = {
  venue_id: 'demo_venue_quilox',
  count_1h: 5,
  count_24h: 34,
  scouts: [
    { username: 'NightCrawler_X', clout: 3120, energy: 'peak', vibe_score: 94, timestamp: new Date(Date.now() - 8 * 60000).toISOString(), is_last_hour: true },
    { username: 'LagosLens', clout: 2850, energy: 'lit', vibe_score: 88, timestamp: new Date(Date.now() - 22 * 60000).toISOString(), is_last_hour: true },
    { username: 'VibeHunter', clout: 1940, energy: 'lit', vibe_score: 85, timestamp: new Date(Date.now() - 35 * 60000).toISOString(), is_last_hour: true },
    { username: 'SceneScout', clout: 1650, energy: 'warming', vibe_score: 72, timestamp: new Date(Date.now() - 48 * 60000).toISOString(), is_last_hour: true },
    { username: 'AbujaNight', clout: 980, energy: 'warming', vibe_score: 68, timestamp: new Date(Date.now() - 59 * 60000).toISOString(), is_last_hour: true },
    { username: 'ClubRadar', clout: 2100, energy: 'chill', vibe_score: 55, timestamp: new Date(Date.now() - 95 * 60000).toISOString(), is_last_hour: false },
    { username: 'StreetPulse', clout: 760, energy: 'lit', vibe_score: 82, timestamp: new Date(Date.now() - 130 * 60000).toISOString(), is_last_hour: false },
  ],
};

// ===== EVENT PERFORMANCE — Merchant event tracker =====
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const lastSaturday = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const nextFriday = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

export const DEMO_EVENTS = {
  venue_id: 'demo_venue_quilox',
  events: [
    {
      id: 'demo_event_001',
      venue_id: 'demo_venue_quilox',
      name: 'Quilox Saturday Takeover',
      event_type: 'DJ Night',
      expected_start: new Date(lastSaturday.setHours(22, 0, 0, 0)).toISOString(),
      expected_end: new Date(lastSaturday.setHours(4, 0, 0, 0) + 24 * 60 * 60 * 1000).toISOString(),
      expected_crowd: 400,
      baseline_score: 71,
      actual_score: 89,
      rating_count: 47,
      status: 'completed' as const,
    },
    {
      id: 'demo_event_002',
      venue_id: 'demo_venue_quilox',
      name: 'Midweek Chill Session',
      event_type: 'Lounge Night',
      expected_start: new Date(threeDaysAgo.setHours(20, 0, 0, 0)).toISOString(),
      expected_end: new Date(threeDaysAgo.setHours(2, 0, 0, 0) + 24 * 60 * 60 * 1000).toISOString(),
      expected_crowd: 150,
      baseline_score: 48,
      actual_score: 41,
      rating_count: 12,
      status: 'completed' as const,
    },
    {
      id: 'demo_event_003',
      venue_id: 'demo_venue_quilox',
      name: 'Afrobeats Fridays — Vol. 8',
      event_type: 'DJ Night',
      expected_start: new Date(nextFriday.setHours(22, 0, 0, 0)).toISOString(),
      expected_end: new Date(nextFriday.setHours(4, 0, 0, 0) + 24 * 60 * 60 * 1000).toISOString(),
      expected_crowd: 350,
      baseline_score: 74,
      actual_score: null,
      rating_count: 0,
      status: 'upcoming' as const,
    },
  ],
};
