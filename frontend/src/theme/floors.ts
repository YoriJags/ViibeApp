/**
 * Vibe App - 3-Storey Theme System
 * 
 * Each "floor" has its own visual identity:
 * - Public: Neon/Midnight (Social Experience)
 * - Merchant: Fintech/Gold-on-Dark (Business Experience)
 * - Admin: Slate/Royal Blue (Authority Experience)
 */

// ==================== PUBLIC FLOOR ====================
// Neon/Midnight Theme - The Social Experience
export const publicTheme = {
  colors: {
    background: {
      dark: '#0A0A0F',
      card: '#151520',
      elevated: '#1A1A28',
      input: '#1E1E2E',
    },
    primary: '#FF3366',
    secondary: '#00D4FF',
    accent: '#FF6B35',
    gold: '#FFD700',
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      muted: '#666666',
    },
    vibe: {
      chill: '#4FC3F7',
      moderate: '#FFD54F',
      popping: '#FF9800',
      electric: '#FF3366',
    },
    status: {
      success: '#00E676',
      warning: '#FFD700',
      error: '#FF5252',
      info: '#00D4FF',
    },
    border: '#2A2A3A',
  },
  gradients: {
    primary: ['#FF3366', '#FF6B35'],
    card: ['#1A1A28', '#151520'],
    vibe: ['#FF3366', '#FF6B35', '#FFD700'],
    tabBarGlow: '#FF3366',
    glass: 'rgba(255, 51, 102, 0.06)',
    glassBorder: 'rgba(255, 51, 102, 0.12)',
  },
};

// ==================== MERCHANT FLOOR ====================
// Fintech/Gold-on-Dark Theme - The Business Experience
export const merchantTheme = {
  colors: {
    background: {
      dark: '#0D0D12',
      card: '#16161D',
      elevated: '#1C1C26',
      input: '#212130',
    },
    primary: '#D4AF37', // Gold
    secondary: '#8B7355', // Bronze accent
    accent: '#C9A227',
    gold: '#FFD700',
    text: {
      primary: '#FFFFFF',
      secondary: '#A0A0A0',
      muted: '#606060',
    },
    status: {
      success: '#4CAF50',
      warning: '#FFC107',
      error: '#F44336',
      info: '#2196F3',
      profit: '#00E676',
      loss: '#FF5252',
    },
    border: '#2A2A35',
    chart: {
      positive: '#4CAF50',
      negative: '#F44336',
      neutral: '#9E9E9E',
    },
  },
  gradients: {
    primary: ['#D4AF37', '#C9A227'],
    card: ['#1C1C26', '#16161D'],
    profit: ['#00E676', '#4CAF50'],
    tabBarGlow: '#D4AF37',
    glass: 'rgba(212, 175, 55, 0.06)',
    glassBorder: 'rgba(212, 175, 55, 0.12)',
  },
};

// ==================== ADMIN FLOOR ====================
// Slate/Royal Blue Theme - The Authority Experience
export const adminTheme = {
  colors: {
    background: {
      dark: '#0A0E14',
      card: '#12181F',
      elevated: '#1A222C',
      input: '#1E2A36',
    },
    primary: '#4169E1', // Royal Blue
    secondary: '#6C8EBF',
    accent: '#00BFFF', // Deep Sky Blue
    gold: '#FFD700',
    text: {
      primary: '#FFFFFF',
      secondary: '#94A3B8',
      muted: '#64748B',
    },
    status: {
      success: '#22C55E',
      warning: '#EAB308',
      error: '#EF4444',
      info: '#3B82F6',
      online: '#22C55E',
      offline: '#EF4444',
    },
    border: '#1E3A5F',
    data: {
      revenue: '#22C55E',
      users: '#3B82F6',
      venues: '#A855F7',
      activity: '#F59E0B',
    },
  },
  gradients: {
    primary: ['#4169E1', '#6C8EBF'],
    card: ['#1A222C', '#12181F'],
    royal: ['#4169E1', '#00BFFF'],
    tabBarGlow: '#4169E1',
    glass: 'rgba(65, 105, 225, 0.06)',
    glassBorder: 'rgba(65, 105, 225, 0.12)',
  },
};

// ==================== SHARED VALUES ====================
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
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

export const typography = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 48,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
};

// Helper to get theme by floor type
export type FloorType = 'public' | 'merchant' | 'admin';

export const getTheme = (floor: FloorType) => {
  switch (floor) {
    case 'merchant':
      return merchantTheme;
    case 'admin':
      return adminTheme;
    default:
      return publicTheme;
  }
};

// Default export for backward compatibility
export const colors = publicTheme.colors;
export default { publicTheme, merchantTheme, adminTheme, spacing, borderRadius, typography };
