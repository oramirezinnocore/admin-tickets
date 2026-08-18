'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { supabase } from '@/lib/supabase';
import { getTicketSlaState, TicketSlaState, formatTicketFolio } from '@wisper/shared';

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
  durationSeconds: number;
  polyline: string | null;
  ticketsWithoutLocation: any[];
  warning?: string;
  originUsed?: string;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [tab, setTab] = useState<'locations' | 'route'>('locations');

  // Route optimization state
  const [routeTechId, setRouteTechId] = useState<string>('');
  const [tickets, setTickets] = useState<TicketForRoute[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [optimizing, setOptimizing] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteOptimizationResult | null>(null);

  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    loadTechnicians();

    const interval = setInterval(() => {
      loadTechnicians();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (apiKey && mapRef.current && !map) {
      initMap();
    }
  }, [apiKey]);

  useEffect(() => {
    if (map && tab === 'locations') {
      updateMarkers();
    }
  }, [technicians, map, tab]);

  useEffect(() => {
    if (routeTechId) {
      loadTechnicianTickets(routeTechId);
    } else {
      setTickets([]);
      setSelectedTicketIds(new Set());
    }
  }, [routeTechId]);

  async function initMap() {
    if (!apiKey) return;

    try {
      if (!window.google) {
        await loadGoogleMapsScript(apiKey);
      }

      const newMap = new google.maps.Map(mapRef.current!, {
        center: { lat: 19.4326, lng: -99.1332 },
        zoom: 12,
      });

      setMap(newMap);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function loadGoogleMapsScript(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }

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
    } catch (err: any) {
      console.error('Error loading tickets:', err);
    }
  }

  function updateMarkers() {
    if (!map) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    technicians.forEach(tech => {
      if (!tech.location) return;

      const { latitude, longitude } = tech.location;
      const status = getLocationStatus(tech.location.recorded_at);

      const marker = new google.maps.Marker({
        position: { lat: latitude, lng: longitude },
        map,
        title: tech.profile.full_name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: getStatusColor(status),
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 8px 0;">${tech.profile.full_name}</h3>
            ${tech.zone ? `<p style="margin: 4px 0;"><strong>Zona:</strong> ${tech.zone}</p>` : ''}
            ${tech.vehicle ? `<p style="margin: 4px 0;"><strong>Vehículo:</strong> ${tech.vehicle}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Estado:</strong> ${getStatusLabel(status)}</p>
            <p style="margin: 4px 0;"><strong>Última actualización:</strong> ${getTimeAgo(tech.location.recorded_at)}</p>
            <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank" style="color: #007AFF;">Abrir en Google Maps</a>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        setSelectedTech(tech.id);
      });

      markersRef.current.set(tech.id, marker);
    });
  }

  function centerOnTech(tech: TechnicianWithLocation) {
    if (!map || !tech.location) return;

    map.setCenter({
      lat: tech.location.latitude,
      lng: tech.location.longitude,
    });
    map.setZoom(15);

    const marker = markersRef.current.get(tech.id);
    if (marker) {
      google.maps.event.trigger(marker, 'click');
    }

    setSelectedTech(tech.id);
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

  async function optimizeRoute() {
    if (selectedTicketIds.size === 0) {
      alert('Selecciona al menos un ticket');
      return;
    }

    try {
      setOptimizing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Error al optimizar ruta');
        return;
      }

      const result: RouteOptimizationResult = await response.json();
      setRouteResult(result);
      drawRoute(result);
    } catch (err: any) {
      console.error('Error optimizing route:', err);
      alert('Error al optimizar ruta');
    } finally {
      setOptimizing(false);
    }
  }

  function drawRoute(result: RouteOptimizationResult) {
    if (!map) return;

    clearRoute();

    // Draw polyline if available
    if (result.polyline && window.google?.maps?.geometry?.encoding) {
      const path = window.google.maps.geometry.encoding.decodePath(result.polyline);
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#2563EB',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
      polylineRef.current = polyline;
    }

    // Add numbered markers
    result.orderedTicketIds.forEach((ticketId, index) => {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket || !ticket.client.latitude || !ticket.client.longitude) return;

      const marker = new google.maps.Marker({
        position: {
          lat: ticket.client.latitude,
          lng: ticket.client.longitude,
        },
        map,
        label: {
          text: String(index + 1),
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
        },
        title: `${index + 1}. ${ticket.client.name}`,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 8px 0;">${index + 1}. ${formatTicketFolio(ticket.folio)}</h3>
            <p style="margin: 4px 0;"><strong>Cliente:</strong> ${ticket.client.name}</p>
            <p style="margin: 4px 0;"><strong>Dirección:</strong> ${ticket.client.address}</p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      routeMarkersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (routeMarkersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      routeMarkersRef.current.forEach(marker => {
        const pos = marker.getPosition();
        if (pos) bounds.extend(pos);
      });
      map.fitBounds(bounds);
    }
  }

  function clearRoute() {
    routeMarkersRef.current.forEach(marker => marker.setMap(null));
    routeMarkersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    setRouteResult(null);
  }

  function getLocationStatus(recordedAt: string): 'online' | 'recent' | 'stale' {
    const now = new Date().getTime();
    const recorded = new Date(recordedAt).getTime();
    const diff = (now - recorded) / 1000 / 60;

    if (diff <= 2) return 'online';
    if (diff <= 10) return 'recent';
    return 'stale';
  }

  function getStatusColor(status: 'online' | 'recent' | 'stale'): string {
    switch (status) {
      case 'online':
        return '#10B981';
      case 'recent':
        return '#F59E0B';
      case 'stale':
        return '#6B7280';
    }
  }

  function getStatusLabel(status: 'online' | 'recent' | 'stale'): string {
    switch (status) {
      case 'online':
        return 'En línea';
      case 'recent':
        return 'Reciente';
      case 'stale':
        return 'Desactualizado';
    }
  }

  function getTimeAgo(dateString: string): string {
    const now = new Date().getTime();
    const then = new Date(dateString).getTime();
    const diff = Math.floor((now - then) / 1000 / 60);

    if (diff < 1) return 'Ahora';
    if (diff === 1) return 'Hace 1 min';
    if (diff < 60) return `Hace ${diff} min`;
    const hours = Math.floor(diff / 60);
    if (hours === 1) return 'Hace 1 hora';
    if (hours < 24) return `Hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  }

  const criticalTicketsCount = tickets.filter(t => {
    const selected = selectedTicketIds.has(t.id);
    if (!selected) return false;
    const sla = getTicketSlaState(t.created_at);
    return sla === TicketSlaState.OVERDUE || sla === TicketSlaState.RED;
  }).length;

  if (!apiKey) {
    return (
      <ProtectedLayout>
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Mapa de Técnicos</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <p className="text-yellow-800">
              Configura <strong>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</strong> para visualizar el mapa.
            </p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="h-[calc(100vh-64px)] flex">
        <div className="flex-1" ref={mapRef} />
        <div className="w-96 bg-white border-l overflow-y-auto flex flex-col">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => {
                setTab('locations');
                clearRoute();
              }}
              className={`flex-1 px-4 py-3 font-medium transition ${
                tab === 'locations'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Ubicaciones
            </button>
            <button
              onClick={() => setTab('route')}
              className={`flex-1 px-4 py-3 font-medium transition ${
                tab === 'route'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Optimizar Ruta
            </button>
          </div>

          {/* Tab content */}
          {tab === 'locations' ? (
            <>
              <div className="p-4 border-b">
                <h2 className="text-xl font-bold mb-2">Técnicos</h2>
                <button
                  onClick={loadTechnicians}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Actualizar ubicaciones
                </button>
              </div>
              <TechniciansList
                technicians={technicians}
                loading={loading}
                selectedTech={selectedTech}
                onSelect={centerOnTech}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-xl font-bold mb-2">Optimizar Ruta</h2>
                <select
                  value={routeTechId}
                  onChange={(e) => {
                    setRouteTechId(e.target.value);
                    clearRoute();
                    setSelectedTicketIds(new Set());
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Selecciona técnico</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.profile.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {routeTechId && (
                <>
                  {criticalTicketsCount > 0 && (
                    <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-red-800 text-sm font-medium">
                        ⚠️ Hay {criticalTicketsCount} ticket{criticalTicketsCount > 1 ? 's' : ''} crítico{criticalTicketsCount > 1 ? 's' : ''} en esta selección
                      </p>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="font-semibold mb-2">Tickets activos ({tickets.length})</h3>
                    {tickets.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay tickets activos</p>
                    ) : (
                      <div className="space-y-2">
                        {tickets.map(ticket => {
                          const sla = getTicketSlaState(ticket.created_at);
                          const hasLocation = ticket.client.latitude && ticket.client.longitude;
                          return (
                            <label
                              key={ticket.id}
                              className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                                !hasLocation ? 'opacity-50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTicketIds.has(ticket.id)}
                                onChange={() => toggleTicketSelection(ticket.id)}
                                disabled={!hasLocation}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="font-mono text-sm font-semibold">
                                  {formatTicketFolio(ticket.folio)}
                                </p>
                                <p className="text-sm">{ticket.client.name}</p>
                                <p className="text-xs text-gray-600">{ticket.client.address}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                                      sla === TicketSlaState.OVERDUE
                                        ? 'bg-red-100 text-red-800'
                                        : sla === TicketSlaState.RED
                                        ? 'bg-red-100 text-red-800'
                                        : sla === TicketSlaState.YELLOW
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-green-100 text-green-800'
                                    }`}
                                  >
                                    {sla === TicketSlaState.OVERDUE
                                      ? 'VENCIDO'
                                      : sla === TicketSlaState.RED
                                      ? 'ROJO'
                                      : sla === TicketSlaState.YELLOW
                                      ? 'AMARILLO'
                                      : 'VERDE'}
                                  </span>
                                  {!hasLocation && (
                                    <span className="text-xs text-gray-500">Sin ubicación</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t space-y-2">
                    <button
                      onClick={optimizeRoute}
                      disabled={selectedTicketIds.size === 0 || optimizing}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
                    >
                      {optimizing ? 'Optimizando...' : `Optimizar ruta (${selectedTicketIds.size})`}
                    </button>
                    {routeResult && (
                      <button
                        onClick={clearRoute}
                        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                      >
                        Limpiar ruta
                      </button>
                    )}
                  </div>

                  {routeResult && (
                    <div className="p-4 border-t bg-gray-50">
                      <h3 className="font-semibold mb-2">Resultado</h3>
                      {routeResult.warning && (
                        <p className="text-yellow-700 text-sm mb-2">{routeResult.warning}</p>
                      )}
                      <div className="space-y-1 text-sm">
                        <p>
                          <strong>Distancia:</strong>{' '}
                          {(routeResult.distanceMeters / 1000).toFixed(1)} km
                        </p>
                        <p>
                          <strong>Duración:</strong>{' '}
                          {Math.round(routeResult.durationSeconds / 60)} min
                        </p>
                        {routeResult.originUsed && (
                          <p className="text-xs text-gray-600">
                            Origen:{' '}
                            {routeResult.originUsed === 'technician'
                              ? 'Ubicación del técnico'
                              : 'Primer ticket'}
                          </p>
                        )}
                      </div>
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold mb-2">Orden sugerido:</h4>
                        <ol className="space-y-1 text-sm">
                          {routeResult.orderedTicketIds.map((ticketId, index) => {
                            const ticket = tickets.find(t => t.id === ticketId);
                            return (
                              <li key={ticketId} className="flex items-start gap-2">
                                <span className="font-semibold text-blue-600">{index + 1}.</span>
                                <span>
                                  {ticket
                                    ? `${formatTicketFolio(ticket.folio)} - ${ticket.client.name}`
                                    : ticketId}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                      {routeResult.ticketsWithoutLocation.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-xs text-yellow-800 font-semibold mb-1">
                            Excluidos (sin ubicación):
                          </p>
                          <ul className="text-xs text-yellow-700">
                            {routeResult.ticketsWithoutLocation.map((t: any) => (
                              <li key={t.id}>• {t.clientName}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}

function TechniciansList({
  technicians,
  loading,
  selectedTech,
  onSelect,
}: {
  technicians: TechnicianWithLocation[];
  loading: boolean;
  selectedTech: string | null;
  onSelect?: (tech: TechnicianWithLocation) => void;
}) {
  if (loading) {
    return <div className="p-4 text-center text-gray-500">Cargando...</div>;
  }

  return (
    <div>
      {technicians.map(tech => {
        const status = tech.location ? getLocationStatus(tech.location.recorded_at) : null;
        return (
          <div
            key={tech.id}
            onClick={() => onSelect?.(tech)}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${
              selectedTech === tech.id ? 'bg-blue-50' : ''
            }`}
          >
            <h3 className="font-semibold">{tech.profile.full_name}</h3>
            {tech.zone && <p className="text-sm text-gray-600">Zona: {tech.zone}</p>}
            {tech.location ? (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        status === 'online' ? '#10B981' : status === 'recent' ? '#F59E0B' : '#6B7280',
                    }}
                  />
                  <span className="text-sm text-gray-600">
                    {status === 'online' ? 'En línea' : status === 'recent' ? 'Reciente' : 'Desactualizado'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {getTimeAgo(tech.location.recorded_at)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Sin ubicación</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getLocationStatus(recordedAt: string): 'online' | 'recent' | 'stale' {
  const now = new Date().getTime();
  const recorded = new Date(recordedAt).getTime();
  const diff = (now - recorded) / 1000 / 60;

  if (diff <= 2) return 'online';
  if (diff <= 10) return 'recent';
  return 'stale';
}

function getTimeAgo(dateString: string): string {
  const now = new Date().getTime();
  const then = new Date(dateString).getTime();
  const diff = Math.floor((now - then) / 1000 / 60);

  if (diff < 1) return 'Ahora';
  if (diff === 1) return 'Hace 1 min';
  if (diff < 60) return `Hace ${diff} min`;
  const hours = Math.floor(diff / 60);
  if (hours === 1) return 'Hace 1 hora';
  if (hours < 24) return `Hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? 's' : ''}`;
}
