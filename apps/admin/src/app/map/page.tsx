'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distanceMeters: number;
  durationSeconds: number;
  legs: Array<{
    distanceMeters: number;
    durationSeconds: number;
  }>;
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

function getLocationTitle(status: LocationStatus): string {
  switch (status) {
    case 'online':
      return 'Ubicación actual';
    case 'recent':
      return 'Última ubicación';
    case 'stale':
      return 'Última ubicación conocida';
  }
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
  const mapContainerNodeRef = useRef<HTMLDivElement | null>(null);
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

  // Cache for technician addresses: techId:lat:lng -> address
  const addressCacheRef = useRef<Map<string, string>>(new Map());

  // Map initialization state
  const initializingRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const generationRef = useRef(0);

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

  // Initialize map for a given node
  const initializeMapForNode = useCallback(async (node: HTMLDivElement) => {
    const startTime = performance.now();
    console.log('[MAP41][INIT_START]', {
      hasNode: !!node,
      isConnected: node?.isConnected,
      hasMap: !!mapRef.current,
      initializing: initializingRef.current,
      time: startTime
    });

    if (!node || !node.isConnected) {
      console.log('[MAP41] Node not connected');
      return;
    }

    if (mapRef.current) {
      console.log('[MAP41] Map already exists');
      return;
    }

    if (initializingRef.current) {
      console.log('[MAP41] Already initializing');
      return;
    }

    const rect = node.getBoundingClientRect();
    console.log('[MAP41][DIMENSIONS]', {
      width: rect.width,
      height: rect.height,
      time: performance.now()
    });

    if (rect.width <= 100 || rect.height <= 100) {
      console.log('[MAP41] Invalid dimensions, skipping');
      return;
    }

    initializingRef.current = true;
    const generation = ++generationRef.current;
    console.log('[MAP41] Generation:', generation);

    try {
      const maplibregl = await initMapLibre();
      console.log('[MAP41][LIB_READY]', {
        generation,
        currentGen: generationRef.current,
        isConnected: node.isConnected,
        time: performance.now()
      });

      // Check generation and node
      if (generation !== generationRef.current) {
        console.log('[MAP41] Generation mismatch, aborting');
        return;
      }

      if (!node.isConnected) {
        console.log('[MAP41] Node disconnected after lib load');
        return;
      }

      if (mapRef.current) {
        console.log('[MAP41] Map created by another process');
        return;
      }

      const map = new (maplibregl as any).Map({
        container: node,
        style: DEFAULT_MAP_STYLE,
        center: MORELIA_CENTER,
        zoom: 12,
      });

      console.log('[MAP41][MAP_CREATED]', {
        generation,
        time: performance.now()
      });

      // Check canvas
      requestAnimationFrame(() => {
        const canvas = node.querySelector('.maplibregl-canvas');
        console.log('[MAP41][CANVAS_CHECK]', {
          exists: !!canvas,
          width: (canvas as any)?.width,
          height: (canvas as any)?.height,
          clientWidth: (canvas as any)?.clientWidth,
          clientHeight: (canvas as any)?.clientHeight,
        });
      });

      map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

      map.on('styledata', () => {
        console.log('[MAP41][STYLE_DATA]', { time: performance.now() });
      });

      map.on('load', () => {
        console.log('[MAP41][LOAD]', { time: performance.now() });
        if (node.isConnected) {
          setMapLoading(false);
          map.resize();
        }
      });

      map.on('idle', () => {
        console.log('[MAP41][IDLE]', { time: performance.now() });
      });

      map.on('error', (e: any) => {
        console.error('[MAP41][ERROR]', e, { time: performance.now() });
        const errorMessage = e.error?.message || 'Error desconocido';
        setMapError(`No fue posible cargar el mapa: ${errorMessage}`);
        setMapLoading(false);
      });

      mapRef.current = map;
      console.log('[MAP41][MAP_ASSIGNED]', { time: performance.now() });

    } catch (err: any) {
      console.error('[MAP41][INIT_FAILED]', err, { time: performance.now() });
      setMapError('Error al inicializar el mapa');
      setMapLoading(false);
    } finally {
      initializingRef.current = false;
      console.log('[MAP41][INIT_COMPLETE]', {
        duration: performance.now() - startTime
      });
    }
  }, []);

  // Callback ref for map container
  const handleMapContainerRef = useCallback((node: HTMLDivElement | null) => {
    const refTime = performance.now();
    console.log('[MAP41][REF]', {
      hasNode: !!node,
      isConnected: node?.isConnected,
      width: node?.getBoundingClientRect().width,
      height: node?.getBoundingClientRect().height,
      time: refTime
    });

    mapContainerNodeRef.current = node;

    if (node) {
      // Setup ResizeObserver for this node
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;

          console.log('[MAP41][RESIZE_OBSERVER]', {
            width,
            height,
            hasMap: !!mapRef.current,
            time: performance.now()
          });

          // Try to init if not yet initialized and dimensions are valid
          if (
            width > 100 &&
            height > 100 &&
            !mapRef.current &&
            !initializingRef.current &&
            node.isConnected
          ) {
            console.log('[MAP41] ResizeObserver triggering init');
            initializeMapForNode(node);
          }

          // Resize existing map
          if (mapRef.current && width > 0 && height > 0) {
            mapRef.current.resize();
          }
        }
      });

      resizeObserverRef.current.observe(node);

      // Try immediate init
      requestAnimationFrame(() => {
        if (node.isConnected && !mapRef.current && !initializingRef.current) {
          initializeMapForNode(node);
        }
      });
    } else {
      // Node removed
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    }
  }, [initializeMapForNode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[MAP41][CLEANUP]', {
        hasMap: !!mapRef.current,
        time: performance.now()
      });

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (mapRef.current) {
        console.log('[MAP41][MAP_REMOVED]', { time: performance.now() });
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

  async function reverseGeocodeForTechnician(
    techId: string,
    lat: number,
    lng: number,
    popup: any
  ) {
    console.log('[TechAddress] start', { techId, lat, lng });

    // Build cache key
    const cacheKey = `${techId}:${lat.toFixed(5)}:${lng.toFixed(5)}`;

    // Check cache
    const cached = addressCacheRef.current.get(cacheKey);
    if (cached) {
      console.log('[TechAddress] cache hit', { cacheKey, cached });

      // Wait for next frame to ensure popup is rendered
      requestAnimationFrame(() => {
        const popupElement = popup.getElement();
        if (!popupElement) {
          console.warn('[TechAddress] popup element not found (cache)');
          return;
        }
        const addressElement = popupElement.querySelector('.tech-address');
        if (addressElement) {
          addressElement.textContent = cached;
          console.log('[TechAddress] updated from cache');
        } else {
          console.warn('[TechAddress] .tech-address element not found (cache)');
        }
      });
      return;
    }

    console.log('[TechAddress] cache miss, fetching');

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[TechAddress] timeout');
      controller.abort();
    }, 10000);

    try {
      const url = `/api/reverse-geocode?lat=${lat}&lon=${lng}`;
      console.log('[TechAddress] request URL:', url);

      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      console.log('[TechAddress] response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[TechAddress] response data:', data);

      let addressText = 'Dirección no disponible';

      if (data.address && data.address.label) {
        addressText = data.address.label;
        // Cache successful result
        addressCacheRef.current.set(cacheKey, addressText);
        console.log('[TechAddress] cached address:', addressText);
      } else {
        console.warn('[TechAddress] no address in response');
      }

      // Wait for next frame to ensure popup is rendered
      requestAnimationFrame(() => {
        const popupElement = popup.getElement();
        if (!popupElement) {
          console.warn('[TechAddress] popup element not found');
          return;
        }
        const addressElement = popupElement.querySelector('.tech-address');
        if (addressElement) {
          addressElement.textContent = addressText;
          console.log('[TechAddress] success');
        } else {
          console.warn('[TechAddress] .tech-address element not found');
        }
      });
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error('[TechAddress] aborted/timeout');
      } else {
        console.error('[TechAddress] error:', error.message);
      }

      // Show fallback with coordinates
      requestAnimationFrame(() => {
        const popupElement = popup.getElement();
        if (!popupElement) return;
        const addressElement = popupElement.querySelector('.tech-address');
        if (addressElement) {
          addressElement.innerHTML = `Dirección no disponible<br><span style="font-size: 11px; color: #9ca3af;">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>`;
          console.log('[TechAddress] fallback shown');
        }
      });
    } finally {
      console.log('[TechAddress] finished');
    }
  }

  function buildTechnicianPopupContent(tech: TechnicianWithLocation): string {
    if (!tech.location) return '';

    const status = getLocationStatus(tech.location.recorded_at);
    const color = getStatusColor(status);
    const locationTitle = getLocationTitle(status);

    return `
      <div style="padding: 12px; min-width: 240px; max-width: 280px;">
        <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #111827;">
          ${tech.profile.full_name}
        </div>

        <div style="display: inline-block; padding: 3px 10px; border-radius: 12px; background-color: ${color}; color: white; font-size: 11px; font-weight: 600; margin-bottom: 12px;">
          ${getStatusLabel(status)}
        </div>

        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 6px;">
            ${locationTitle}
          </div>
          <div class="tech-address" style="font-size: 13px; color: #374151; line-height: 1.4;">
            Obteniendo dirección...
          </div>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
            Actualizada ${formatTimeAgo(tech.location.recorded_at).toLowerCase()}
          </div>
        </div>

        ${tech.zone || tech.vehicle ? `
          <div style="padding-top: 12px; border-top: 1px solid #e5e7eb; margin-bottom: 12px;">
            ${tech.zone ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 3px;"><span style="font-weight: 500;">Zona:</span> ${tech.zone}</div>` : ''}
            ${tech.vehicle ? `<div style="font-size: 12px; color: #6b7280;"><span style="font-weight: 500;">Vehículo:</span> ${tech.vehicle}</div>` : ''}
          </div>
        ` : ''}

        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <a
            href="https://www.openstreetmap.org/?mlat=${tech.location.latitude}&mlon=${tech.location.longitude}#map=17/${tech.location.latitude}/${tech.location.longitude}"
            target="_blank"
            style="color: #007AFF; font-size: 13px; text-decoration: none; font-weight: 500;"
          >
            Abrir ubicación →
          </a>
        </div>
      </div>
    `;
  }

  function setupPopupWithReverseGeocode(
    popup: any,
    tech: TechnicianWithLocation
  ) {
    // Trigger reverse geocoding when popup opens (on-demand)
    popup.on('open', () => {
      console.log('[Map] Popup opened for technician:', tech.profile.full_name);
      if (tech.location) {
        reverseGeocodeForTechnician(
          tech.id,
          tech.location.latitude,
          tech.location.longitude,
          popup
        );
      }
    });
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

        // Update popup content AND setup event listener
        const popupContent = buildTechnicianPopupContent(tech);
        const popup = new (maplibregl as any).Popup({ offset: 25 }).setHTML(popupContent);
        setupPopupWithReverseGeocode(popup, tech);
        existingMarker.setPopup(popup);
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

        const popupContent = buildTechnicianPopupContent(tech);
        const popup = new (maplibregl as any).Popup({ offset: 25 }).setHTML(popupContent);
        setupPopupWithReverseGeocode(popup, tech);

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

      const response = await fetch('/api/routes/driving', {
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
        throw new Error(data.error || 'Error calculando ruta');
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

    // Use OSRM geometry (follows streets)
    const routeGeometry = result.geometry;

    // Add GeoJSON source
    if (mapRef.current.getSource(routeSourceId)) {
      (mapRef.current.getSource(routeSourceId) as any).setData({
        type: 'Feature',
        properties: {},
        geometry: routeGeometry,
      });
    } else {
      mapRef.current.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeometry,
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

    // Add numbered markers for ticket destinations
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

    // Fit bounds to OSRM route geometry
    if (routeGeometry.coordinates.length > 1) {
      const bounds = new (maplibregl as any).LngLatBounds();
      routeGeometry.coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
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
            <div ref={handleMapContainerRef} className="absolute inset-0 w-full h-full" />

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

                      <div className="space-y-2">
                        <div className="p-3 bg-blue-50 rounded-md">
                          <div className="text-sm font-medium text-blue-900">
                            Distancia por carretera
                          </div>
                          <div className="text-2xl font-bold text-blue-900">
                            {(routeResult.distanceMeters / 1000).toFixed(1)} km
                          </div>
                        </div>

                        <div className="p-3 bg-green-50 rounded-md">
                          <div className="text-sm font-medium text-green-900">
                            Tiempo estimado de recorrido
                          </div>
                          <div className="text-2xl font-bold text-green-900">
                            {Math.round(routeResult.durationSeconds / 60)} min
                          </div>
                        </div>
                      </div>

                      {hasCriticalInSelection && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                          Hay tickets prioritarios en esta selección
                        </div>
                      )}

                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">
                        El tiempo es estimado y no considera tráfico en tiempo real.
                        El orden se calcula por proximidad geográfica.
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
