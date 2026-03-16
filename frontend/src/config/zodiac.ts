/**
 * Zodiac configuration for the Vibe App.
 * Used for optional personality context at signup and Cosmic Vibe readings.
 * 12 signs, each with nightlife-relevant trait descriptors fed to the AI prompt.
 */

export interface ZodiacSign {
  key: string;
  name: string;
  symbol: string;   // Unicode glyph
  emoji: string;
  dateRange: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  elementColor: string;
  /** Short nightlife personality descriptors used in AI prompt context */
  nightlifeTraits: string[];
  /** One-liner shown on the profile badge */
  tagline: string;
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    key: 'aries',
    name: 'Aries',
    symbol: '♈',
    emoji: '🔥',
    dateRange: 'Mar 21 – Apr 19',
    element: 'Fire',
    elementColor: '#FF4422',
    nightlifeTraits: ['first to arrive', 'hype generator', 'energy igniter', 'spontaneous'],
    tagline: 'Sets the vibe before it starts',
  },
  {
    key: 'taurus',
    name: 'Taurus',
    symbol: '♉',
    emoji: '🌿',
    dateRange: 'Apr 20 – May 20',
    element: 'Earth',
    elementColor: '#66BB6A',
    nightlifeTraits: ['knows the best spots', 'steady presence', 'good taste', 'loyal to their crew'],
    tagline: 'Finds the best table every time',
  },
  {
    key: 'gemini',
    name: 'Gemini',
    symbol: '♊',
    emoji: '✨',
    dateRange: 'May 21 – Jun 20',
    element: 'Air',
    elementColor: '#FFEE58',
    nightlifeTraits: ['social butterfly', 'knows everyone', 'switches venues twice', 'storyteller'],
    tagline: 'Hits 3 spots before midnight',
  },
  {
    key: 'cancer',
    name: 'Cancer',
    symbol: '♋',
    emoji: '🌙',
    dateRange: 'Jun 21 – Jul 22',
    element: 'Water',
    elementColor: '#42A5F5',
    nightlifeTraits: ['vibe reader', 'holds crew together', 'intuitive energy', 'protective of the squad'],
    tagline: 'Holds the vibe down for everyone',
  },
  {
    key: 'leo',
    name: 'Leo',
    symbol: '♌',
    emoji: '👑',
    dateRange: 'Jul 23 – Aug 22',
    element: 'Fire',
    elementColor: '#FFA726',
    nightlifeTraits: ['natural spotlight', 'commands the dance floor', 'amplifies energy', 'unforgettable entrance'],
    tagline: 'The room notices when they arrive',
  },
  {
    key: 'virgo',
    name: 'Virgo',
    symbol: '♍',
    emoji: '⚡',
    dateRange: 'Aug 23 – Sep 22',
    element: 'Earth',
    elementColor: '#A5D6A7',
    nightlifeTraits: ['scouts the scene', 'reads vibe scores', 'curates the plan', 'never gets caught off-guard'],
    tagline: 'Had the plan before you woke up',
  },
  {
    key: 'libra',
    name: 'Libra',
    symbol: '♎',
    emoji: '⚖️',
    dateRange: 'Sep 23 – Oct 22',
    element: 'Air',
    elementColor: '#F06292',
    nightlifeTraits: ['picks the perfect venue', 'balanced energy', 'everyone wants in their crew', 'aesthetic eye'],
    tagline: 'Makes every decision look effortless',
  },
  {
    key: 'scorpio',
    name: 'Scorpio',
    symbol: '♏',
    emoji: '🖤',
    dateRange: 'Oct 23 – Nov 21',
    element: 'Water',
    elementColor: '#AB47BC',
    nightlifeTraits: ['mysterious pull', 'feels the deeper current', 'doesn\'t miss a thing', 'transformative nights'],
    tagline: 'Always in the most electric spot',
  },
  {
    key: 'sagittarius',
    name: 'Sagittarius',
    symbol: '♐',
    emoji: '🏹',
    dateRange: 'Nov 22 – Dec 21',
    element: 'Fire',
    elementColor: '#FF7043',
    nightlifeTraits: ['adventure-driven', 'discovers new venues', 'infectious enthusiasm', 'never goes home early'],
    tagline: 'The night is never long enough',
  },
  {
    key: 'capricorn',
    name: 'Capricorn',
    symbol: '♑',
    emoji: '🏔️',
    dateRange: 'Dec 22 – Jan 19',
    element: 'Earth',
    elementColor: '#78909C',
    nightlifeTraits: ['VIP mindset', 'built different', 'makes moves with purpose', 'status ascender'],
    tagline: 'Moves with intention, never random',
  },
  {
    key: 'aquarius',
    name: 'Aquarius',
    symbol: '♒',
    emoji: '🌊',
    dateRange: 'Jan 20 – Feb 18',
    element: 'Air',
    elementColor: '#29B6F6',
    nightlifeTraits: ['ahead of the trend', 'finds the underground gems', 'original energy', 'scene pioneer'],
    tagline: 'Was at that spot before it blew up',
  },
  {
    key: 'pisces',
    name: 'Pisces',
    symbol: '♓',
    emoji: '🐠',
    dateRange: 'Feb 19 – Mar 20',
    element: 'Water',
    elementColor: '#7E57C2',
    nightlifeTraits: ['absorbs the vibe', 'in flow with the music', 'deep feeling', 'memorable presence'],
    tagline: 'Feels the music on another level',
  },
];

export function getZodiacSign(key: string): ZodiacSign | undefined {
  return ZODIAC_SIGNS.find(z => z.key === key);
}

export const ELEMENT_COLORS: Record<string, string> = {
  Fire:  '#FF4422',
  Earth: '#66BB6A',
  Air:   '#FFEE58',
  Water: '#42A5F5',
};
