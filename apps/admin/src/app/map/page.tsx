'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { supabase } from '@/lib/supabase';
import { initMapLibre } from '@/lib/maplibre';
import { getTicketSlaState, TicketSlaState, formatTicketFolio, hasValidCoordinates, DEFAULT_MAP_STYLE, MORELIA_CENTER } from '@wisper/shared';
import 'maplibre-gl/dist/maplibre-gl.css';

interface TechnicianWithLocation {
  id: string;
  zone: string | null;
  vehicle: string | null;
  profile: {
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  location: {
    latitude: number;
    longitude: number;
    recorded_at: string;
  } | null;
}

interface TicketForRoute {
  id: string;
  folio: number;
  status: string;
  created_at: string;
  client: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
}

interface RouteOptimizationResult {
  orderedTicketIds: string[];
  distanceMeters: number;
  ticketsWithoutLocation: TicketForRoute[];
  warning?: string;
}

type LocationStatus = 'online' | 'recent' | 'stale';

function getLocationStatus(recordedAt: string): LocationStatus {
  const now = new Date();
  const recorded = new Date(recordedAt);
  const diffMinutes = (now.getTime() - recorded.getTime()) / (1000 * 60);

  if (diffMinutes <= 2) return 'online';
  if (diffMinutes <= 10) return 'recent';
  return 'stale';
}

function getStatusLabel(status: LocationStatus): string {
  switch (status) {
    case 'online':
      return 'En línea';
    case 'recent':
      return 'Ubicación reciente';
    case 'stale':
      return 'Sin actualización reciente';
  }
}

function getStatusColor(status: LocationStatus): string {
  switch (status) {
    case 'online':
      return '#10B981';
    case 'recent':
      return '#F59E0B';
    case 'stale':
      return '#6B7280';
  }
}

function formatTimeAgo(recordedAt: string): string {
  const now = new Date();
  const recorded = new Date(recordedAt);
  const diffMinutes = Math.floor((now.getTime() - recorded.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return 'Ahora';
  if (diffMinutes === 1) return 'Hace 1 min';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return 'Hace 1 hora';
  if (diffHours < 24) return `Hace ${diffHours} horas`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hace 1 día';
  return `Hace ${diffDays} días`;
}

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [technicians, setTechnicians] = useState<TechnicianWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [tab, setTab] = useState<'locations' | 'route'>('locations');

  // Route optimization state
  const [routeTechId, setRouteTechId] = useState<string>('');
  const [tickets, setTickets] = useState<TicketForRoute[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [optimizing, setOptimizing] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteOptimizationResult | null>(null);

  const markersRef = useRef<Map<string, any>>(new Map());
  const routeMarkersRef = useRef<any[]>([]);
  const routeSourceId = 'route-line';
  const routeLayerId = 'route-line-layer';

  useEffect(() => {
    loadTechnicians();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadTechnicians();
    }, 30000);

    // Refresh when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTechnicians();
        if (routeTechId) {
          loadTechnicianTickets(routeTechId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [routeTechId]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initializeMap = async () => {
      try {
        const maplibregl = await initMapLibre();

        setTimeout(() => {
          if (!mapContainerRef.current || mapRef.current) return;

          try {
            const map = new (maplibregl as any).Map({
              container: mapContainerRef.current,
              style: DEFAULT_MAP_STYLE,
              center: MORELIA_CENTER,
              zoom: 12,
            });

            map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

            map.on('load', () => {
              console.log('[Map] Map loaded successfully');
              setMapLoading(false);
              map.resize();
            });

            map.on('error', (e: any) => {
              console.error('[Map] Map error:', e);
              const errorMessage = e.error?.message || 'Error desconocido';
              setMapError(`No fue posible cargar el mapa: ${errorMessage}`);
              setMapLoading(false);
            });

            mapRef.current = map;
          } catch (err: any) {
            console.error('[Map] Failed to initialize:', err);
            setMapError('Error al inicializar el mapa');
            setMapLoading(false);
          }
        }, 100);
      } catch (err: any) {
        console.error('[Map] Failed to load MapLibre:', err);
        setMapError('Error al cargar MapLibre');
        setMapLoading(false);
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && tab === 'locations') {
      updateMarkers();
    }
  }, [technicians, tab]);

  useEffect(() => {
    if (routeTechId) {
      loadTechnicianTickets(routeTechId);
    } else {
      setTickets([]);
      setSelectedTicketIds(new Set());
    }
  }, [routeTechId]);

  async function loadTechnicians() {
    try {
      setLoading(true);

      const { data: techData } = await supabase
        .from('technicians')
        .select(`
          id,
          zone,
          vehicle,
          is_active,
          profile:profiles(full_name, email, phone)
        `)
        .eq('is_active', true);

      if (!techData) return;

      const { data: locations } = await supabase
        .from('technician_latest_locations')
        .select('*');

      const combined: TechnicianWithLocation[] = techData.map((tech: any) => ({
        ...tech,
        location: locations?.find((l: any) => l.technician_id === tech.id) || null,
      }));

      setTechnicians(combined);

      // Fit bounds to technicians with locations
      if (mapRef.current && combined.length > 0) {
        const techsWithLocation = combined.filter(t => t.location);
        if (techsWithLocation.length > 0) {
          const maplibregl = await initMapLibre();
          const bounds = new (maplibregl as any).LngLatBounds();
          techsWithLocation.forEach(tech => {
            if (tech.location) {
              bounds.extend([tech.location.longitude, tech.location.latitude]);
            }
          });
          mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTechnicianTickets(techId: string) {
    try {
      const { data } = await supabase
        .from('tickets')
        .select(`
          id,
          folio,
          status,
          created_at,
          client:clients(id, name, address, latitude, longitude)
        `)
        .eq('technician_id', techId)
        .in('status', ['PENDING', 'ASSIGNED', 'IN_REVIEW', 'PAUSED'])
        .order('created_at', { ascending: true });

      setTickets((data as any) || []);
      setSelectedTicketIds(new Set());
      setRouteResult(null);
    } catch (err: any) {
      console.error('Error loading tickets:', err);
    }
  }

  async function updateMarkers() {
    if (!mapRef.current) return;

    const maplibregl = await initMapLibre();
    const processedIds = new Set<string>();

    technicians.forEach(tech => {
      processedIds.add(tech.id);

      // Skip technicians without location
      if (!tech.location) {
        // Remove marker if exists (technician lost location)
        const existingMarker = markersRef.current.get(tech.id);
        if (existingMarker) {
          existingMarker.remove();
          markersRef.current.delete(tech.id);
        }
        return;
      }

      const status = getLocationStatus(tech.location.recorded_at);
      const color = getStatusColor(status);
      const existingMarker = markersRef.current.get(tech.id);

      if (existingMarker) {
        // Update existing marker position and color
        existingMarker.setLngLat([tech.location.longitude, tech.location.latitude]);

        // Update marker element color
        const el = existingMarker.getElement();
        el.style.backgroundColor = color;

        // Update popup content
        const popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">${tech.profile.full_name}</div>
            ${tech.zone ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Zona: ${tech.zone}</div>` : ''}
            ${tech.vehicle ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Vehículo: ${tech.vehicle}</div>` : ''}
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${formatTimeAgo(tech.location.recorded_at)}</div>
            <div style="display: inline-block; padding: 2px 8px; border-radius: 12px; background-color: ${color}; color: white; font-size: 11px; font-weight: 500;">
              ${getStatusLabel(status)}
            </div>
            <div style="margin-top: 8px;">
              <a href="https://www.openstreetmap.org/?mlat=${tech.location.latitude}&mlon=${tech.location.longitude}#map=17/${tech.location.latitude}/${tech.location.longitude}" target="_blank" style="color: #007AFF; font-size: 12px; text-decoration: none;">
                Abrir ubicación →
              </a>
            </div>
          </div>
        `;
        existingMarker.setPopup(new (maplibregl as any).Popup({ offset: 25 }).setHTML(popupContent));
      } else {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'technician-marker';
        el.style.backgroundColor = color;
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const marker = new (maplibregl as any).Marker({ element: el })
          .setLngLat([tech.location.longitude, tech.location.latitude])
          .addTo(mapRef.current!);

        const popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">${tech.profile.full_name}</div>
            ${tech.zone ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Zona: ${tech.zone}</div>` : ''}
            ${tech.vehicle ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Vehículo: ${tech.vehicle}</div>` : ''}
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${formatTimeAgo(tech.location.recorded_at)}</div>
            <div style="display: inline-block; padding: 2px 8px; border-radius: 12px; background-color: ${color}; color: white; font-size: 11px; font-weight: 500;">
              ${getStatusLabel(status)}
            </div>
            <div style="margin-top: 8px;">
              <a href="https://www.openstreetmap.org/?mlat=${tech.location.latitude}&mlon=${tech.location.longitude}#map=17/${tech.location.latitude}/${tech.location.longitude}" target="_blank" style="color: #007AFF; font-size: 12px; text-decoration: none;">
                Abrir ubicación →
              </a>
            </div>
          </div>
        `;

        const popup = new (maplibregl as any).Popup({ offset: 25 }).setHTML(popupContent);
        marker.setPopup(popup);

        markersRef.current.set(tech.id, marker);
      }
    });

    // Remove markers for technicians that no longer exist
    markersRef.current.forEach((marker, techId) => {
      if (!processedIds.has(techId)) {
        marker.remove();
        markersRef.current.delete(techId);
      }
    });
  }

  function handleTechnicianClick(techId: string) {
    setSelectedTech(techId);
    const tech = technicians.find(t => t.id === techId);
    if (tech?.location && mapRef.current) {
      mapRef.current.flyTo({
        center: [tech.location.longitude, tech.location.latitude],
        zoom: 14,
      });
      const marker = markersRef.current.get(techId);
      if (marker) {
        marker.togglePopup();
      }
    }
  }

  async function handleOptimizeRoute() {
    if (!routeTechId || selectedTicketIds.size === 0) {
      alert('Selecciona al menos un ticket');
      return;
    }

    setOptimizing(true);
    setRouteResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          technicianId: routeTechId,
          ticketIds: Array.from(selectedTicketIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error optimizing route');
      }

      setRouteResult(data);
      drawRoute(data);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setOptimizing(false);
    }
  }

  async function drawRoute(result: RouteOptimizationResult) {
    if (!mapRef.current) return;

    clearRoute();

    const maplibregl = await initMapLibre();
    const tech = technicians.find(t => t.id === routeTechId);
    if (!tech?.location) return;

    // Build coordinates array
    const coordinates: [number, number][] = [
      [tech.location.longitude, tech.location.latitude],
    ];

    result.orderedTicketIds.forEach(ticketId => {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && hasValidCoordinates(ticket.client.latitude, ticket.client.longitude)) {
        coordinates.push([ticket.client.longitude!, ticket.client.latitude!]);
      }
    });

    // Add GeoJSON source
    if (mapRef.current.getSource(routeSourceId)) {
      (mapRef.current.getSource(routeSourceId) as any).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });
    } else {
      mapRef.current.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });

      mapRef.current.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#007AFF',
          'line-width': 4,
          'line-opacity': 0.8,
        },
      });
    }

    // Add numbered markers
    result.orderedTicketIds.forEach((ticketId, index) => {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && hasValidCoordinates(ticket.client.latitude, ticket.client.longitude)) {
        const el = document.createElement('div');
        el.style.backgroundColor = '#007AFF';
        el.style.color = 'white';
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = '600';
        el.style.fontSize = '14px';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.textContent = (index + 1).toString();

        const marker = new (maplibregl as any).Marker({ element: el })
          .setLngLat([ticket.client.longitude!, ticket.client.latitude!])
          .addTo(mapRef.current!);

        routeMarkersRef.current.push(marker);
      }
    });

    // Fit bounds to route
    if (coordinates.length > 1) {
      const maplibregl = await initMapLibre();
      const bounds = new (maplibregl as any).LngLatBounds();
      coordinates.forEach(coord => bounds.extend(coord));
      mapRef.current.fitBounds(bounds, { padding: 50 });
    }
  }

  function clearRoute() {
    if (!mapRef.current) return;

    // Remove markers
    routeMarkersRef.current.forEach(marker => marker.remove());
    routeMarkersRef.current = [];

    // Remove layer and source
    if (mapRef.current.getLayer(routeLayerId)) {
      mapRef.current.removeLayer(routeLayerId);
    }
    if (mapRef.current.getSource(routeSourceId)) {
      mapRef.current.removeSource(routeSourceId);
    }
  }

  function handleClearRoute() {
    clearRoute();
    setRouteResult(null);
    setSelectedTicketIds(new Set());
  }

  function toggleTicketSelection(ticketId: string) {
    const newSet = new Set(selectedTicketIds);
    if (newSet.has(ticketId)) {
      newSet.delete(ticketId);
    } else {
      newSet.add(ticketId);
    }
    setSelectedTicketIds(newSet);
  }

  const criticalTickets = tickets.filter(t => {
    const sla = getTicketSlaState(t.created_at);
    return sla === TicketSlaState.RED || sla === TicketSlaState.OVERDUE;
  });

  const hasCriticalInSelection = Array.from(selectedTicketIds).some(id => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return false;
    const sla = getTicketSlaState(ticket.created_at);
    return sla === TicketSlaState.RED || sla === TicketSlaState.OVERDUE;
  });

  return (
    <ProtectedLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-2xl font-bold">Mapa de técnicos</h1>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Map */}
          <div className="flex-1 relative bg-gray-100">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            {/* Map loading state */}
            {mapLoading && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <div className="text-gray-700">Cargando mapa...</div>
                </div>
              </div>
            )}

            {/* Map error state */}
            {mapError && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg max-w-md">
                <div className="text-center">
                  <div className="text-red-600 mb-3">{mapError}</div>
                </div>
              </div>
            )}

            {/* Technicians loading state */}
            {loading && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow text-sm">
                Cargando técnicos...
              </div>
            )}

            {/* Technicians error */}
            {error && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-600 px-4 py-2 rounded-lg shadow text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-96 bg-white border-l flex flex-col">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setTab('locations')}
                className={`flex-1 px-4 py-3 font-medium transition ${
                  tab === 'locations'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Ubicaciones
              </button>
              <button
                onClick={() => setTab('route')}
                className={`flex-1 px-4 py-3 font-medium transition ${
                  tab === 'route'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Ruta sugerida
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {tab === 'locations' && (
                <div className="p-4 space-y-2">
                  {technicians.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No hay técnicos activos
                    </div>
                  ) : technicians.filter(t => t.location).length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No hay ubicaciones de técnicos disponibles.
                    </div>
                  ) : null}
                  {technicians.map(tech => {
                    const status = tech.location
                      ? getLocationStatus(tech.location.recorded_at)
                      : null;

                    return (
                      <div
                        key={tech.id}
                        onClick={() => tech.location && handleTechnicianClick(tech.id)}
                        className={`p-4 border rounded-lg transition cursor-pointer ${
                          selectedTech === tech.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">
                          {tech.profile.full_name}
                        </div>
                        {tech.zone && (
                          <div className="text-sm text-gray-600 mt-1">
                            Zona: {tech.zone}
                          </div>
                        )}
                        {tech.location ? (
                          <>
                            <div className="text-xs text-gray-500 mt-2">
                              {formatTimeAgo(tech.location.recorded_at)}
                            </div>
                            <div className="mt-2">
                              <span
                                className="inline-block px-2 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: getStatusColor(status!) }}
                              >
                                {getStatusLabel(status!)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400 mt-2">
                            Sin ubicación registrada
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'route' && (
                <div className="p-4 space-y-4">
                  {/* Technician selector */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Técnico</label>
                    <select
                      value={routeTechId}
                      onChange={e => setRouteTechId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Seleccionar técnico</option>
                      {technicians.map(tech => (
                        <option key={tech.id} value={tech.id}>
                          {tech.profile.full_name}
                          {tech.location ? '' : ' (sin ubicación)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tickets */}
                  {tickets.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">
                        Tickets activos ({tickets.length})
                      </div>

                      {criticalTickets.length > 0 && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                          ⚠️ Hay {criticalTickets.length} ticket
                          {criticalTickets.length > 1 ? 's' : ''} prioritario
                          {criticalTickets.length > 1 ? 's' : ''}
                        </div>
                      )}

                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {tickets.map(ticket => {
                          const sla = getTicketSlaState(ticket.created_at);
                          const hasLocation = hasValidCoordinates(
                            ticket.client.latitude,
                            ticket.client.longitude
                          );

                          return (
                            <label
                              key={ticket.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
                                selectedTicketIds.has(ticket.id)
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              } ${!hasLocation ? 'opacity-50' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTicketIds.has(ticket.id)}
                                onChange={() => toggleTicketSelection(ticket.id)}
                                disabled={!hasLocation}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm font-semibold">
                                  {formatTicketFolio(ticket.folio)}
                                </div>
                                <div className="text-sm text-gray-900">
                                  {ticket.client.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {ticket.client.address}
                                </div>
                                {!hasLocation && (
                                  <div className="mt-1">
                                    <div className="text-xs text-red-600">
                                      Ubicación no configurada
                                    </div>
                                    <a
                                      href={`/clients?edit=${ticket.client.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                                    >
                                      Configurar ubicación
                                    </a>
                                  </div>
                                )}
                                {(sla === TicketSlaState.RED ||
                                  sla === TicketSlaState.OVERDUE) && (
                                  <div className="text-xs text-red-600 font-medium mt-1">
                                    {sla === TicketSlaState.RED ? 'Rojo' : 'Vencido'}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No technician location warning */}
                  {routeTechId &&
                    !technicians.find(t => t.id === routeTechId)?.location && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        ⚠️ No se puede generar la ruta porque el técnico no tiene una
                        ubicación registrada.
                      </div>
                    )}

                  {/* Generate button */}
                  {tickets.length > 0 &&
                    technicians.find(t => t.id === routeTechId)?.location && (
                      <button
                        onClick={handleOptimizeRoute}
                        disabled={optimizing || selectedTicketIds.size === 0}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                      >
                        {optimizing
                          ? 'Generando...'
                          : `Generar ruta sugerida (${selectedTicketIds.size})`}
                      </button>
                    )}

                  {/* Route result */}
                  {routeResult && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Orden sugerido</h3>
                        <button
                          onClick={handleClearRoute}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Limpiar
                        </button>
                      </div>

                      <div className="space-y-2">
                        {routeResult.orderedTicketIds.map((ticketId, index) => {
                          const ticket = tickets.find(t => t.id === ticketId);
                          if (!ticket) return null;

                          return (
                            <div
                              key={ticketId}
                              className="flex items-start gap-3 p-2 bg-gray-50 rounded"
                            >
                              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm font-semibold">
                                  {formatTicketFolio(ticket.folio)}
                                </div>
                                <div className="text-xs text-gray-600 truncate">
                                  {ticket.client.name}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-3 bg-blue-50 rounded-md">
                        <div className="text-sm font-medium text-blue-900">
                          Distancia aproximada:{' '}
                          {(routeResult.distanceMeters / 1000).toFixed(1)} km
                        </div>
                      </div>

                      {hasCriticalInSelection && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                          Hay tickets prioritarios en esta selección
                        </div>
                      )}

                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">
                        El orden se calcula por proximidad geográfica y no considera
                        tráfico ni condiciones viales.
                      </div>

                      {routeResult.ticketsWithoutLocation.length > 0 && (
                        <div className="p-3 bg-gray-50 rounded-md text-xs text-gray-600">
                          No se incluyeron {routeResult.ticketsWithoutLocation.length}{' '}
                          ticket{routeResult.ticketsWithoutLocation.length > 1 ? 's' : ''}{' '}
                          porque no tienen ubicación registrada
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .maplibregl-ctrl-attrib {
          font-size: 11px;
        }
        .maplibregl-popup-content {
          padding: 0;
        }
      `}</style>
    </ProtectedLayout>
  );
}
