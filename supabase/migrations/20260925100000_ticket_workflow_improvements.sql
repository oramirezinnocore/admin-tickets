-- WIS-TICKET-WORKFLOW-01
-- Improvements to ticket workflow: auto-set started_at, server-side closing validation

-- ============================================================================
-- TRIGGER: Auto-set started_at when ticket moves to IN_REVIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION set_ticket_started_at()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to IN_REVIEW for the first time, set started_at to now()
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'IN_REVIEW'
     AND (OLD.status IS DISTINCT FROM 'IN_REVIEW')
     AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_started_at_trigger
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_started_at();

COMMENT ON FUNCTION set_ticket_started_at IS
  'Automatically sets started_at timestamp when ticket transitions to IN_REVIEW status for the first time';

-- ============================================================================
-- RPC: Close ticket with server-side validation
-- ============================================================================

CREATE OR REPLACE FUNCTION close_ticket_with_validation(
  p_ticket_id uuid,
  p_solution_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket tickets%ROWTYPE;
  v_evidence_count integer;
  v_signature_count integer;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  -- Get ticket
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket no encontrado'
    );
  END IF;

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
  FROM ticket_evidences
  WHERE ticket_id = p_ticket_id;

  IF v_evidence_count = 0 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos una fotografía de evidencia');
  END IF;

  -- Validation 4: Customer signature is required
  SELECT COUNT(*) INTO v_signature_count
  FROM ticket_signatures
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
  UPDATE tickets
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

GRANT EXECUTE ON FUNCTION close_ticket_with_validation(uuid, text) TO authenticated;

COMMENT ON FUNCTION close_ticket_with_validation IS
  'Closes a ticket with server-side validation: requires started_at, solution, evidence, and signature';
