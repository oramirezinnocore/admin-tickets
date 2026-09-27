'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initMapLibre } from '@/lib/maplibre';
import { DEFAULT_MAP_STYLE } from '@wisper/shared';

interface ClientMapPreviewProps {
  latitude: number;
  longitude: number;
  clientName?: string;
}

export default function ClientMapPreview({ latitude, longitude, clientName }: ClientMapPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let mapInitialized = false;

    console.log('[ClientMapPreview] Component mounted', { latitude, longitude });

    const initMap = async () => {
      if (cancelled) {
        console.log('[ClientMapPreview] Init cancelled before start');
        return;
      }
      if (mapRef.current) {
        console.log('[ClientMapPreview] Map already exists');
        return;
      }
      if (!mapContainerRef.current) {
        console.log('[ClientMapPreview] Container ref not available');
        return;
      }
      if (mapInitialized) {
        console.log('[ClientMapPreview] Map already initialized');
        return;
      }

      // Verify container has valid dimensions before initializing
      const rect = mapContainerRef.current.getBoundingClientRect();
      console.log('[ClientMapPreview] Container dimensions:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      });

      if (rect.width < 50 || rect.height < 50) {
        console.warn('[ClientMapPreview] Container dimensions too small, retrying...');
        // Retry after another delay
        setTimeout(() => {
          if (!cancelled && !mapInitialized) {
            initMap();
          }
        }, 200);
        return;
      }

      mapInitialized = true;
      console.log('[ClientMapPreview] Starting map initialization...');

      try {
        console.log('[ClientMapPreview] Loading MapLibre GL...');
        const maplibregl = await initMapLibre();
        console.log('[ClientMapPreview] MapLibre GL loaded successfully');

        if (cancelled) {
          console.log('[ClientMapPreview] Cancelled after MapLibre load');
          return;
        }
        if (!mapContainerRef.current) {
          console.log('[ClientMapPreview] Container disappeared after MapLibre load');
          return;
        }

        console.log('[ClientMapPreview] Creating map instance...', {
          style: DEFAULT_MAP_STYLE,
          center: [longitude, latitude],
          zoom: 14
        });

        const map = new (maplibregl as any).Map({
          container: mapContainerRef.current,
          style: DEFAULT_MAP_STYLE,
          center: [longitude, latitude],
          zoom: 14,
          interactive: false,
        });

        console.log('[ClientMapPreview] Map instance created');

        map.on('load', () => {
          console.log('[ClientMapPreview] Map load event fired');
          if (cancelled) {
            console.log('[ClientMapPreview] Cancelled in load event');
            return;
          }

          // Ensure map is properly sized
          requestAnimationFrame(() => {
            if (mapContainerRef.current && !cancelled) {
              const rect = mapContainerRef.current.getBoundingClientRect();
              console.log('[ClientMapPreview] Resizing map to:', {
                width: rect.width,
                height: rect.height
              });
              if (rect.width > 0 && rect.height > 0) {
                map.resize();
                console.log('[ClientMapPreview] Map resized');
              }
            }
          });

          console.log('[ClientMapPreview] Setting loading to false');
          setLoading(false);

          // Add marker
          console.log('[ClientMapPreview] Adding marker at:', [longitude, latitude]);
          new (maplibregl as any).Marker({ color: '#3B82F6' })
            .setLngLat([longitude, latitude])
            .addTo(map);
          console.log('[ClientMapPreview] Marker added');
        });

        map.on('style.load', () => {
          console.log('[ClientMapPreview] Style loaded');
        });

        map.on('idle', () => {
          console.log('[ClientMapPreview] Map idle');
        });

        map.on('error', (e: any) => {
          console.error('[ClientMapPreview] Map error:', e);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        });

        mapRef.current = map;
        console.log('[ClientMapPreview] Map ref stored');
      } catch (err) {
        console.error('[ClientMapPreview] Initialization error:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    // Use ResizeObserver to wait for valid dimensions
    if (mapContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          console.log('[ClientMapPreview] ResizeObserver:', { width, height });
          if (width > 0 && height > 0 && !mapInitialized && !mapRef.current) {
            console.log('[ClientMapPreview] Valid dimensions detected, initializing map');
            initMap();
          }
        }
      });
      resizeObserverRef.current.observe(mapContainerRef.current);
    }

    // Fallback: also try after delay
    const timeoutId = setTimeout(() => {
      if (!mapInitialized && !mapRef.current) {
        console.log('[ClientMapPreview] Timeout fallback triggered');
        initMap();
      }
    }, 100);

    return () => {
      console.log('[ClientMapPreview] Component unmounting');
      cancelled = true;
      clearTimeout(timeoutId);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        console.log('[ClientMapPreview] Removing map');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="h-48 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-4">
        <div className="text-center">
          <svg
            className="w-8 h-8 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-sm text-gray-600">No se pudo cargar el mapa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapContainerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <div className="text-sm text-gray-600">Cargando mapa...</div>
          </div>
        </div>
      )}
    </div>
  );
}
