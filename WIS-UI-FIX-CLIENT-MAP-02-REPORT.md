# WIS-UI-FIX-CLIENT-MAP-02 — Diagnóstico instrumentado del mapa del cliente

## Estado
**INSTRUMENTADO** 🔍 - Requiere verificación en navegador

## Resumen Ejecutivo

El usuario confirmó que **MAP-01 FAILED** - el recuadro gris sigue apareciendo después de aplicar WIS-UI-FIX-CLIENT-MAP-01. La corrección anterior (validación de dimensiones, setTimeout de 100ms, map.resize()) **no resolvió el problema observado**.

Esta versión implementa:
1. **Diagnósticos extensivos** en consola para capturar la causa raíz exacta
2. **ResizeObserver** en lugar de setTimeout fijo para manejo robusto de dimensiones
3. **Logs de todos los eventos** de MapLibre (load, style.load, idle, error)
4. **Verificación paso a paso** del flujo de inicialización

**Acción requerida:** El usuario debe ejecutar esta versión en desarrollo y reportar los logs de consola del navegador para identificar dónde falla exactamente el proceso de inicialización.

---

## Problema Reportado

**Usuario confirma:** Después de aplicar WIS-UI-FIX-CLIENT-MAP-01, el mapa del cliente **sigue mostrando un recuadro gris vacío** en la tarjeta Cliente del detalle del ticket.

**Situación:**
- ✅ TypeScript: PASS
- ✅ Build: PASS (5.7s compilación)
- ❌ MAP-01 (Cliente con coordenadas válidas): **FAIL** - Recuadro gris visible
- ❓ Causa raíz: **Desconocida** - Requiere diagnóstico en navegador

---

## Análisis del Código Actual (MAP-01)

### Flujo de Inicialización Esperado

```
1. Componente se monta
   ↓
2. useEffect ejecuta
   ↓
3. setTimeout de 100ms
   ↓
4. initMap() verifica dimensiones
   ↓
5. initMapLibre() carga MapLibre GL
   ↓
6. new Map() crea instancia
   ↓
7. Evento 'load' dispara
   ↓
8. setLoading(false)
   ↓
9. Overlay de carga desaparece
   ↓
10. Mapa visible ✅
```

### Puntos de Falla Potenciales

#### 1. **Dimensiones del Contenedor**

**Teoría:** El contenedor podría no tener dimensiones válidas cuando `setTimeout` de 100ms ejecuta.

**Estructura HTML:**
```tsx
<div className="relative h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
  <div ref={mapContainerRef} className="absolute inset-0" />
  {loading && (
    <div className="absolute inset-0 flex items-center justify-center bg-white">
      <!-- Spinner -->
    </div>
  )}
</div>
```

**Problema potencial:**
- `h-48` = 192px de altura
- `absolute inset-0` debería ocupar todo el contenedor padre
- Pero si el navegador no ha calculado el layout cuando `initMap()` ejecuta, `getBoundingClientRect()` podría devolver dimensiones inválidas

#### 2. **Evento 'load' No Dispara**

**Teoría:** El evento 'load' de MapLibre podría no dispararse si:
- El estilo no carga (OpenFreeMap caído)
- El worker no carga
- Hay un error de red silencioso
- El canvas se crea pero queda oculto

**Consecuencia:** `setLoading(false)` nunca se ejecuta → Overlay blanco permanece visible indefinidamente → Usuario ve recuadro blanco/gris

#### 3. **CSS de MapLibre No Cargado**

**Teoría:** La importación `import 'maplibre-gl/dist/maplibre-gl.css';` podría no cargarse correctamente en producción.

**Consecuencia:** El canvas de MapLibre se crea pero sin estilos, queda invisible

#### 4. **Canvas Detrás del Overlay**

**Teoría:** Incluso si `setLoading(false)` ejecuta, podría haber un problema de z-index o timing que mantenga el overlay visible.

**Estructura actual:**
- Contenedor padre: `relative`
- Canvas de MapLibre: `absolute inset-0` (primer hijo)
- Overlay de loading: `absolute inset-0` (condicional)

Sin z-index explícito, el orden de renderizado depende del orden DOM.

#### 5. **Hidratación de React**

**Teoría:** En Next.js con SSR, el componente se renderiza en servidor y luego se hidrata en cliente. MapLibre es client-only, por lo que debe inicializarse después de hidratación.

**Problema potencial:** Si hay un mismatch entre servidor y cliente, React podría tener problemas con el DOM.

---

## Solución Implementada - Fase de Diagnóstico

### 1. Diagnósticos Extensivos en Consola

Se agregaron logs en **cada punto crítico** del flujo de inicialización:

```typescript
// Montaje del componente
console.log('[ClientMapPreview] Component mounted', { latitude, longitude });

// Verificación de dimensiones
console.log('[ClientMapPreview] Container dimensions:', {
  width: rect.width,
  height: rect.height,
  top: rect.top,
  left: rect.left
});

// Dimensiones insuficientes
console.warn('[ClientMapPreview] Container dimensions too small, retrying...');

// Inicio de inicialización
console.log('[ClientMapPreview] Starting map initialization...');

// Carga de MapLibre
console.log('[ClientMapPreview] Loading MapLibre GL...');
console.log('[ClientMapPreview] MapLibre GL loaded successfully');

// Creación de mapa
console.log('[ClientMapPreview] Creating map instance...', {
  style: DEFAULT_MAP_STYLE,
  center: [longitude, latitude],
  zoom: 14
});
console.log('[ClientMapPreview] Map instance created');

// Evento 'load'
console.log('[ClientMapPreview] Map load event fired');

// Resize
console.log('[ClientMapPreview] Resizing map to:', { width, height });
console.log('[ClientMapPreview] Map resized');

// Loading state
console.log('[ClientMapPreview] Setting loading to false');

// Marcador
console.log('[ClientMapPreview] Adding marker at:', [longitude, latitude]);
console.log('[ClientMapPreview] Marker added');

// Eventos adicionales
map.on('style.load', () => {
  console.log('[ClientMapPreview] Style loaded');
});

map.on('idle', () => {
  console.log('[ClientMapPreview] Map idle');
});

// Errores
console.error('[ClientMapPreview] Map error:', e);
console.error('[ClientMapPreview] Initialization error:', err);

// Unmount
console.log('[ClientMapPreview] Component unmounting');
console.log('[ClientMapPreview] Removing map');
```

### 2. ResizeObserver en Lugar de setTimeout

**Problema con setTimeout fijo:**
```typescript
// ❌ MAP-01: Asume que 100ms es suficiente
const timeoutId = setTimeout(initMap, 100);
```

**Problemas:**
- En dispositivos lentos, 100ms podría no ser suficiente
- En dispositivos rápidos, 100ms es desperdicio
- No hay garantía de que el layout esté calculado

**Solución con ResizeObserver:**
```typescript
// ✅ MAP-02: Espera a que el contenedor tenga dimensiones reales
resizeObserverRef.current = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    console.log('[ClientMapPreview] ResizeObserver:', { width, height });
    if (width > 0 && height > 0 && !mapInitialized && !mapRef.current) {
      console.log('[ClientMapPreview] Valid dimensions detected, initializing map');
      initMap();
    }
  }
});
resizeObserverRef.current.observe(mapContainerRef.current);
```

**Beneficios:**
- Dispara automáticamente cuando el contenedor tiene dimensiones válidas
- No depende de timing arbitrario
- Más robusto en diferentes dispositivos y condiciones de red

**Fallback:** Se mantiene setTimeout de 100ms como respaldo si ResizeObserver no dispara:
```typescript
const timeoutId = setTimeout(() => {
  if (!mapInitialized && !mapRef.current) {
    console.log('[ClientMapPreview] Timeout fallback triggered');
    initMap();
  }
}, 100);
```

### 3. Protección Contra Inicialización Duplicada

```typescript
let mapInitialized = false;

const initMap = async () => {
  // ...
  if (mapInitialized) {
    console.log('[ClientMapPreview] Map already initialized');
    return;
  }
  
  mapInitialized = true;
  // ... continúa inicialización
};
```

**Previene:**
- Múltiples instancias de mapa si ResizeObserver y setTimeout disparan simultáneamente
- Errores de inicialización duplicada

### 4. Retry con Backoff

Si las dimensiones son insuficientes en el primer intento:

```typescript
if (rect.width < 50 || rect.height < 50) {
  console.warn('[ClientMapPreview] Container dimensions too small, retrying...');
  setTimeout(() => {
    if (!cancelled && !mapInitialized) {
      initMap();
    }
  }, 200);
  return;
}
```

**Estrategia:**
- Primer intento: ResizeObserver o 100ms
- Dimensiones insuficientes: Retry después de 200ms
- Máximo un retry (evita loops infinitos)

### 5. Cleanup Mejorado

```typescript
return () => {
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
};
```

**Mejoras:**
- Desconecta ResizeObserver
- Limpia referencias
- Previene memory leaks

---

## Archivos Modificados

### Modificados (1 archivo)

```
apps/admin/src/components/ClientMapPreview.tsx           (+106 -60 líneas)
```

### Cambios Principales

| Aspecto | MAP-01 | MAP-02 |
|---------|--------|--------|
| Detección de dimensiones | setTimeout fijo (100ms) | ResizeObserver + setTimeout fallback |
| Logs | Solo warnings/errors | Logs extensivos en cada paso |
| Retry | No | Retry con 200ms backoff si dimensiones insuficientes |
| Eventos monitoreados | load, error | load, style.load, idle, error |
| Protección duplicación | initAttemptedRef | mapInitialized flag + initAttemptedRef |
| Cleanup | Básico | ResizeObserver disconnect + limpieza completa |

---

## Validación

### TypeScript
```bash
cd apps/admin && npx tsc --noEmit
```
✅ **PASS** - Sin errores de tipo

### Build de Producción
```bash
cd apps/admin && npm run build
```
✅ **PASS** - Build exitoso

**Salida:**
```
▲ Next.js 16.3.1 (Turbopack)
✓ Compiled successfully in 5.7s
  Running TypeScript ...
  Finished TypeScript in 1096ms
✓ Generating static pages (25/25) in 210ms

Exit code: 0
```

---

## Instrucciones para Diagnóstico en Navegador

### Requisitos

- Ticket cuyo cliente tenga coordenadas válidas
- Navegador con DevTools (Chrome, Firefox, Edge, Safari)

### Pasos para Ejecutar MAP-01 con Diagnósticos

#### 1. Iniciar Servidor de Desarrollo

```bash
cd /Users/jesus.ramirez/Documents/Personal/Personal/Negocios/InnoCore/Projects/admin-tickets/apps/admin
npm run dev
```

**Esperar mensaje:**
```
  ▲ Next.js 16.3.1
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 2.3s
```

#### 2. Abrir DevTools ANTES de Navegar

**Chrome/Edge:**
- Windows: `F12` o `Ctrl+Shift+I`
- Mac: `Cmd+Option+I`

**Firefox:**
- Windows: `F12` o `Ctrl+Shift+K`
- Mac: `Cmd+Option+K`

**Safari:**
- Preferencias → Avanzado → Mostrar menú Desarrollo
- `Cmd+Option+C`

#### 3. Ir a la Pestaña Console

**Importante:** Asegurarse de que la consola esté visible **antes** de cargar la página del ticket para capturar todos los logs desde el inicio.

#### 4. Navegar al Ticket

1. Abrir http://localhost:3000
2. Login con usuario ADMIN
3. Ir a **Tickets**
4. Seleccionar un ticket cuyo cliente tenga coordenadas válidas
5. Scroll hasta la sección "Cliente"

#### 5. Observar Logs en Console

**Logs esperados si funciona correctamente:**

```
[ClientMapPreview] Component mounted {latitude: 19.7037, longitude: -101.1949}
[ClientMapPreview] ResizeObserver: {width: 560, height: 192}
[ClientMapPreview] Valid dimensions detected, initializing map
[ClientMapPreview] Container dimensions: {width: 560, height: 192, top: 1234, left: 56}
[ClientMapPreview] Starting map initialization...
[ClientMapPreview] Loading MapLibre GL...
[MapLibre] Configured worker URL: /maplibre/maplibre-gl-worker.mjs
[ClientMapPreview] MapLibre GL loaded successfully
[ClientMapPreview] Creating map instance... {style: 'https://tiles.openfreemap.org/styles/liberty', center: Array(2), zoom: 14}
[ClientMapPreview] Map instance created
[ClientMapPreview] Style loaded
[ClientMapPreview] Map load event fired
[ClientMapPreview] Resizing map to: {width: 560, height: 192}
[ClientMapPreview] Map resized
[ClientMapPreview] Setting loading to false
[ClientMapPreview] Adding marker at: [-101.1949, 19.7037]
[ClientMapPreview] Marker added
[ClientMapPreview] Map idle
```

**Logs si dimensiones son insuficientes:**

```
[ClientMapPreview] Component mounted {latitude: 19.7037, longitude: -101.1949}
[ClientMapPreview] Timeout fallback triggered
[ClientMapPreview] Container dimensions: {width: 0, height: 0, top: 0, left: 0}
[ClientMapPreview] Container dimensions too small, retrying...
[ClientMapPreview] Container dimensions: {width: 560, height: 192, top: 1234, left: 56}
[ClientMapPreview] Starting map initialization...
// ... continúa
```

**Logs si hay error de red:**

```
[ClientMapPreview] Component mounted {latitude: 19.7037, longitude: -101.1949}
// ...
[ClientMapPreview] Map instance created
[ClientMapPreview] Map error: {error: {…}, ...}
```

**Logs si el estilo no carga:**

```
[ClientMapPreview] Map instance created
// NO HAY "Style loaded"
// NO HAY "Map load event fired"
```

#### 6. Inspeccionar la Pestaña Network

1. Ir a pestaña **Network** en DevTools
2. Buscar estas peticiones:
   - `/maplibre/maplibre-gl-worker.mjs` - Status: **200 OK**
   - `https://tiles.openfreemap.org/styles/liberty` - Status: **200 OK**
   - `https://tiles.openfreemap.org/...` (tiles individuales) - Status: **200 OK**

**Si alguna petición falla:**
- Status 404: Archivo no encontrado
- Status 500: Error del servidor
- Status CORS: Problema de CORS
- (failed): Error de red o timeout

#### 7. Inspeccionar el DOM

1. En DevTools, ir a **Elements** (Chrome) o **Inspector** (Firefox)
2. Buscar el contenedor del mapa (clase `relative h-48 bg-gray-100`)
3. Verificar:
   - ¿Existe `<div class="maplibregl-map">`? → Mapa inicializado
   - ¿Existe `<canvas class="maplibregl-canvas">`? → Canvas creado
   - ¿El canvas tiene `width` y `height`? → Dimensiones configuradas
   - ¿El overlay blanco está visible? → `loading` sigue en `true`

#### 8. Capturar Evidencia

**Para reportar el problema, incluir:**

1. **Screenshot de la consola** con todos los logs de `[ClientMapPreview]`
2. **Screenshot de Network** con las peticiones de MapLibre y OpenFreeMap
3. **Screenshot del DOM** mostrando el contenedor del mapa y sus hijos
4. **Descripción visual:** ¿Qué se ve? (recuadro gris, recuadro blanco, spinner, nada)

---

## Causas Raíz Posibles Basadas en Logs

### Escenario A: Dimensiones Insuficientes Persistentes

**Logs:**
```
[ClientMapPreview] Container dimensions: {width: 0, height: 0, ...}
[ClientMapPreview] Container dimensions too small, retrying...
[ClientMapPreview] Container dimensions: {width: 0, height: 0, ...}
[ClientMapPreview] Container dimensions too small, retrying...
```

**Causa:** El contenedor nunca obtiene dimensiones válidas.

**Posibles razones:**
- CSS que oculta el contenedor (`display: none`, `visibility: hidden`)
- Contenedor padre colapsado
- Problema de hidratación de React

**Corrección:** Investigar estilos CSS y estructura HTML

### Escenario B: MapLibre No Carga

**Logs:**
```
[ClientMapPreview] Loading MapLibre GL...
[ClientMapPreview] Initialization error: Error: Cannot find module 'maplibre-gl'
```

**Causa:** El módulo `maplibre-gl` no está disponible.

**Corrección:** Verificar instalación de dependencias

### Escenario C: Worker No Carga

**Logs:**
```
[ClientMapPreview] Map instance created
GET /maplibre/maplibre-gl-worker.mjs net::ERR_ABORTED 404 (Not Found)
```

**Causa:** El worker no se copió correctamente al directorio `/public/maplibre/`

**Corrección:** Verificar script `copy-maplibre-worker.mjs`

### Escenario D: Estilo No Carga

**Logs:**
```
[ClientMapPreview] Map instance created
// NO HAY "Style loaded"
// NO HAY "Map load event fired"
```

**Network:**
```
GET https://tiles.openfreemap.org/styles/liberty  Status: 404 Not Found
```

**Causa:** OpenFreeMap está caído o el estilo no existe.

**Corrección:** Cambiar a estilo alternativo o proveedor de tiles diferente

### Escenario E: Evento 'load' No Dispara

**Logs:**
```
[ClientMapPreview] Map instance created
[ClientMapPreview] Style loaded
// NO HAY "Map load event fired"
```

**Causa:** El evento 'load' no se dispara por algún problema interno de MapLibre.

**Corrección:** Usar timeout de respaldo para `setLoading(false)` después de X segundos

### Escenario F: setLoading(false) No Actualiza UI

**Logs:**
```
[ClientMapPreview] Map load event fired
[ClientMapPreview] Setting loading to false
// Pero el overlay sigue visible en UI
```

**Causa:** Problema de actualización de estado de React.

**Corrección:** Forzar re-render o verificar que no haya múltiples instancias del componente

---

## Próximos Pasos

### Paso 1: Usuario Ejecuta Diagnóstico

El usuario debe seguir las **Instrucciones para Diagnóstico en Navegador** y reportar:

1. ✅ Logs completos de consola (screenshot o copiar/pegar)
2. ✅ Peticiones de Network (screenshot)
3. ✅ Inspección del DOM (screenshot)
4. ✅ Descripción visual de lo que ve

### Paso 2: Análisis de Evidencia

Con la evidencia del navegador, identificar:
- ¿En qué paso falla exactamente el flujo?
- ¿Qué log NO aparece?
- ¿Qué petición falla?
- ¿El canvas existe pero está oculto?

### Paso 3: Corrección Específica

Basándose en la causa raíz demostrada:
- **Dimensiones:** Ajustar CSS o timing
- **Worker/Estilo:** Corregir rutas o configuración
- **Evento 'load':** Implementar timeout de respaldo
- **State update:** Forzar re-render o key prop

### Paso 4: Verificación Final

Después de la corrección, el usuario debe confirmar:
- ✅ MAP-01: Mapa visible con marcador
- ✅ MAP-02: Estado vacío correcto sin coordenadas
- ✅ MAP-04: Error visible cuando OpenFreeMap falla
- ✅ MAP-09: Navegación entre tickets sin rastros del anterior

---

## Estado de Pruebas

### Pruebas Automatizadas

✅ **TypeScript:** PASS - Sin errores
✅ **Build:** PASS - Compilación exitosa (5.7s)

### Pruebas Manuales

| ID      | Caso                                | Estado      | Nota                                          |
| ------- | ----------------------------------- | ----------- | --------------------------------------------- |
| MAP-01  | Cliente con coordenadas válidas     | **PENDIENTE** | Requiere ejecución en navegador con diagnósticos |
| MAP-02  | Cliente sin coords, con dirección   | **PENDIENTE** | Verificar estado vacío + botón Google Maps    |
| MAP-03  | Cliente sin coords ni dirección     | **PENDIENTE** | Verificar estado vacío sin botón              |
| MAP-04  | Error al cargar mapa                | **PENDIENTE** | Simular falla de OpenFreeMap                  |
| MAP-05  | Visualización en escritorio         | **PENDIENTE** | Verificar responsive                          |
| MAP-06  | Visualización en móvil              | **PENDIENTE** | Verificar responsive                          |
| MAP-09  | Navegación rápida entre tickets     | **PENDIENTE** | Verificar cleanup correcto                    |

**Estado anterior reportado por usuario:**
- ❌ **MAP-01: FAIL** - Recuadro gris sigue visible después de MAP-01

---

## Limitaciones

### Sin Navegador Automatizado

Este diagnóstico requiere **ejecución manual en navegador** porque:
1. No hay tests E2E configurados (Playwright/Cypress)
2. MapLibre GL requiere renderizado real de canvas
3. Los diagnósticos de consola solo son visibles en navegador
4. Network requests deben inspeccionarse en DevTools

### No Puedo Declarar FIXED Sin Evidencia

**Razones:**
- Build exitoso ≠ Mapa funcionando
- TypeScript pass ≠ Renderizado correcto
- Logs en código ≠ Logs ejecutados

**Necesito:**
- Screenshot de consola con logs completos
- Confirmación visual de que el mapa se ve
- Confirmación de que el marcador azul está visible

---

## Restricciones Respetadas

✅ **Backend:** No modificado
✅ **Migraciones:** No ejecutadas ni creadas
✅ **RLS/RPC/RBAC:** No modificados
✅ **Reglas de cierre:** No modificadas
✅ **Aplicación Android:** No modificada
✅ **Ticket Journey:** No modificado
✅ **Wisper Command:** No modificado
✅ **Operational Insights:** No modificado
✅ **Push:** No ejecutado
✅ **Despliegue VPS:** No ejecutado
✅ **APK:** No generado

---

## Conclusión

WIS-UI-FIX-CLIENT-MAP-02 implementa:

✅ **Diagnósticos Extensivos:**
- Logs en cada paso del flujo de inicialización
- Monitoreo de eventos 'load', 'style.load', 'idle', 'error'
- Captura de dimensiones, estado de loading, y errores

✅ **ResizeObserver:**
- Reemplaza setTimeout fijo por detección real de dimensiones
- Más robusto en diferentes dispositivos y condiciones
- Timeout de 100ms como fallback

✅ **Retry con Backoff:**
- Intenta nuevamente si dimensiones son insuficientes
- Previene failures en dispositivos lentos

✅ **Protección Contra Duplicación:**
- Flag `mapInitialized` previene múltiples instancias
- Cleanup mejorado con ResizeObserver.disconnect()

**Estado:**
- Build: ✅ PASS
- TypeScript: ✅ PASS
- MAP-01: ❓ **PENDIENTE** - Requiere verificación en navegador
- Causa raíz: ❓ **POR DETERMINAR** - Requiere logs de consola

**Acción requerida:**
El usuario debe ejecutar esta versión en navegador siguiendo las **Instrucciones para Diagnóstico en Navegador** y reportar:
1. Logs de consola (screenshot o texto)
2. Peticiones de Network (screenshot)
3. Inspección del DOM (screenshot)
4. Descripción visual del problema

Con esta evidencia, se podrá identificar la causa raíz exacta y aplicar la corrección específica.

---

**Fix:** WIS-UI-FIX-CLIENT-MAP-02  
**Fecha:** 27 de septiembre de 2026  
**Branch:** feature/wis-experience-01  
**Implementado por:** Claude Sonnet 4.5  
**Estado:** 🔍 INSTRUMENTADO - Requiere verificación en navegador

**Archivos modificados:** 1  
**Líneas netas:** +46  
**Build:** ✅ PASS  
**TypeScript:** ✅ PASS  
**MAP-01:** ❓ PENDIENTE verificación

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
