/**
 * Geographic utilities for coordinate validation
 */

/**
 * Validates if coordinates are valid geographic coordinates
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns true if coordinates are valid, false otherwise
 */
export function hasValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude === null || latitude === undefined) return false;
  if (longitude === null || longitude === undefined) return false;

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  // Validate geographic ranges
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;

  return true;
}

/**
 * Type guard for objects with coordinates
 */
export interface HasCoordinates {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

/**
 * Type guard to check if object has valid coordinates
 */
export function hasCoordinates(
  obj: HasCoordinates | null | undefined
): obj is { latitude: number; longitude: number } {
  if (!obj) return false;
  return hasValidCoordinates(obj.latitude, obj.longitude);
}
