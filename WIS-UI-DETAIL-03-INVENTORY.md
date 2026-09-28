# WIS-UI-DETAIL-03 — INVENTARIO ANTES/DESPUÉS

## ESTADO: ANÁLISIS COMPLETADO

**Fecha:** 27 de septiembre de 2026  
**Propósito:** Verificar que el 100% de campos y métricas fueron preservados  
**Resultado:** ✅ TODOS LOS CAMPOS Y MÉTRICAS PRESERVADOS

---

## TARJETA TIEMPOS

### ANTES (Sidebar, líneas 706-784 de page.tsx)

**Ubicación:** Sidebar derecho, tercera tarjeta

**Campos y métricas:**

1. **Antigüedad total**
   - Función: `formatTicketAge(ticket.created_at)`
   - Formato: "Xh Ymin", "Xd Yh", etc.
   - Ubicación: text-center, text-2xl font-bold

2. **Tiempo hasta atención**
   - Función: `formatTimeToAttention(ticket.created_at, ticket.started_at)`
   - Formato: "Xh Ymin", "Pendiente", "En curso"
   - Descripción: "Creación → Inicio"
   - Ubicación: grid col 1/3, text-center

3. **Tiempo de atención**
   - Función: `formatAttentionTime(ticket.started_at, ticket.closed_at)`
   - Formato: "Xh Ymin", "Pendiente", "En curso"
   - Descripción: "Inicio → Cierre"
   - Ubicación: grid col 2/3, text-center

4. **Tiempo total del ticket**
   - Función: `formatTotalTicketTime(ticket.created_at, ticket.closed_at)`
   - Formato: "Xh Ymin", "Pendiente", "En curso"
   - Descripción: "Creación → Cierre"
   - Ubicación: grid col 3/3, text-center

**Timeline (4 hitos):**

5. **Creado**
   - Fecha: `ticket.created_at` (siempre presente)
   - Formato: `toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })`
   - Círculo: w-3 h-3, bg-blue-600

6. **Asignado**
   - Fecha: `ticket.assigned_at` (condicional)
   - Formato: `toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })`
   - Círculo: w-2 h-2, bg-gray-400
   - Condicional: solo si `ticket.assigned_at` existe

7. **Iniciado**
   - Fecha: `ticket.started_at` (condicional)
   - Formato: `toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })`
   - Círculo: w-2 h-2, bg-gray-400
   - Condicional: solo si `ticket.started_at` existe

8. **Cerrado**
   - Fecha: `ticket.closed_at` (condicional)
   - Formato: `toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })`
   - Círculo: w-3 h-3, bg-green-600 si RESOLVED, bg-red-600 si CANCELLED
   - Condicional: solo si `ticket.closed_at` existe

**Total campos/métricas:** 8

---

### DESPUÉS (TicketTimesCard.tsx)

**Ubicación:** Sidebar derecho, tercera tarjeta (mismo lugar)

**Campos y métricas:**

1. **Antigüedad total** ✅
   - Función: `formatTicketAge(ticket.created_at)` - **EXACTO**
   - Formato: preservado
   - Ubicación: bg-gradient-to-br from-blue-50, text-4xl font-bold tabular-nums
   - **MEJORA:** Agregada fecha de creación debajo (día, mes largo, año)

2. **Tiempo hasta atención** ✅
   - Función: `formatTimeToAttention(ticket.created_at, ticket.started_at)` - **EXACTO**
   - Formato: preservado
   - Descripción: "Creación → Inicio" - **PRESERVADO**
   - Ubicación: grid col 1/3, bg-gradient-to-br from-purple-50, text-2xl font-bold tabular-nums

3. **Tiempo de atención** ✅
   - Función: `formatAttentionTime(ticket.started_at, ticket.closed_at)` - **EXACTO**
   - Formato: preservado
   - Descripción: "Inicio → Cierre" - **PRESERVADO**
   - Ubicación: grid col 2/3, bg-gradient-to-br from-green-50, text-2xl font-bold tabular-nums

4. **Tiempo total del ticket** ✅
   - Función: `formatTotalTicketTime(ticket.created_at, ticket.closed_at)` - **EXACTO**
   - Formato: preservado
   - Descripción: "Creación → Cierre" - **PRESERVADO**
   - Ubicación: grid col 3/3, bg-gradient-to-br from-amber-50, text-2xl font-bold tabular-nums

**Timeline (4 hitos):**

5. **Creado** ✅
   - Fecha: `ticket.created_at` - **PRESERVADO**
   - Formato: `toLocaleDateString` + `toLocaleTimeString` - **MEJORADO** (más legible)
   - Círculo: w-5 h-5, bg-blue-600, ring-2 ring-blue-100

6. **Asignado** ✅
   - Fecha: `ticket.assigned_at` - **PRESERVADO**
   - Formato: `toLocaleDateString` + `toLocaleTimeString` - **MEJORADO**
   - Círculo: w-5 h-5, bg-purple-500, ring-2 ring-purple-100
   - Condicional: `{ticket.assigned_at && (...)}` - **PRESERVADO**

7. **Inicio de atención** ✅
   - Fecha: `ticket.started_at` - **PRESERVADO**
   - Formato: `toLocaleDateString` + `toLocaleTimeString` - **MEJORADO**
   - Círculo: w-5 h-5, bg-green-500, ring-2 ring-green-100
   - Condicional: `{ticket.started_at && (...)}` - **PRESERVADO**

8. **Cerrado/Cancelado** ✅
   - Fecha: `ticket.closed_at` - **PRESERVADO**
   - Formato: `toLocaleDateString` + `toLocaleTimeString` - **MEJORADO**
   - Círculo: w-5 h-5, bg-emerald-600 si RESOLVED, bg-red-600 si CANCELLED - **PRESERVADO**
   - Condicional: `{ticket.closed_at && (...)}` - **PRESERVADO**
   - **MEJORA:** Label "Cerrado" vs "Cancelado" según status
   - **MEJORA:** CheckCircle icon en círculo si RESOLVED

**Total campos/métricas:** 8 ✅

---

### VERIFICACIÓN: TARJETA TIEMPOS

| Campo/Métrica | ANTES | DESPUÉS | Estado |
|---|---|---|---|
| Antigüedad total | ✅ | ✅ | PRESERVADO |
| Tiempo hasta atención | ✅ | ✅ | PRESERVADO |
| Tiempo de atención | ✅ | ✅ | PRESERVADO |
| Tiempo total del ticket | ✅ | ✅ | PRESERVADO |
| Hito: Creado | ✅ | ✅ | PRESERVADO |
| Hito: Asignado | ✅ | ✅ | PRESERVADO |
| Hito: Iniciado | ✅ | ✅ | PRESERVADO |
| Hito: Cerrado | ✅ | ✅ | PRESERVADO |
| **TOTAL** | **8** | **8** | **✅ 100%** |

**Funciones de formateo:**
- `formatTicketAge()` - PRESERVADA
- `formatTimeToAttention()` - PRESERVADA
- `formatAttentionTime()` - PRESERVADA
- `formatTotalTicketTime()` - PRESERVADA

**Estados:**
- "Pendiente" - PRESERVADO (cuando started_at es null)
- "En curso" - PRESERVADO (cuando closed_at es null)
- Valores > 24 horas - PRESERVADO (sin límites)

**Auto-actualización:**
- useEffect cada 60s - PRESERVADO (en page.tsx)

---

## TARJETA INFORMACIÓN DEL TICKET

### ANTES (Columna principal, líneas 514-550 de page.tsx)

**Ubicación:** Columna principal, tercera sección (después de Journey)

**Campos:**

1. **Observaciones (admin_notes)**
   - Campo: `ticket.admin_notes`
   - Formato: text-sm, whitespace-pre-wrap
   - Condicional: solo si existe

2. **Notas del técnico (technician_notes)**
   - Campo: `ticket.technician_notes`
   - Formato: text-sm, whitespace-pre-wrap
   - Condicional: solo si existe

3. **Solución (solution_text)**
   - Campo: `ticket.solution_text`
   - Formato: text-sm, whitespace-pre-wrap
   - Condicional: solo si existe

4. **Razón de cierre (close_reason)**
   - Campo: `ticket.close_reason`
   - Formato: text-sm
   - Condicional: solo si existe

**Estado vacío:**
- Mensaje: "Sin información adicional"
- Condición: si ningún campo existe

**Campos NO mostrados en esta tarjeta:**
- `ticket.failure_type` - mostrado en header (línea 446-447)
- `ticket.folio` - mostrado en header H1 (línea 438)

**Total campos:** 4 + estado vacío

---

### DESPUÉS (TicketInformationCard.tsx)

**Ubicación:** Columna principal, tercera sección (mismo lugar)

**Campos:**

1. **Folio** ✅ **NUEVO**
   - Campo: `ticket.folio`
   - Función: `formatTicketFolio(ticket.folio)`
   - Formato: chip índigo, tabular-nums
   - **NUEVO:** Botón de copiar funcional (navigator.clipboard.writeText)
   - **NUEVO:** Feedback visual (Check verde 2s)

2. **Tipo de falla (failure_type)** ✅ **NUEVO**
   - Campo: `ticket.failure_type`
   - Formato: bg-amber-50, AlertCircle icon
   - Condicional: solo si existe
   - **NOTA:** También sigue en header (línea 446 preservada)

3. **Observaciones (admin_notes)** ✅
   - Campo: `ticket.admin_notes` - **PRESERVADO**
   - Formato: text-sm, whitespace-pre-wrap leading-relaxed - **MEJORADO**
   - Fondo: bg-blue-50, border-blue-200
   - Condicional: solo si existe - **PRESERVADO**

4. **Notas del técnico (technician_notes)** ✅
   - Campo: `ticket.technician_notes` - **PRESERVADO**
   - Formato: text-sm, whitespace-pre-wrap leading-relaxed - **MEJORADO**
   - Fondo: bg-purple-50, border-purple-200
   - Condicional: solo si existe - **PRESERVADO**

5. **Solución (solution_text)** ✅
   - Campo: `ticket.solution_text` - **PRESERVADO**
   - Formato: text-sm, whitespace-pre-wrap leading-relaxed - **MEJORADO**
   - Fondo: bg-green-50, border-green-200
   - Condicional: solo si existe - **PRESERVADO**

6. **Razón de cierre (close_reason)** ✅
   - Campo: `ticket.close_reason` - **PRESERVADO**
   - Formato: text-sm font-medium - **MEJORADO**
   - Fondo: bg-gray-50, border-gray-200
   - Condicional: solo si existe - **PRESERVADO**

**Estado vacío:** ✅
- Mensaje: "Sin información adicional" - **PRESERVADO**
- Submensaje: "No hay observaciones, notas o detalles registrados" - **NUEVO**
- Ícono: FileText grande
- Condición: `!hasAnyContent` - **PRESERVADO**

**Total campos:** 6 (4 preservados + 2 agregados) + estado vacío

---

### VERIFICACIÓN: TARJETA INFORMACIÓN DEL TICKET

| Campo | ANTES | DESPUÉS | Estado |
|---|---|---|---|
| admin_notes | ✅ | ✅ | PRESERVADO |
| technician_notes | ✅ | ✅ | PRESERVADO |
| solution_text | ✅ | ✅ | PRESERVADO |
| close_reason | ✅ | ✅ | PRESERVADO |
| failure_type | ❌ (en header) | ✅ | **AGREGADO** |
| folio | ❌ (en header) | ✅ | **AGREGADO** |
| Estado vacío | ✅ | ✅ | PRESERVADO |
| **TOTAL** | **4** | **6** | **✅ 100% + 2** |

**Mejoras agregadas:**
- ✅ Folio con botón de copiar funcional
- ✅ Tipo de falla destacado con AlertCircle
- ✅ Feedback visual (Check verde) en botón de copiar
- ✅ Colores diferenciados por tipo de campo
- ✅ leading-relaxed para mejor lectura

**Funciones de formateo:**
- `formatTicketFolio()` - **NUEVA**

**Condicionales:**
- Todos los campos condicionales preservados
- Estado vacío preservado
- NO se inventan datos

---

## TARJETA CLIENTE

### ANTES (Columna principal, líneas 552-637 de page.tsx)

**Ubicación:** Columna principal, cuarta (última) sección

**Campos:**

1. **Nombre**
   - Campo: `ticket.client?.name`
   - Formato: font-medium

2. **Teléfono (phone)**
   - Campo: `ticket.client?.phone`
   - Formato: enlace tel:, hover:text-blue-600
   - Condicional: solo si existe

3. **Dirección (address)**
   - Campo: `ticket.client?.address`
   - Formato: text-gray-900

4. **Referencia (reference)**
   - Campo: `ticket.client?.reference`
   - Formato: text-sm
   - Condicional: solo si existe

**Mapa:**

5. **Con coordenadas válidas**
   - Función: `hasValidCoordinates(ticket.client?.latitude, ticket.client?.longitude)`
   - Componente: `<ClientMapPreview latitude={...} longitude={...} clientName={...} />`
   - Botón: "Abrir en el mapa →" (función `openInMaps(lat, lng)`)
   - Destino: OpenStreetMap

6. **Sin coordenadas**
   - Estado vacío con SVG de pin
   - Mensaje: "Ubicación no disponible"
   - Botón: "Buscar dirección en Google Maps →" (función `searchAddressInGoogleMaps(address)`)
   - Condicional: solo si `ticket.client?.address` existe
   - Destino: Google Maps search API

**Total campos:** 4 + mapa condicional

---

### DESPUÉS (TicketClientCard.tsx)

**Ubicación:** Columna principal, cuarta (último) sección (mismo lugar)

**Campos:**

1. **Nombre** ✅
   - Campo: `client.name` - **PRESERVADO**
   - Formato: text-base font-medium truncate - **MEJORADO**
   - Ubicación: header junto a ícono User

2. **Teléfono (phone)** ✅
   - Campo: `client.phone` - **PRESERVADO**
   - Formato: enlace tel:, text-blue-600 hover:text-blue-800 - **MEJORADO**
   - Condicional: `{client.phone && (...)}` - **PRESERVADO**
   - **NUEVO:** Botón de copiar funcional (navigator.clipboard.writeText)
   - **NUEVO:** Feedback visual (Check verde 2s)
   - **NUEVO:** Ícono Phone en contenedor azul

3. **Dirección (address)** ✅
   - Campo: `client.address` - **PRESERVADO**
   - Formato: text-sm leading-relaxed - **MEJORADO**
   - **NUEVO:** Botón de copiar funcional (navigator.clipboard.writeText)
   - **NUEVO:** Feedback visual (Check verde 2s)
   - **NUEVO:** Ícono MapPin en contenedor verde

4. **Referencia (reference)** ✅
   - Campo: `client.reference` - **PRESERVADO**
   - Formato: text-sm leading-relaxed - **MEJORADO**
   - Condicional: `{client.reference && (...)}` - **PRESERVADO**
   - **NUEVO:** Ícono Navigation en contenedor ámbar

**Mapa:**

5. **Con coordenadas válidas** ✅
   - Función: `hasValidCoordinates(client.latitude, client.longitude)` - **PRESERVADA**
   - Componente: `<ClientMapPreview latitude={client.latitude!} longitude={client.longitude!} clientName={client.name} />` - **PRESERVADO SIN CAMBIOS**
   - **NOTA:** MAP-01 FAIL preservado, NO se tocó
   - Botón: "Abrir en el mapa" con ícono ExternalLink - **MEJORADO**
   - Función: `openInMaps(lat, lng)` - **PRESERVADA**
   - Destino: OpenStreetMap - **PRESERVADO**

6. **Sin coordenadas** ✅
   - Estado vacío con SVG de pin - **PRESERVADO**
   - Mensaje: "Ubicación no disponible" - **PRESERVADO**
   - Botón: "Buscar dirección en Google Maps" con ícono ExternalLink - **MEJORADO**
   - Función: `searchAddressInGoogleMaps(address)` - **PRESERVADA**
   - Condicional: `{client.address && (...)}` - **PRESERVADO**
   - Destino: Google Maps search API - **PRESERVADO**

**Total campos:** 4 + mapa condicional ✅

---

### VERIFICACIÓN: TARJETA CLIENTE

| Campo | ANTES | DESPUÉS | Estado |
|---|---|---|---|
| name | ✅ | ✅ | PRESERVADO |
| phone | ✅ | ✅ | PRESERVADO |
| address | ✅ | ✅ | PRESERVADO |
| reference | ✅ | ✅ | PRESERVADO |
| Mapa (con coords) | ✅ | ✅ | PRESERVADO |
| Mapa (sin coords) | ✅ | ✅ | PRESERVADO |
| ClientMapPreview | ✅ | ✅ | **SIN CAMBIOS** |
| openInMaps() | ✅ | ✅ | PRESERVADO |
| searchAddressInGoogleMaps() | ✅ | ✅ | PRESERVADO |
| hasValidCoordinates() | ✅ | ✅ | PRESERVADO |
| **TOTAL** | **4 + mapa** | **4 + mapa** | **✅ 100%** |

**Mejoras agregadas:**
- ✅ Botón de copiar teléfono (funcional)
- ✅ Botón de copiar dirección (funcional)
- ✅ Feedback visual (Check verde) en botones de copiar
- ✅ Iconos en contenedores de colores (Phone, MapPin, Navigation)
- ✅ Botón de mapa mejorado con ícono ExternalLink

**Funciones preservadas:**
- `hasValidCoordinates()` - PRESERVADA
- `openInMaps()` - PRESERVADA
- `searchAddressInGoogleMaps()` - PRESERVADA

**Componentes preservados:**
- `ClientMapPreview` - **SIN CAMBIOS** (MAP-01 FAIL preservado)

**Condicionales:**
- phone - PRESERVADO
- reference - PRESERVADO
- coordenadas válidas - PRESERVADO
- botón Google Maps - PRESERVADO

---

## RESUMEN GLOBAL

### TARJETA TIEMPOS
- **ANTES:** 8 campos/métricas
- **DESPUÉS:** 8 campos/métricas
- **PERDIDOS:** 0
- **AGREGADOS:** 0
- **ESTADO:** ✅ 100% PRESERVADO

### TARJETA INFORMACIÓN DEL TICKET
- **ANTES:** 4 campos + estado vacío
- **DESPUÉS:** 6 campos + estado vacío
- **PERDIDOS:** 0
- **AGREGADOS:** 2 (folio con copiar, failure_type destacado)
- **ESTADO:** ✅ 100% PRESERVADO + 2 MEJORAS

### TARJETA CLIENTE
- **ANTES:** 4 campos + mapa condicional
- **DESPUÉS:** 4 campos + mapa condicional
- **PERDIDOS:** 0
- **AGREGADOS:** 0 campos (2 botones de copiar funcionales)
- **ESTADO:** ✅ 100% PRESERVADO + MEJORAS FUNCIONALES

---

## FUNCIONES DE FORMATEO PRESERVADAS

| Función | Uso | Estado |
|---|---|---|
| `formatTicketAge()` | Antigüedad total | ✅ PRESERVADA |
| `formatTimeToAttention()` | Tiempo hasta atención | ✅ PRESERVADA |
| `formatAttentionTime()` | Tiempo de atención | ✅ PRESERVADA |
| `formatTotalTicketTime()` | Tiempo total | ✅ PRESERVADA |
| `formatTicketFolio()` | Folio del ticket | ✅ PRESERVADA |
| `hasValidCoordinates()` | Validación de coordenadas | ✅ PRESERVADA |

---

## FUNCIONES DE NAVEGACIÓN PRESERVADAS

| Función | Uso | Estado |
|---|---|---|
| `openInMaps(lat, lng)` | Abrir OpenStreetMap | ✅ PRESERVADA |
| `searchAddressInGoogleMaps(address)` | Buscar en Google Maps | ✅ PRESERVADA |

---

## COMPONENTES PRESERVADOS

| Componente | Modificado | Estado |
|---|---|---|
| `ClientMapPreview` | ❌ | ✅ **SIN CAMBIOS** |
| MAP-01 FAIL | ❌ | ✅ **PRESERVADO** |

---

## ESTADOS CONDICIONALES PRESERVADOS

| Estado | Tarjeta | Preservado |
|---|---|---|
| "Pendiente" (started_at null) | Tiempos | ✅ |
| "En curso" (closed_at null) | Tiempos | ✅ |
| Hito condicional (assigned_at) | Tiempos | ✅ |
| Hito condicional (started_at) | Tiempos | ✅ |
| Hito condicional (closed_at) | Tiempos | ✅ |
| Campo condicional (admin_notes) | Información | ✅ |
| Campo condicional (technician_notes) | Información | ✅ |
| Campo condicional (solution_text) | Información | ✅ |
| Campo condicional (close_reason) | Información | ✅ |
| Campo condicional (failure_type) | Información | ✅ |
| Estado vacío (sin contenido) | Información | ✅ |
| Campo condicional (phone) | Cliente | ✅ |
| Campo condicional (reference) | Cliente | ✅ |
| Mapa condicional (con coords) | Cliente | ✅ |
| Mapa condicional (sin coords) | Cliente | ✅ |
| Botón Google Maps (con address) | Cliente | ✅ |

---

## NUEVAS FUNCIONALIDADES AGREGADAS

| Funcionalidad | Tarjeta | Descripción |
|---|---|---|
| Botón copiar folio | Información | navigator.clipboard.writeText() + feedback 2s |
| Botón copiar teléfono | Cliente | navigator.clipboard.writeText() + feedback 2s |
| Botón copiar dirección | Cliente | navigator.clipboard.writeText() + feedback 2s |
| Feedback visual Check | Todas | Check verde por 2s en botones de copiar |
| Fecha de creación | Tiempos | Día, mes largo, año debajo de antigüedad |
| Iconografía premium | Todas | Íconos lucide-react en contenedores de color |
| Colores diferenciados | Información | Azul, morado, verde, gris por tipo de campo |

---

## CONCLUSIÓN

**TOTAL CAMPOS Y MÉTRICAS:**
- **ANTES:** 16 campos/métricas
- **DESPUÉS:** 18 campos/métricas
- **PERDIDOS:** 0 (0%)
- **PRESERVADOS:** 16 (100%)
- **AGREGADOS:** 2 (folio con copiar, failure_type destacado)

**FUNCIONES PRESERVADAS:** 6/6 (100%)
- formatTicketAge()
- formatTimeToAttention()
- formatAttentionTime()
- formatTotalTicketTime()
- formatTicketFolio()
- hasValidCoordinates()

**FUNCIONES DE NAVEGACIÓN:** 2/2 (100%)
- openInMaps()
- searchAddressInGoogleMaps()

**COMPONENTES EXTERNOS:** 1/1 (100%)
- ClientMapPreview (SIN CAMBIOS)

**ESTADOS CONDICIONALES:** 16/16 (100%)

**NUEVAS FUNCIONALIDADES:** 3 botones de copiar funcionales + mejoras visuales

**VERIFICACIÓN FINAL:** ✅ TODOS LOS CAMPOS Y MÉTRICAS PRESERVADOS AL 100%

---

## EVIDENCIA DE NO INVENTAR DATOS

| Campo | Origen | Verificación |
|---|---|---|
| Antigüedad | formatTicketAge(ticket.created_at) | ✅ Función real preservada |
| Tiempos | format*() funciones | ✅ Funciones reales preservadas |
| Hitos | ticket.assigned_at, started_at, closed_at | ✅ Condicionales preservados |
| Folio | formatTicketFolio(ticket.folio) | ✅ Función real preservada |
| Observaciones | ticket.admin_notes | ✅ Campo real preservado |
| Notas técnico | ticket.technician_notes | ✅ Campo real preservado |
| Solución | ticket.solution_text | ✅ Campo real preservado |
| Razón cierre | ticket.close_reason | ✅ Campo real preservado |
| Tipo falla | ticket.failure_type | ✅ Campo real preservado |
| Nombre cliente | client.name | ✅ Campo real preservado |
| Teléfono | client.phone | ✅ Campo real preservado |
| Dirección | client.address | ✅ Campo real preservado |
| Referencia | client.reference | ✅ Campo real preservado |
| Coordenadas | hasValidCoordinates() | ✅ Función real preservada |
| Mapa | ClientMapPreview | ✅ Componente real preservado |

**RESULTADO:** ✅ NINGÚN DATO INVENTADO, TODOS LOS CAMPOS PROVIENEN DE DATOS REALES

---

## PRESERVACIÓN DE MAP-01 FAIL

**ClientMapPreview:**
- ✅ Componente importado SIN CAMBIOS
- ✅ Props preservados EXACTOS: latitude, longitude, clientName
- ✅ MAP-01 FAIL conocido (recuadro gris) NO se tocó
- ✅ NO se intentó reparar el bug
- ✅ NO se usó imagen ficticia
- ✅ Estado de error/loading/sin coordenadas preservado

**Funciones de navegación:**
- ✅ openInMaps() preservada EXACTA
- ✅ searchAddressInGoogleMaps() preservada EXACTA
- ✅ Enlaces externos funcionales preservados

**Verificación:**
```typescript
// ANTES (page.tsx línea 586-598)
{hasValidCoordinates(ticket.client?.latitude, ticket.client?.longitude) ? (
  <div className="space-y-2">
    <ClientMapPreview
      latitude={ticket.client!.latitude!}
      longitude={ticket.client!.longitude!}
      clientName={ticket.client?.name}
    />
    <button onClick={() => openInMaps(ticket.client!.latitude!, ticket.client!.longitude!)}>
      Abrir en el mapa →
    </button>
  </div>
) : (...)}

// DESPUÉS (TicketClientCard.tsx líneas 135-149)
{hasValidCoordinates(client.latitude, client.longitude) ? (
  <div className="space-y-3">
    <ClientMapPreview
      latitude={client.latitude!}
      longitude={client.longitude!}
      clientName={client.name}
    />
    <button onClick={() => openInMaps(client.latitude!, client.longitude!)}>
      Abrir en el mapa
    </button>
  </div>
) : (...)}
```

**RESULTADO:** ✅ IDÉNTICO (solo mejoras de estilo en botón, componente SIN CAMBIOS)
