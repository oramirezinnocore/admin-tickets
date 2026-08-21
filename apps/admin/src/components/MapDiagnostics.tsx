'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initMapLibre } from '@/lib/maplibre';

interface DiagnosticLog {
  timestamp: string;
  type: 'info' | 'error' | 'warn';
  message: string;
}

interface ResourceStatus {
  name: string;
  url: string;
  status: 'pending' | 'success' | 'error' | 'unknown';
  details?: string;
}

export default function MapDiagnostics() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [resources, setResources] = useState<ResourceStatus[]>([]);

  const addLog = (type: 'info' | 'error' | 'warn', message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setLogs(prev => [...prev, { timestamp, type, message }]);
    console.log(`[MapDiag ${timestamp}]`, message);
  };

  useEffect(() => {
    // Check WebGL support manually (MapLibre v6+ doesn't have supported())
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const isSupported = !!gl;
      setSupported(isSupported);
      addLog('info', `WebGL supported: ${isSupported}`);

      if (!isSupported) {
        addLog('error', 'WebGL not supported in this browser');
        return;
      }
    } catch (e) {
      setSupported(false);
      addLog('error', 'Error checking WebGL support');
      return;
    }

    if (!mapContainerRef.current) return;

    const styleURL = 'https://tiles.openfreemap.org/styles/liberty';
    addLog('info', `Style URL: ${styleURL}`);

    // Load MapLibre dynamically
    const initDiagnostics = async () => {
      addLog('info', 'Loading MapLibre GL dynamically...');
      const maplibregl = await initMapLibre();
      addLog('info', 'MapLibre GL loaded, worker configured');

      if (!mapContainerRef.current) return;

      // Pre-fetch and analyze style
      const initResources: ResourceStatus[] = [
        { name: 'Style JSON', url: styleURL, status: 'pending' },
      ];
      setResources(initResources);

      fetch(styleURL)
      .then(async (response) => {
        const newResources = [...initResources];
        if (response.ok) {
          newResources[0].status = 'success';
          newResources[0].details = `${response.status}`;

          const styleJson = await response.json();
          addLog('info', `Style version: ${styleJson.version}`);
          addLog('info', `Sources: ${Object.keys(styleJson.sources || {}).join(', ')}`);

          // Add sprite resources
          if (styleJson.sprite) {
            newResources.push(
              { name: 'Sprite JSON', url: `${styleJson.sprite}.json`, status: 'unknown' },
              { name: 'Sprite PNG', url: `${styleJson.sprite}.png`, status: 'unknown' }
            );
          }

          // Add glyph resource
          if (styleJson.glyphs) {
            const glyphExample = styleJson.glyphs.replace('{fontstack}', 'Noto Sans Regular').replace('{range}', '0-255');
            newResources.push({ name: 'Glyphs', url: glyphExample, status: 'unknown' });
          }

          // Add tile sources
          Object.entries(styleJson.sources || {}).forEach(([sourceId, source]: [string, any]) => {
            if (source.tiles && source.tiles[0]) {
              const tileExample = source.tiles[0].replace('{z}', '12').replace('{x}', '1024').replace('{y}', '1024');
              newResources.push({ name: `Tile (${sourceId})`, url: tileExample, status: 'unknown' });
            }
          });

          setResources(newResources);
        } else {
          newResources[0].status = 'error';
          newResources[0].details = `${response.status} ${response.statusText}`;
          setResources(newResources);
          addLog('error', `Style fetch failed: ${response.status}`);
        }
      })
        .catch((err) => {
          addLog('error', `Style fetch error: ${err.message}`);
          const newResources = [...initResources];
          newResources[0].status = 'error';
          newResources[0].details = err.message;
          setResources(newResources);
        });

      try {
        const map = new (maplibregl as any).Map({
          container: mapContainerRef.current,
          style: styleURL,
          center: [-101.1949, 19.7037],
          zoom: 12,
        });

      addLog('info', 'Map instance created');

      map.on('styledata', () => {
        addLog('info', 'EVENT: styledata');
      });

      map.on('style.load', () => {
        addLog('info', 'EVENT: style.load');
      });

      map.on('load', () => {
        addLog('info', 'EVENT: load - Map fully loaded!');

        // Log sources
        const style = map.getStyle();
        if (style.sources) {
          Object.keys(style.sources).forEach(sourceId => {
            addLog('info', `Source: ${sourceId}`);
          });
        }

        // Log layers
        if (style.layers) {
          addLog('info', `Layers count: ${style.layers.length}`);
        }
      });

      map.on('idle', () => {
        addLog('info', 'EVENT: idle - Map is idle');
      });

      map.on('sourcedata', (e: any) => {
        if (e.isSourceLoaded && e.sourceId) {
          addLog('info', `Source loaded: ${e.sourceId}`);
        }
      });

      map.on('data', (e: any) => {
        if (e.dataType === 'source' && e.isSourceLoaded) {
          addLog('info', `Data loaded for source: ${e.sourceId || 'unknown'}`);
        }
      });

      map.on('error', (e: any) => {
        const errorMsg = e.error?.message || JSON.stringify(e.error) || 'Unknown error';
        const errorUrl = e.error?.url || '';
        const errorStatus = e.error?.status || '';
        addLog('error', `ERROR: ${errorMsg}`);
        if (errorUrl) addLog('error', `  URL: ${errorUrl}`);
        if (errorStatus) addLog('error', `  Status: ${errorStatus}`);
        if (e.sourceId) addLog('error', `  Source: ${e.sourceId}`);

        // Update resource status
        if (errorUrl) {
          setResources(prev => prev.map(r =>
            r.url === errorUrl || errorUrl.startsWith(r.url.split('{')[0])
              ? { ...r, status: 'error', details: `${errorStatus} ${errorMsg}` }
              : r
          ));
        }
      });

      map.on('dataloading', (e: any) => {
        if (e.dataType === 'source') {
          addLog('info', `Loading data for: ${e.sourceId || 'unknown'}`);
        }
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      mapRef.current = map;

      // Timeout check
      setTimeout(() => {
        if (!map.loaded()) {
          addLog('warn', 'Map not loaded after 15 seconds');
        } else {
          addLog('info', 'Map is loaded (checked after 15s)');
        }
      }, 15000);

      } catch (err: any) {
        addLog('error', `Exception: ${err.message || String(err)}`);
      }
    };

    initDiagnostics();

    return () => {
      if (mapRef.current) {
        addLog('info', 'Cleaning up map');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Map */}
      <div className="flex-1 relative bg-gray-100">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {supported === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
            <div className="text-red-600 text-center p-8">
              <div className="text-xl font-bold mb-2">WebGL No Soportado</div>
              <div>Tu navegador no soporta WebGL requerido para MapLibre</div>
            </div>
          </div>
        )}
      </div>

      {/* Logs Panel */}
      <div className="w-96 bg-gray-900 text-gray-100 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <h2 className="font-bold">Diagnósticos MapLibre</h2>
          <div className="text-xs text-gray-400 mt-1">
            {logs.length} eventos registrados
          </div>
        </div>

        {/* Resources Table */}
        {resources.length > 0 && (
          <div className="p-4 border-b border-gray-700 bg-gray-800">
            <h3 className="font-bold text-sm mb-2">Recursos</h3>
            <div className="space-y-1 text-xs">
              {resources.map((resource, i) => (
                <div
                  key={i}
                  className={`p-2 rounded ${
                    resource.status === 'success'
                      ? 'bg-green-900 text-green-100'
                      : resource.status === 'error'
                      ? 'bg-red-900 text-red-100'
                      : resource.status === 'pending'
                      ? 'bg-yellow-900 text-yellow-100'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="font-semibold">{resource.name}</div>
                  <div className="text-xs opacity-75 truncate">{resource.url}</div>
                  {resource.details && (
                    <div className="text-xs mt-1">
                      {resource.status === 'success' ? '✓' : '✗'} {resource.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="flex-1 p-2 space-y-1 font-mono text-xs overflow-y-auto">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                log.type === 'error'
                  ? 'bg-red-900 text-red-100'
                  : log.type === 'warn'
                  ? 'bg-yellow-900 text-yellow-100'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <span className="text-gray-500">{log.timestamp}</span>{' '}
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
