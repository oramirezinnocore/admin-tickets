/**
 * MapLibre GL configuration for Next.js
 * Configures worker URL to use self-hosted worker instead of trying to load from node_modules
 */

let maplibregl: typeof import('maplibre-gl') | null = null;
let configured = false;

/**
 * Initialize MapLibre GL with proper worker configuration
 * Must be called client-side only (inside useEffect or after dynamic import)
 */
export async function initMapLibre() {
  if (maplibregl && configured) {
    return maplibregl;
  }

  // Dynamic import to ensure client-side only
  maplibregl = await import('maplibre-gl');

  // Configure worker URL to use self-hosted worker from public/
  // This fixes MIME type error in Next.js/Turbopack
  // MapLibre v6+ uses ESM (.mjs)
  if (maplibregl.setWorkerUrl) {
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
  } else {
    // Fallback for older versions
    (maplibregl as any).workerUrl = '/maplibre/maplibre-gl-worker.mjs';
  }

  configured = true;
  console.log('[MapLibre] Configured worker URL: /maplibre/maplibre-gl-worker.mjs');

  return maplibregl;
}

/**
 * Get MapLibre GL instance (must call initMapLibre first)
 */
export function getMapLibre() {
  if (!maplibregl || !configured) {
    throw new Error('MapLibre not initialized. Call initMapLibre() first.');
  }
  return maplibregl;
}
