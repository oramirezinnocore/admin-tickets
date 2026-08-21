# WIS-021-HF25 - Solución MapLibre Worker MIME Error

## Problema Identificado

**Error:** `Failed to load module script: The server responded with a non-JavaScript MIME type of "text/html"`

**Causa raíz:** MapLibre GL v6+ usa ES modules y workers. Next.js/Turbopack no puede servir correctamente el worker de MapLibre desde node_modules, devolviendo HTML (página 404) en lugar del JavaScript del worker.

## Evidencia

```
[Map] Style fetch status: 200
[Map] Style version: 8
[Map] Style sources: ['ne2_shaded', 'openmaptiles']
[Map] EVENT: style.load - Style loaded successfully
[Map] Source loaded: ne2_shaded
```

Pero inmediatamente después:
```
Failed to load module script:
The server responded with a non-JavaScript MIME type of "text/html"
```

Y MapLibre nunca llega a `EVENT: load`.

## FAILED_URL

El worker de MapLibre intentando cargar desde node_modules:
- Ruta esperada: `/_next/static/chunks/node_modules/maplibre-gl/dist/maplibre-gl-worker.js`
- Content-Type recibido: `text/html` (página 404 de Next.js)
- Content-Type esperado: `application/javascript`

## Solución

### Opción 1: Worker desde CDN (RECOMENDADO para producción rápida)

Configurar `workerUrl` para usar CDN de unpkg:

```typescript
// Importar dinámicamente
const maplibregl = await import('maplibre-gl');

// Configurar worker URL
(maplibregl as any).workerUrl = 'https://unpkg.com/maplibre-gl@6.4.1/dist/maplibre-gl-worker.js';

// Crear mapa
const map = new (maplibregl as any).Map({...});
```

**Ventajas:**
- Funciona inmediatamente
- No requiere configuración de Next.js/Turbopack
- CDN rápido y confiable
- Sin cambios en build

**Desventajas:**
- Depende de CDN externo
- Requiere conexión a internet

### Opción 2: Worker desde public/ (ALTERNATIVA)

1. Copiar worker a public:
```bash
cp node_modules/maplibre-gl/dist/maplibre-gl-worker.js public/
```

2. Configurar:
```typescript
(maplibregl as any).workerUrl = '/maplibre-gl-worker.js';
```

**Ventajas:**
- Self-hosted
- No depende de CDN
- Funciona offline

**Desventajas:**
- Requiere mantener worker actualizado manualmente
- Aumenta tamaño del build
- Puede quedar desactualizado vs versión en node_modules

### Opción 3: Configurar Turbopack (NO RECOMENDADO - complejo)

Agregar configuración para que Turbopack sirva el worker correctamente.

**No recomendado** porque:
- Turbopack aún es experimental
- Configuración compleja y propensa a cambios
- Las opciones 1 y 2 son más simples

## Implementación Opción 1 (CDN)

### apps/admin/src/app/map/page.tsx

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
// ... otros imports ...

// NO importar maplibregl estáticamente
// import * as maplibregl from 'maplibre-gl'; // ❌ REMOVER

// Importar solo CSS estáticamente
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Importar dinámicamente
    const initMap = async () => {
      const maplibregl = await import('maplibre-gl');
      
      // Configurar worker
      (maplibregl as any).workerUrl = 'https://unpkg.com/maplibre-gl@6.4.1/dist/maplibre-gl-worker.js';
      
      // Inicializar mapa
      const map = new (maplibregl as any).Map({
        container: mapContainerRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [-101.1949, 19.7037],
        zoom: 12,
      });

      map.on('load', () => {
        console.log('Map loaded!');
      });

      mapRef.current = map;
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  return (
    // ... JSX ...
  );
}
```

### apps/admin/src/components/MapLocationPicker.tsx

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapLocationPicker({...}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      const maplibregl = await import('maplibre-gl');
      (maplibregl as any).workerUrl = 'https://unpkg.com/maplibre-gl@6.4.1/dist/maplibre-gl-worker.js';
      
      const map = new (maplibregl as any).Map({...});
      mapRef.current = map;
    };

    initMap();
  }, []);

  return (
    // ... JSX ...
  );
}
```

## Validación

Después de aplicar el fix, en Console del browser deberías ver:

```
[Map] Loading MapLibre GL dynamically...
[Map] MapLibre GL loaded, worker configured
[Map] Map instance created
[Map] EVENT: styledata
[Map] EVENT: style.load - Style loaded successfully
[Map] Source loaded: ne2_shaded
[Map] Source loaded: openmaptiles
[Map] EVENT: load - Map fully loaded!      ← ✅ ESTO DEBE APARECER
[Map] Layers: 119
[Map] EVENT: idle - Map is idle
```

Y en Network tab:

```
✅ https://unpkg.com/maplibre-gl@6.4.1/dist/maplibre-gl-worker.js
   Status: 200 OK
   Type: script
   Content-Type: application/javascript
```

## Resultado Esperado

- ✅ Calles visibles
- ✅ Labels visibles
- ✅ Zoom funcional
- ✅ Markers visibles
- ✅ NO error MIME type
- ✅ MapLibre EVENT: load se dispara

## NO Modificar

- Push Notifications ✅
- Supabase Realtime ✅
- iOS credentials/provisioning ✅
- APNs configuration ✅
- Technician location tracking ✅
- Rutas sugeridas ✅

## Archivos a Modificar

1. `apps/admin/src/app/map/page.tsx`
2. `apps/admin/src/components/MapLocationPicker.tsx`
3. `apps/admin/src/components/MapDiagnostics.tsx`

## Testing

1. `npm run dev`
2. Abrir `/map-debug`
3. Verificar Console logs
4. Verificar Network tab (worker desde unpkg)
5. Verificar mapa visible con calles
6. Abrir `/map`
7. Verificar mismo comportamiento
8. Abrir `/clients` → Crear → Seleccionar ubicación
9. Verificar modal de mapa funciona

## Notas Adicionales

- MapLibre GL v6.4.1 es la versión actual
- unpkg.com es un CDN confiable para npm packages
- El worker tiene ~150KB sin comprimir
- CDN usa HTTP/2 + Brotli compression
- Cache-Control: public, max-age=31536000
- No requiere API key ni autenticación
