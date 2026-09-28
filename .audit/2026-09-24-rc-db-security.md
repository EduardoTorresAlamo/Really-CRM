# Auditoría de Seguridad de Base de Datos, RLS y Migraciones
**Repositorio:** `/Users/eduardotorres/Developer/Really-CRM`  
**Alcance:** [supabase/schema.sql](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql), [supabase/migrations/](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations), políticas RLS, triggers, índices, configuración de storage y rutas de consumo en el backend.

---

## 1. Políticas RLS incompletas o ausentes por tabla (SELECT/INSERT/UPDATE/DELETE/STORAGE, y WITH CHECK faltantes)

### [HIGH] Ausencia de políticas `FOR UPDATE` en `storage.objects` rompe la subida con `upsert: true`
**Evidencia:** [supabase/schema.sql:186-218](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L186-L218), [lib/storage/uploadFile.ts:14](file:///Users/eduardotorres/Developer/Really-CRM/lib/storage/uploadFile.ts#L14), [components/profile/AvatarUpload.tsx:43-52](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/AvatarUpload.tsx#L43-L52)  
**Impacto:** En [lib/storage/uploadFile.ts:14](file:///Users/eduardotorres/Developer/Really-CRM/lib/storage/uploadFile.ts#L14) la subida utiliza `{ upsert: true }`. En [components/profile/AvatarUpload.tsx:43](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/AvatarUpload.tsx#L43) la ruta es fija por usuario (`${userId}/avatar.${ext}`). Cuando un usuario intenta cambiar su foto de perfil o re-subir un documento existente, la API de Supabase Storage ejecuta un comando SQL `UPDATE` sobre `storage.objects`. Al no existir ninguna política `FOR UPDATE` en [supabase/schema.sql](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql) para los buckets `avatars` o `documents`, PostgreSQL rechaza la operación con error 403 Forbidden (`new row violates row-level security policy for table "objects"`), bloqueando la actualización de fotos de perfil.  
**Fix sugerido:** Definir políticas `FOR UPDATE` para ambos buckets en `storage.objects`:
```sql
create policy "Update own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Update own documents" on storage.objects
  for update using (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'documents' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### [HIGH] Políticas RLS en tablas dependientes (`documents`, `follow_ups`, `client_history`) omiten validación relacional de pertenencia de `client_id`
**Evidencia:** [supabase/schema.sql:130-134](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L130-L134), [supabase/migrations/20260601_fix_client_history_rls.sql:11-13](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260601_fix_client_history_rls.sql#L11-L13)  
**Impacto:** Las políticas RLS actuales únicamente comprueban que `auth.uid() = realtor_id`. No existe cláusula `WITH CHECK` que valide que el `client_id` pertenezca al mismo agente inmobiliario autenticado. Un usuario autenticado puede emitir un `INSERT` directo a través del cliente de Supabase adjuntando seguimientos, documentos o eventos de historial apuntando al UUID de un cliente que pertenece a otro realtor, mientras declare su propio `realtor_id = auth.uid()`.  
**Fix sugerido:** Agregar verificación relacional en las políticas de inserción y actualización:
```sql
-- Ejemplo para follow_ups
alter policy "own followups" on follow_ups
  with check (
    auth.uid() = realtor_id and
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.realtor_id = auth.uid()
    )
  );
```

### [MEDIUM] Políticas genéricas `FOR ALL` sin segregación de comandos ni `WITH CHECK` explícitos
**Evidencia:** [supabase/schema.sql:127-131](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L127-L131), [supabase/migrations/0001_pipeline_and_templates.sql:34-35](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/0001_pipeline_and_templates.sql#L34-L35)  
**Impacto:** En tablas centrales (`profiles`, `clients`, `email_templates`, `documents`, `follow_ups`) se utiliza `FOR ALL USING (auth.uid() = realtor_id)`. Aunque PostgreSQL reutiliza `USING` como `WITH CHECK` si este último no se define, carecer de políticas explícitas por comando (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) impide aplicar restricciones granulares (por ejemplo, evitar que durante un `UPDATE` se modifique el campo `realtor_id` o `created_at`).  
**Fix sugerido:** Separar las políticas `FOR ALL` en políticas individuales por operación con cláusulas `USING` y `WITH CHECK` diferenciadas.

---

## 2. Funciones SECURITY DEFINER sin search_path fijado

### [HIGH] Función de trigger `fn_audit_client_changes()` declarada como `SECURITY DEFINER` sin fijar `search_path`
**Evidencia:** [supabase/migrations/20260824_full_audit_remediation.sql:35-37](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L35-L37)  
**Impacto:** La función `fn_audit_client_changes()` se ejecuta con privilegios del propietario de la base de datos (`postgres` / superusuario), pero no contiene la directiva `SET search_path = ''` (a diferencia de `handle_new_user()` que sí la implementó en [20260920_handle_new_user_trigger.sql:13](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260920_handle_new_user_trigger.sql#L13)). Además, realiza accesos no calificados como `INSERT INTO client_history...`. Si un atacante consigue crear tablas o funciones en esquemas temporales u otros esquemas en la ruta de búsqueda, puede secuestrar la resolución de objetos del trigger (Search Path Hijacking), escalando privilegios bajo el contexto de ejecución del superusuario.  
**Fix sugerido:** Fijar el `search_path` a vacío y calificar explícitamente los nombres de tabla con su esquema:
```sql
create or replace function fn_audit_client_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.client_history (client_id, realtor_id, event_type, description, metadata)
    values (new.id, new.realtor_id, 'created', 'Client "' || new.name || '" was created', jsonb_build_object('source', 'database_trigger'));
  elsif (tg_op = 'UPDATE') then
    if (old.stage is distinct from new.stage) then
      insert into public.client_history (client_id, realtor_id, event_type, description, metadata)
      values (new.id, new.realtor_id, 'stage_change', 'Stage changed from ' || old.stage || ' to ' || new.stage, jsonb_build_object('old_stage', old.stage, 'new_stage', new.stage));
    end if;
    if (old.status is distinct from new.status) then
      insert into public.client_history (client_id, realtor_id, event_type, description, metadata)
      values (new.id, new.realtor_id, 'status_change', 'Status changed from ' || old.status || ' to ' || new.status, jsonb_build_object('old_status', old.status, 'new_status', new.status));
    end if;
  end if;
  return new;
end;
$$;
```

---

## 3. Triggers de auth y backfill

### [CRITICAL] Ausencia del trigger de aprovisionamiento de perfil (`handle_new_user`) en el esquema base `schema.sql`
**Evidencia:** [supabase/schema.sql:20-30](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L20-L30), [supabase/schema.sql:150-179](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L150-L179) frente a [supabase/migrations/20260920_handle_new_user_trigger.sql:31-34](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260920_handle_new_user_trigger.sql#L31-L34)  
**Impacto:** El archivo base `supabase/schema.sql` (que en la línea 2 instruye ser ejecutado en el SQL Editor de Supabase) no incluye el trigger en `auth.users`. Si una base de datos se despliega con `schema.sql`, cuando un nuevo realtor se registra mediante Magic Link en [app/(auth)/login/page.tsx:29](file:///Users/eduardotorres/Developer/Really-CRM/app/%28auth%29/login/page.tsx#L29), se crea la fila en `auth.users`, pero nunca se inserta en `public.profiles`. Como `clients.realtor_id` tiene una restricción estricta `REFERENCES profiles(id) ON DELETE CASCADE` ([supabase/schema.sql:37](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L37)), el usuario no puede crear ningún cliente en la plataforma, fallando de inmediato con violación de clave foránea.  
**Fix sugerido:** Incorporar formalmente la definición de `public.handle_new_user()` y el trigger `on_auth_user_created` en `supabase/schema.sql` (o unificar el ciclo de vida bajo migraciones de Supabase CLI).

### [HIGH] Duplicación sistemática de auditoría en `client_history` por colisión entre trigger de base de datos y Server Action
**Evidencia:** [supabase/migrations/20260824_full_audit_remediation.sql:38-40](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L38-L40), [app/actions/clients.ts:51-56](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56)  
**Impacto:** La migración [20260824_full_audit_remediation.sql](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L38) creó el trigger `trg_audit_clients` que inserta automáticamente una fila con `event_type = 'created'` en `client_history` al crear un cliente. No obstante, la Server Action `createClientAction` en [app/actions/clients.ts:51-56](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56) ejecuta a su vez un segundo `insert` manual en `client_history` con `event_type: 'created'`. Cada cliente nuevo genera dos entradas de auditoría idénticas en la base de datos y añade un round-trip innecesario.  
**Fix sugerido:** Eliminar el bloque de inserción manual en [app/actions/clients.ts:51-56](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56) y permitir que el trigger SQL gestione la auditoría de forma atómica.

### [MEDIUM] `ON CONFLICT DO NOTHING` en `handle_new_user()` omite errores de unicidad de email y carece de trigger para sincronizar actualizaciones
**Evidencia:** [supabase/migrations/20260920_handle_new_user_trigger.sql:24-26](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260920_handle_new_user_trigger.sql#L24-L26), [supabase/migrations/20260824_full_audit_remediation.sql:31-32](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L31-L32)  
**Impacto:** La migración [20260824_full_audit_remediation.sql:32](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L32) agregó la restricción `uq_profiles_email UNIQUE (email)`. En [20260920_handle_new_user_trigger.sql:26](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260920_handle_new_user_trigger.sql#L26), `handle_new_user()` tiene un `ON CONFLICT DO NOTHING` genérico. Si un usuario se re-registra con un nuevo UUID de auth pero su correo ya figuraba en `profiles`, la inserción se descarta silenciosamente. El usuario queda autenticado en `auth.users` pero sin registro en `profiles`, reproduciendo el fallo de clave foránea. Tampoco existe trigger `AFTER UPDATE ON auth.users` para reflejar cambios de correo en `profiles`.  
**Fix sugerido:** Definir un target de conflicto específico y actualizar el registro:
```sql
insert into public.profiles (id, name, email, phone, photo_url)
values (...)
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();
```

---

## 4. Índices faltantes en FKs y queries calientes

### [HIGH] Clave foránea `follow_ups(client_id)` no indexada en el esquema base `schema.sql`
**Evidencia:** [supabase/schema.sql:93](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L93), [supabase/schema.sql:144-145](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L144-L145) frente a [supabase/migrations/20260824_full_audit_remediation.sql:5](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L5)  
**Impacto:** En [supabase/schema.sql](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql), `follow_ups.client_id` tiene una FK hacia `clients(id)` con `ON DELETE CASCADE`. Sin embargo, `schema.sql` no define un índice en `client_id`. Cada carga de la página de detalle de cliente en [app/(app)/clients/[id]/page.tsx:32](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L32) filtra por `eq('client_id', id)`. Además, cualquier eliminación de un cliente obliga a PostgreSQL a realizar un Sequential Scan completo sobre la tabla `follow_ups` para verificar el borrado en cascada.  
**Fix sugerido:** Incluir el índice en `supabase/schema.sql`:
```sql
create index on follow_ups(client_id);
```

### [MEDIUM] Ausencia de índice compuesto `clients(realtor_id, created_at DESC)` para queries calientes de Pipeline, Dashboard y Listado
**Evidencia:** [supabase/schema.sql:139-142](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L139-L142), [app/(app)/clients/page.tsx:63](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L63), [app/(app)/dashboard/page.tsx:26](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L26), [app/(app)/pipeline/page.tsx:21](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/pipeline/page.tsx#L21)  
**Impacto:** Las tres vistas centrales del CRM filtran por `realtor_id` y ordenan por `created_at DESC`. `schema.sql` solo cuenta con un índice simple en `clients(realtor_id)`. PostgreSQL debe filtrar por el índice y posteriormente realizar una operación de ordenamiento en memoria (`Sort Method: top-N heapsort` / `quicksort`) en cada consulta, degradando el rendimiento conforme aumenta el volumen de clientes.  
**Fix sugerido:** Crear un índice compuesto:
```sql
create index idx_clients_realtor_created on clients(realtor_id, created_at desc);
```

### [MEDIUM] Falta de índice parcial para el cron diario de seguimientos en `follow_ups`
**Evidencia:** [supabase/schema.sql:144-145](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L144-L145), [app/api/cron/send-daily-followups/route.ts:40-44](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L40-L44)  
**Impacto:** El cron diario en [app/api/cron/send-daily-followups/route.ts:40-44](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L40-L44) consulta:
`WHERE completed = false AND email_sent = false AND scheduled_date <= today`.
Los índices existentes (`scheduled_date, completed`) no indexan `email_sent`. A medida que se acumulen seguimientos a lo largo de los meses, la consulta escaneará miles de filas ya procesadas.  
**Fix sugerido:** Crear un índice parcial que cubra únicamente los registros pendientes de notificación:
```sql
create index idx_follow_ups_pending_cron on follow_ups(scheduled_date)
  where completed = false and email_sent = false;
```

---

## 5. Migraciones aplicadas vs presentes en disco

### [CRITICAL] Inversión de dependencias y ruptura del runner de migraciones por orden lexicográfico (`0001_` vs `YYYYMMDD_`)
**Evidencia:** [supabase/migrations/0001_pipeline_and_templates.sql:12-24](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/0001_pipeline_and_templates.sql#L12-L24) frente a [supabase/schema.sql:20-56](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L20-L56)  
**Impacto:** En [supabase/migrations/](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations) conviven archivos con prefijo secuencial (`0001_pipeline_and_templates.sql`) y con timestamp ISO (`20260601_...`, `20260824_...`, `20260920_...`). El CLI de Supabase ejecuta migraciones en orden alfabético. En un entorno nuevo (`supabase start` o `supabase db reset`), el CLI intenta ejecutar `0001_pipeline_and_templates.sql` primero. Como el esquema base reside fuera del directorio de migraciones en `schema.sql`, el comando falla de inmediato con `ERROR: relation "clients" does not exist` y `ERROR: relation "profiles" does not exist`.  
**Fix sugerido:** Convertir `schema.sql` en la primera migración formal (ej. `20260101000000_initial_schema.sql`) y renombrar `0001_pipeline_and_templates.sql` con una estampa temporal coherente con el historial (`20260804000000_pipeline_and_templates.sql`).

### [HIGH] Divergencia de esquema (Schema Drift) entre `schema.sql` y las migraciones del repositorio
**Evidencia:** [supabase/schema.sql:1-219](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L1-L219) vs [supabase/migrations/20260824_full_audit_remediation.sql:1-88](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L1-L88) y [supabase/migrations/20260920_handle_new_user_trigger.sql:1-45](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260920_handle_new_user_trigger.sql#L1-L45)  
**Impacto:** [supabase/schema.sql](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql) no contiene:
1. La función RPC `get_dashboard_stats()` ([20260824_full_audit_remediation.sql:61](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L61)), requerida por [app/(app)/dashboard/page.tsx:24](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L24) (sin ella, el dashboard crashea en runtime).
2. Las restricciones numéricas de `clients` (`chk_clients_budget_positive`, `chk_clients_budget_range`, etc.).
3. La restricción de unicidad de email `uq_profiles_email`.
4. El trigger de auditoría `trg_audit_clients`.
5. El trigger de aprovisionamiento `handle_new_user()`.
Cualquier base de datos creada ejecutando `schema.sql` en producción o staging queda en un estado incompleto e inoperable.  
**Fix sugerido:** Actualizar `schema.sql` con las definiciones acumuladas o generar un dump actualizado con `supabase db dump`.

### [MEDIUM] Falta de idempotencia en sentencias DDL de migraciones
**Evidencia:** [supabase/migrations/0001_pipeline_and_templates.sql:8,22](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/0001_pipeline_and_templates.sql#L8), [supabase/migrations/20260601_fix_client_history_rls.sql:7-13](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260601_fix_client_history_rls.sql#L7-L13)  
**Impacto:** `0001_pipeline_and_templates.sql` ejecuta `create type client_stage` y `create table email_templates` sin `IF NOT EXISTS`. Asimismo, `20260601_fix_client_history_rls.sql` crea la política `"own history read"` sin verificar si ya existía en el esquema. Si las migraciones se aplican sobre una base de datos que ya tenía partes de `schema.sql` aplicadas, la ejecución aborta con `ERROR: type "client_stage" already exists`.  
**Fix sugerido:** Utilizar `IF NOT EXISTS` en creación de tablas e índices, y encapsular la creación de ENUMs en bloques anónimos PL/pgSQL:
```sql
do $$ begin
  create type client_stage as enum ('lead', 'contacted', 'showing', 'negotiation', 'closed', 'lost');
exception
  when duplicate_object then null;
end $$;
```

---

## 6. Secretos o claves hardcodeadas

SIN HALLAZGOS

*(Verificación realizada: Se revisó la totalidad del código fuente, el historial completo de commits de Git y las variables de entorno. `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` y `CRON_SECRET` se consumen estrictamente mediante `process.env.*`. `.env.local` se encuentra excluido en [.gitignore:34](file:///Users/eduardotorres/Developer/Really-CRM/.gitignore#L34) y no ha sido commiteado. Los archivos presentes en `supabase/.temp/` contienen identificadores públicos y de infraestructura como el project reference `kvlwoeciafvnkejxsvlk` y el host del pooler, pero no contienen contraseñas ni tokens de autenticación).*

---

## 7. Ruta de escalada de privilegios entre realtors/agencias (multi-tenant leakage)

### [CRITICAL] Exfiltración de datos multi-tenant e IDOR a través del Cron Job por desacoplamiento relacional en `follow_ups`
**Evidencia:** [supabase/schema.sql:91-103](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L91-L103), [supabase/schema.sql:131](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L131), [app/api/cron/send-daily-followups/route.ts:31-74](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L31-L74)  
**Impacto:** 
1. La política RLS de `follow_ups` ([supabase/schema.sql:131](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L131)) solo valida `auth.uid() = realtor_id`, omitiendo verificar si el `client_id` le pertenece.
2. Un Realtor A malicioso puede insertar un seguimiento con su propio `realtor_id = Realtor A`, pero asociando el `client_id` de un cliente privado del Realtor B con `scheduled_date = CURRENT_DATE`. PostgreSQL acepta la fila.
3. El cron diario en [app/api/cron/send-daily-followups/route.ts:31-34](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L31-L34) se ejecuta con la clave maestra `SUPABASE_SERVICE_ROLE_KEY`, la cual **omite RLS por completo**.
4. La consulta (líneas 40-45) ejecuta:
   `.from('follow_ups').select('*, clients(id, name), profiles(name, email)').lte('scheduled_date', today)`.
   Al no haber RLS, PostgreSQL resuelve la relación `clients` y obtiene el registro del cliente del Realtor B.
5. En la línea 66, el worker despacha un email a la dirección `profile.email` (Realtor A) incluyendo:
   `clientName: client.name` (nombre del cliente de Realtor B) y `clientUrl: .../clients/${client.id}`.
Realtor A logra exfiltrar la identidad e ID de clientes de otros agentes sin autorización.  
**Fix sugerido:** 
1. Impedir la inserción de seguimientos ajenos en RLS:
```sql
alter policy "own followups" on follow_ups
  with check (
    auth.uid() = realtor_id and
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.realtor_id = auth.uid()
    )
  );
```
2. Imponer integridad multi-tenant a nivel de esquema mediante una clave foránea compuesta:
```sql
alter table clients add constraint uq_clients_id_realtor unique (id, realtor_id);
alter table follow_ups
  add constraint fk_follow_ups_tenant
  foreign key (client_id, realtor_id)
  references clients(id, realtor_id) on delete cascade;
```

### [HIGH] Contaminación cruzada e inyección de metadatos en clientes de otros agentes vía `documents` y `client_history`
**Evidencia:** [supabase/schema.sql:75-86](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L75-L86), [supabase/schema.sql:130](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L130), [supabase/migrations/20260601_fix_client_history_rls.sql:11-13](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260601_fix_client_history_rls.sql#L11-L13), [components/documents/DocumentUploadDialog.tsx:68-76](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L68-L76)  
**Impacto:** Al igual que en `follow_ups`, un agente puede insertar registros en `documents` o en la pista de auditoría `client_history` asignados a su propio `realtor_id` pero apuntando al UUID de un cliente de otro agente. Aunque la vista del Realtor B no mostrará estos documentos debido al filtro `auth.uid() = realtor_id`, la base de datos queda contaminada con relaciones foráneas cruzadas y registros de auditoría espurios vinculados a entidades de terceros.  
**Fix sugerido:** Implementar la restricción de pertenencia obligatoria en las políticas RLS y aplicar claves foráneas compuestas `(client_id, realtor_id)` en `documents` y `client_history`:
```sql
alter policy "own documents" on documents
  with check (
    auth.uid() = realtor_id and
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.realtor_id = auth.uid()
    )
  );

alter policy "own history insert" on client_history
  with check (
    auth.uid() = realtor_id and
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.realtor_id = auth.uid()
    )
  );
```
