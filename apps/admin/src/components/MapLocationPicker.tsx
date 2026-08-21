'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { hasValidCoordinates, DEFAULT_MAP_STYLE, MORELIA_CENTER } from '@wisper/shared';

interface MapLocationPickerProps {
  initialLatitude?: number;
  initialLongitude?: number;
  onLocationSelect: (latitude: number, longitude: number) => void;
  onCancel: () => void;
}

export default function MapLocationPicker({
  initialLatitude,
  initialLongitude,
  onLocationSelect,
  onCancel,
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [latitude, setLatitude] = useState(initialLatitude || MORELIA_CENTER[1]);
  const [longitude, setLongitude] = useState(initialLongitude || MORELIA_CENTER[0]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    setMapLoading(true);
    setMapError('');

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: DEFAULT_MAP_STYLE,
          center: [longitude, latitude],
          zoom: initialLatitude && initialLongitude ? 15 : 12,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          console.log('[MapLocationPicker] Map loaded');
          setMapLoading(false);
          map.resize();
        });

        map.on('error', (e) => {
          console.error('[MapLocationPicker] Map error:', e);
          const errorMessage = e.error?.message || 'Error desconocido';
          setMapError(`No fue posible cargar el mapa: ${errorMessage}`);
          setMapLoading(false);
        });

        // Timeout fallback
        const loadTimeout = setTimeout(() => {
          if (mapLoading) {
            setMapError('El mapa tardó demasiado en cargar');
            setMapLoading(false);
          }
        }, 10000);

        map.once('load', () => {
          clearTimeout(loadTimeout);
        });

        // Create initial marker
        const marker = new maplibregl.Marker({
          draggable: true,
          color: '#007AFF',
        })
          .setLngLat([longitude, latitude])
          .addTo(map);

        // Update coordinates when marker is dragged
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          setLatitude(lngLat.lat);
          setLongitude(lngLat.lng);
        });

        // Update marker position on map click
        map.on('click', (e) => {
          marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
          setLatitude(e.lngLat.lat);
          setLongitude(e.lngLat.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
      } catch (err) {
        console.error('[MapLocationPicker] Failed to initialize:', err);
        setMapError('Error al inicializar el mapa');
        setMapLoading(false);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, []);

  function handleRetryMap() {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // Trigger re-initialization by updating a key or similar
    // For now, we'll just show the error - user can cancel and reopen
    setMapError('');
    setMapLoading(true);

    setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: DEFAULT_MAP_STYLE,
          center: [longitude, latitude],
          zoom: initialLatitude && initialLongitude ? 15 : 12,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          setMapLoading(false);
          map.resize();
        });

        map.on('error', (e) => {
          console.error('[MapLocationPicker] Map error:', e);
          setMapError('No fue posible cargar el mapa');
          setMapLoading(false);
        });

        const marker = new maplibregl.Marker({
          draggable: true,
          color: '#007AFF',
        })
          .setLngLat([longitude, latitude])
          .addTo(map);

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          setLatitude(lngLat.lat);
          setLongitude(lngLat.lng);
        });

        map.on('click', (e) => {
          marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
          setLatitude(e.lngLat.lat);
          setLongitude(e.lngLat.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
      } catch (err) {
        console.error('[MapLocationPicker] Retry failed:', err);
        setMapError('Error al inicializar el mapa');
        setMapLoading(false);
      }
    }, 100);
  }

  function handleConfirm() {
    // Validate coordinates before confirming
    if (!hasValidCoordinates(latitude, longitude)) {
      alert('Las coordenadas seleccionadas no son válidas');
      return;
    }
    onLocationSelect(latitude, longitude);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Seleccionar ubicación en mapa</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Map container */}
        <div className="flex-1 relative min-h-[500px] bg-gray-100">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* Loading state */}
          {mapLoading && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="text-gray-700">Cargando mapa...</div>
              </div>
            </div>
          )}

          {/* Error state */}
          {mapError && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg max-w-md">
              <div className="text-center">
                <div className="text-red-600 mb-3">{mapError}</div>
                <button
                  onClick={handleRetryMap}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Coordinates display and actions */}
        <div className="px-6 py-4 border-t space-y-3">
          <div className="text-sm text-gray-600">
            <div className="font-medium mb-1">Coordenadas seleccionadas:</div>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div>
                <span className="text-gray-500">Latitud:</span> {latitude.toFixed(6)}
              </div>
              <div>
                <span className="text-gray-500">Longitud:</span> {longitude.toFixed(6)}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            💡 Haz clic en el mapa o arrastra el marcador para cambiar la ubicación
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Usar esta ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
