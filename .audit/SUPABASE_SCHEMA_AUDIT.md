# Reporte de Auditoría: Esquema de Base de Datos Supabase & Políticas RLS
**Repositorio Auditado:** Really-CRM ([`Really-CRM`](file:///Users/eduardotorres/Developer/Really-CRM))  
**Archivo Base:** [`supabase/schema.sql`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql) y migraciones en [`supabase/migrations/`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/)  
**Fecha de Evaluación:** 20 de Agosto, 2026  
**Alcance:** Tablas relacionales, tipos ENUM, Row Level Security (RLS), integridad referencial, índices foráneos/compuestos, disparadores (triggers) y almacenamiento en Supabase Storage.  

---

## 1. Resumen Ejecutivo del Esquema

El modelo de datos de Really-CRM está compuesto por **6 tablas principales**:
- `profiles`: Registro del agente inmobiliario vinculado a `auth.users(id)`.
- `clients`: Clientes (compradores y vendedores), preferencias y etapa en el pipeline (`stage`).
- `email_templates`: Plantillas de correo personalizadas por agente.
- `documents`: Metadatos de documentos asociados a clientes y subidos a Storage.
- `follow_ups`: Recordatorios y seguimientos fechados por cliente.
- `client_history`: Bitácora de eventos y auditoría del cliente.

Las políticas RLS aplican adecuadamente el aislamiento multi-inquilino (`tenant isolation`) comprobando `auth.uid() = realtor_id` o `auth.uid() = id`. Sin embargo, se identificaron **6 deficiencias estructurales críticas** en indexación, integridad, auditoría y ciclo de vida de archivos.

---

## 2. Matriz de Hallazgos en el Esquema

| ID | Área de Impacto | Título del Hallazgo | Severidad | Ubicación en `schema.sql` |
| :--- | :--- | :--- | :---: | :--- |
| **SCH-01** | Rendimiento DB | Falta de Índice Foráneo en `follow_ups(client_id)` | 🔴 **HIGH** | Líneas 137–148 |
| **SCH-02** | Integridad / Auditoría | Dependencia de Inserción Client-Side en `client_history` | 🔴 **HIGH** | Líneas 107–135 |
| **SCH-03** | Integridad de Datos | Ausencia de Restricciones CHECK en Preferencias y Precios | 🔴 **HIGH** | Líneas 45–53 |
| **SCH-04** | Cloud Storage | Riesgo de Archivos Huérfanos en Borrados en Cascada | 🔴 **HIGH** | Línea 77 |
| **SCH-05** | Optimización de Consultas | Falta de Índice Compuesto en `documents(realtor_id, created_at)` | 🟡 **MEDIUM** | Líneas 146–148 |
| **SCH-06** | Consistencia de Datos | Falta de Restricción UNIQUE en `profiles.email` | 🟡 **MEDIUM** | Línea 23 |

---

## 3. Análisis Detallado de Hallazgos

### SCH-01: Falta de Índice Foráneo en `follow_ups(client_id)`
- **Severidad:** 🔴 **HIGH**
- **Descripción:**  
  La tabla `follow_ups` define la clave foránea `client_id uuid not null references clients(id) on delete cascade`.  
  Los índices creados originalmente en `schema.sql` son:
  ```sql
  create index on follow_ups(realtor_id);
  create index on follow_ups(scheduled_date, completed);
  ```
  **No existe ningún índice sobre `follow_ups(client_id)`.**
- **Impacto:**  
  1. En la página de detalle del cliente ([`app/(app)/clients/[id]/page.tsx:32`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L32)), el servidor ejecuta:
     ```typescript
     supabase.from('follow_ups').select('*').eq('client_id', id).order('scheduled_date', { ascending: false })
     ```
     Al no existir índice por `client_id`, PostgreSQL se ve forzado a realizar un escaneo secuencial (`Seq Scan`) o filtrar a través del índice de `realtor_id`.
  2. Al eliminar un cliente, PostgreSQL ejecuta un escaneo completo de `follow_ups` para cumplir con `ON DELETE CASCADE`.
- **Solución:**
  ```sql
  create index if not exists idx_follow_ups_client_id on follow_ups(client_id);
  ```

---

### SCH-02: Dependencia de Inserción Client-Side en `client_history` y Riesgo de Falsificación
- **Severidad:** 🔴 **HIGH**
- **Descripción:**  
  La tabla `client_history` fue diseñada como un registro de auditoría inmutable (con políticas RLS para permitir solo `SELECT` e `INSERT`). Sin embargo, las inserciones dependen enteramente de llamadas manuales en componentes de interfaz (`ClientForm.tsx`, `BulkEmailModal.tsx`).
- **Impacto:**  
  1. **Omisiones:** Si un cliente se modifica vía API, migración o en interfaces donde se omitió la llamada (como el Kanban en `PipelineBoard.tsx`), la auditoría no se genera.
  2. **Falsificación:** Cualquier usuario con una sesión válida puede enviar peticiones directas al endpoint REST de Supabase e insertar eventos falsos o arbitrarios en `client_history`.
- **Solución:**  
  Mover la generación de auditoría al motor de PostgreSQL mediante un disparador (`Trigger`) con permisos `SECURITY DEFINER`.

---

### SCH-03: Ausencia de Restricciones CHECK en Preferencias y Precios
- **Severidad:** 🔴 **HIGH**
- **Descripción:**  
  En la tabla `clients`, los campos numéricos carecen de cláusulas `CHECK`:
  - `budget_min numeric(12,2)`
  - `budget_max numeric(12,2)`
  - `bedrooms_min smallint`
  - `bedrooms_max smallint`
  - `bathrooms_min numeric(3,1)`
  - `bathrooms_max numeric(3,1)`
- **Impacto:**  
  La base de datos acepta valores negativos (`budget_min = -50000`) o rangos invertidos (`budget_min > budget_max`), lo cual invalida los algoritmos de matching de compradores y filtros de búsqueda.
- **Solución:**
  ```sql
  alter table clients
    add constraint chk_clients_budget_positive check (
      (budget_min is null or budget_min >= 0) and
      (budget_max is null or budget_max >= 0)
    ),
    add constraint chk_clients_budget_range check (
      budget_min is null or budget_max is null or budget_min <= budget_max
    ),
    add constraint chk_clients_bedrooms_range check (
      (bedrooms_min is null or bedrooms_min >= 0) and
      (bedrooms_max is null or bedrooms_max >= 0) and
      (bedrooms_min is null or bedrooms_max is null or bedrooms_min <= bedrooms_max)
    ),
    add constraint chk_clients_bathrooms_range check (
      (bathrooms_min is null or bathrooms_min >= 0) and
      (bathrooms_max is null or bathrooms_max >= 0) and
      (bathrooms_min is null or bathrooms_max is null or bathrooms_min <= bathrooms_max)
    );
  ```

---

### SCH-04: Riesgo de Archivos Huérfanos en Borrados en Cascada de Storage
- **Severidad:** 🔴 **HIGH**
- **Descripción:**  
  La tabla `documents` tiene la clave `client_id uuid not null references clients(id) on delete cascade`.  
  Cuando se elimina un cliente, PostgreSQL elimina en cascada las filas en `documents`, pero los archivos físicos binarios en el bucket de Supabase Storage (`documents/{realtorId}/{clientId}/...`) **permanecen almacenados indefinidamente**.
- **Impacto:**  
  Consumo acumulativo innecesario de almacenamiento cloud y persistencia indebida de datos sensibles de clientes eliminados.
- **Solución:**  
  Implementar un trigger en PostgreSQL con `pg_net` o una Supabase Database Webhook en `AFTER DELETE ON documents` para invocar la API de Supabase Storage y eliminar el objeto asociado.

---

### SCH-05: Falta de Índice Compuesto en `documents(realtor_id, created_at)`
- **Severidad:** 🟡 **MEDIUM**
- **Descripción:**  
  Actualmente solo existe `create index on documents(client_id);`. Las consultas globales de documentos filtradas por agente o las verificaciones RLS `auth.uid() = realtor_id` requieren escanear la tabla entera.
- **Solución:**
  ```sql
  create index if not exists idx_documents_realtor_created on documents(realtor_id, created_at desc);
  create index if not exists idx_client_history_realtor_created on client_history(realtor_id, created_at desc);
  ```

---

### SCH-06: Falta de Restricción UNIQUE en `profiles.email`
- **Severidad:** 🟡 **MEDIUM**
- **Descripción:**  
  `profiles.email text not null` no tiene restricción `UNIQUE`. Aunque `profiles.id` es la clave primaria vinculada a `auth.users(id)`, garantizar la unicidad a nivel de columna en `profiles` previene inconsistencias de datos al buscar perfiles por email.
- **Solución:**
  ```sql
  alter table profiles add constraint uq_profiles_email unique (email);
  ```

---

## 4. Script de Migración Recomendado (SQL Listo para Producción)

Guarda este script como `supabase/migrations/20260820_schema_security_and_indexes.sql`:

```sql
-- Really CRM — Migración de Seguridad, Índices e Integridad
-- Fecha: 2026-08-20

-- 1. Índices de Rendimiento Faltantes
create index if not exists idx_follow_ups_client_id on follow_ups(client_id);
create index if not exists idx_follow_ups_realtor_scheduled on follow_ups(realtor_id, scheduled_date);
create index if not exists idx_documents_realtor_created on documents(realtor_id, created_at desc);
create index if not exists idx_client_history_realtor_created on client_history(realtor_id, created_at desc);

-- 2. Restricciones de Integridad y Rangos Coherentes
alter table clients
  add constraint chk_clients_budget_positive check (
    (budget_min is null or budget_min >= 0) and
    (budget_max is null or budget_max >= 0)
  ),
  add constraint chk_clients_budget_range check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  ),
  add constraint chk_clients_bedrooms_range check (
    (bedrooms_min is null or bedrooms_min >= 0) and
    (bedrooms_max is null or bedrooms_max >= 0) and
    (bedrooms_min is null or bedrooms_max is null or bedrooms_min <= bedrooms_max)
  ),
  add constraint chk_clients_bathrooms_range check (
    (bathrooms_min is null or bathrooms_min >= 0) and
    (bathrooms_max is null or bathrooms_max >= 0) and
    (bathrooms_min is null or bathrooms_max is null or bathrooms_min <= bathrooms_max)
  );

-- 3. Unicidad de Correo en Perfiles
alter table profiles
  add constraint uq_profiles_email unique (email);

-- 4. Trigger de Auditoría Automatizado e Inmutable para Clientes
create or replace function fn_audit_client_changes()
returns trigger language plpgsql security definer as $$
begin
  if (TG_OP = 'INSERT') then
    insert into client_history (client_id, realtor_id, event_type, description, metadata)
    values (NEW.id, NEW.realtor_id, 'created', 'Client "' || NEW.name || '" was created', jsonb_build_object('source', 'database_trigger'));
  elsif (TG_OP = 'UPDATE') then
    if (OLD.stage is distinct from NEW.stage) then
      insert into client_history (client_id, realtor_id, event_type, description, metadata)
      values (NEW.id, NEW.realtor_id, 'stage_change', 'Stage changed from ' || OLD.stage || ' to ' || NEW.stage, jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage));
    end if;
    if (OLD.status is distinct from NEW.status) then
      insert into client_history (client_id, realtor_id, event_type, description, metadata)
      values (NEW.id, NEW.realtor_id, 'status_change', 'Status changed from ' || OLD.status || ' to ' || NEW.status, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_audit_clients on clients;
create trigger trg_audit_clients
  after insert or update on clients
  for each row execute procedure fn_audit_client_changes();

-- 5. Función RPC Consolidada para Estadísticas de Dashboard (1 Round-trip)
create or replace function get_dashboard_stats(p_realtor_id uuid, p_today date)
returns json language plpgsql security invoker as $$
declare
  v_total_clients bigint;
  v_active_buyers bigint;
  v_active_sellers bigint;
  v_overdue_followups bigint;
begin
  select count(*) into v_total_clients
  from clients where realtor_id = p_realtor_id;

  select count(*) into v_active_buyers
  from clients where realtor_id = p_realtor_id and client_type = 'buyer' and status = 'active';

  select count(*) into v_active_sellers
  from clients where realtor_id = p_realtor_id and client_type = 'seller' and status = 'active';

  select count(*) into v_overdue_followups
  from follow_ups where realtor_id = p_realtor_id and completed = false and scheduled_date < p_today;

  return json_build_object(
    'totalClients', v_total_clients,
    'activeBuyers', v_active_buyers,
    'activeSellers', v_active_sellers,
    'overdueFollowUps', v_overdue_followups
  );
end;
$$;
```
