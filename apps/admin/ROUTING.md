# Routing Engine - OSRM

Este documento describe la integración de routing por calles usando OSRM (Open Source Routing Machine).

## Arquitectura

### Backend Abstraction

**NO** se realizan llamadas a OSRM directamente desde el browser. Todo el routing se maneja a través de nuestro backend:

```
Frontend → /api/routes/driving → OSRM → Geometría normalizada → Frontend
```

### Endpoint

**POST** `/api/routes/driving`

**Body:**
```json
{
  "technicianId": "uuid",
  "ticketIds": ["uuid1", "uuid2", ...]
}
```

**Respuesta:**
```json
{
  "orderedTicketIds": ["uuid1", "uuid2"],
  "geometry": {
    "type": "LineString",
    "coordinates": [[lon, lat], [lon, lat], ...]
  },
  "distanceMeters": 12800,
  "durationSeconds": 1920,
  "legs": [
    {
      "distanceMeters": 4300,
      "durationSeconds": 660
    },
    {
      "distanceMeters": 8500,
      "durationSeconds": 1260
    }
  ],
  "ticketsWithoutLocation": []
}
```

## Configuración

### Variable de Entorno

```bash
ROUTING_BASE_URL=https://router.project-osrm.org
```

**Desarrollo:** Apunta a la instancia pública de OSRM (DEV/QA ONLY - NO PARA PRODUCCIÓN)

**Producción:** Debe apuntar a una instancia self-hosted:
```bash
ROUTING_BASE_URL=http://osrm:5000
```

### Instancia Self-Hosted

Para producción, se debe desplegar una instancia OSRM propia con datos de México/Michoacán.

La arquitectura está preparada para esto. El frontend y backend NO están acoplados a ningún proveedor específico.

## Funcionamiento

### 1. Optimización de Orden

El orden de los tickets se calcula usando **nearest-neighbor** (conservado de la implementación anterior).

Este algoritmo usa distancia Haversine (línea recta) para determinar el orden óptimo de visitas.

### 2. Geometría de Ruta

Una vez determinado el orden, se envían las coordenadas ordenadas a OSRM:

```
tecnician.lng,tecnician.lat;ticket1.lng,ticket1.lat;ticket2.lng,ticket2.lat
```

OSRM devuelve:
- **Geometría real** que sigue calles
- **Distancia vial** (no línea recta)
- **Tiempo estimado** basado en velocidades del perfil `car`
- **Steps** (instrucciones turn-by-turn, guardadas pero no usadas aún)

### 3. Perfil de Routing

Se usa el perfil **`driving`** (automóvil) que:

✅ Sigue red vial de OpenStreetMap
✅ Respeta sentidos de circulación según OSM
✅ Respeta restricciones de giro disponibles en OSM
✅ Usa velocidades y pesos del perfil `car`

❌ **NO** conoce tráfico en tiempo real
❌ **NO** conoce accidentes actuales
❌ **NO** conoce cierres temporales
❌ **NO** conoce obras no registradas en OSM

### 4. Snap to Road

OSRM automáticamente ajusta los puntos a la red vial más cercana.

**IMPORTANTE:** Las coordenadas originales del cliente en la base de datos **NO se modifican**.

El snapping solo se usa para el cálculo de ruta.

## UI

### Resultados Mostrados

Después de generar la ruta:

```
Orden sugerido

1. #001012 — Cliente Norte
2. #001018 — Cliente Centro
3. #001021 — Cliente Sur

Resumen:

Distancia por carretera
14.7 km

Tiempo estimado de recorrido
31 min

Nota:
El tiempo es estimado y no considera tráfico en tiempo real.
El orden se calcula por proximidad geográfica.
```

### Visualización en Mapa

La ruta dibujada en MapLibre **sigue calles reales**, no líneas rectas.

La geometría devuelta por OSRM típicamente contiene 50-200+ coordenadas dependiendo de la complejidad de la ruta.

## Manejo de Errores

### NoRoute

Si OSRM no puede encontrar una ruta vehicular:

```
"No fue posible encontrar una ruta vehicular para todos los destinos seleccionados."
```

**NO** se vuelve silenciosamente a líneas rectas.

### Provider Down

Si OSRM no responde:

```
"El servicio de cálculo de rutas no está disponible temporalmente."
```

El mapa, tickets y selección siguen operativos.

### Timeout

Timeout configurado: **10 segundos**

Si OSRM tarda más:

```
"El servicio de cálculo de rutas tardó demasiado en responder."
```

## Seguridad

### Validaciones

- Mínimo 1 ticket, máximo 20
- Validación de coordenadas con `hasValidCoordinates()`
- Latitude: -90 a 90
- Longitude: -180 a 180
- NO se permite que el browser elija URL externa arbitraria

### ROUTING_BASE_URL

Esta variable **NO** es configurable por el usuario.

Solo puede ser modificada mediante variables de entorno del servidor.

## Próximas Mejoras (No Implementadas)

### OSRM Table API

Reemplazar nearest-neighbor por optimización basada en **tiempo real de red vial estimado** en lugar de distancia Haversine.

Esto requiere:
- Llamar a `/table/v1/driving` para obtener matriz de duraciones
- Adaptar algoritmo de optimización para usar duraciones en lugar de distancias
- Considerar tráfico estimado por tipo de vía

## Testing

### Casos de Prueba

**TC-ROAD-01:** Técnico y cliente separados por varias calles
- ✅ Línea sigue calles, no línea recta

**TC-ROAD-02:** Ruta incluye avenida con sentido único
- ✅ Routing sigue dirección permitida según OSM

**TC-ROAD-03:** Ruta con 2+ tickets
- ✅ technician → ticket 1 → ticket 2 por red vial

**TC-ROAD-04:** Mostrar distancia por carretera
- ✅ Visible en km

**TC-ROAD-05:** Mostrar tiempo estimado
- ✅ Visible en minutos

**TC-ROAD-06:** NoRoute
- ✅ Mensaje amigable

**TC-ROAD-07:** OSRM caído
- ✅ Mapa sigue operativo

**TC-ROAD-08:** Limpiar ruta
- ✅ Elimina route layer + numbered markers + summary

## Referencias

- [OSRM Documentation](http://project-osrm.org/)
- [OSRM API Reference](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md)
- [OpenStreetMap](https://www.openstreetmap.org/)
