'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface DiagnosticLog {
  timestamp: string;
  type: 'info' | 'error' | 'warn';
  message: string;
}

export default function MapDiagnostics() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [supported, setSupported] = useState<boolean | null>(null);

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

    try {
      const map = new maplibregl.Map({
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

      map.on('sourcedata', (e) => {
        if (e.isSourceLoaded && e.sourceId) {
          addLog('info', `Source loaded: ${e.sourceId}`);
        }
      });

      map.on('data', (e) => {
        if (e.dataType === 'source' && e.isSourceLoaded) {
          addLog('info', `Data loaded for source: ${e.sourceId || 'unknown'}`);
        }
      });

      map.on('error', (e) => {
        const errorMsg = e.error?.message || JSON.stringify(e.error) || 'Unknown error';
        addLog('error', `ERROR: ${errorMsg}`);
      });

      map.on('dataloading', (e) => {
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
      <div className="w-96 bg-gray-900 text-gray-100 overflow-y-auto">
        <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-800">
          <h2 className="font-bold">Diagnósticos MapLibre</h2>
          <div className="text-xs text-gray-400 mt-1">
            {logs.length} eventos registrados
          </div>
        </div>
        <div className="p-2 space-y-1 font-mono text-xs">
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
