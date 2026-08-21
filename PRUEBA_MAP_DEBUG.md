# Prueba /map-debug - Instrucciones para QA

## OBJETIVO
Identificar exactamente qué recurso impide que el mapa cargue completamente.

## PROCEDIMIENTO

### 1. Iniciar servidor
```bash
cd apps/admin
npm run dev
```

### 2. Abrir página de diagnóstico
```
http://localhost:3000/map-debug
```

### 3. Observar panel derecho

El panel derecho tiene 2 secciones:

#### A) RECURSOS
Tabla con estado de cada recurso:
- Style JSON
- Sprite JSON
- Sprite PNG
- Glyphs
- Tiles

**Colores:**
- 🟢 Verde = Success (200 OK)
- 🔴 Rojo = Error (404/500/CORS)
- 🟡 Amarillo = Pending (cargando)
- ⚪ Gris = Unknown (no intentado)

**Capturar:**
Screenshot de esta tabla

#### B) LOGS
Eventos en tiempo real de MapLibre.

**Buscar específicamente:**

```
[timestamp] Style version: 8
[timestamp] Sources: ne2_shaded, openmaptiles
[timestamp] External hosts required: [...]
[timestamp] EVENT: style.load
[timestamp] EVENT: load - Map fully loaded!
[timestamp] EVENT: idle - Map is idle
```

**Si hay errores, buscar:**
```
[timestamp] ERROR: ...
[timestamp]   URL: https://...
[timestamp]   Status: 404
[timestamp]   Source: openmaptiles
```

### 4. Abrir Console (F12)

Console debe mostrar los mismos logs con más detalle.

**Capturar:**
Screenshot del Console

### 5. Abrir Network Tab (F12)

**Filtrar por:** `openfreemap`

**Verificar cada request:**

| Request | Expected Status | Tipo |
|---------|----------------|------|
| `/styles/liberty` | 200 OK | json |
| `/sprites/.../ofm.json` | 200 OK | json |
| `/sprites/.../ofm.png` | 200 OK | image |
| `/fonts/.../0-255.pbf` | 200 OK | binary |
| `/planet/12/*/*.pbf` | 200 OK | binary |

**Si alguno falla:**
- Click derecho → Copy as cURL
- Pegar en terminal para probar fuera de browser

**Capturar:**
Screenshot de Network tab mostrando requests

### 6. Verificar CSP

En Console buscar:
```
Refused to connect to 'https://...' because it violates the following Content Security Policy directive
```

Si aparece: **CSP está bloqueando el recurso**

### 7. Esperar eventos

**CASO A: Map carga exitosamente**
- ✅ Calles visibles
- ✅ Avenidas visibles
- ✅ Labels visibles
- ✅ Log: `EVENT: load - Map fully loaded!`
- ✅ Log: `EVENT: idle`

**CASO B: style.load pero NO load**
- ✅ Log: `EVENT: style.load`
- ❌ Log: `EVENT: load` NO aparece después de 20s
- ❌ Calles NO visibles

**Significa:** Style cargó, pero tiles/glyphs/sprites están fallando

**CASO C: Ni style.load ni load**
- ❌ Log: `EVENT: style.load` NO aparece
- ❌ Log: `EVENT: load` NO aparece
- ❌ Calles NO visibles

**Significa:** Style JSON no carga correctamente

### 8. Reportar

**Template:**

```
## RESULTADO /map-debug

### Entorno
- Browser: [Chrome 130 / Firefox / Safari]
- OS: [macOS / Windows / Linux]
- Conexión: [WiFi / Ethernet]

### Panel Recursos
[Screenshot]

Tabla estado:
- Style JSON: [success/error/pending]
- Sprite JSON: [success/error/unknown]
- Sprite PNG: [success/error/unknown]
- Glyphs: [success/error/unknown]
- Tiles: [success/error/unknown]

### Eventos MapLibre
style.load recibido: [SÍ / NO]
load recibido: [SÍ / NO]
idle recibido: [SÍ / NO]

### Errores
[Copiar errores exactos del panel de logs]

### Network Tab
[Screenshot]

Primer request fallido:
- URL: [URL exacta]
- Status: [404 / 500 / etc]
- Error: [mensaje]

### Console
[Screenshot]

CSP errors: [SÍ / NO]
[Copiar mensaje CSP si existe]

### Mapa
Calles visibles: [SÍ / NO]
Labels visibles: [SÍ / NO]
```

### 9. Troubleshooting

**Si Style JSON falla (404/500):**
```bash
curl -I https://tiles.openfreemap.org/styles/liberty
```

**Si Tiles fallan (404):**
```bash
curl -I https://tiles.openfreemap.org/planet/12/1024/1024.pbf
```

**Si Sprites fallan (404):**
```bash
curl -I https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json
```

**Si Glyphs fallan (404):**
```bash
curl -I https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf
```

**Si CSP bloquea:**
Ver `apps/admin/next.config.ts` línea `connect-src`

Debe incluir: `https://tiles.openfreemap.org`

## INTERPRETACIÓN

### Si todos los requests son 200 OK pero mapa no carga:
→ Problema de MapLibre rendering o timing
→ Verificar WebGL en Console
→ Probar en otro browser

### Si Style JSON falla:
→ OpenFreeMap service down
→ Firewall bloqueando
→ DNS issue

### Si Tiles fallan:
→ URL de tiles incorrecta en style
→ Source configuration issue
→ CSP bloqueando workers

### Si Glyphs fallan:
→ Labels no aparecerán
→ Pero calles SÍ deberían aparecer

### Si Sprites fallan:
→ Iconos no aparecerán
→ Pero calles SÍ deberían aparecer

### Si CSP errors:
→ Agregar dominio a next.config.ts
→ Hard refresh (Ctrl+Shift+R)

## SIGUIENTE PASO

Con los datos capturados, se puede determinar:

1. **Qué recurso falla exactamente** (tabla recursos + Network)
2. **Por qué falla** (HTTP status + error message)
3. **Cómo fixearlo** (CSP / URL / config)

**NO avanzar sin estos datos.**
