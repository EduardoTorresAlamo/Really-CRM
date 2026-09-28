# AUDITORÍA DE ESQUEMA Y BASE DE DATOS SUPABASE / POSTGRESQL
**Proyecto:** Really-CRM  
**Fecha:** 22 de Septiembre de 2026  
**Alcance:** Tablas, Tipos ENUM, Políticas RLS, Triggers, Índices, Restricciones y Supabase Storage  

---

## 1. RESUMEN DEL ESQUEMA Y MODELO DE DATOS

El modelo de base de datos de Really-CRM está organizado en torno a 6 entidades relacionales:
1. `profiles`: Perfiles de agentes inmobiliarios (realtors), vinculados 1:1 con `auth.users(id)`.
2. `clients`: Clientes compradores y vendedores administrados por cada agente.
3. `email_templates`: Plantillas personalizadas de correo por agente.
4. `documents`: Documentos cargados por cliente (identificaciones, preaprobaciones, contratos).
5. `follow_ups`: Tareas y llamadas de seguimiento agendadas por cliente.
6. `client_history`: Registro inmutable de eventos de auditoría por cliente.

```
                    ┌─────────────────────────┐
                    │       auth.users        │
                    └────────────┬────────────┘
                                 │ 1:1
                    ┌────────────▼────────────┐
                    │        profiles         │
                    └────────────┬────────────┘
                                 │ 1:N
            ┌─────────────────────┼─────────────────────┐
            │ 1:N                 │ 1:N                 │ 1:N
 ┌──────────▼──────────┐ ┌────────▼──────────┐ ┌────────▼──────────┐
 │   email_templates   │ │      clients      │ │     documents     │
 └─────────────────────┘ └────────┬──────────┘ └───────────────────┘
                                  │ 1:N
                     ┌────────────┴────────────┐
                     │ 1:N                     │ 1:N
          ┌──────────▼──────────┐   ┌──────────▼──────────┐
          │     follow_ups      │   │   client_history    │
          └─────────────────────┘   └─────────────────────┘
```

---

## 2. HALLAZGOS CRÍTICOS Y SCHEMA DRIFT

### 2.1 [CRITICAL] Ausencia de Trigger `handle_new_user` en `auth.users` (Esquema Base `schema.sql`)
- **Diagnóstico:**  
  Al registrarse un nuevo agente mediante OTP/Magic Link, Supabase inserta el usuario en `auth.users`. Sin embargo, el archivo base `schema.sql` no define ningún trigger que cree la fila en `public.profiles`.  
  *Actualización (20 de Septiembre de 2026):* El commit `b88f5e6` añadió la migración `supabase/migrations/20260920_handle_new_user_trigger.sql` que soluciona el problema al correr migraciones con Supabase CLI. No obstante, `supabase/schema.sql` aún no ha sido sincronizado, lo que mantiene el Schema Drift activo para instalaciones directas o entornos nuevos sin pipeline de migraciones.
- **Efecto:**  
  Como `clients.realtor_id` tiene una restricción de integridad referencial obligatoria `REFERENCES profiles(id) ON DELETE CASCADE`, cuando el usuario intenta agregar un cliente, la operación falla catastróficamente con error de violación de clave foránea.
- **Solución SQL:**
  ```sql
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  ```

---

### 2.2 [HIGH] Falta de Políticas RLS `FOR UPDATE` en `storage.objects`
- **Diagnóstico:**  
  Las funciones de carga en `lib/storage/uploadFile.ts` utilizan `{ upsert: true }`. Si un archivo con la misma ruta ya existe (por ejemplo, al actualizar la foto de perfil en `${userId}/avatar.png`), Supabase Storage ejecuta un comando SQL `UPDATE` sobre la tabla `storage.objects`.  
  El archivo `schema.sql` solo tiene políticas `INSERT`, `SELECT` y `DELETE`.
- **Efecto:**  
  Las actualizaciones de foto de perfil y re-subidas de documentos fallan con error `403 Forbidden` (`Failed to upload photo`).
- **Solución SQL:**
  ```sql
  CREATE POLICY "Update own avatar" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'avatars' AND
      auth.uid()::text = (storage.foldername(name))[1]
    ) WITH CHECK (
      bucket_id = 'avatars' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );

  CREATE POLICY "Update own documents" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'documents' AND
      auth.uid()::text = (storage.foldername(name))[1]
    ) WITH CHECK (
      bucket_id = 'documents' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
  ```

---

### 2.3 [HIGH] Desincronización Crítica de `schema.sql` (Schema Drift)
- **Diagnóstico:**  
  El archivo `supabase/schema.sql` es el script referenciado en la documentación para aprovisionar nuevas instancias de base de datos. Sin embargo, no incluye los siguientes objetos que el código de la aplicación asume que existen:
  1. **Función RPC `get_dashboard_stats(p_realtor_id uuid, p_today date)`:** Invocada directamente en `app/(app)/dashboard/page.tsx:24`. Si la base de datos se inicializa con `schema.sql`, el dashboard se rompe inmediatamente arrojando error 500.
  2. **Restricciones CHECK de Integridad:** `chk_clients_budget_positive`, `chk_clients_budget_range`, `chk_clients_bedrooms_range`, `chk_clients_bathrooms_range`.
  3. **Restricción `UNIQUE` en `profiles(email)`.**
  4. **Índices de Rendimiento Compuestos:**
     - `idx_follow_ups_client_id`
     - `idx_follow_ups_realtor_scheduled` (`realtor_id, scheduled_date`)
     - `idx_documents_realtor_created` (`realtor_id, created_at DESC`)
     - `idx_client_history_realtor_created` (`realtor_id, created_at DESC`)
  5. **Trigger de Auditoría `trg_audit_clients`:** Gestiona cambios automáticos de estado y etapa.
- **Efecto:**  
  Inconsistencia severa entre entornos locales, de staging y de producción.

---

## 3. SCRIPT SQL MAESTRO CONSOLIDADO (PRODUCCIÓN)

A continuación se presenta el script maestro completo y reconciliado para ejecutar en el SQL Editor de Supabase o utilizar como `supabase/schema.sql`:

```sql
-- Really CRM — Esquema Consolidado y Completo de Base de Datos
-- Reconciliación total de migraciones, RLS, Storage y Triggers de Producción
-- Fecha: 12 de Septiembre de 2026

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TIPOS ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE client_type   AS ENUM ('buyer', 'seller');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('active', 'inactive', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE sale_type     AS ENUM ('cash', 'loan');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE property_type AS ENUM ('house', 'condo', 'apartment', 'land', 'commercial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE doc_type      AS ENUM ('id', 'pre_approval_letter', 'contract', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE doc_status    AS ENUM ('pending', 'received', 'verified');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE client_stage  AS ENUM ('lead', 'contacted', 'showing', 'negotiation', 'closed', 'lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 2. TABLAS PRINCIPALES
-- ============================================================

-- PROFILES (un perfil por agente autenticado)
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL CONSTRAINT uq_profiles_email UNIQUE,
  phone          TEXT,
  license_number TEXT,
  bio            TEXT,
  photo_url      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLIENTS (clientes por agente)
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realtor_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_type         client_type NOT NULL,
  status              client_status NOT NULL DEFAULT 'active',
  stage               client_stage NOT NULL DEFAULT 'lead',
  name                TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  notes               TEXT,
  budget_min          NUMERIC(12,2),
  budget_max          NUMERIC(12,2),
  preferred_locations TEXT[],
  property_types      property_type[],
  sale_type           sale_type,
  bedrooms_min        SMALLINT,
  bedrooms_max        SMALLINT,
  bathrooms_min       NUMERIC(3,1),
  bathrooms_max       NUMERIC(3,1),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_clients_budget_positive CHECK (
    (budget_min IS NULL OR budget_min >= 0) AND
    (budget_max IS NULL OR budget_max >= 0)
  ),
  CONSTRAINT chk_clients_budget_range CHECK (
    budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max
  ),
  CONSTRAINT chk_clients_bedrooms_range CHECK (
    (bedrooms_min IS NULL OR bedrooms_min >= 0) AND
    (bedrooms_max IS NULL OR bedrooms_max >= 0) AND
    (bedrooms_min IS NULL OR bedrooms_max IS NULL OR bedrooms_min <= bedrooms_max)
  ),
  CONSTRAINT chk_clients_bathrooms_range CHECK (
    (bathrooms_min IS NULL OR bathrooms_min >= 0) AND
    (bathrooms_max IS NULL OR bathrooms_max >= 0) AND
    (bathrooms_min IS NULL OR bathrooms_max IS NULL OR bathrooms_min <= bathrooms_max)
  )
);

-- EMAIL TEMPLATES (plantillas personalizadas de correo)
CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realtor_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOCUMENTS (documentos por cliente)
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  realtor_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doc_type    doc_type NOT NULL,
  doc_status  doc_status NOT NULL DEFAULT 'pending',
  file_url    TEXT,
  file_name   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FOLLOW-UPS (seguimientos programados)
CREATE TABLE IF NOT EXISTS follow_ups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  realtor_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date  DATE NOT NULL,
  notes           TEXT,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLIENT HISTORY (bitácora inmutable de auditoría)
CREATE TABLE IF NOT EXISTS client_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  realtor_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_history  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile" ON profiles;
CREATE POLICY "own profile" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "own clients" ON clients;
CREATE POLICY "own clients" ON clients FOR ALL USING (auth.uid() = realtor_id);

DROP POLICY IF EXISTS "own templates" ON email_templates;
CREATE POLICY "own templates" ON email_templates FOR ALL USING (auth.uid() = realtor_id);

DROP POLICY IF EXISTS "own documents" ON documents;
CREATE POLICY "own documents" ON documents FOR ALL USING (auth.uid() = realtor_id);

DROP POLICY IF EXISTS "own followups" ON follow_ups;
CREATE POLICY "own followups" ON follow_ups FOR ALL USING (auth.uid() = realtor_id);

DROP POLICY IF EXISTS "own history read" ON client_history;
CREATE POLICY "own history read" ON client_history FOR SELECT USING (auth.uid() = realtor_id);

DROP POLICY IF EXISTS "own history insert" ON client_history;
CREATE POLICY "own history insert" ON client_history FOR INSERT WITH CHECK (auth.uid() = realtor_id);

-- ============================================================
-- 4. ÍNDICES DE ALTO RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_realtor_id ON clients(realtor_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_stage ON clients(stage);
CREATE INDEX IF NOT EXISTS idx_email_templates_realtor_id ON email_templates(realtor_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_realtor_id ON follow_ups(realtor_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_client_id ON follow_ups(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_completed ON follow_ups(scheduled_date, completed);
CREATE INDEX IF NOT EXISTS idx_follow_ups_realtor_scheduled ON follow_ups(realtor_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_realtor_created ON documents(realtor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_history_client_id ON client_history(client_id);
CREATE INDEX IF NOT EXISTS idx_client_history_realtor_created ON client_history(realtor_id, created_at DESC);

-- ============================================================
-- 5. PROCEDIMIENTOS Y TRIGGERS AUTOMÁTICOS
-- ============================================================

-- Actualización automática de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  return new;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER trg_follow_ups_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Trigger automático para crear perfil al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger automático de auditoría en tabla clients
CREATE OR REPLACE FUNCTION fn_audit_client_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ============================================================
-- 6. FUNCIÓN RPC PARA CONSOLIDAR ESTADÍSTICAS DEL DASHBOARD
-- ============================================================
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

-- ============================================================
-- 7. POLÍTICAS RLS DE SUPABASE STORAGE
-- ============================================================
-- BUCKET 'avatars' (Público para lectura, acotado al realtor para escritura)
DROP POLICY IF EXISTS "Upload own avatar" ON storage.objects;
CREATE POLICY "Upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Update own avatar" ON storage.objects;
CREATE POLICY "Update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  ) WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "Public avatar read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Delete own avatar" ON storage.objects;
CREATE POLICY "Delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- BUCKET 'documents' (Privado, acotado al realtor para todas las operaciones)
DROP POLICY IF EXISTS "Upload own documents" ON storage.objects;
CREATE POLICY "Upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Update own documents" ON storage.objects;
CREATE POLICY "Update own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  ) WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Read own documents" ON storage.objects;
CREATE POLICY "Read own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Delete own documents" ON storage.objects;
CREATE POLICY "Delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```
