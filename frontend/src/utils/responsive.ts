/**
 * RESPONSIVE UTILITIES
 * 
 * Hook and utilities for responsive design across web and mobile
 */
import { useState, useEffect } from 'react';
import { Dimensions, Platform, ScaledSize } from 'react-native';

export interface ResponsiveInfo {
  width: number;
  height: number;
  isWeb: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// Breakpoints (matching common CSS frameworks)
const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

const getBreakpoint = (width: number): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

const getResponsiveInfo = (dimensions: ScaledSize): ResponsiveInfo => {
  const { width, height } = dimensions;
  const breakpoint = getBreakpoint(width);
  
  return {
    width,
    height,
    isWeb: Platform.OS === 'web',
    isMobile: breakpoint === 'xs' || breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl',
    isLandscape: width > height,
    breakpoint,
  };
};

/**
 * Hook for responsive design
 */
export const useResponsive = (): ResponsiveInfo => {
  const [responsive, setResponsive] = useState<ResponsiveInfo>(
    getResponsiveInfo(Dimensions.get('window'))
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setResponsive(getResponsiveInfo(window));
    });

    return () => subscription?.remove();
  }, []);

  return responsive;
};

/**
 * Responsive style helper
 * Returns different values based on breakpoint
 */
export const responsive = <T,>(
  values: {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
    default: T;
  },
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
): T => {
  return values[breakpoint] ?? values.default;
};

/**
 * Check if running on web platform
 */
export const isWeb = Platform.OS === 'web';

/**
 * Check if running on native platform
 */
export const isNative = Platform.OS !== 'web';

/**
 * Platform-specific value helper
 */
export const platformSelect = <T,>(config: {
  web?: T;
  native?: T;
  ios?: T;
  android?: T;
  default: T;
}): T => {
  if (Platform.OS === 'web' && config.web !== undefined) return config.web;
  if (Platform.OS === 'ios' && config.ios !== undefined) return config.ios;
  if (Platform.OS === 'android' && config.android !== undefined) return config.android;
  if (Platform.OS !== 'web' && config.native !== undefined) return config.native;
  return config.default;
};

/**
 * Responsive container width for dashboards
 */
export const getContainerWidth = (screenWidth: number, breakpoint: string): number | string => {
  switch (breakpoint) {
    case 'xl':
      return Math.min(1200, screenWidth - 48);
    case 'lg':
      return Math.min(960, screenWidth - 48);
    case 'md':
      return screenWidth - 32;
    default:
      return '100%';
  }
};

/**
 * Grid columns based on breakpoint
 */
export const getGridColumns = (breakpoint: string): number => {
  switch (breakpoint) {
    case 'xl':
      return 4;
    case 'lg':
      return 3;
    case 'md':
      return 2;
    default:
      return 1;
  }
};

export default {
  useResponsive,
  responsive,
  isWeb,
  isNative,
  platformSelect,
  getContainerWidth,
  getGridColumns,
  BREAKPOINTS,
};
