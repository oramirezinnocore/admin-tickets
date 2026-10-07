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
  const initAttemptedRef = useRef(false);

  // RCA: Instance identity tracking
  const instanceIdRef = useRef(
    Math.random().toString(36).slice(2)
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // RCA: Track every render
  console.log('[CLIENT-MAP-RENDER]', instanceIdRef.current, { latitude, longitude });

  useEffect(() => {
    let cancelled = false;

    console.log('[CLIENT-MAP-MOUNT]', instanceIdRef.current);
    console.log('[ClientMapPreview] Component mounted', { latitude, longitude });

    const initMap = async () => {
      // Guard: only initialize ONCE per component mount
      if (cancelled || mapRef.current || initAttemptedRef.current) {
        console.log('[ClientMapPreview] Init skipped:', {
          cancelled,
          mapExists: !!mapRef.current,
          attempted: initAttemptedRef.current
        });
        return;
      }

      if (!mapContainerRef.current) {
        console.log('[ClientMapPreview] Container ref not available');
        return;
      }

      // Verify container has valid dimensions
      const rect = mapContainerRef.current.getBoundingClientRect();
      console.log('[ClientMapPreview] Container dimensions:', {
        width: rect.width,
        height: rect.height
      });

      if (rect.width < 50 || rect.height < 50) {
        console.warn('[ClientMapPreview] Container dimensions too small, waiting...');
        return;
      }

      initAttemptedRef.current = true;
      console.log('[ClientMapPreview] Starting map initialization...');

      try {
        const maplibregl = await initMapLibre();
        console.log('[ClientMapPreview] MapLibre GL loaded');

        if (cancelled || !mapContainerRef.current) {
          console.log('[ClientMapPreview] Cancelled after lib load');
          return;
        }

        console.log('[ClientMapPreview] Creating map instance...');

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

          // Diagnostic proof logging
          console.log('[CLIENT-MAP-PROOF]', {
            coords: [longitude, latitude],
            width: mapContainerRef.current?.clientWidth,
            height: mapContainerRef.current?.clientHeight,
            mapLoaded: map?.loaded(),
            styleLoaded: map?.isStyleLoaded(),
            canvas: !!map?.getCanvas(),
            canvasWidth: map?.getCanvas()?.width,
            canvasHeight: map?.getCanvas()?.height
          });

          // Ensure map is properly sized
          requestAnimationFrame(() => {
            if (mapContainerRef.current && !cancelled) {
              const rect = mapContainerRef.current.getBoundingClientRect();
              console.log('[ClientMapPreview] Post-load resize:', {
                width: rect.width,
                height: rect.height
              });
              if (rect.width > 0 && rect.height > 0) {
                map.resize();
                console.log('[CLIENT-MAP-PROOF] Post-resize:', {
                  canvasWidth: map?.getCanvas()?.width,
                  canvasHeight: map?.getCanvas()?.height
                });
              }
            }
          });

          console.log('[ClientMapPreview] Setting loading to false');
          setLoading(false);

          // RCA: Verify DOM state before potential unmount
          console.log('[CLIENT-MAP-DOM]', {
            connected: mapContainerRef.current?.isConnected,
            childCount: mapContainerRef.current?.childElementCount,
            canvasExists: !!map?.getCanvas(),
            canvasRect: map?.getCanvas()?.getBoundingClientRect(),
            containerRect: mapContainerRef.current?.getBoundingClientRect()
          });

          console.log('[CLIENT-MAP-FINAL]', {
            width: mapContainerRef.current?.clientWidth,
            height: mapContainerRef.current?.clientHeight,
            mapLoaded: mapRef.current?.loaded(),
            styleLoaded: mapRef.current?.isStyleLoaded(),
            canvasWidth: mapRef.current?.getCanvas()?.width,
            canvasHeight: mapRef.current?.getCanvas()?.height
          });

          // Add marker
          console.log('[ClientMapPreview] Adding marker at:', [longitude, latitude]);
          new (maplibregl as any).Marker({ color: '#3B82F6' })
            .setLngLat([longitude, latitude])
            .addTo(map);
          console.log('[ClientMapPreview] Marker added');
        });

        map.on('error', (e: any) => {
          console.error('[ClientMapPreview] Map error:', e);
          console.error('[CLIENT-MAP-ERROR-RCA]', e.error ?? e);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        });

        // RCA: Capture detailed state after idle
        map.once('idle', () => {
          console.log('[ClientMapPreview] Map idle event fired');

          // DOM inspection
          const container = mapContainerRef.current;
          const canvas = map.getCanvas();
          const canvasContainer = canvas?.parentElement;

          console.log('[CLIENT-MAP-CANVAS-RCA]', {
            containerConnected: container?.isConnected,
            containerRect: container?.getBoundingClientRect(),

            containerChildren: container
              ? Array.from(container.children).map((el: any) => ({
                  tag: el.tagName,
                  className: el.className,
                  rect: el.getBoundingClientRect()
                }))
              : [],

            canvasExists: !!canvas,
            canvasConnected: canvas?.isConnected,
            canvasWidthAttribute: canvas?.width,
            canvasHeightAttribute: canvas?.height,
            canvasClientWidth: canvas?.clientWidth,
            canvasClientHeight: canvas?.clientHeight,
            canvasRect: canvas?.getBoundingClientRect(),

            canvasComputedStyle: canvas
              ? {
                  display: getComputedStyle(canvas).display,
                  visibility: getComputedStyle(canvas).visibility,
                  opacity: getComputedStyle(canvas).opacity,
                  position: getComputedStyle(canvas).position,
                  width: getComputedStyle(canvas).width,
                  height: getComputedStyle(canvas).height,
                  transform: getComputedStyle(canvas).transform,
                  zIndex: getComputedStyle(canvas).zIndex
                }
              : null,

            canvasContainerClass: canvasContainer?.className,
            canvasContainerRect: canvasContainer?.getBoundingClientRect(),

            canvasContainerStyle: canvasContainer
              ? {
                  display: getComputedStyle(canvasContainer).display,
                  visibility: getComputedStyle(canvasContainer).visibility,
                  opacity: getComputedStyle(canvasContainer).opacity,
                  position: getComputedStyle(canvasContainer).position,
                  width: getComputedStyle(canvasContainer).width,
                  height: getComputedStyle(canvasContainer).height
                }
              : null
          });

          // Map state inspection
          console.log('[CLIENT-MAP-STATE-RCA]', {
            loaded: map.loaded(),
            styleLoaded: map.isStyleLoaded(),
            center: map.getCenter(),
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),

            styleLayers: map.getStyle()?.layers?.length,
            styleSources: Object.keys(map.getStyle()?.sources ?? {}),
            styleSourceList: map.getStyle()?.sources
              ? Object.entries(map.getStyle()?.sources ?? {}).map(([key, value]: [string, any]) => ({
                  name: key,
                  type: value.type
                }))
              : [],

            containerRect: map.getContainer()?.getBoundingClientRect(),
            canvasRect: map.getCanvas()?.getBoundingClientRect()
          });

          // WebGL inspection (read-only, non-destructive)
          // Note: We use painter's context to avoid creating a new one
          try {
            const painter = (map as any).painter;
            const gl = painter?.gl;

            console.log('[CLIENT-MAP-WEBGL-RCA]', {
              painterExists: !!painter,
              contextExists: !!gl,
              drawingBufferWidth: gl?.drawingBufferWidth,
              drawingBufferHeight: gl?.drawingBufferHeight,
              contextLost: gl?.isContextLost?.(),
              glError: gl?.getError?.(),
              // Additional context info
              maxTextureSize: gl?.getParameter?.(gl.MAX_TEXTURE_SIZE),
              vendor: gl?.getParameter?.(gl.VENDOR),
              renderer: gl?.getParameter?.(gl.RENDERER)
            });
          } catch (err) {
            console.error('[CLIENT-MAP-WEBGL-RCA] Error inspecting WebGL:', err);
          }

          // CSS inspection
          console.log('[CLIENT-MAP-CSS-RCA]', {
            maplibreGLCSSLoaded: !!document.querySelector('link[href*="maplibre-gl"]'),
            canvasHasMapLibreClass: canvas?.className.includes('maplibre'),
            containerHasMapLibreClass: container?.className.includes('maplibre')
          });
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

    // ResizeObserver: only resize existing map, NEVER reinitialize
    if (mapContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          console.log('[ClientMapPreview] ResizeObserver:', { width, height });

          // If map exists and dimensions are valid, resize it
          if (mapRef.current && width > 0 && height > 0) {
            console.log('[ClientMapPreview] Resizing existing map');
            mapRef.current.resize();
          }

          // If map doesn't exist yet and dimensions are valid, try to init
          if (!mapRef.current && !initAttemptedRef.current && width > 0 && height > 0) {
            console.log('[ClientMapPreview] Valid dimensions detected, initializing map');
            initMap();
          }
        }
      });
      resizeObserverRef.current.observe(mapContainerRef.current);
    }

    // Fallback: try after delay if container is ready
    const timeoutId = setTimeout(() => {
      if (!mapRef.current && !initAttemptedRef.current) {
        console.log('[ClientMapPreview] Timeout fallback triggered');
        initMap();
      }
    }, 100);

    return () => {
      console.trace('[CLIENT-MAP-UNMOUNT]', instanceIdRef.current);
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
      initAttemptedRef.current = false;
    };
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="h-48 min-h-[12rem] bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-4">
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
    <div className="relative w-full h-48 min-h-[12rem] bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <div className="text-sm text-gray-600">Cargando mapa...</div>
          </div>
        </div>
      )}
    </div>
  );
}
