# Wisper Logística

MVP de sistema de gestión de tickets para técnicos de campo con tracking GPS, SLA y optimización de rutas.

## Estructura

- **apps/admin**: Panel administrativo web (Next.js 16)
- **apps/technician**: App móvil para técnicos (React Native + Expo 57)
- **packages/shared**: Tipos, helpers y constantes compartidas
- **supabase**: Migraciones y esquema de base de datos

## Run Admin

```bash
cd apps/admin
npm install
npm run dev
```

Acceder en: http://localhost:3000

## Run Technician

```bash
cd apps/technician
npm install
npx expo start
```

Escanear QR con Expo Go o ejecutar en simulador.

## Supabase

### Aplicar migraciones

```bash
npx supabase db reset
```

O aplicar manualmente los archivos en `supabase/migrations/` en orden cronológico.

### Create Admin

Ejecutar en Supabase SQL Editor:

```sql
-- 1. Crear usuario admin via Supabase Auth Dashboard
-- Email: admin@wisper.com
-- Password: (tu contraseña)

-- 2. Obtener el user_id y ejecutar:
UPDATE profiles 
SET role = 'ADMIN', is_active = true 
WHERE id = 'user-id-here';
```

## Variables requeridas

### Admin (apps/admin/.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=xxxxx
GOOGLE_ROUTES_API_KEY=xxxxx
```

### Technician (apps/technician/.env.local)

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

## Build

```bash
# Shared package
cd packages/shared
npm run build

# Admin
cd apps/admin
npm run build

# Technician
cd apps/technician
npx expo export
```

## Funcionalidades

### Admin
- Dashboard con métricas y alertas operativas
- CRUD clientes
- CRUD técnicos
- Gestión de tickets (crear, asignar, reasignar, cancelar)
- Tracking SLA automático (GREEN/YELLOW/RED/OVERDUE)
- Mapa con ubicación de técnicos en tiempo real
- Optimización de rutas con Google Routes API
- Notificaciones de tickets críticos

### Técnico
- Login con email/password
- Vista de tickets asignados
- Iniciar/pausar/reanudar tickets
- Captura de evidencias fotográficas con GPS
- Firma digital del cliente
- Cierre de tickets con validaciones
- GPS tracking automático en foreground
- Alertas de tickets prioritarios

## Stack

- TypeScript strict
- Next.js 16 (App Router) + Tailwind CSS
- React Native + Expo 57
- Supabase (PostgreSQL, Auth, Storage, RLS)
- Google Maps + Routes API
- expo-location, expo-image-manipulator
- react-native-signature-canvas

## Seguridad

- RLS habilitado en todas las tablas
- Service role key NUNCA expuesta al frontend
- Rutas API server-side para operaciones privilegiadas
- Storage buckets privados con signed URLs
- Validación de roles en auth context

## Notas

- SLA: 0-24h=Verde, 24-48h=Amarillo, 48-72h=Rojo, >72h=Vencido
- Folio auto-generado con sequence PostgreSQL
- GPS tracking cada 60s o 50m de movimiento
- Máximo 20 tickets por optimización de ruta
