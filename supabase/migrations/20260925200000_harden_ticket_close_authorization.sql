-- WIS-TICKET-METRICS-01: Fix authorization vulnerability in close_ticket_with_validation
-- CRITICAL: The function was SECURITY DEFINER without authorization checks,
-- allowing ANY authenticated user to close ANY ticket.

-- Drop and recreate function with proper authorization
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
  -- AUTHORIZATION: Get caller identity from auth context (cannot be spoofed)
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No autenticado'
    );
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;

  -- Get ticket
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket no encontrado'
    );
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
  ELSIF v_caller_role != 'ADMIN' AND v_caller_role != 'SUPER_ADMIN' THEN
    -- Other roles not authorized
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No autorizado para cerrar tickets'
    );
  END IF;
  -- ADMIN and SUPER_ADMIN can close any ticket (existing authorization model)

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
  -- closed_at is server-generated (database timestamp)
  UPDATE public.tickets
  SET
    status = 'RESOLVED',
    closed_at = now(),
    solution_text = trim(p_solution_text)
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ticket cerrado exitosamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error al cerrar el ticket',
      'details', SQLERRM
    );
END;
$$;

-- Restrict EXECUTE permissions
-- First revoke from PUBLIC (PostgreSQL default can be permissive)
REVOKE ALL ON FUNCTION close_ticket_with_validation(uuid, text) FROM PUBLIC;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION close_ticket_with_validation(uuid, text) TO authenticated;

COMMENT ON FUNCTION close_ticket_with_validation(uuid, text) IS
  'Closes a ticket with server-side validation and authorization. Uses auth.uid() for caller identity. Technicians can only close their own tickets. ADMIN/SUPER_ADMIN can close any ticket. Requires started_at, solution, evidence, and signature.';
