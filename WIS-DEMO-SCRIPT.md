# Wisper Logística — Demo Script
**Duration: 8-12 minutes**

## Pre-Demo Setup (2 minutes before)

### 1. Verify Services Running
```bash
# Terminal 1: Admin Web
cd apps/admin
npm run dev
# Wait for: Ready on http://localhost:3000

# Terminal 2: Technician App (if using Expo Go)
cd apps/technician
npm start
# Scan QR code with Expo Go app
```

### 2. Verify Test Data
- Admin: admin@wisper.com / WisperAdmin2024!
- Technician: tecnico.e2e@wisper.com / E2ETechPass2024!
- E2E Clients exist
- E2E Tickets exist with various SLA states

### 3. Prepare Devices
- **Desktop/Laptop**: Browser at http://localhost:3000
- **Mobile Device**: Expo Go app with Technician app loaded
- Both logged out, ready for demo

---

## Demo Flow (8-12 minutes)

### PART 1: Admin Dashboard (2 minutes)

**Narrator:**
> "Wisper Logística es un sistema de gestión de tickets de servicio técnico. Vamos a ver cómo un administrador gestiona los servicios."

**Actions:**
1. Open Admin at http://localhost:3000
2. **Login** as admin@wisper.com
3. Show **Dashboard**:
   - "Aquí vemos los tickets pendientes, vencidos, y completados hoy"
   - Point to metrics cards

**Key Points:**
- Real-time metrics
- Clean, professional interface
- Spanish throughout

---

### PART 2: SLA Priority Management (2 minutes)

**Narrator:**
> "El sistema prioriza automáticamente por SLA. Los tickets más urgentes aparecen primero."

**Actions:**
1. Navigate to **Tickets** page
2. Show SLA color coding:
   - **OVERDUE** (vencido) - most critical
   - **RED** (crítico)
   - **YELLOW** (atención)
   - **GREEN** (normal)
3. "Los tickets se ordenan automáticamente por urgencia"

**Key Points:**
- Automatic SLA calculation based on creation time
- Visual priority system
- No manual sorting needed

---

### PART 3: Create New Ticket (2 minutes)

**Narrator:**
> "Vamos a crear un ticket de servicio y asignarlo a un técnico."

**Actions:**
1. Click **"Crear Ticket"** button
2. Fill form:
   - **Client**: Select "[E2E] Cliente Centro"
   - **Failure Type**: "Falla de conexión de internet"
   - **Priority**: 3 (normal)
   - **Technician**: Select "Técnico E2E"
3. Click **Save**
4. Show ticket appears in list immediately

**Key Points:**
- Simple, clear form
- Immediate assignment to technician
- No page refresh needed

---

### PART 4: Technician Mobile App (3 minutes)

**Narrator:**
> "El técnico recibe el ticket en su aplicación móvil inmediatamente."

**Actions:**
1. **Switch to mobile device**
2. Open Technician app
3. **Login** as tecnico.e2e@wisper.com
4. Show **Home screen**:
   - Active tickets counter
   - Newly created ticket visible
5. **Tap on the new ticket**
6. Show ticket detail:
   - Client name
   - Address
   - Problem description
   - Current status

**Key Points:**
- Real-time sync
- Mobile-optimized interface
- All info technician needs

---

### PART 5: Ticket Workflow (2 minutes)

**Narrator:**
> "El técnico inicia el trabajo y documenta el servicio."

**Actions:**
1. Tap **"Iniciar"** (Start) button
2. Show status changes to "In Review"
3. **Add Evidence**:
   - Tap camera/photo button
   - Take or select a photo
   - Show photo uploads and appears in ticket
4. **Add Signature**:
   - Tap signature button
   - Draw a simple signature
   - Save
5. **Complete Ticket**:
   - Tap "Completar" button
   - Show completion confirmation

**Key Points:**
- Simple workflow
- Photo evidence
- Digital signature for proof of service
- Clear status progression

---

### PART 6: Admin Verification (1 minute)

**Narrator:**
> "El administrador ve inmediatamente que el servicio fue completado."

**Actions:**
1. **Switch back to Admin browser**
2. Refresh or show dashboard auto-updates
3. Show metrics changed:
   - Pending tickets decreased
   - Closed today increased
4. Open the completed ticket
5. Show:
   - Status: "Resolved"
   - Evidence photo visible
   - Signature captured
   - Completion timestamp

**Key Points:**
- Real-time dashboard updates
- Full audit trail
- Evidence and signature preserved
- Complete transparency

---

## Optional Features (if time permits)

### GPS Tracking
**Narrator:**
> "El sistema también rastrea la ubicación del técnico en tiempo real (foreground)."

**Actions:**
1. Show Admin **Map** page
2. Point to technician location markers
3. "Esto ayuda a optimizar rutas y verificar que el técnico llegó al cliente"

### Status History
**Actions:**
1. In ticket detail, scroll to history
2. Show complete timeline:
   - Assigned
   - Started
   - Paused (if applicable)
   - Completed
3. "Tenemos un registro completo de cada cambio"

---

## Demo Closing (30 seconds)

**Narrator:**
> "Wisper Logística simplifica la gestión de servicios técnicos con:
> - Priorización automática por SLA
> - Aplicación móvil para técnicos
> - Documentación completa con fotos y firmas
> - Transparencia total del proceso"

**Final Screen:**
- Admin dashboard showing updated metrics
- Mobile app with completed ticket

---

## Troubleshooting

### If something doesn't appear immediately:
- "El sistema sincroniza en tiempo real, pero a veces toma unos segundos"
- Wait 2-3 seconds or do a soft refresh

### If camera doesn't work:
- Use gallery/photo picker as fallback
- "En producción el técnico usa la cámara del dispositivo"

### If map doesn't load:
- "El mapa requiere configuración de Google Maps API"
- Skip this section or show alternative view

### If network is slow:
- Acknowledge it naturally: "Estamos trabajando con conexión en vivo"
- Focus on features that are already loaded

---

## Post-Demo Q&A Prep

**Expected Questions:**

**Q: "¿Funciona offline?"**
A: "Actualmente requiere conexión. Offline es una mejora futura planeada."

**Q: "¿Puede personalizar los tipos de falla?"**
A: "Sí, completamente personalizable desde el panel de administración." (Note: implement if not present)

**Q: "¿Cuántos técnicos soporta?"**
A: "Ilimitado. El sistema escala según necesidad."

**Q: "¿Qué pasa si el cliente no puede firmar?"**
A: "La firma puede ser opcional según configuración del administrador."

**Q: "¿Se pueden agregar más campos al ticket?"**
A: "Sí, el sistema es extensible y personalizable."

**Q: "¿Tiene reportes?"**
A: "El dashboard muestra métricas en tiempo real. Reportes detallados en roadmap."

---

## Success Metrics

Demo is successful if audience understands:
1. ✅ SLA-based prioritization
2. ✅ Admin creates and assigns tickets
3. ✅ Technician receives and completes work via mobile
4. ✅ Evidence and signature capture
5. ✅ Real-time visibility for admin

Demo is **excellent** if audience sees:
6. ✅ GPS tracking
7. ✅ Complete status history
8. ✅ Professional, polished UI
9. ✅ Fast, responsive performance
10. ✅ No visible bugs or errors
