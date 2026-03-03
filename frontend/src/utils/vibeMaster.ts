/**
 * VIBE MASTER - Lagos Nightlife Personality Engine
 * 
 * Generates dynamic, culturally-authentic commentary based on
 * real-time venue data. Pure Lagos energy! 🇳🇬
 */

// ==================== VIBE LEVEL TYPES ====================
export type VibeLevel = 'peak' | 'lit' | 'warming' | 'chill' | 'quiet';
export type CityMood = 'high' | 'mid' | 'low' | 'rainy' | 'weekend';

// ==================== TEMPLATE LIBRARY ====================

// Templates for when a venue is PEAK (80+ vibe score)
const ELECTRIC_TEMPLATES = [
  "{venue} is currently the capital of {city}! The energy is pure gbedu. Pull up now! 🔥",
  "Omo! {venue} dey scatter ground tonight! No be small thing o. 🎉",
  "{venue} no dey disappoint! Maximum ginger right now. Cruise dey! 💃",
  "The vibe at {venue} dey mad o! {city} stand up! 🙌",
  "Alert! {venue} don enter wahala mode. If you no dey there, you dey miss! ⚡",
  "{venue} is giving what it's supposed to give! Pure vibes only! 🌟",
  "E be like say {venue} wan break internet tonight! Levels don change! 🚀",
  "Somebody hold me o! {venue} too hot right now! Fire dey! 🔥🔥",
];

// Templates for when a venue is LIT (60-79 vibe score)
const POPPING_TEMPLATES = [
  "{venue} is heating up nicely! The night is young, the vibes are right. 🌙",
  "Things are looking good at {venue}. Energy dey build small small. 📈",
  "{venue} don start to dey move! Correct time to slide through. 🎯",
  "The gbedu at {venue} dey warm body. No be everywhere you go see this one. 💫",
  "{venue} is in that sweet spot right now. Not too loud, not too quiet. Perfect! ✨",
  "Vibes dey increase for {venue}! Better go early before e full up. 🏃",
];

// Templates for when a venue is WARMING (40-59 vibe score)
const MODERATE_TEMPLATES = [
  "{venue} is still finding its rhythm tonight. Give it time, magic dey come. ⏳",
  "Lowkey vibes at {venue} right now. Good for those who like am calm. 🎵",
  "{venue} dey warm up. The DJ just dey test the waters. 🎧",
  "Things dey happen small small for {venue}. Patience is key! 🔑",
  "Early vibes at {venue}. The real ones know - best seats go first! 💺",
];

// Templates for when a venue is CHILL (20-39 vibe score)
const CHILL_TEMPLATES = [
  "{city} is still warming up. {venue} is looking chill for a low-key jaiye. No dulling! 🍷",
  "{venue} dey on a relaxed tip tonight. Perfect for deep conversations. 💭",
  "Soft life vibes at {venue}. If you wan yarn with your person, na here be. 🥂",
  "Low-key energy at {venue}. Sometimes that's exactly what you need. 🌊",
  "{venue} is giving chill executive vibes. Classy tings! 👔",
];

// Templates for when a venue is QUIET (0-19 vibe score)
const QUIET_TEMPLATES = [
  "{venue} is taking a breather tonight. Even the best spots need rest! 😴",
  "Ghost town vibes at {venue}. But hey, tomorrow na another day! 🌅",
  "{venue} is quiet for now. The calm before the storm maybe? ⛈️",
  "If you check {venue} now, you fit hear pin drop. Abeg, try another spot! 📍",
  "Na early days for {venue} tonight. The party never land yet. ✈️",
];

// City-wide mood templates
const CITY_HIGH_TEMPLATES = [
  "{city} is absolutely buzzing tonight! Multiple spots are on fire! 🔥🔥🔥",
  "The whole of {city} don wake up! Everywhere is popping! 🎊",
  "Tonight is THE night in {city}! The energy is through the roof! 🚀",
  "{city} nightlife no send anybody tonight! Maximum enjoyment loading... 💯",
];

const CITY_MID_TEMPLATES = [
  "{city} is vibing at a steady pace tonight. A few hot spots emerging! 📊",
  "Balanced energy across {city} tonight. Something for everyone! 🎭",
  "{city} dey take things easy tonight. Weekend vibes in the making! 🌴",
];

const CITY_LOW_TEMPLATES = [
  "{city} is having a quiet one tonight. The streets are resting. 🌙",
  "Slow night in {city}. Perfect for planning your next big outing! 📝",
  "{city} is in recovery mode. Save your energy for when it matters! 💪",
];

const RAINY_NIGHT_TEMPLATES = [
  "Rain dey fall for {city} but the vibes no dey stop! Indoor parties dey reign! ☔🎉",
  "Wet weather, hot vibes! {city} indoor spots are where it's at tonight! 🌧️🔥",
  "The rain can't stop {city}'s groove! Cozy vibes loading... 🍷☔",
];

const WEEKEND_TEMPLATES = [
  "Weekend don land for {city}! Everywhere go scatter tonight! 🎊",
  "Friday/Saturday energy in {city}! All the spots are preparing for war! ⚔️",
  "TGIF! {city} is about to go crazy! Choose your battlefield wisely! 🗺️",
];

// ==================== VIBE MASTER ENGINE ====================

export interface VenueSummary {
  name: string;
  vibeScore: number;
  area: string;
}

export interface CityStats {
  city: string;
  totalVenues: number;
  activeVenues: number;
  averageVibe: number;
  topVenue: VenueSummary | null;
  hotSpots: number; // venues with score > 60
  isWeekend: boolean;
  isRainy?: boolean;
}

/**
 * Get the vibe level based on score
 */
export const getVibeLevel = (score: number): VibeLevel => {
  if (score >= 80) return 'peak';
  if (score >= 60) return 'lit';
  if (score >= 40) return 'warming';
  if (score >= 20) return 'chill';
  return 'quiet';
};

/**
 * Get the city mood based on stats
 */
export const getCityMood = (stats: CityStats): CityMood => {
  if (stats.isRainy) return 'rainy';
  if (stats.isWeekend && stats.hotSpots >= 3) return 'weekend';
  if (stats.averageVibe >= 60 || stats.hotSpots >= 5) return 'high';
  if (stats.averageVibe >= 35) return 'mid';
  return 'low';
};

/**
 * Get random template from array
 */
const getRandomTemplate = (templates: string[]): string => {
  return templates[Math.floor(Math.random() * templates.length)];
};

/**
 * Replace placeholders in template
 */
const fillTemplate = (template: string, venue: string, city: string): string => {
  return template
    .replace(/{venue}/g, venue)
    .replace(/{city}/g, city.charAt(0).toUpperCase() + city.slice(1));
};

/**
 * Generate venue-specific commentary
 */
export const getVenueCommentary = (venue: VenueSummary, city: string): string => {
  const level = getVibeLevel(venue.vibeScore);
  let templates: string[];
  
  switch (level) {
    case 'peak':
      templates = ELECTRIC_TEMPLATES;
      break;
    case 'lit':
      templates = POPPING_TEMPLATES;
      break;
    case 'warming':
      templates = MODERATE_TEMPLATES;
      break;
    case 'chill':
      templates = CHILL_TEMPLATES;
      break;
    default:
      templates = QUIET_TEMPLATES;
  }
  
  return fillTemplate(getRandomTemplate(templates), venue.name, city);
};

/**
 * Generate city-wide pulse commentary
 */
export const getCityPulse = (stats: CityStats): string => {
  const mood = getCityMood(stats);
  let templates: string[];
  
  switch (mood) {
    case 'weekend':
      templates = WEEKEND_TEMPLATES;
      break;
    case 'rainy':
      templates = RAINY_NIGHT_TEMPLATES;
      break;
    case 'high':
      templates = CITY_HIGH_TEMPLATES;
      break;
    case 'mid':
      templates = CITY_MID_TEMPLATES;
      break;
    default:
      templates = CITY_LOW_TEMPLATES;
  }
  
  // If we have a top venue that's electric, add venue-specific flair
  if (stats.topVenue && stats.topVenue.vibeScore >= 80) {
    const cityPulse = fillTemplate(getRandomTemplate(templates), stats.topVenue.name, stats.city);
    const venueFlair = getVenueCommentary(stats.topVenue, stats.city);
    return `${cityPulse}\n\n🏆 Top Spot: ${venueFlair}`;
  }
  
  return fillTemplate(
    getRandomTemplate(templates), 
    stats.topVenue?.name || 'the streets', 
    stats.city
  );
};

/**
 * Generate the Daily Pulse message for the public floor
 */
export const generateDailyPulse = (stats: CityStats): {
  headline: string;
  subtext: string;
  mood: CityMood;
  topVenue: VenueSummary | null;
  emoji: string;
} => {
  const mood = getCityMood(stats);
  const cityName = stats.city.charAt(0).toUpperCase() + stats.city.slice(1);
  
  // Get appropriate emoji for mood
  const moodEmojis: Record<CityMood, string> = {
    high: '🔥',
    mid: '✨',
    low: '🌙',
    rainy: '☔',
    weekend: '🎉',
  };
  
  // Generate headline based on mood
  let headline: string;
  let subtext: string;
  
  switch (mood) {
    case 'high':
      headline = `${cityName} is ON FIRE tonight!`;
      subtext = `${stats.hotSpots} spots are lit right now. The city no dey sleep! 🔥`;
      break;
    case 'weekend':
      headline = `Weekend Wahala in ${cityName}!`;
      subtext = `It's the weekend and ${stats.activeVenues} venues are ready to scatter! 🎊`;
      break;
    case 'rainy':
      headline = `Rainy Night Vibes in ${cityName}`;
      subtext = `Weather can't stop the gbedu! Indoor spots are buzzing. ☔🎉`;
      break;
    case 'mid':
      headline = `${cityName} is warming up`;
      subtext = `${stats.hotSpots} hot spots emerging. The night is young! 📈`;
      break;
    default:
      headline = `${cityName} is chilling tonight`;
      subtext = `Lowkey vibes across the city. Perfect for a quiet flex. 🍷`;
  }
  
  // Add top venue info if available
  if (stats.topVenue && stats.topVenue.vibeScore >= 60) {
    subtext = `${stats.topVenue.name} is leading with ${stats.topVenue.vibeScore} energy! ${subtext}`;
  }
  
  return {
    headline,
    subtext,
    mood,
    topVenue: stats.topVenue,
    emoji: moodEmojis[mood],
  };
};

/**
 * Clout reward messages
 */
export const CLOUT_REWARD_MESSAGES = [
  "Ehen! +5 Clout added to your stash! Keep the vibes coming! 💰",
  "+5 Clout! You're helping the streets know what's real! 🙌",
  "Clout secured! +5 added! Your opinion dey matter! ⭐",
  "+5 Clout in the bag! The nightlife needs scouts like you! 🔍",
  "Boom! +5 Clout! Thanks for keeping it real! 💯",
  "+5 Clout credited! You're now officially a Vibe Contributor! 🏆",
];

export const getCloutRewardMessage = (): string => {
  return CLOUT_REWARD_MESSAGES[Math.floor(Math.random() * CLOUT_REWARD_MESSAGES.length)];
};

export default {
  getVibeLevel,
  getCityMood,
  getVenueCommentary,
  getCityPulse,
  generateDailyPulse,
  getCloutRewardMessage,
};
