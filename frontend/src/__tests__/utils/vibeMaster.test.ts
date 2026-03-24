/**
 * Tests for src/utils/vibeMaster.ts
 *
 * vibeMaster contains pure functions with no React Native dependencies,
 * making it ideal for straightforward unit testing.
 */
import {
  getVibeLevel,
  getCityMood,
  getVenueCommentary,
  getCityPulse,
  generateDailyPulse,
  getCloutRewardMessage,
  CLOUT_REWARD_MESSAGES,
  type VibeLevel,
  type CityMood,
  type CityStats,
  type VenueSummary,
} from '../../utils/vibeMaster';

// ---------------------------------------------------------------------------
// getVibeLevel
// ---------------------------------------------------------------------------

describe('getVibeLevel', () => {
  it('returns peak for scores >= 80', () => {
    expect(getVibeLevel(80)).toBe('peak');
    expect(getVibeLevel(100)).toBe('peak');
    expect(getVibeLevel(95)).toBe('peak');
  });

  it('returns lit for scores 60-79', () => {
    expect(getVibeLevel(60)).toBe('lit');
    expect(getVibeLevel(79)).toBe('lit');
  });

  it('returns warming for scores 40-59', () => {
    expect(getVibeLevel(40)).toBe('warming');
    expect(getVibeLevel(59)).toBe('warming');
  });

  it('returns chill for scores 20-39', () => {
    expect(getVibeLevel(20)).toBe('chill');
    expect(getVibeLevel(39)).toBe('chill');
  });

  it('returns quiet for scores below 20', () => {
    expect(getVibeLevel(0)).toBe('quiet');
    expect(getVibeLevel(19)).toBe('quiet');
  });

  it('is deterministic', () => {
    expect(getVibeLevel(75)).toBe(getVibeLevel(75));
  });
});

// ---------------------------------------------------------------------------
// getCityMood
// ---------------------------------------------------------------------------

const baseStats: CityStats = {
  city: 'lagos',
  totalVenues: 20,
  activeVenues: 15,
  averageVibe: 50,
  topVenue: null,
  hotSpots: 3,
  isWeekend: false,
  isRainy: false,
};

describe('getCityMood', () => {
  it('returns rainy when isRainy is true', () => {
    expect(getCityMood({ ...baseStats, isRainy: true })).toBe('rainy');
  });

  it('returns weekend when isWeekend and enough hotspots', () => {
    expect(getCityMood({ ...baseStats, isWeekend: true, hotSpots: 3 })).toBe('weekend');
  });

  it('does not return weekend with fewer than 3 hotspots', () => {
    const mood = getCityMood({ ...baseStats, isWeekend: true, hotSpots: 2 });
    expect(mood).not.toBe('weekend');
  });

  it('returns high when average vibe >= 60', () => {
    expect(getCityMood({ ...baseStats, averageVibe: 60 })).toBe('high');
  });

  it('returns high when hotSpots >= 5', () => {
    expect(getCityMood({ ...baseStats, averageVibe: 30, hotSpots: 5 })).toBe('high');
  });

  it('returns mid for average 35-59', () => {
    expect(getCityMood({ ...baseStats, averageVibe: 35, hotSpots: 2 })).toBe('mid');
    expect(getCityMood({ ...baseStats, averageVibe: 50, hotSpots: 2 })).toBe('mid');
  });

  it('returns low for quiet city', () => {
    expect(getCityMood({ ...baseStats, averageVibe: 10, hotSpots: 0 })).toBe('low');
  });

  it('rainy takes priority over weekend', () => {
    expect(getCityMood({ ...baseStats, isRainy: true, isWeekend: true })).toBe('rainy');
  });
});

// ---------------------------------------------------------------------------
// getVenueCommentary
// ---------------------------------------------------------------------------

describe('getVenueCommentary', () => {
  const makeVenue = (vibeScore: number): VenueSummary => ({
    name: 'Club Quilox',
    vibeScore,
    area: 'Victoria Island',
  });

  it('returns a non-empty string for every vibe level', () => {
    [90, 70, 50, 30, 10].forEach(score => {
      const result = getVenueCommentary(makeVenue(score), 'lagos');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it('substitutes venue name into the commentary', () => {
    const result = getVenueCommentary(makeVenue(90), 'lagos');
    expect(result).toContain('Club Quilox');
  });

  it('substitutes city name (capitalised) into the commentary', () => {
    // Templates use {city} → "Lagos"
    const result = getVenueCommentary(makeVenue(90), 'lagos');
    // Not all templates contain city, but output should never contain raw "{city}"
    expect(result).not.toContain('{city}');
    expect(result).not.toContain('{venue}');
  });

  it('returns different templates across calls (statistical)', () => {
    // Run 20 times — statistically very unlikely to get same string every time
    const results = new Set(
      Array.from({ length: 20 }, () => getVenueCommentary(makeVenue(95), 'lagos'))
    );
    expect(results.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// getCityPulse
// ---------------------------------------------------------------------------

describe('getCityPulse', () => {
  it('returns a string for all mood types', () => {
    const moodStats: Record<string, CityStats> = {
      high:    { ...baseStats, averageVibe: 70 },
      mid:     { ...baseStats, averageVibe: 45, hotSpots: 2 },
      low:     { ...baseStats, averageVibe: 10, hotSpots: 0 },
      rainy:   { ...baseStats, isRainy: true },
      weekend: { ...baseStats, isWeekend: true, hotSpots: 4 },
    };
    Object.values(moodStats).forEach(stats => {
      const result = getCityPulse(stats);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it('includes top venue spotlight when venue is electric', () => {
    const stats: CityStats = {
      ...baseStats,
      averageVibe: 70,
      topVenue: { name: 'Quilox', vibeScore: 95, area: 'VI' },
    };
    const result = getCityPulse(stats);
    expect(result).toContain('Top Spot');
    expect(result).toContain('Quilox');
  });

  it('does not include top spot section when venue vibe is below 80', () => {
    const stats: CityStats = {
      ...baseStats,
      averageVibe: 70,
      topVenue: { name: 'SomeBar', vibeScore: 70, area: 'VI' },
    };
    const result = getCityPulse(stats);
    expect(result).not.toContain('Top Spot');
  });
});

// ---------------------------------------------------------------------------
// generateDailyPulse
// ---------------------------------------------------------------------------

describe('generateDailyPulse', () => {
  it('returns required fields', () => {
    const result = generateDailyPulse(baseStats);
    expect(result).toHaveProperty('headline');
    expect(result).toHaveProperty('subtext');
    expect(result).toHaveProperty('mood');
    expect(result).toHaveProperty('topVenue');
    expect(result).toHaveProperty('emoji');
  });

  it('capitalises the city name in the headline', () => {
    const result = generateDailyPulse({ ...baseStats, averageVibe: 70, city: 'abuja' });
    expect(result.headline).toContain('Abuja');
  });

  it('includes top venue name in subtext when vibe >= 60', () => {
    const stats: CityStats = {
      ...baseStats,
      averageVibe: 70,
      topVenue: { name: 'Rumors Lounge', vibeScore: 80, area: 'Lekki' },
    };
    const result = generateDailyPulse(stats);
    expect(result.subtext).toContain('Rumors Lounge');
  });

  it('returns correct emoji for each mood', () => {
    const emojiMap: Record<CityMood, string> = {
      high: '🔥', mid: '✨', low: '🌙', rainy: '☔', weekend: '🎉',
    };
    const moodStats: Partial<Record<CityMood, CityStats>> = {
      high:    { ...baseStats, averageVibe: 70 },
      rainy:   { ...baseStats, isRainy: true },
      weekend: { ...baseStats, isWeekend: true, hotSpots: 4 },
      low:     { ...baseStats, averageVibe: 10, hotSpots: 0 },
    };
    Object.entries(moodStats).forEach(([mood, stats]) => {
      const result = generateDailyPulse(stats!);
      expect(result.emoji).toBe(emojiMap[mood as CityMood]);
    });
  });
});

// ---------------------------------------------------------------------------
// getCloutRewardMessage
// ---------------------------------------------------------------------------

describe('getCloutRewardMessage', () => {
  it('returns a string from the CLOUT_REWARD_MESSAGES array', () => {
    const msg = getCloutRewardMessage();
    expect(CLOUT_REWARD_MESSAGES).toContain(msg);
  });

  it('returns different messages across multiple calls (statistical)', () => {
    const results = new Set(Array.from({ length: 20 }, getCloutRewardMessage));
    expect(results.size).toBeGreaterThan(1);
  });
});
