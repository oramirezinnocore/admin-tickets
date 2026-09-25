-- WIS-PERSONNEL-RBAC-01: Add SUPPORT role and personnel RBAC

-- Add SUPPORT to user_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUPPORT'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'SUPPORT';
    RAISE NOTICE 'Added SUPPORT to user_role enum';
  ELSE
    RAISE NOTICE 'SUPPORT already exists in user_role enum';
  END IF;
END$$;

-- Update is_admin_or_super to include SUPPORT for operational tasks
DROP FUNCTION IF EXISTS is_admin_or_super();
CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  role_value user_role;
BEGIN
  role_value := current_user_role();
  RETURN role_value = 'ADMIN' OR role_value = 'SUPER_ADMIN';
END;
$$;

-- Create helper function to check if user can access back office
CREATE OR REPLACE FUNCTION can_access_back_office()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  role_value user_role;
BEGIN
  role_value := current_user_role();
  RETURN role_value IN ('ADMIN', 'SUPER_ADMIN', 'SUPPORT');
END;
$$;

-- Update RLS policies for SUPPORT access

-- Profiles: SUPPORT can view profiles needed for operations
DROP POLICY IF EXISTS "SUPPORT can view profiles for operations" ON profiles;
CREATE POLICY "SUPPORT can view profiles for operations"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'SUPPORT'
    AND role IN ('ADMIN', 'SUPPORT', 'TECHNICIAN')
  );

-- Clients: SUPPORT has same read access as ADMIN
DROP POLICY IF EXISTS "SUPPORT can view all clients" ON clients;
CREATE POLICY "SUPPORT can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

DROP POLICY IF EXISTS "SUPPORT can insert clients" ON clients;
CREATE POLICY "SUPPORT can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() = 'SUPPORT');

DROP POLICY IF EXISTS "SUPPORT can update clients" ON clients;
CREATE POLICY "SUPPORT can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Technicians: SUPPORT can view technicians (needed for assignment)
DROP POLICY IF EXISTS "SUPPORT can view all technicians" ON technicians;
CREATE POLICY "SUPPORT can view all technicians"
  ON technicians FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Tickets: SUPPORT has same access as ADMIN
DROP POLICY IF EXISTS "SUPPORT can view all tickets" ON tickets;
CREATE POLICY "SUPPORT can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

DROP POLICY IF EXISTS "SUPPORT can insert tickets" ON tickets;
CREATE POLICY "SUPPORT can insert tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() = 'SUPPORT');

DROP POLICY IF EXISTS "SUPPORT can update tickets" ON tickets;
CREATE POLICY "SUPPORT can update tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Ticket Evidences: SUPPORT can view
DROP POLICY IF EXISTS "SUPPORT can view all evidences" ON ticket_evidences;
CREATE POLICY "SUPPORT can view all evidences"
  ON ticket_evidences FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Ticket Signatures: SUPPORT can view
DROP POLICY IF EXISTS "SUPPORT can view all signatures" ON ticket_signatures;
CREATE POLICY "SUPPORT can view all signatures"
  ON ticket_signatures FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Ticket Status History: SUPPORT can view
DROP POLICY IF EXISTS "SUPPORT can view all history" ON ticket_status_history;
CREATE POLICY "SUPPORT can view all history"
  ON ticket_status_history FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Technician Locations: SUPPORT can view (for map monitoring)
DROP POLICY IF EXISTS "SUPPORT can view all locations" ON technician_locations;
CREATE POLICY "SUPPORT can view all locations"
  ON technician_locations FOR SELECT
  TO authenticated
  USING (current_user_role() = 'SUPPORT');

-- Update close_ticket_with_validation to allow SUPPORT
DROP FUNCTION IF EXISTS close_ticket_with_validation(uuid, text);
CREATE OR REPLACE FUNCTION close_ticket_with_validation(
  p_ticket_id uuid,
  p_solution_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_evidence_count integer;
  v_signature_count integer;
  v_errors text[] := ARRAY[]::text[];
  v_caller_id uuid;
  v_caller_role user_role;
  v_caller_technician_id uuid;
BEGIN
  -- AUTHORIZATION: Get caller identity from auth context
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Get ticket
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado');
  END IF;

  -- AUTHORIZATION: Verify caller can close this ticket
  IF v_caller_role = 'TECHNICIAN' THEN
    -- Get caller's technician_id
    SELECT id INTO v_caller_technician_id
    FROM public.technicians
    WHERE profile_id = v_caller_id;

    -- Technician can only close their own assigned tickets
    IF v_ticket.technician_id IS NULL OR v_ticket.technician_id != v_caller_technician_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No autorizado: Solo puedes cerrar tickets asignados a ti'
      );
    END IF;
  ELSIF v_caller_role != 'ADMIN' AND v_caller_role != 'SUPER_ADMIN' AND v_caller_role != 'SUPPORT' THEN
    -- Other roles not authorized
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado para cerrar tickets');
  END IF;
  -- ADMIN, SUPER_ADMIN, and SUPPORT can close any ticket (with validation requirements)

  -- Validation 1: Ticket must have been started
  IF v_ticket.started_at IS NULL THEN
    v_errors := array_append(v_errors, 'El ticket no ha sido iniciado');
  END IF;

  -- Validation 2: Solution text is required and non-empty
  IF p_solution_text IS NULL OR trim(p_solution_text) = '' THEN
    v_errors := array_append(v_errors, 'La solución realizada es obligatoria');
  END IF;

  -- Validation 3: At least one evidence photo is required
  SELECT COUNT(*) INTO v_evidence_count
  FROM public.ticket_evidences
  WHERE ticket_id = p_ticket_id;

  IF v_evidence_count = 0 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos una fotografía de evidencia');
  END IF;

  -- Validation 4: Customer signature is required
  SELECT COUNT(*) INTO v_signature_count
  FROM public.ticket_signatures
  WHERE ticket_id = p_ticket_id;

  IF v_signature_count = 0 THEN
    v_errors := array_append(v_errors, 'Se requiere la firma del cliente');
  END IF;

  -- If there are validation errors, return them
  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faltan datos requeridos',
      'details', array_to_json(v_errors)
    );
  END IF;

  -- All validations passed - close the ticket
  UPDATE public.tickets
  SET
    status = 'RESOLVED',
    closed_at = now(),
    solution_text = trim(p_solution_text)
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'message', 'Ticket cerrado exitosamente');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error al cerrar el ticket',
      'details', SQLERRM
    );
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION close_ticket_with_validation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_ticket_with_validation(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION can_access_back_office() TO authenticated;

-- Comments
COMMENT ON FUNCTION can_access_back_office() IS
  'Returns true if current user can access back office (ADMIN, SUPER_ADMIN, or SUPPORT)';

COMMENT ON FUNCTION close_ticket_with_validation(uuid, text) IS
  'Closes a ticket with server-side validation and authorization. TECHNICIAN can only close assigned tickets. ADMIN/SUPER_ADMIN/SUPPORT can close any ticket but must satisfy all validation requirements (started, solution, evidence, signature).';
