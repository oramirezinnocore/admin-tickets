# Manual QA - Mapa de Técnicos

## Problema Reportado
El mapa de técnicos inicializa (se ven controles +/-, markers, panel lateral) pero el mapa base (calles, avenidas, contexto geográfico) no se visualiza. El fondo queda beige/blanco.

## Fixes Aplicados

### 1. Centralización de Config
- Creado `packages/shared/src/map-config.ts`
- Style URL: `https://tiles.openfreemap.org/styles/liberty`
- Endpoint verificado funcionando (retorna JSON válido)

### 2. Loading States
- Spinner "Cargando mapa..." mientras carga el style
- Se elimina solo cuando MapLibre emite evento `load`

### 3. Error Handling
- Event listener `map.on('error')` captura errores
- Timeout de 10 segundos
- Mensaje de error descriptivo

### 4. Retry Mechanism
- Botón "Reintentar" si falla la carga
- Reinicializa el mapa sin reload completo
- Funciona tanto en mapa principal como MapLocationPicker

## Testing Manual Requerido

### TC-MAP-BASE-01: Mapa Principal

**Pasos:**
1. `npm run dev` en apps/admin
2. Abrir http://localhost:3000/login
3. Login como admin
4. Navegar a "Mapa de técnicos"
5. Esperar 3-5 segundos

**Esperado:**
- ✅ Spinner "Cargando mapa..." aparece brevemente
- ✅ Spinner desaparece cuando carga
- ✅ Mapa base visible con:
  - Calles (líneas grises/blancas)
  - Avenidas (líneas más gruesas)
  - Nombres de calles
  - Zonas/colonias
  - Contexto geográfico de Morelia
- ✅ Controles +/- visibles
- ✅ Si hay técnicos con ubicación: markers visibles sobre el mapa

**Si falla:**
- ❌ Panel blanco/beige sin calles
- Verificar console de browser (F12)
- Buscar errores MapLibre
- Capturar Network tab (filtrar por openfreemap)
- Verificar si hay errores HTTP 404/500

### TC-MAP-BASE-02: Map Location Picker

**Pasos:**
1. Navegar a "Clientes"
2. Click "Nuevo cliente"
3. Scroll a sección "Ubicación"
4. Click "Seleccionar ubicación en mapa"
5. Esperar carga del modal

**Esperado:**
- ✅ Modal abre con mapa
- ✅ Spinner "Cargando mapa..." aparece
- ✅ Mapa base visible (igual que TC-MAP-BASE-01)
- ✅ Marker azul draggable visible sobre el mapa
- ✅ Coordenadas actualizándose al mover marker

### TC-MAP-BASE-03: Error Handling

**Pasos:**
1. Abrir DevTools (F12) → Network tab
2. Habilitar "Offline" o throttling severo
3. Navegar a Mapa de técnicos
4. Esperar timeout

**Esperado:**
- ✅ Mensaje error: "No fue posible cargar el mapa: ..."
- ✅ Botón "Reintentar" visible
- ✅ NO hay crash de la aplicación

### TC-MAP-BASE-04: Retry

**Pasos:**
1. Desde TC-MAP-BASE-03 (con error)
2. Deshabilitar "Offline" en DevTools
3. Click botón "Reintentar"

**Esperado:**
- ✅ Mapa recarga
- ✅ Spinner aparece nuevamente
- ✅ Mapa se visualiza correctamente
- ✅ NO hay reload completo de página

## Debugging

Si el mapa no carga correctamente:

### Browser Console Logs
Buscar:
```
[Map] Map loaded successfully
[Map] Style loaded successfully
```

Si aparece:
```
[Map] Map error: ...
```
→ Capturar el mensaje completo

### Network Tab
Filtrar por: `openfreemap`

Verificar requests:
- `https://tiles.openfreemap.org/styles/liberty` → debe retornar 200
- `https://tiles.openfreemap.org/sprites/...` → debe retornar 200
- `https://tiles.openfreemap.org/fonts/...` → debe retornar 200
- `https://tiles.openfreemap.org/planet/...` (tiles) → debe retornar 200

Si alguno falla con 404/500:
→ Problema con OpenFreeMap service (reportar)

### MapLibre Version
Verificar en package.json:
```json
"maplibre-gl": "^6.4.1"
```

### CSS Import
Verificar en map/page.tsx:
```typescript
import 'maplibre-gl/dist/maplibre-gl.css';
```

## Known Issues

### Issue 1: Tiles no cargan en primera carga
**Síntoma:** Mapa base blanco, pero retry funciona
**Workaround:** Click "Reintentar"
**Root cause:** Timing issue o red lenta
**Fix permanente:** Pendiente investigación

### Issue 2: CORS errors
**Síntoma:** Console muestra "Access-Control-Allow-Origin"
**Verificación:** OpenFreeMap debe tener `access-control-allow-origin: *`
**Fix:** Ninguno necesario si OpenFreeMap está bien configurado

## Support

Si después de estos fixes el mapa sigue sin visualizarse:

1. Capturar screenshots de:
   - Console (errores)
   - Network tab (requests fallidos)
   - El panel blanco

2. Verificar conexión a internet

3. Probar en otro browser (Chrome, Firefox, Safari)

4. Verificar firewall/proxy corporativo
   - Puede bloquear openfreemap.org
   - Puede requerir whitelist

5. Como último recurso: considerar style alternativo
   - `MAP_STYLES.positron`
   - `MAP_STYLES.bright`
