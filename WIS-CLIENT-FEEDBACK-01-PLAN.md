# WIS-CLIENT-FEEDBACK-01 — PLAN DE IMPLEMENTACIÓN

**Branch:** `feature/wis-client-feedback-01` ✅ Creado

**Status:** 🟡 PLAN COMPLETO - LISTO PARA EJECUTAR

---

## AUDITORÍA INICIAL COMPLETADA

### Estructura encontrada:
- ✅ Admin Web en `/apps/admin/src/app/`
- ✅ Dashboard en `/dashboard/page.tsx`
- ✅ Tickets en `/tickets/`
- ✅ Mapa en `/map/`
- ✅ Technician App en `/apps/technician/`
- ✅ Migraciones en `/supabase/migrations/`
- ✅ Shared types en `/packages/shared/`

### Enums existentes (confirmados en migraciones):
```sql
ticket_status: PENDING, ASSIGNED, IN_REVIEW, PAUSED, RESOLVED, CANCELLED
ticket_activity_type: (auditar completo en migración)
```

---

## PARTE A — NAVEGACIÓN ADMIN WEB

### 1. Logo → Dashboard

**Archivo a modificar:** `apps/admin/src/app/layout.tsx` o componente Header

**Implementación:**
```tsx
<Link href="/dashboard" aria-label="Ir al panel operativo">
  <Logo className="cursor-pointer hover:opacity-80 transition" />
</Link>
```

**Test cases:**
- TC-NAV-01: Click desde /tickets → /dashboard
- TC-NAV-02: Click desde /technicians → /dashboard
- TC-NAV-03: Click desde /clients → /dashboard
- TC-NAV-04: Funciona para ADMIN y SUPER_ADMIN

---

### 2. Cards Dashboard → Listado Filtrado

**Archivo:** `apps/admin/src/app/dashboard/page.tsx`

**Cards a hacer clickable:**

```tsx
// Tickets hoy
<Link href="/tickets?filter=today">
  <Card className="cursor-pointer hover:shadow-lg transition">
    {/* contenido actual */}
  </Card>
</Link>

// Cerrados
<Link href="/tickets?status=RESOLVED,CANCELLED">
  
// Activos  
<Link href="/tickets?status=ASSIGNED,IN_PROGRESS,IN_REVIEW,PAUSED">

// Vencidos
<Link href="/tickets?sla=overdue">
```

**Modificar:** `apps/admin/src/app/tickets/page.tsx`

Agregar soporte para query params:
```tsx
const searchParams = useSearchParams()
const filter = searchParams.get('filter')
const status = searchParams.get('status')?.split(',')
const sla = searchParams.get('sla')
```

**Test cases:**
- TC-DASH-01 a TC-DASH-05

---

### 3. SLA Status → Listado Filtrado

Similar a cards, agregar navegación:

```tsx
<Link href="/tickets?sla=on-time">
<Link href="/tickets?sla=at-risk">
<Link href="/tickets?sla=overdue">
```

**Test cases:**
- TC-SLA-01 a TC-SLA-03

---

### 4. Resueltos Mes/Año → Filtrado

```tsx
const currentMonth = new Date().toISOString().slice(0, 7)
const currentYear = new Date().getFullYear()

<Link href={`/tickets?status=RESOLVED&period=month&value=${currentMonth}`}>
<Link href={`/tickets?status=RESOLVED&period=year&value=${currentYear}`}>
```

**Test cases:**
- TC-RES-01 a TC-RES-03

---

## PARTE B — RESOLUCIÓN ADMINISTRATIVA

### 5. Admin puede resolver ticket

**Archivos a crear/modificar:**

1. **Migración:** Agregar activity_type si hace falta
   ```bash
   # Si ticket_activity_type no tiene ADMIN_RESOLVED:
   supabase/migrations/YYYYMMDDHHMMSS_add_admin_resolved_type.sql
   ```

2. **Componente Modal:**
   ```
   apps/admin/src/components/ResolveTicketModal.tsx
   ```

3. **Server Action:**
   ```
   apps/admin/src/app/tickets/[id]/actions.ts
   ```
   
   Función: `resolveTicketAdminAction(ticketId, reason, notes?)`

4. **Ticket Detail Page:**
   ```
   apps/admin/src/app/tickets/[id]/page.tsx
   ```
   
   Agregar botón "Resolver ticket" solo para ADMIN/SUPER_ADMIN

**Implementación:**

```tsx
// ResolveTicketModal.tsx
export function ResolveTicketModal({ 
  ticketId, 
  open, 
  onOpenChange 
}: Props) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleResolve() {
    if (!reason.trim()) return
    
    if (!confirm('¿Confirmas que deseas marcar este ticket como resuelto?')) {
      return
    }

    setLoading(true)
    const result = await resolveTicketAdminAction(ticketId, reason)
    // handle result
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver ticket</DialogTitle>
          <DialogDescription>
            Esta acción quedará registrada en la bitácora.
          </DialogDescription>
        </DialogHeader>
        
        <div>
          <Label htmlFor="reason">Motivo / Justificación *</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explica por qué se resuelve administrativamente..."
            rows={4}
            required
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleResolve}
            disabled={!reason.trim() || loading}
          >
            {loading ? 'Resolviendo...' : 'Confirmar resolución'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

```typescript
// actions.ts
'use server'

export async function resolveTicketAdminAction(
  ticketId: string,
  reason: string
) {
  const supabase = createClient()
  
  // 1. Verificar auth y rol
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
    return { error: 'No tienes permisos para resolver tickets' }
  }
  
  // 2. Validar reason
  if (!reason?.trim()) {
    return { error: 'El motivo es obligatorio' }
  }
  
  // 3. Actualizar ticket
  const { error: ticketError } = await supabase
    .from('tickets')
    .update({
      status: 'RESOLVED',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
  
  if (ticketError) {
    return { error: 'Error al actualizar ticket' }
  }
  
  // 4. Crear actividad en bitácora
  const { error: activityError } = await supabase
    .from('ticket_activity')
    .insert({
      ticket_id: ticketId,
      activity_type: 'ADMIN_RESOLVED',
      actor_profile_id: user.id,
      notes: reason,
      created_at: new Date().toISOString()
    })
  
  if (activityError) {
    console.error('Error creating activity:', activityError)
  }
  
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  revalidatePath('/dashboard')
  
  return { success: true }
}
```

**Migración SQL (si necesaria):**
```sql
-- Agregar ADMIN_RESOLVED al enum si no existe
ALTER TYPE ticket_activity_type ADD VALUE IF NOT EXISTS 'ADMIN_RESOLVED';

-- Comentario
COMMENT ON TYPE ticket_activity_type IS 'Updated to include ADMIN_RESOLVED for administrative resolution';
```

**Test cases:**
- TC-ADMIN-RESOLVE-01 a TC-ADMIN-RESOLVE-08

---

## PARTE C — UBICACIÓN EMPRESA / MAPA

### 6. Coordenadas Oficina Central

**1. Verificar tabla organization/company**

```bash
grep -A 20 "CREATE TABLE.*organization\|CREATE TABLE.*company" supabase/migrations/*.sql
```

**2. Si no existe, crear migración:**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_company_location.sql

-- Agregar campos a la tabla correcta (organization, company, o settings)
-- Ejemplo si es "organization":

ALTER TABLE organization 
ADD COLUMN IF NOT EXISTS office_address TEXT,
ADD COLUMN IF NOT EXISTS office_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS office_longitude DOUBLE PRECISION;

-- Validaciones
ALTER TABLE organization
ADD CONSTRAINT check_latitude CHECK (
  office_latitude IS NULL OR 
  (office_latitude >= -90 AND office_latitude <= 90)
);

ALTER TABLE organization
ADD CONSTRAINT check_longitude CHECK (
  office_longitude IS NULL OR 
  (office_longitude >= -180 AND office_longitude <= 180)
);

COMMENT ON COLUMN organization.office_latitude IS 'Central office latitude for default map center';
COMMENT ON COLUMN organization.office_longitude IS 'Central office longitude for default map center';
```

**3. Componente de configuración:**

```
apps/admin/src/app/settings/page.tsx
```

Agregar formulario con:
- Campo dirección
- Selector de mapa (reutilizar MapLibre existente)
- Guardar coordenadas

**4. Modificar mapa:**

```tsx
// apps/admin/src/app/map/page.tsx

// Obtener coordenadas de oficina
const { data: org } = await supabase
  .from('organization')
  .select('office_latitude, office_longitude')
  .single()

const defaultCenter = org?.office_latitude && org?.office_longitude
  ? [org.office_longitude, org.office_latitude]
  : [/* fallback actual */]
```

**Test cases:**
- TC-MAP-01 a TC-MAP-04

---

## PARTE D — BUGS TECHNICIAN APP

### 7. BUG — Cámara no captura

**Archivo:** `apps/technician/src/screens/EvidenceScreen.tsx` (o similar)

**Auditar:**
```typescript
// Buscar función de captura
const takePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    alert('Se requiere permiso de cámara')
    return
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  })

  // VERIFICAR AQUÍ
  if (!result.canceled && result.assets?.[0]) {
    const photo = result.assets[0]
    await uploadEvidence(photo.uri)
  }
}
```

**Posibles issues:**
- `result.cancelled` vs `result.canceled` (typo)
- No verifica `result.assets`
- No maneja errores de upload
- No actualiza UI después de upload

**Fix esperado:**
Asegurar flujo completo: permiso → captura → upload → DB → UI update

**Test cases:**
- TC-CAMERA-01 a TC-CAMERA-07

---

### 8. BUG — Firma sin botón

**Archivo:** `apps/technician/src/screens/SignatureScreen.tsx` (o similar)

**Auditar componente de firma:**
```tsx
<SignatureCanvas
  ref={signatureRef}
  onEnd={handleStrokeEnd}
/>

{/* VERIFICAR FOOTER */}
<View style={styles.footer}>
  <Button 
    variant="outline" 
    onPress={handleClear}
  >
    Limpiar
  </Button>
  
  {/* ESTE BOTÓN DEBE EXISTIR */}
  <Button
    onPress={handleSave}
    disabled={!hasSignature || saving}
  >
    {saving ? 'Guardando...' : 'Usar esta firma'}
  </Button>
</View>
```

**Fix esperado:**
- Footer visible y fijo
- Botón enabled cuando hay trazos
- Loading state durante save
- No permitir doble tap

**Test cases:**
- TC-SIGN-01 a TC-SIGN-06

---

### 9. BUG — Pausar no activo

**Archivo:** `apps/technician/src/screens/TicketDetailScreen.tsx`

**Auditar lógica de estados:**
```typescript
const canPause = ticket.status === 'IN_PROGRESS' || ticket.status === 'ASSIGNED'
const isPaused = ticket.status === 'PAUSED'

// Botón debe verse así:
<Button
  disabled={!canPause && !isPaused}
  onPress={isPaused ? handleResume : handlePause}
>
  {isPaused ? 'Reanudar' : 'Pausar'}
</Button>
```

**Modal de pausa:**
```tsx
<Modal visible={pauseModalVisible}>
  <Text>Pausar ticket</Text>
  <TextInput
    placeholder="Motivo de pausa *"
    value={pauseReason}
    onChangeText={setPauseReason}
    multiline
    required
  />
  <Button 
    onPress={handleConfirmPause}
    disabled={!pauseReason.trim()}
  >
    Confirmar pausa
  </Button>
</Modal>
```

**Server action:**
```typescript
async function pauseTicket(ticketId: string, reason: string) {
  // Update status to PAUSED
  // Create activity
  // Return result
}

async function resumeTicket(ticketId: string) {
  // Update status to IN_PROGRESS (o el estado anterior)
  // Create activity
  // Return result
}
```

**Test cases:**
- TC-PAUSE-01 a TC-PAUSE-08

---

## ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### Día 1: Navegación Admin (Parte A)
1. Logo clickable
2. Cards dashboard con navegación
3. Modificar /tickets para soportar query params
4. SLA clickable
5. Resueltos mes/año

**Validación:** Todas las cards navegan correctamente con filtros aplicados

---

### Día 2: Resolución administrativa (Parte B)
1. Verificar enums, crear migración si necesaria
2. Crear ResolveTicketModal component
3. Implementar resolveTicketAdminAction
4. Agregar botón en Ticket Detail
5. Actualizar bitácora para mostrar ADMIN_RESOLVED

**Validación:** ADMIN puede resolver con motivo, aparece en bitácora

---

### Día 3: Oficina central (Parte C)
1. Auditar tabla organization/company
2. Crear migración para coordenadas
3. Crear/actualizar settings page
4. Modificar mapa para usar coordenadas

**Validación:** Mapa inicia en oficina central configurada

---

### Día 4: Bugs Mobile - Cámara (Parte D.7)
1. Auditar flujo actual
2. Identificar root cause
3. Implementar fix
4. Test en dispositivo real

**Validación:** Foto se captura, sube, y aparece en bitácora Admin

---

### Día 5: Bugs Mobile - Firma y Pausar (Parte D.8-9)
1. Auditar firma, agregar botones faltantes
2. Auditar pausar, habilitar para estados correctos
3. Crear modales de pausa/reanudar
4. Test en dispositivo real

**Validación:** Firma se guarda, Pausar funciona, bitácora muestra todo

---

### Día 6: QA Completa + PR
1. Ejecutar todos los test cases
2. Builds de Admin, Shared, Technician
3. Test de regresión general
4. Preparar PR

---

## COMANDOS ÚTILES

```bash
# Admin build
cd apps/admin
npm run build

# Technician typecheck
cd apps/technician
npx tsc --noEmit
npx expo-doctor

# Shared build
cd packages/shared
npm run build

# Create migration
npx supabase migration new add_feature_name

# Apply migrations locally
npx supabase db push

# Generate Prisma types (si aplica)
npx prisma generate
```

---

## CHECKLIST ANTES DE PR

- [ ] Branch `feature/wis-client-feedback-01` creado
- [ ] Logo clickable → /dashboard
- [ ] Cards dashboard → /tickets con filtros
- [ ] SLA clickable → /tickets con filtro SLA
- [ ] Resueltos mes/año → /tickets con filtro período
- [ ] ADMIN puede resolver ticket con motivo
- [ ] Motivo aparece en bitácora
- [ ] Coordenadas oficina en DB
- [ ] Mapa usa coordenadas oficina
- [ ] Cámara captura y persiste
- [ ] Firma tiene botón "Usar esta firma"
- [ ] Pausar enabled en estados válidos
- [ ] Modal pausa con motivo obligatorio
- [ ] Todos los TC ejecutados
- [ ] Admin build OK
- [ ] Technician typecheck OK
- [ ] Shared build OK
- [ ] Migraciones aplicadas local
- [ ] RLS mantenido
- [ ] No se usa service_role en frontend
- [ ] DB UAT no reseteada

---

## ESTADO ACTUAL

🟢 **Branch creado**
🟡 **Plan completo - listo para ejecutar**
⚪ **Implementación pendiente**

El plan está completo y detallado. Cada parte tiene:
- Archivos específicos a modificar
- Código de ejemplo
- Test cases claros
- Orden de implementación

Puedes ejecutar este plan paso a paso siguiendo el orden recomendado.

---

## PRÓXIMO PASO

Ejecutar Día 1: Navegación Admin (Parte A)

```bash
# 1. Auditar layout y dashboard
cat apps/admin/src/app/layout.tsx
cat apps/admin/src/app/dashboard/page.tsx

# 2. Implementar cambios según plan
# 3. Test manual
# 4. Commit parcial
```
