# Diagnóstico del Mapa - Procedimiento de Testing

## IMPORTANTE
Este documento es para ejecutar AHORA en browser real y reportar resultados.

## 1. Página de Diagnóstico

### Ejecutar
```bash
cd apps/admin
npm run dev
```

### Abrir en browser
```
http://localhost:3000/map-debug
```

### Qué observar

**Panel izquierdo:** Mapa
**Panel derecho:** Logs en tiempo real

#### Escenario A: ÉXITO
Si el mapa carga correctamente verás:
- ✅ Calles de Morelia visibles
- ✅ Avenidas visibles
- ✅ Nombres/labels visibles
- ✅ Controles +/- funcionando

Logs esperados:
```
[timestamp] WebGL supported: true
[timestamp] Style URL: https://tiles.openfreemap.org/styles/liberty
[timestamp] Map instance created
[timestamp] EVENT: styledata
[timestamp] EVENT: style.load
[timestamp] Source loaded: ne2_shaded
[timestamp] Source loaded: openmaptiles
[timestamp] EVENT: load - Map fully loaded!
[timestamp] Source: ne2_shaded
[timestamp] Source: openmaptiles
[timestamp] Layers count: 119
[timestamp] EVENT: idle - Map is idle
```

#### Escenario B: FALLO
Si el mapa NO carga:

**Capturar:**
1. Screenshot del panel de logs (derecha)
2. Console del browser (F12 → Console tab)
3. Network tab (F12 → Network tab)
   - Filtrar por "openfreemap"
   - Capturar requests fallidos (rojos)
   - Capturar HTTP status

**Buscar específicamente:**
- ❌ `ERROR:` en logs
- ❌ Requests 404/500 en Network
- ❌ CORS errors en Console
- ❌ CSP errors en Console
- ❌ "Refused to connect..."
- ❌ "Failed to fetch..."

## 2. Network Tab Analysis

### Requests esperados

Con el mapa funcionando correctamente deberías ver:

#### Style JSON
```
Request: https://tiles.openfreemap.org/styles/liberty
Status: 200 OK
Type: json
Size: ~42 KB
```

#### Tiles (vector)
```
Request: https://tiles.openfreemap.org/planet/12/*/*.pbf
Status: 200 OK
Type: pbf (binary)
Multiple requests (uno por tile visible)
```

#### Sprites
```
Request: https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json
Status: 200 OK
Request: https://tiles.openfreemap.org/sprites/ofm_f384/ofm.png
Status: 200 OK
```

#### Fonts/Glyphs
```
Request: https://tiles.openfreemap.org/fonts/{font}/{range}.pbf
Status: 200 OK
Multiple requests (según zoom y texto visible)
```

### Si algún request falla

**404 Not Found:**
→ El recurso no existe en OpenFreeMap
→ Capturar URL exacta
→ Reportar a OpenFreeMap o buscar URL alternativa

**500 Server Error:**
→ Problema en servidor OpenFreeMap
→ Temporal: esperar y reintentar
→ Persistente: considerar proveedor alternativo

**CORS Error:**
→ Browser bloquea por política CORS
→ Verificar que response tenga:
  `Access-Control-Allow-Origin: *`
→ Si no tiene: problema de OpenFreeMap

**CSP Error:**
→ Next.js bloqueando conexión
→ Verificar que next.config.ts tenga:
  `connect-src ... https://tiles.openfreemap.org`

## 3. Console Errors

### Error: "WebGL not supported"
**Causa:** Browser o GPU no soporta WebGL
**Fix:** Cambiar browser o actualizar drivers GPU
**Workaround:** Ninguno - MapLibre requiere WebGL

### Error: "Failed to fetch"
**Causa:** Conexión de red o firewall
**Fix:**
1. Verificar conexión a internet
2. Verificar que https://tiles.openfreemap.org sea accesible
3. Deshabilitar VPN/Proxy temporalmente
4. Verificar firewall corporativo

### Error: "Refused to connect..."
**Causa:** CSP bloqueando
**Fix:** Ya implementado en next.config.ts
**Verificar:** Reload con Ctrl+Shift+R (hard refresh)

## 4. Testing del Mapa Principal

Después de diagnosticar con /map-debug:

### Abrir
```
http://localhost:3000/map
```

### Verificar Console
Mismo procedimiento:
- F12 → Console tab
- Buscar logs `[Map]`
- Verificar eventos en orden:
  1. Initializing map
  2. Map instance created
  3. EVENT: styledata
  4. EVENT: style.load
  5. Source loaded: ...
  6. EVENT: load
  7. EVENT: idle

### Si falla

Comparar logs de /map-debug vs /map:
- ¿Difieren?
- ¿Algún evento falta?
- ¿Error diferente?

## 5. MapLocationPicker

### Abrir
```
http://localhost:3000/clients
```

### Testing
1. Click "Nuevo cliente"
2. Scroll a "Ubicación"
3. Click "Seleccionar ubicación en mapa"
4. Abrir F12 → Console
5. Buscar logs `[MapLocationPicker]`
6. Verificar si mapa carga en modal

## 6. Resultados a Reportar

### Template

```
## DIAGNÓSTICO MAPA

### Entorno
- Browser: [Chrome 130 / Firefox 120 / Safari 17]
- OS: [macOS 15 / Windows 11 / Linux]
- Conexión: [WiFi / Ethernet / Móvil]
- Firewall: [Sí / No]
- VPN: [Sí / No]

### /map-debug
- Calles visibles: [SÍ / NO]
- Labels visibles: [SÍ / NO]
- Logs capturados: [adjuntar screenshot]
- Console errors: [adjuntar screenshot]

### Network Tab
- style JSON: [200 OK / 404 / 500 / CORS error]
- tiles .pbf: [200 OK / 404 / 500 / No requests]
- sprites: [200 OK / 404 / 500]
- glyphs: [200 OK / 404 / 500]

### Errors específicos
[Copiar mensaje de error exacto]

### /map principal
- Igual que /map-debug: [SÍ / NO]
- Diferencias: [describir]

### MapLocationPicker
- Mapa carga en modal: [SÍ / NO]
- Mismo comportamiento: [SÍ / NO]
```

## 7. Workarounds Temporales

### Si OpenFreeMap no funciona

**Opción 1: Verificar DNS**
```bash
nslookup tiles.openfreemap.org
ping tiles.openfreemap.org
```

**Opción 2: Verificar accesibilidad**
```bash
curl -I https://tiles.openfreemap.org/styles/liberty
```

Debe retornar: `HTTP/2 200`

**Opción 3: Browser diferente**
- Probar Chrome, Firefox, Safari
- Deshabilitar extensiones
- Modo incógnito

**Opción 4: Red diferente**
- WiFi personal vs corporativa
- Móvil hotspot
- Ethernet

## 8. Next Steps

### Si OpenFreeMap funciona
→ Problema está en nuestra implementación
→ Revisar logs específicos
→ Comparar con /map-debug

### Si OpenFreeMap NO funciona
→ Problema es externo (service, red, firewall)
→ Considerar proveedor alternativo
→ Reportar a OpenFreeMap

### Si funciona intermitente
→ Problema de timing o red lenta
→ Aumentar timeout
→ Agregar retry automático
→ Preload de tiles

## 9. CSP Actual

Verificado en `next.config.ts`:

```typescript
connect-src: 'self' 
  https://*.supabase.co 
  wss://*.supabase.co 
  https://tiles.openfreemap.org
```

Permite:
- ✅ Style JSON
- ✅ Tiles .pbf
- ✅ Sprites
- ✅ Glyphs

## 10. Checklist Final

Antes de reportar "no funciona":

- [ ] Ejecutado /map-debug
- [ ] Capturado screenshot de logs
- [ ] Capturado screenshot de Network tab
- [ ] Capturado screenshot de Console
- [ ] Verificado HTTP status de requests
- [ ] Probado en browser diferente
- [ ] Probado en red diferente
- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Verificado acceso a tiles.openfreemap.org

**SIN estos datos NO es posible diagnosticar el problema real.**
