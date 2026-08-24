'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { hasValidCoordinates, DEFAULT_MAP_STYLE, MORELIA_CENTER } from '@wisper/shared';
import { initMapLibre } from '@/lib/maplibre';

interface MapLocationPickerProps {
  initialLatitude?: number;
  initialLongitude?: number;
  initialAddress?: string;
  onLocationSelect: (latitude: number, longitude: number) => void;
  onCancel: () => void;
}

interface GeocodeResult {
  id: string;
  name: string;
  street: string;
  housenumber: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export default function MapLocationPicker({
  initialLatitude,
  initialLongitude,
  initialAddress,
  onLocationSelect,
  onCancel,
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initAttemptedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [latitude, setLatitude] = useState(initialLatitude || MORELIA_CENTER[1]);
  const [longitude, setLongitude] = useState(initialLongitude || MORELIA_CENTER[0]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');

  // Geocoding state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchError, setSearchError] = useState('');

  // Reverse geocoding state
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '');
  const [reverseLoading, setReverseLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const tryInitializeMap = async () => {
      if (cancelled) return;
      if (mapRef.current) return;
      if (!mapContainerRef.current) return;

      const rect = mapContainerRef.current.getBoundingClientRect();

      if (rect.width < 100 || rect.height < 100) {
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
          zoom: initialLatitude && initialLongitude ? 15 : 12,
        });

        map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

        map.on('load', () => {
          setMapLoading(false);

          requestAnimationFrame(() => {
            if (!mapContainerRef.current) return;
            const rect = mapContainerRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              map.resize();
            }
          });

          if (cancelled) {
            map.remove();
            return;
          }

          const marker = new (maplibregl as any).Marker({
            draggable: true,
            color: '#3B82F6',
          })
            .setLngLat([longitude, latitude])
            .addTo(map);

          marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            const lat = lngLat.lat;
            const lng = lngLat.lng;
            setLatitude(lat);
            setLongitude(lng);
            reverseGeocode(lat, lng);
          });

          map.on('click', (e: any) => {
            const lat = e.lngLat.lat;
            const lng = e.lngLat.lng;
            marker.setLngLat([lng, lat]);
            setLatitude(lat);
            setLongitude(lng);
            reverseGeocode(lat, lng);
          });

          markerRef.current = marker;
        });

        map.on('error', (e: any) => {
          console.error('[MapLocationPicker] Map error:', e);
          const errorMessage = e.error?.message || 'Error desconocido';
          setMapError(`No fue posible cargar el mapa: ${errorMessage}`);
          setMapLoading(false);
        });

        if (cancelled) {
          map.remove();
          return;
        }

        mapRef.current = map;

      } catch (err: any) {
        console.error('[MapLocationPicker] Failed to initialize:', err);
        setMapError('Error al inicializar el mapa');
        setMapLoading(false);
      }
    };

    const setupResizeObserver = () => {
      if (!mapContainerRef.current) return;

      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;

          if (width <= 0 || height <= 0) {
            return;
          }

          if (mapRef.current) {
            mapRef.current.resize();
          } else if (width >= 100 && height >= 100 && !initAttemptedRef.current) {
            tryInitializeMap();
          }
        }
      });

      resizeObserverRef.current.observe(mapContainerRef.current);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setupResizeObserver();
        tryInitializeMap();
      });
    });

    return () => {
      cancelled = true;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      initAttemptedRef.current = false;
    };
  }, []);

  async function reverseGeocode(lat: number, lng: number) {
    // Cancelar request anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setReverseLoading(true);
    setSelectedAddress('Buscando dirección...');

    try {
      const response = await fetch(
        `/api/reverse-geocode?lat=${lat}&lon=${lng}`,
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      const data = await response.json();

      if (!response.ok) {
        console.error('[MapLocationPicker] Reverse geocode error:', data.error);
        setSelectedAddress('Ubicación sin nombre');
        return;
      }

      if (data.address && data.address.label) {
        setSelectedAddress(data.address.label);
      } else {
        setSelectedAddress('Ubicación sin nombre');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[MapLocationPicker] Reverse geocode aborted');
        return;
      }
      console.error('[MapLocationPicker] Reverse geocode error:', error);
      setSelectedAddress('Ubicación sin nombre');
    } finally {
      if (!controller.signal.aborted) {
        setReverseLoading(false);
      }
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();

    if (query.length < 3) {
      setSearchError('La búsqueda debe tener al menos 3 caracteres');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al buscar');
      }

      if (data.results.length === 0) {
        setSearchError('No encontramos esa dirección. Intenta agregar colonia, ciudad o código postal.');
      } else {
        setSearchResults(data.results);
      }
    } catch (error: any) {
      console.error('[MapLocationPicker] Search error:', error);
      setSearchError('No fue posible buscar la dirección. Puedes seleccionar la ubicación manualmente en el mapa.');
    } finally {
      setSearching(false);
    }
  }

  function handleSelectResult(result: GeocodeResult) {
    if (result.latitude === null || result.longitude === null) return;

    const lat = result.latitude;
    const lng = result.longitude;
    const label = formatResultLabel(result);

    setLatitude(lat);
    setLongitude(lng);
    setSelectedAddress(label);
    setSearchQuery(label);

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    }

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        essential: true,
      });
    }

    setSearchResults([]);
  }

  function formatResultLabel(result: GeocodeResult): string {
    const parts: string[] = [];

    if (result.name) parts.push(result.name);
    if (result.street) {
      if (result.housenumber) {
        parts.push(`${result.street} ${result.housenumber}`);
      } else {
        parts.push(result.street);
      }
    }
    if (result.city) parts.push(result.city);
    if (result.state) parts.push(result.state);

    return parts.join(', ') || 'Ubicación sin nombre';
  }

  function handleConfirm() {
    if (!hasValidCoordinates(latitude, longitude)) {
      alert('Las coordenadas seleccionadas no son válidas');
      return;
    }
    onLocationSelect(latitude, longitude);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel();
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] overflow-hidden"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 id="map-picker-title" className="text-lg font-semibold text-gray-900">
              Seleccionar ubicación en mapa
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search bar */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar dirección
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Ej. Av. Camelinas 123, Morelia"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={searching}
              />
              <button
                onClick={handleSearch}
                disabled={searching || searchQuery.trim().length < 3}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                  Resultados encontrados
                </div>
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition text-sm"
                  >
                    <div className="font-medium text-gray-900">{formatResultLabel(result)}</div>
                    {result.postcode && (
                      <div className="text-xs text-gray-500 mt-0.5">CP: {result.postcode}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Search error */}
            {searchError && (
              <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {searchError}
              </div>
            )}
          </div>

          {/* Map container - FIXED HEIGHT */}
          <div className="relative w-full h-[420px] min-h-[420px] flex-shrink-0 bg-gray-100 overflow-hidden">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            {/* Loading state */}
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                <div className="bg-white px-6 py-4 rounded-lg shadow-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                    <div className="text-gray-700 font-medium">Cargando mapa...</div>
                  </div>
                </div>
              </div>
            )}

            {/* Error state */}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                <div className="bg-white px-6 py-4 rounded-lg shadow-lg border border-red-200 max-w-md">
                  <div className="text-center">
                    <div className="text-red-600 mb-3">{mapError}</div>
                    <button
                      onClick={onCancel}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">
                Ubicación seleccionada
              </div>
              {selectedAddress && (
                <div className="text-sm text-gray-900 mb-1.5">
                  {reverseLoading ? (
                    <span className="text-blue-600 italic">Buscando dirección...</span>
                  ) : (
                    selectedAddress
                  )}
                </div>
              )}
              <div className="font-mono text-xs text-gray-600">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-3">
              💡 Busca una dirección o haz clic en el mapa para seleccionar
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={mapLoading || !!mapError}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Usar esta ubicación
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
