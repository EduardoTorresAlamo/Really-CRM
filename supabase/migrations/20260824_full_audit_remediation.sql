-- Really CRM — Migración Integral de Remediación (Auditoría 2026-08-24)
-- Ejecutar en el SQL Editor de Supabase

-- 1. Índices de Rendimiento Faltantes
CREATE INDEX IF NOT EXISTS idx_follow_ups_client_id ON follow_ups(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_realtor_scheduled ON follow_ups(realtor_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_documents_realtor_created ON documents(realtor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_history_realtor_created ON client_history(realtor_id, created_at DESC);

-- 2. Restricciones de Integridad y Rangos Numéricos
ALTER TABLE clients
  ADD CONSTRAINT chk_clients_budget_positive CHECK (
    (budget_min IS NULL OR budget_min >= 0) AND
    (budget_max IS NULL OR budget_max >= 0)
  ),
  ADD CONSTRAINT chk_clients_budget_range CHECK (
    budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max
  ),
  ADD CONSTRAINT chk_clients_bedrooms_range CHECK (
    (bedrooms_min IS NULL OR bedrooms_min >= 0) AND
    (bedrooms_max IS NULL OR bedrooms_max >= 0) AND
    (bedrooms_min IS NULL OR bedrooms_max IS NULL OR bedrooms_min <= bedrooms_max)
  ),
  ADD CONSTRAINT chk_clients_bathrooms_range CHECK (
    (bathrooms_min IS NULL OR bathrooms_min >= 0) AND
    (bathrooms_max IS NULL OR bathrooms_max >= 0) AND
    (bathrooms_min IS NULL OR bathrooms_max IS NULL OR bathrooms_min <= bathrooms_max)
  );

-- 3. Unicidad de Correo en Perfiles
ALTER TABLE profiles
  ADD CONSTRAINT uq_profiles_email UNIQUE (email);

-- 4. Trigger de Auditoría Automatizado e Inmutable para Clientes
CREATE OR REPLACE FUNCTION fn_audit_client_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO client_history (client_id, realtor_id, event_type, description, metadata)
    VALUES (NEW.id, NEW.realtor_id, 'created', 'Client "' || NEW.name || '" was created', jsonb_build_object('source', 'database_trigger'));
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.stage IS DISTINCT FROM NEW.stage) THEN
      INSERT INTO client_history (client_id, realtor_id, event_type, description, metadata)
      VALUES (NEW.id, NEW.realtor_id, 'stage_change', 'Stage changed from ' || OLD.stage || ' to ' || NEW.stage, jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage));
    END IF;
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO client_history (client_id, realtor_id, event_type, description, metadata)
      VALUES (NEW.id, NEW.realtor_id, 'status_change', 'Status changed from ' || OLD.status || ' to ' || NEW.status, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_clients ON clients;
CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE fn_audit_client_changes();

-- 5. Función RPC Consolidada para Estadísticas de Dashboard (1 Round-trip)
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_realtor_id uuid, p_today date)
RETURNS json LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_total_clients bigint;
  v_active_buyers bigint;
  v_active_sellers bigint;
  v_overdue_followups bigint;
BEGIN
  SELECT count(*) INTO v_total_clients
  FROM clients WHERE realtor_id = p_realtor_id;

  SELECT count(*) INTO v_active_buyers
  FROM clients WHERE realtor_id = p_realtor_id AND client_type = 'buyer' AND status = 'active';

  SELECT count(*) INTO v_active_sellers
  FROM clients WHERE realtor_id = p_realtor_id AND client_type = 'seller' AND status = 'active';

  SELECT count(*) INTO v_overdue_followups
  FROM follow_ups WHERE realtor_id = p_realtor_id AND completed = false AND scheduled_date < p_today;

  RETURN json_build_object(
    'totalClients', v_total_clients,
    'activeBuyers', v_active_buyers,
    'activeSellers', v_active_sellers,
    'overdueFollowUps', v_overdue_followups
  );
END;
$$;
