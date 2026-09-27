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
  const initAttemptedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (cancelled) return;
      if (mapRef.current) return;
      if (!mapContainerRef.current) return;

      // Verify container has valid dimensions before initializing
      const rect = mapContainerRef.current.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) {
        console.warn('[ClientMapPreview] Container has invalid dimensions:', rect);
        return;
      }

      if (initAttemptedRef.current) return;
      initAttemptedRef.current = true;

      try {
        const maplibregl = await initMapLibre();

        if (cancelled) return;
        if (!mapContainerRef.current) return;

        const map = new (maplibregl as any).Map({
          container: mapContainerRef.current,
          style: DEFAULT_MAP_STYLE,
          center: [longitude, latitude],
          zoom: 14,
          interactive: false,
        });

        map.on('load', () => {
          if (cancelled) return;

          // Ensure map is properly sized
          requestAnimationFrame(() => {
            if (mapContainerRef.current && !cancelled) {
              const rect = mapContainerRef.current.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                map.resize();
              }
            }
          });

          setLoading(false);

          // Add marker
          new (maplibregl as any).Marker({ color: '#3B82F6' })
            .setLngLat([longitude, latitude])
            .addTo(map);
        });

        map.on('error', (e: any) => {
          console.error('[ClientMapPreview] Map error:', e);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        });

        mapRef.current = map;
      } catch (err) {
        console.error('[ClientMapPreview] Initialization error:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    // Small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(initMap, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      initAttemptedRef.current = false;
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
