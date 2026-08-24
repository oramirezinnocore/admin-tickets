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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      try {
        const maplibregl = await initMapLibre();

        const map = new (maplibregl as any).Map({
          container: mapContainerRef.current,
          style: DEFAULT_MAP_STYLE,
          center: [longitude, latitude],
          zoom: 14,
          interactive: false,
        });

        map.on('load', () => {
          setLoading(false);

          // Add marker
          new (maplibregl as any).Marker({ color: '#3B82F6' })
            .setLngLat([longitude, latitude])
            .addTo(map);
        });

        map.on('error', () => {
          setError(true);
          setLoading(false);
        });

        mapRef.current = map;
      } catch (err) {
        setError(true);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-sm text-gray-500">No se pudo cargar el mapa</p>
      </div>
    );
  }

  return (
    <div className="relative h-40 bg-gray-100 rounded-lg overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-sm text-gray-500">Cargando mapa...</div>
        </div>
      )}
    </div>
  );
}
