/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
}

interface RouteOptimizationResult {
  orderedPoints: LocationPoint[];
  totalDistanceKm: number;
}

/**
 * Optimize route using nearest-neighbor algorithm
 * @param origin Starting point with latitude/longitude
 * @param destinations Array of destination points with id, latitude, longitude
 * @returns Ordered points and total distance
 */
export function optimizeRouteNearestNeighbor(
  origin: { latitude: number; longitude: number },
  destinations: LocationPoint[]
): RouteOptimizationResult {
  if (destinations.length === 0) {
    return { orderedPoints: [], totalDistanceKm: 0 };
  }

  const remaining = [...destinations];
  const orderedPoints: LocationPoint[] = [];
  let currentLat = origin.latitude;
  let currentLon = origin.longitude;
  let totalDistanceKm = 0;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistanceKm(
      currentLat,
      currentLon,
      remaining[0].latitude,
      remaining[0].longitude
    );

    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistanceKm(
        currentLat,
        currentLon,
        remaining[i].latitude,
        remaining[i].longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = remaining[nearestIndex];
    orderedPoints.push(nearest);
    totalDistanceKm += minDistance;
    currentLat = nearest.latitude;
    currentLon = nearest.longitude;
    remaining.splice(nearestIndex, 1);
  }

  return { orderedPoints, totalDistanceKm };
}
