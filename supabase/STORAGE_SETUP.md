# Storage Setup

Ejecutar desde Supabase Dashboard o CLI:

## Crear Buckets

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('ticket-evidences', 'ticket-evidences', false),
  ('ticket-signatures', 'ticket-signatures', false);
```

## Políticas de Storage

### ticket-evidences

```sql
-- Admins pueden subir
CREATE POLICY "Admins can upload evidences"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-evidences' AND
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Técnicos pueden subir evidencias de sus tickets
CREATE POLICY "Technicians can upload evidences for their tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-evidences' AND
  (SELECT id FROM technicians WHERE profile_id = auth.uid()) IS NOT NULL
);

-- Admins y técnicos asignados pueden leer
CREATE POLICY "Admins and assigned technicians can read evidences"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-evidences' AND
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' OR
    (SELECT id FROM technicians WHERE profile_id = auth.uid()) IS NOT NULL
  )
);
```

### ticket-signatures

```sql
-- Admins pueden subir
CREATE POLICY "Admins can upload signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-signatures' AND
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Técnicos pueden subir firmas de sus tickets
CREATE POLICY "Technicians can upload signatures for their tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-signatures' AND
  (SELECT id FROM technicians WHERE profile_id = auth.uid()) IS NOT NULL
);

-- Admins y técnicos asignados pueden leer
CREATE POLICY "Admins and assigned technicians can read signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-signatures' AND
  (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' OR
    (SELECT id FROM technicians WHERE profile_id = auth.uid()) IS NOT NULL
  )
);
```
