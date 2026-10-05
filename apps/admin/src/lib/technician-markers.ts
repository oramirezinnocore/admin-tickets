/**
 * Technician Map Marker Utilities
 *
 * Provides catalog and helpers for customizable technician map markers.
 * Translates semantic marker types (CAR, BLUE, etc.) into visual representations.
 */

import { TechnicianMarkerIcon, TechnicianMarkerColor } from '@wisper/shared';
import { Car, Truck, Bike, User, type LucideIcon } from 'lucide-react';

// ============================================================================
// ICON CATALOG
// ============================================================================

export interface MarkerIconOption {
  value: TechnicianMarkerIcon;
  label: string;
  Icon: LucideIcon;
  description: string;
}

export const MARKER_ICONS: MarkerIconOption[] = [
  {
    value: TechnicianMarkerIcon.CAR,
    label: 'Automóvil',
    Icon: Car,
    description: 'Vehículo tipo sedán o compacto'
  },
  {
    value: TechnicianMarkerIcon.VAN,
    label: 'Camioneta',
    Icon: Truck,
    description: 'Camioneta pickup o van'
  },
  {
    value: TechnicianMarkerIcon.MOTORCYCLE,
    label: 'Motocicleta',
    Icon: Bike,
    description: 'Motocicleta o scooter'
  },
  {
    value: TechnicianMarkerIcon.PERSON,
    label: 'Persona',
    Icon: User,
    description: 'Técnico a pie o sin vehículo asignado'
  },
];

// ============================================================================
// COLOR CATALOG
// ============================================================================

export interface MarkerColorOption {
  value: TechnicianMarkerColor;
  label: string;
  hex: string;
  tailwindBg: string;
  tailwindText: string;
  tailwindBorder: string;
}

export const MARKER_COLORS: MarkerColorOption[] = [
  {
    value: TechnicianMarkerColor.BLUE,
    label: 'Azul',
    hex: '#3B82F6',
    tailwindBg: 'bg-blue-500',
    tailwindText: 'text-blue-500',
    tailwindBorder: 'border-blue-500'
  },
  {
    value: TechnicianMarkerColor.GREEN,
    label: 'Verde',
    hex: '#10B981',
    tailwindBg: 'bg-green-500',
    tailwindText: 'text-green-500',
    tailwindBorder: 'border-green-500'
  },
  {
    value: TechnicianMarkerColor.ORANGE,
    label: 'Naranja',
    hex: '#F97316',
    tailwindBg: 'bg-orange-500',
    tailwindText: 'text-orange-500',
    tailwindBorder: 'border-orange-500'
  },
  {
    value: TechnicianMarkerColor.PURPLE,
    label: 'Morado',
    hex: '#A855F7',
    tailwindBg: 'bg-purple-500',
    tailwindText: 'text-purple-500',
    tailwindBorder: 'border-purple-500'
  },
  {
    value: TechnicianMarkerColor.RED,
    label: 'Rojo',
    hex: '#EF4444',
    tailwindBg: 'bg-red-500',
    tailwindText: 'text-red-500',
    tailwindBorder: 'border-red-500'
  },
  {
    value: TechnicianMarkerColor.CYAN,
    label: 'Cian',
    hex: '#06B6D4',
    tailwindBg: 'bg-cyan-500',
    tailwindText: 'text-cyan-500',
    tailwindBorder: 'border-cyan-500'
  },
  {
    value: TechnicianMarkerColor.AMBER,
    label: 'Ámbar',
    hex: '#F59E0B',
    tailwindBg: 'bg-amber-500',
    tailwindText: 'text-amber-500',
    tailwindBorder: 'border-amber-500'
  },
  {
    value: TechnicianMarkerColor.PINK,
    label: 'Rosa',
    hex: '#EC4899',
    tailwindBg: 'bg-pink-500',
    tailwindText: 'text-pink-500',
    tailwindBorder: 'border-pink-500'
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Lucide icon component for a marker icon type
 */
export function getMarkerIconComponent(icon: TechnicianMarkerIcon | string | null | undefined): LucideIcon {
  const option = MARKER_ICONS.find(opt => opt.value === icon);
  return option?.Icon || User; // Default to User
}

/**
 * Get hex color value for a marker color
 */
export function getMarkerColorHex(color: TechnicianMarkerColor | string | null | undefined): string {
  const option = MARKER_COLORS.find(opt => opt.value === color);
  return option?.hex || '#3B82F6'; // Default to blue
}

/**
 * Get Tailwind background class for a marker color
 */
export function getMarkerColorBgClass(color: TechnicianMarkerColor | string | null | undefined): string {
  const option = MARKER_COLORS.find(opt => opt.value === color);
  return option?.tailwindBg || 'bg-blue-500'; // Default to blue
}

/**
 * Get Tailwind text class for a marker color
 */
export function getMarkerColorTextClass(color: TechnicianMarkerColor | string | null | undefined): string {
  const option = MARKER_COLORS.find(opt => opt.value === color);
  return option?.tailwindText || 'text-blue-500'; // Default to blue
}

/**
 * Get Tailwind border class for a marker color
 */
export function getMarkerColorBorderClass(color: TechnicianMarkerColor | string | null | undefined): string {
  const option = MARKER_COLORS.find(opt => opt.value === color);
  return option?.tailwindBorder || 'border-blue-500'; // Default to blue
}

/**
 * Get human-friendly label for a marker icon
 */
export function getMarkerIconLabel(icon: TechnicianMarkerIcon | string | null | undefined): string {
  const option = MARKER_ICONS.find(opt => opt.value === icon);
  return option?.label || 'Persona';
}

/**
 * Get human-friendly label for a marker color
 */
export function getMarkerColorLabel(color: TechnicianMarkerColor | string | null | undefined): string {
  const option = MARKER_COLORS.find(opt => opt.value === color);
  return option?.label || 'Azul';
}

/**
 * Get default marker icon
 */
export function getDefaultMarkerIcon(): TechnicianMarkerIcon {
  return TechnicianMarkerIcon.PERSON;
}

/**
 * Get default marker color
 */
export function getDefaultMarkerColor(): TechnicianMarkerColor {
  return TechnicianMarkerColor.BLUE;
}
