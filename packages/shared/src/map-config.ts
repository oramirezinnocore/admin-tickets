/**
 * Map configuration for OpenFreeMap
 * Using official endpoint format from https://openfreemap.org/quick_start/
 */

export const MAP_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  bright: 'https://tiles.openfreemap.org/styles/bright',
} as const;

export const DEFAULT_MAP_STYLE = MAP_STYLES.liberty;

export const MORELIA_CENTER: [number, number] = [-101.1949, 19.7037];

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';
