/**
 * Vibe App Theme Configuration
 * 
 * This file contains all design tokens for the app.
 * Modify these values to change the app's appearance globally.
 */

export const colors = {
  // Brand Colors
  primary: '#FF3366',      // Main accent (pink/red)
  secondary: '#9933FF',    // Secondary accent (purple)
  
  // Background Colors
  background: {
    dark: '#0A0A0F',       // Main app background
    card: '#151520',       // Card/surface background
    elevated: '#1A1F2A',   // Elevated surface
    input: '#252530',      // Input field background
  },
  
  // Text Colors
  text: {
    primary: '#FFFFFF',
    secondary: '#888888',
    muted: '#666666',
    disabled: '#444444',
  },
  
  // Status Colors
  status: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#FF5252',
    info: '#2196F3',
  },
  
  // Vibe Level Colors (for heatmap gradient)
  vibe: {
    chill: '#3399FF',      // Blue - Low energy
    moderate: '#9933FF',   // Purple - Moderate
    popping: '#FF9933',    // Orange - High energy
    electric: '#FF3366',   // Pink/Red - Peak energy
  },
  
  // Scout Status Colors
  scout: {
    newbie: '#666666',
    regular: '#2196F3',
    scout: '#E91E63',
    elite: '#FFD700',
  },
  
  // Pulse Drop Tier Colors
  pulseTier: {
    spark: '#FF9800',
    flare: '#E91E63',
    supernova: '#FFD700',
  },
  
  // Miscellaneous
  border: '#252530',
  overlay: 'rgba(0, 0, 0, 0.8)',
  gold: '#FFD700',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const typography = {
  // Font Families (update if using custom fonts)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  
  // Font Sizes
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    display: 28,
    hero: 32,
    mega: 64,
    giant: 72,
  },
  
  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};

export const shadows = {
  // Note: React Native shadows work differently on iOS vs Android
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  }),
};

// Animation durations (in ms)
export const animation = {
  fast: 150,
  normal: 300,
  slow: 500,
  pulse: 1000,
};

// Touch targets (minimum 44pt for iOS, 48dp for Android)
export const touchTargets = {
  minimum: 44,
  comfortable: 48,
};

// Helper function to get vibe color based on score
export const getVibeColor = (score: number): string => {
  if (score >= 80) return colors.vibe.electric;
  if (score >= 60) return colors.vibe.popping;
  if (score >= 40) return colors.vibe.moderate;
  return colors.vibe.chill;
};

// Helper function to get scout status color
export const getScoutColor = (status: string): string => {
  return colors.scout[status as keyof typeof colors.scout] || colors.scout.newbie;
};

export default {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  animation,
  touchTargets,
  getVibeColor,
  getScoutColor,
};
