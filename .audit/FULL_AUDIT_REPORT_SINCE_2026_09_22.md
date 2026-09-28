# REALLY-CRM — REPORTE DE AUDITORÍA INTEGRAL DE CÓDIGO (POST 22-SEP-2026)

**Fecha de Auditoría:** 24 de Septiembre de 2026  
**Repositorio:** `~/Developer/Really-CRM`  
**Alcance (Scope):** Código fuente (`src/`, `app/`, `lib/`, `components/`, `supabase/migrations`, `supabase/schema.sql`, configuración, tests)  
**Stack Tecnológico:** Next.js 16.2.7 (App Router, Turbopack), React 19.2.4, Supabase SSR & Database (PostgreSQL 15+, RLS, Storage), Resend, Tailwind CSS v4, Base UI / shadcn  
**Clasificación de Severidad:**  
- 🔴 **CRITICAL:** Vulnerabilidades o fallos que rompen por completo flujos esenciales del sistema (autenticación, inserción de datos, bloqueo total de usuarios).  
- 🟠 **HIGH:** Vulnerabilidades de seguridad explotables, bypasses de políticas RLS, bugs de lógica con impacto directo en el negocio (desfase de fechas, corrupción de estados) y riesgos de denegación de servicio (timeouts serverless).  
- 🟡 **MEDIUM:** Debilidades arquitectónicas, fallas de rate limiting en serverless, fugas de recursos huérfanos, inconsistencias de diseño y problemas de sincronización de estado.  
- 🟢 **LOW:** Código muerto, tipos exportados sin uso, residuos de archivos temporales, advertencias del compilador/linter y degradaciones menores de UX.  

---

## 1. RESUMEN EJECUTIVO Y ESTADO DEL REPOSITORIO

Esta auditoría exhaustiva evalúa el estado del repositorio Really-CRM a fecha de 24 de septiembre de 2026, revisando los 6 pilares exigidos: **Seguridad**, **Bugs y Errores Lógicos**, **Arquitectura**, **Rendimiento**, **Código Muerto & Exports Huérfanos**, y **Esquema de Base de Datos**.

A pesar de los avances y remediaciones previas (como la implementación de Server Actions para clientes y documentos, la paginación en `/clients`, y la consolidación de estadísticas en RPC), persisten **debilidades de severidad crítica y alta** derivadas principalmente del **Schema Drift** entre `supabase/schema.sql` y el directorio de migraciones, vectores de **Server-Side Request Forgery (SSRF)** por redirecciones HTTP no bloqueadas, la **ausencia de validación Zod en Server Actions**, la **omisión de la política RLS `UPDATE` en Supabase Storage**, y **errores de desfase de zona horaria (-1 día)** en el envío de correos automatizados.

### Métricas Globales de Hallazgos

| Nivel de Severidad | Total de Hallazgos | Áreas Clave Afectadas |
| :--- | :---: | :--- |
| 🔴 **CRITICAL** | **1** | Schema Drift en `supabase/schema.sql`: Bloqueo total de nuevos usuarios por falta de trigger `profiles`. |
| 🟠 **HIGH** | **6** | SSRF por HTTP Redirects, Falta de RLS `UPDATE` en Storage, Desfase -1 día en correos (`parseISO`), Timeout 504 en Bulk Email, Schema Drift RPC/Constraints en `schema.sql`, Falta de validación Zod server-side en Server Actions. |
| 🟡 **MEDIUM** | **9** | Rate limiter volátil en Serverless, Falta de rate limit en send-followup, Fuga de storage en borrado de docs, Duplicación de historial cliente, Disparidad Server Actions vs Browser SDK, Desincronización Auth/Profile email, Desfase horario UTC en Dashboard SSR, Carga sin paginar en Pipeline Kanban, Fallo de Magic Link por `NEXT_PUBLIC_APP_URL`. |
| 🟢 **LOW** | **9** | Componente huérfano `ClientList.tsx`, Componentes UI sin usar (`select`, `skeleton`), Archivo residual `ruvector.db`, Tipos exportados sin uso, Incompatible-library warning en React Compiler (`watch` en map), Persistencia de preferencias buyer en seller, Residuos de Anthropic en CSP/.env, Falla de ESLint por `landing/`, Ausencia de suite de tests `npm test`. |
| **TOTAL** | **25** | **1 CRITICAL, 6 HIGH, 9 MEDIUM, 9 LOW** |

---

## 2. MATRIZ CONSOLIDADA DE HALLAZGOS

| ID | Pilar | Severidad | Descripción Breve | Archivo y Línea Afectada |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-SCHEMA-01** | DB / Seguridad | 🔴 **CRITICAL** | Bloqueo fatal para nuevos usuarios registrados por falta de trigger `handle_new_user` en `supabase/schema.sql` | [supabase/schema.sql:20-56](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L20-L56) |
| **SEC-SSRF-01** | Seguridad | 🟠 **HIGH** | SSRF Bypass mediante HTTP Redirects (301/302) y TOCTOU en extracción de propiedades | [lib/security/ssrf.ts:40-68](file:///Users/eduardotorres/Developer/Really-CRM/lib/security/ssrf.ts#L40-L68), [lib/claude/propertyMatch.ts:107-115](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107-L115) |
| **BUG-RLS-01** | Seguridad / Storage | 🟠 **HIGH** | Falta de política RLS `FOR UPDATE` en `storage.objects` rompe `upsert: true` en avatares y documentos | [supabase/schema.sql:186-218](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L186-L218), [components/profile/AvatarUpload.tsx:52](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/AvatarUpload.tsx#L52) |
| **BUG-TIMEZONE-01** | Bugs / Lógica | 🟠 **HIGH** | `parseISO` en strings date-only provoca desfase de 1 día en correos de seguimiento | [app/api/send-followup-email/route.ts:49](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L49), [app/api/cron/send-daily-followups/route.ts:70](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L70) |
| **PERF-API-01** | Rendimiento | 🟠 **HIGH** | Envío secuencial bloqueante y riesgo inminente de Timeout 504 en `POST /api/bulk-email` | [app/api/bulk-email/route.ts:70-95](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L70-L95) |
| **SCHEMA-DRIFT-01** | DB / Schema | 🟠 **HIGH** | Desconexión crítica entre `schema.sql` y migraciones: ausencia de RPC `get_dashboard_stats`, constraints e índices | [supabase/schema.sql:1-219](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L1-L219), [app/(app)/dashboard/page.tsx:24](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/dashboard/page.tsx#L24) |
| **SEC-ACTION-01** | Seguridad / Backend | 🟠 **HIGH** | Omisión de validación Zod server-side en Server Actions `createClientAction` y `updateClientAction` | [app/actions/clients.ts:39-90](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L90) |
| **SEC-RATELIMIT-01** | Seguridad / Infra | 🟡 **MEDIUM** | Rate limiting en memoria `Map` volátil e inefectivo en arquitectura Serverless (Vercel) | [lib/rateLimit.ts:1-16](file:///Users/eduardotorres/Developer/Really-CRM/lib/rateLimit.ts#L1-L16) |
| **SEC-RATELIMIT-02** | Seguridad / Abuso | 🟡 **MEDIUM** | Ausencia total de rate limiting en `POST /api/send-followup-email` permite spam y agotamiento de cuota | [app/api/send-followup-email/route.ts:10-61](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L10-L61) |
| **BUG-STORAGE-01** | Almacenamiento | 🟡 **MEDIUM** | Fuga de archivos huérfanos en Storage al eliminar registros de `documents` y en fallos de inserción | [app/actions/documents.ts:10-27](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L10-L27), [components/documents/DocumentUploadDialog.tsx:66-78](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L66-L78) |
| **BUG-AUTH-SYNC-01** | Auth / Integridad | 🟡 **MEDIUM** | Actualización de email en `profiles` no sincroniza `auth.users`, causando inconsistencia de identidad | [components/profile/ProfileForm.tsx:70-77](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/ProfileForm.tsx#L70-L77) |
| **ARCH-AUDIT-01** | Arquitectura / Datos| 🟡 **MEDIUM** | Duplicación sistemática de eventos en `client_history` por inserción simultánea en Server Action y Trigger | [app/actions/clients.ts:51-56](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56), [supabase/migrations/20260824_full_audit_remediation.sql:56-58](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L56-L58) |
| **ARCH-MUTATION-01** | Arquitectura | 🟡 **MEDIUM** | Disparidad de diseño: coexistencia desordenada de Server Actions y mutaciones directas de browser SDK | [components/pipeline/PipelineBoard.tsx:55-59](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L55-L59), [components/follow-ups/FollowUpCard.tsx:37-51](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L37-L51) |
| **ARCH-PROXY-01** | Compatibilidad Next | 🟡 **MEDIUM** | Convención `middleware.ts` deprecada en Next.js 16 (requiere migración a `proxy.ts`) | [middleware.ts:4](file:///Users/eduardotorres/Developer/Really-CRM/middleware.ts#L4) |
| **PERF-TIMEZONE-01** | Rendimiento / Lógica| 🟡 **MEDIUM** | `today` calculado en UTC en Server Component descalibra Dashboard nocturno para husos de Puerto Rico | [app/(app)/dashboard/page.tsx:17](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/dashboard/page.tsx#L17) |
| **PERF-PIPELINE-01** | Rendimiento | 🟡 **MEDIUM** | Consulta `select('*')` sin paginación ni límite en Pipeline Kanban degrada memoria y renderizado | [app/(app)/pipeline/page.tsx:20-25](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/pipeline/page.tsx#L20-L25) |
| **BUG-ENV-01** | Auth / Frontend | 🟡 **MEDIUM** | `emailRedirectTo` sin fallback evalúa a `"undefined/auth/callback"` si falta variable de entorno | [app/(auth)/login/page.tsx:32](file:///Users/eduardotorres/Developer/Really-CRM/app/(auth)/login/page.tsx#L32) |
| **DEAD-CODE-01** | Mantenibilidad | 🟢 **LOW** | Componente huérfano no importado `ClientList.tsx` | [components/clients/ClientList.tsx:1-125](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx#L1-L125) |
| **DEAD-CODE-02** | Mantenibilidad | 🟢 **LOW** | Componentes UI exportados sin ninguna referencia (`select.tsx`, `skeleton.tsx`) | [components/ui/select.tsx:1-168](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/select.tsx#L1-L168), [components/ui/skeleton.tsx:1-15](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/skeleton.tsx#L1-L15) |
| **DEAD-FILE-01** | Deuda Técnica | 🟢 **LOW** | Base de datos residual SQLite/vector `ruvector.db` (1.5 MB) en la raíz | [ruvector.db](file:///Users/eduardotorres/Developer/Really-CRM/ruvector.db) |
| **DEAD-TYPES-01** | Tipado TypeScript | 🟢 **LOW** | 9 tipos exportados sin uso en la aplicación (`ClientInsert`, `DocumentInsert`, `ProfileUpsert`, etc.) | [types/client.ts:47-50](file:///Users/eduardotorres/Developer/Really-CRM/types/client.ts#L47-L50), [types/document.ts:22-25](file:///Users/eduardotorres/Developer/Really-CRM/types/document.ts#L22-L25), [types/profile.ts:22](file:///Users/eduardotorres/Developer/Really-CRM/types/profile.ts#L22) |
| **LINT-COMPILER-01** | React 19 Compiler | 🟢 **LOW** | Invocación de `watch` dentro de `.map()` deshabilita optimizaciones del compilador de React | [components/clients/ClientForm.tsx:259](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L259) |
| **BUG-FORM-01** | UX / Consistencia | 🟢 **LOW** | Persistencia de presupuesto y cuartos al conmutar de Comprador a Vendedor en `ClientForm` | [components/clients/ClientForm.tsx:157-173](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L157-L173) |
| **DEBT-CSP-01** | Configuración | 🟢 **LOW** | Residuos obsoletos de Anthropic en CSP de `next.config.ts` y `.env.example` | [next.config.ts:9](file:///Users/eduardotorres/Developer/Really-CRM/next.config.ts#L9), [.env.example:7](file:///Users/eduardotorres/Developer/Really-CRM/.env.example#L7) |
| **LINT-ESLINT-01** | Build / Calidad | 🟢 **LOW** | ESLint analiza archivos tipados autogenerados de Astro provocando fallo en `npm run lint` | [eslint.config.mjs:9-15](file:///Users/eduardotorres/Developer/Really-CRM/eslint.config.mjs#L9-L15) |
| **TEST-MISSING-01** | Testing / QA | 🟢 **LOW** | Ausencia absoluta de tests unitarios/integración y comando `npm test` faltante en `package.json` | [package.json:5-10](file:///Users/eduardotorres/Developer/Really-CRM/package.json#L5-L10), [AGENTS.md:19](file:///Users/eduardotorres/Developer/Really-CRM/AGENTS.md#L19) |

---

## 3. EVALUACIÓN DETALLADA POR PILAR

### PILAR 1: SEGURIDAD (SECURITY)

#### 1.1. [SEC-SCHEMA-01] Bloqueo Fatal de Nuevos Usuarios por Falta de Trigger en `supabase/schema.sql`
- **Severidad:** 🔴 **CRITICAL**
- **Archivo afectado:** [supabase/schema.sql:20-56](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L20-L56)
- **Mecanismo del Fallo:**
  El documento de bienvenida y configuración inicial (`README.md:30`) instruye a ejecutar `supabase/schema.sql` en el SQL Editor de Supabase. En este esquema base:
  1. `profiles.id` es `uuid primary key references auth.users(id) on delete cascade`.
  2. `clients.realtor_id` tiene restricción foránea `references profiles(id) on delete cascade`.
  3. `follow_ups`, `documents` y `email_templates` también referencian `profiles(id)`.
  4. **No existe ningún trigger en `schema.sql` sobre `auth.users`.**
  Cuando un usuario se autentica vía Magic Link (`signInWithOtp`), Supabase crea el registro en `auth.users`, pero la tabla `public.profiles` queda vacía. Como resultado, cualquier intento del usuario de crear un cliente, subir un documento o programar un seguimiento falla con violación de clave foránea (`violates foreign key constraint "clients_realtor_id_fkey"`).
- **Impacto:** Bloqueo operativo total de la plataforma para cualquier cuenta nueva que despliegue con la documentación oficial.
- **Remediación:** Incorporar a `supabase/schema.sql` la función `handle_new_user()` y el trigger `on_auth_user_created` (presente en la migración `20260920_handle_new_user_trigger.sql`).

```sql
-- Remedio en supabase/schema.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

#### 1.2. [SEC-SSRF-01] SSRF Bypass Mediante Redirecciones HTTP en Parser de Propiedades
- **Severidad:** 🟠 **HIGH**
- **Archivos afectados:**  
  - [lib/security/ssrf.ts:40-68](file:///Users/eduardotorres/Developer/Really-CRM/lib/security/ssrf.ts#L40-L68)  
  - [lib/claude/propertyMatch.ts:107-115](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107-L115)  
  - [app/api/property-match/route.ts:35](file:///Users/eduardotorres/Developer/Really-CRM/app/api/property-match/route.ts#L35)
- **Mecanismo del Fallo:**
  En `app/api/property-match/route.ts`, se invoca `await assertUrlAllowed(url)`. Esta función valida correctamente que la URL inicial no apunte a direcciones IP privadas (RFC 1918, link-local, loopback, metadatos `169.254.169.254`).
  Sin embargo, inmediatamente después en [lib/claude/propertyMatch.ts:107](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107), se ejecuta:
  ```ts
  const res = await fetch(safeUrl, {
    signal: controller.signal,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
  })
  ```
  La API `fetch` estándar en Node.js sigue de forma automática las redirecciones HTTP (`redirect: 'follow'`). Un atacante puede proveer una URL legítima bajo su control (ej. `https://attacker.com/redirect`) que responda con `302 Found` y cabecera `Location: http://169.254.169.254/latest/meta-data/` o `http://localhost:54321/`. `fetch` seguirá ciegamente la redirección al endpoint privado sin volver a evaluar `assertUrlAllowed`. En la línea 113, `await res.text()` descarga la respuesta interna y la expone en `rawDescription` y `haystack`.
- **Impacto:** Filtración de metadatos de instancia cloud (AWS/GCP/Vercel tokens de servicio), acceso a servicios internos de la red privada o interfaces administrativas locales.
- **Remediación:** Configurar `redirect: 'manual'` o implementar un agente de fetch con resolución DNS fija y validación en cada salto de redirección.

```ts
// Remediación en lib/claude/propertyMatch.ts
const res = await fetch(safeUrl, {
  signal: controller.signal,
  redirect: 'error', // O 'manual' comprobando la cabecera Location con assertUrlAllowed
  headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
})
```

---

#### 1.3. [BUG-RLS-01] Omisión de Política RLS `UPDATE` en `storage.objects` Rompe Re-subidas con `upsert: true`
- **Severidad:** 🟠 **HIGH**
- **Archivos afectados:**  
  - [supabase/schema.sql:186-218](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L186-L218)  
  - [lib/storage/uploadFile.ts:14](file:///Users/eduardotorres/Developer/Really-CRM/lib/storage/uploadFile.ts#L14)  
  - [components/profile/AvatarUpload.tsx:52](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/AvatarUpload.tsx#L52)
- **Mecanismo del Fallo:**
  Las políticas de Storage en `supabase/schema.sql` definen únicamente:
  - `Upload own avatar` / `Upload own documents` (`FOR INSERT`)
  - `Public avatar read` / `Read own documents` (`FOR SELECT`)
  - `Delete own avatar` / `Delete own documents` (`FOR DELETE`)
  En [lib/storage/uploadFile.ts:14](file:///Users/eduardotorres/Developer/Really-CRM/lib/storage/uploadFile.ts#L14), la subida utiliza `{ upsert: true }`. Cuando un archivo ya existe (por ejemplo, el usuario cambia su foto de perfil en `${userId}/avatar.${ext}`), la API de Supabase Storage ejecuta un comando SQL `UPDATE` sobre `storage.objects`. Debido a que PostgreSQL deniega cualquier operación no permitida explícitamente en RLS, el `UPDATE` es rechazado con error `403 Forbidden` (`new row violates row-level security policy for table "objects"`).
- **Impacto:** Imposibilidad de actualizar fotos de perfil o sobrescribir documentos existentes tras la primera subida.
- **Remediación:** Agregar las políticas `FOR UPDATE` para los buckets `avatars` y `documents`.

```sql
-- Remediación en supabase/schema.sql y nueva migración
CREATE POLICY "Update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Update own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

#### 1.4. [SEC-ACTION-01] Falta de Validación Zod Server-Side en Server Actions de Clientes
- **Severidad:** 🟠 **HIGH**
- **Archivo afectado:** [app/actions/clients.ts:39-90](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L90)
- **Mecanismo del Fallo:**
  Las Server Actions `createClientAction` y `updateClientAction` reciben `input: ClientInput` y realizan la inserción/actualización directa en la tabla `clients`:
  ```ts
  export async function createClientAction(input: ClientInput): Promise<ClientActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('clients')
      .insert({ ...input, realtor_id: user.id })
  ```
  No existe ninguna verificación de esquema Zod en el servidor. Aunque el formulario cliente (`ClientForm.tsx`) valida con Zod, las Server Actions son endpoints HTTP públicos invocables mediante herramientas como `curl` o scripts maliciosos. Un usuario autenticado puede enviar nombres vacíos, correos malformados, valores monetarios negativos o no numéricos, y rangos ilógicos (`budget_min > budget_max`).
- **Impacto:** Inyección de datos corruptos, evasión de reglas de negocio y potencial fallo del renderizado en cliente.
- **Remediación:** Importar y ejecutar el esquema Zod en el servidor antes de invocar Supabase.

---

#### 1.5. [SEC-RATELIMIT-01 & 02] Rate Limiter en Memoria Volátil y Endpoints Expuestos a Abuso
- **Severidad:** 🟡 **MEDIUM**
- **Archivos afectados:**  
  - [lib/rateLimit.ts:1-16](file:///Users/eduardotorres/Developer/Really-CRM/lib/rateLimit.ts#L1-L16)  
  - [app/api/bulk-email/route.ts:21](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L21)  
  - [app/api/send-followup-email/route.ts:10-61](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L10-L61)
- **Mecanismo del Fallo:**
  1. `lib/rateLimit.ts` utiliza un `Map<string, ...>` en memoria local del proceso. En la infraestructura Serverless de Vercel, cada petición puede atenderse en un contenedor efímero independiente o experimentar cold starts, haciendo que el rate limit sea completamente ignorado bajo peticiones concurrentes. Además, el `Map` no purga entradas expiradas, acumulando claves indefinidamente.
  2. La ruta [app/api/send-followup-email/route.ts](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts) no implementa ningún tipo de rate limit.
- **Impacto:** Posibilidad de saturar la cuota de Resend API, generar costos imprevistos o ser catalogado como remitente de spam.
- **Remediación:** Migrar a un store distribuido (Upstash Redis) o implementar control de concurrencia y rate limit por usuario en todos los endpoints de correo.

---

### PILAR 2: BUGS Y ERRORES LÓGICOS (BUGS & LOGIC ERRORS)

#### 2.1. [BUG-TIMEZONE-01] Desfase de Zona Horaria (-1 Día) en Correos por `parseISO`
- **Severidad:** 🟠 **HIGH**
- **Archivos afectados:**  
  - [app/api/send-followup-email/route.ts:49](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L49)  
  - [app/api/cron/send-daily-followups/route.ts:70](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L70)
- **Mecanismo del Fallo:**
  La columna `scheduled_date` es de tipo SQL `DATE` (ej. `'2026-09-24'`).
  Al ejecutar:
  ```ts
  format(parseISO(fu.scheduled_date), 'MMMM d, yyyy')
  ```
  `parseISO` interpreta un string de solo fecha como medianoche UTC (`2026-09-24T00:00:00.000Z`). Cuando la función `format` de `date-fns` opera en entornos con zonas horarias al oeste de Greenwich (como Puerto Rico AST UTC-4, o servidores configurados en EDT/CDT/PDT), el timestamp se convierte a la hora local equivalente (las 8:00 PM del día anterior, `2026-09-23 20:00:00`).
  El correo enviado al cliente/realtor indica: *"You have a follow-up scheduled on September 23, 2026"*, indicando una fecha atrasada en un día completo respecto a lo programado en la base de datos.
  *(Nota: Este bug fue corregido en la UI en [FollowUpCard.tsx:30](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L30) usando `parse(..., 'yyyy-MM-dd', new Date())`, pero fue omitido en los servicios de envío de correo).*
- **Impacto:** Confusión directa en clientes y agentes inmobiliarios sobre la fecha real de reuniones y citas.
- **Remediación:** Reemplazar `parseISO` por `parse(dateStr, 'yyyy-MM-dd', new Date())` en ambas rutas.

---

#### 2.2. [PERF-TIMEZONE-01] Desincronización Nocturna del Dashboard Server Component por Cálculo en UTC
- **Severidad:** 🟡 **MEDIUM**
- **Archivo afectado:** [app/(app)/dashboard/page.tsx:17](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/dashboard/page.tsx#L17)
- **Mecanismo del Fallo:**
  En el Server Component del Dashboard:
  ```ts
  const today = format(new Date(), 'yyyy-MM-dd')
  ```
  Este código corre en el servidor de Vercel, cuya zona horaria de sistema es `UTC`. En Puerto Rico (AST, UTC-4), entre las 8:00 PM y las 11:59 PM de cada día, la hora UTC ya se encuentra en el día siguiente.
  En consecuencia, las consultas:
  ```ts
  supabase.rpc('get_dashboard_stats', { p_realtor_id: user.id, p_today: today })
  supabase.from('follow_ups').select(...).eq('scheduled_date', today)
  ```
  filtran por la fecha de mañana, mostrando que no hay tareas pendientes para hoy y marcando erróneamente los seguimientos de la fecha actual como vencidos.
- **Impacto:** Datos erróneos en el Dashboard durante las noches para usuarios en Puerto Rico y la costa este de EE.UU.
- **Remediación:** Utilizar la zona horaria del realtor o fijar la zona horaria por defecto (`America/Puerto_Rico`) mediante `date-fns-tz` o `Intl.DateTimeFormat`.

---

#### 2.3. [BUG-STORAGE-01] Fuga de Archivos Huérfanos en Supabase Storage
- **Severidad:** 🟡 **MEDIUM**
- **Archivos afectados:**  
  - [app/actions/documents.ts:10-27](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L10-L27)  
  - [components/documents/DocumentUploadDialog.tsx:66-78](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L66-L78)
- **Mecanismo del Fallo:**
  1. La acción [deleteDocumentAction](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L10) elimina la fila en la tabla `documents`, pero nunca invoca `supabase.storage.from('documents').remove([file_path])`. El archivo físico permanece para siempre en el bucket de storage.
  2. En `DocumentUploadDialog.tsx`, la subida física del archivo se realiza en la línea 66 (`await uploadFile(...)`) antes de insertar la fila en la base de datos (línea 68). Si la inserción en la BD falla por un error de validación o corte de red, el archivo en Storage queda huérfano de inmediato sin ningún mecanismo de rollback.
- **Impacto:** Consumo descontrolado de cuota de almacenamiento en Supabase Storage y aumento injustificado de costos.
- **Remediación:** En `deleteDocumentAction`, consultar la ruta del archivo y borrarlo de storage antes o después del delete en DB. En el diálogo de subida, agregar un bloque `catch` que invoque `.remove()` si la inserción en la tabla falla.

---

#### 2.4. [BUG-AUTH-SYNC-01] Desincronización de Identidad entre `profiles.email` y `auth.users`
- **Severidad:** 🟡 **MEDIUM**
- **Archivo afectado:** [components/profile/ProfileForm.tsx:70-77](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/ProfileForm.tsx#L70-L77)
- **Mecanismo del Fallo:**
  El formulario de perfil permite editar el campo `email` y lo actualiza en `public.profiles`. No obstante, el usuario se autentica contra el servicio `auth.users` de Supabase Auth. Cambiar el correo en `profiles` no altera `auth.users.email`. Como consecuencia:
  - El usuario debe seguir iniciando sesión con el correo anterior.
  - Los correos de Magic Link se envían al correo viejo, pero las notificaciones de seguimientos ([app/api/send-followup-email/route.ts:46](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L46)) se leen de `profiles.email`.
- **Impacto:** Desconexión de cuentas, confusión y posible pérdida de acceso a la cuenta.
- **Remediación:** Deshabilitar la edición directa del email en `ProfileForm` o canalizar el cambio mediante `supabase.auth.updateUser({ email })`.

---

#### 2.5. [BUG-ENV-01] Magic Link Inoperativo por Falta de Fallback en `NEXT_PUBLIC_APP_URL`
- **Severidad:** 🟡 **MEDIUM**
- **Archivo afectado:** [app/(auth)/login/page.tsx:32](file:///Users/eduardotorres/Developer/Really-CRM/app/(auth)/login/page.tsx#L32)
- **Mecanismo del Fallo:**
  ```ts
  emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
  ```
  Si `NEXT_PUBLIC_APP_URL` no está definida en el entorno (ej. en desarrollo local o previews de Vercel mal configuradas), la variable evalúa a `undefined`. La URL resultante enviada a Supabase es `"undefined/auth/callback"`, lo que provoca que Supabase Auth rechace el envío o redirija a un destino inválido.
- **Impacto:** Falla en el inicio de sesión para entornos sin la variable explícita.
- **Remediación:** En componentes de cliente, utilizar `typeof window !== 'undefined' ? window.location.origin : ...`.

---

### PILAR 3: ARQUITECTURA (ARCHITECTURE)

#### 3.1. [ARCH-AUDIT-01] Duplicación Sistemática de Registros en `client_history`
- **Severidad:** 🟡 **MEDIUM**
- **Archivos afectados:**  
  - [app/actions/clients.ts:51-56](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56)  
  - [supabase/migrations/20260824_full_audit_remediation.sql:35-58](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L35-L58)
- **Mecanismo del Fallo:**
  En la migración `20260824_full_audit_remediation.sql`, se creó el trigger:
  ```sql
  CREATE TRIGGER trg_audit_clients
    AFTER INSERT OR UPDATE ON clients
    FOR EACH ROW EXECUTE PROCEDURE fn_audit_client_changes();
  ```
  Dicho trigger inserta automáticamente una fila con `event_type = 'created'` en `client_history` cada vez que se inserta un cliente.
  Simultáneamente, la Server Action [createClientAction](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51) ejecuta manualmente:
  ```ts
  await supabase.from('client_history').insert({
    client_id: data.id,
    realtor_id: user.id,
    event_type: 'created',
    description: `Client "${input.name}" was created`,
  })
  ```
- **Impacto:** Cada cliente nuevo genera dos eventos idénticos de creación en la pestaña de historial (`HistoryTab.tsx`).
- **Remediación:** Eliminar la inserción manual en `createClientAction` y dejar la responsabilidad exclusivamente en el trigger de base de datos.

---

#### 3.2. [ARCH-MUTATION-01] Inconsistencia en la Capa de Mutación de Datos
- **Severidad:** 🟡 **MEDIUM**
- **Archivos afectados:**  
  - Mutaciones vía Server Actions: [app/actions/clients.ts](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts), [app/actions/documents.ts](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts)  
  - Mutaciones vía Browser SDK directo:  
    - [components/pipeline/PipelineBoard.tsx:55-59](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L55-L59) (`clients.update stage`)  
    - [components/follow-ups/FollowUpCard.tsx:37-51](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L37-L51) (`follow_ups.update`, `delete`)  
    - [components/follow-ups/FollowUpForm.tsx:39-46](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpForm.tsx#L39-L46) (`follow_ups.insert`)  
    - [components/templates/TemplatesManager.tsx:59-83](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatesManager.tsx#L59-L83) (`email_templates` CRUD)  
    - [components/profile/ProfileForm.tsx:70-77](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/ProfileForm.tsx#L70-L77) (`profiles.upsert`)
- **Mecanismo del Fallo:**
  El proyecto carece de una estrategia unificada de mutación. Se inició una migración hacia Server Actions para clientes y documentos, pero el resto de las entidades esenciales continúan mutando desde el navegador mediante el cliente anónimo de Supabase.
- **Impacto:** Fragmentación del manejo de errores, incapacidad de auditar cambios de forma homogénea en el servidor y dependencia del cliente para la revalidación de caché (`revalidatePath`).
- **Remediación:** Crear `app/actions/followUps.ts`, `app/actions/templates.ts` y `app/actions/profile.ts` para centralizar todas las mutaciones en Server Actions.

---

#### 3.3. [ARCH-PROXY-01] Convención Deprecada `middleware.ts` en Next.js 16
- **Severidad:** 🟡 **MEDIUM**
- **Archivo afectado:** [middleware.ts:4](file:///Users/eduardotorres/Developer/Really-CRM/middleware.ts#L4)
- **Mecanismo del Fallo:**
  Next.js 16 introdujo la convención `proxy.ts` para sustituir a `middleware.ts` en la gestión de proxying y control de cabeceras/cookies en el App Router. En [lib/supabase/server.ts:6](file:///Users/eduardotorres/Developer/Really-CRM/lib/supabase/server.ts#L6) el código ya alude en sus comentarios a `proxy.ts`:
  *"the proxy.ts middleware refreshes/persists the session per request"*, pero el archivo sigue nombrado físicamente como `middleware.ts`.
- **Impacto:** Deuda técnica y potenciales fallos de compatibilidad en futuras versiones menores de Next.js o compilaciones con Turbopack estricto.
- **Remediación:** Renombrar `middleware.ts` a `proxy.ts` de acuerdo con las especificaciones de Next.js 16.

---

### PILAR 4: RENDIMIENTO (PERFORMANCE)

#### 4.1. [PERF-API-01] Bucle Secuencial y Riesgo Crítico de Timeout 504 en `POST /api/bulk-email`
- **Severidad:** 🟠 **HIGH**
- **Archivo afectado:** [app/api/bulk-email/route.ts:70-95](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L70-L95)
- **Mecanismo del Fallo:**
  La ruta permite hasta 100 destinatarios (`MAX_RECIPIENTS = 100`). La ejecución procesa a los clientes mediante un bucle `for...of` secuencial:
  ```ts
  for (const client of (clients ?? []) as Client[]) {
    // 1. await sendClientEmail(...) -> HTTP request a Resend API (~300-600ms)
    // 2. await supabase.from('client_history').insert(...) -> Query a DB (~100-200ms)
  }
  ```
  Para un envío a 30 clientes, el tiempo total es de ~20-25 segundos. En 100 clientes, supera los 60 segundos.
  Las funciones Serverless de Vercel en planes estándar tienen un límite de ejecución (timeout) de 10 a 15 segundos (máximo 60 segundos con `maxDuration`). Cuando la función excede el límite, Vercel termina abruptamente el proceso arrojando `504 Gateway Timeout`.
- **Impacto:** Pérdida de estado: un número indeterminado de correos se envía, el resto queda en el limbo, y la interfaz de usuario muestra un error genérico sin reportar cuáles fallaron.
- **Remediación:** Utilizar procesamiento concurrente con control de concurrencia (`p-limit` o chunks de 5-10 promesas) o utilizar la API de Batch Email de Resend (`resend.batch.send`).

```ts
// Remediación recomendada: Batch Sending con Resend
// Resend permite enviar hasta 100 correos en un solo payload HTTP
const emailPayloads = clientsWithEmail.map(c => ({
  from: process.env.RESEND_FROM_EMAIL!,
  to: c.email,
  subject: applyTemplate(subject, vars),
  html: ...,
}))
await resend.batch.send(emailPayloads)
```

---

#### 4.2. [PERF-PIPELINE-01] Consulta Masiva no Acotada en Pipeline Kanban
- **Severidad:** 🟡 **MEDIUM**
- **Archivo afectado:** [app/(app)/pipeline/page.tsx:20-25](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/pipeline/page.tsx#L20-L25)
- **Mecanismo del Fallo:**
  ```ts
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('realtor_id', user.id)
    .order('created_at', { ascending: false })
  ```
  La página de Pipeline no incluye cláusula `.limit()` ni paginación por etapas. A medida que un agente acumula cientos o miles de prospectos y transacciones pasadas, toda la tabla de clientes se transfiere por la red y se hidrata en memoria en el componente `PipelineBoard.tsx`.
- **Impacto:** Consumo excesivo de memoria en navegador móvil, renders lentos e incremento innecesario en la transferencia de datos.
- **Remediación:** Filtrar por defecto clientes activos o de los últimos 6 meses, o cargar los clientes bajo demanda/virtualizados por columna.

---

### PILAR 5: CÓDIGO MUERTO Y EXPORTS SIN USAR (DEAD CODE)

#### 5.1. [DEAD-CODE-01 & 02] Archivos y Componentes UI Huérfanos
- **Severidad:** 🟢 **LOW**
- **Archivos afectados:**  
  - [components/clients/ClientList.tsx:1-125](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx#L1-L125) (100% huérfano, sustituido por `SelectableClientList.tsx`)  
  - [components/ui/select.tsx:1-168](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/select.tsx#L1-L168) (Nunca importado; los formularios usan `<select>` nativo)  
  - [components/ui/skeleton.tsx:1-15](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/skeleton.tsx#L1-L15) (Nunca importado; el matching usa divs con `animate-pulse`)  
  - [ruvector.db](file:///Users/eduardotorres/Developer/Really-CRM/ruvector.db) (Archivo residual de base de datos sqlite de 1.5 MB en raíz)
- **Remediación:** Eliminar los 4 archivos del repositorio.

---

#### 5.2. [DEAD-TYPES-01] Tipos Exportados sin Referencia
- **Severidad:** 🟢 **LOW**
- **Archivos afectados:**  
  - `types/client.ts:47-50`: `ClientInsert`, `ClientUpdate`  
  - `types/document.ts:22-25`: `DocumentInsert`, `DocumentUpdate`  
  - `types/profile.ts:22`: `ProfileUpsert`  
  - `types/followUp.ts:20-23`: `FollowUpInsert`, `FollowUpUpdate`  
  - `types/emailTemplate.ts:17-20`: `EmailTemplateInsert`
- **Mecanismo:** Tipos auxiliares creados durante el scaffolding inicial que nunca llegaron a integrarse en las acciones o componentes.
- **Remediación:** Eliminar los tipos no referenciados o utilizarlos en las Server Actions correspondientes.

---

#### 5.3. [LINT-COMPILER-01] Advertencia del Compilador de React 19 por `watch` en Loop
- **Severidad:** 🟢 **LOW**
- **Archivo afectado:** [components/clients/ClientForm.tsx:259](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L259)
- **Diagnóstico:** `const saleType = watch('sale_type')` se ejecuta dentro del callback `.map(...)` al iterar los botones de tipo de venta. React Compiler omite la optimización del componente con la advertencia: `react-hooks/incompatible-library`.
- **Remediación:** Elevar la llamada a `watch('sale_type')` antes del `.map()`.

---

### PILAR 6: SCHEMA Y BASE DE DATOS (DATABASE & MIGRATIONS)

#### 6.1. [SCHEMA-DRIFT-01] Desincronización Crítica entre `supabase/schema.sql` y Migraciones
- **Severidad:** 🟠 **HIGH** (Con impacto funcional crítico)
- **Archivo afectado:** [supabase/schema.sql:1-219](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L1-L219)
- **Diagnóstico Detallado:**
  Existe una severa divergencia entre lo documentado en `schema.sql` (que se supone que es el script completo de inicialización) y los cambios introducidos en las migraciones posteriores (`0001_pipeline_and_templates.sql`, `20260824_full_audit_remediation.sql`, `20260920_handle_new_user_trigger.sql`):
  
  | Elemento en Migraciones | Estado en `supabase/schema.sql` | Consecuencia en DB limpia |
  | :--- | :---: | :--- |
  | RPC `get_dashboard_stats(...)` | ❌ **Ausente** | **Crash total del Dashboard** ([dashboard/page.tsx:24](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/dashboard/page.tsx#L24) llama a una función inexistente). |
  | Trigger `on_auth_user_created` | ❌ **Ausente** | **Bloqueo de nuevos usuarios** tras signup de Supabase Auth. |
  | Restricción `uq_profiles_email` | ❌ **Ausente** | Permite múltiples perfiles con el mismo correo electrónico. |
  | CHECK constraints en `clients` (`chk_clients_budget_*`, etc.) | ❌ **Ausente** | Permite presupuestos y habitaciones negativas o inconsistentes. |
  | Índices de rendimiento (`idx_follow_ups_realtor_scheduled`, etc.) | ❌ **Ausente** | Consultas no indexadas en seguimientos y auditoría. |

- **Remediación:** Regenerar y consolidar `supabase/schema.sql` para que contenga el 100% de la estructura actual del sistema, permitiendo un aprovisionamiento limpio en un solo paso.

---

#### 6.2. [LINT-ESLINT-01] Configuración de ESLint Analiza Archivos Autogenerados de Astro
- **Severidad:** 🟢 **LOW**
- **Archivo afectado:** [eslint.config.mjs:9-15](file:///Users/eduardotorres/Developer/Really-CRM/eslint.config.mjs#L9-L15)
- **Diagnóstico:** Al ejecutar `npm run lint`, el proceso falla con 6 errores de TypeScript procedentes de `landing/.astro/content.d.ts` y `landing/.astro/types.d.ts`. Aunque la carpeta `landing/` es un proyecto separado, no está excluida en `globalIgnores` de ESLint.
- **Remediación:** Añadir `"landing/**"` a `globalIgnores` en `eslint.config.mjs`.

---

## 4. PLAN DE REMEDIACIÓN Y PRIORIZACIÓN

### Fase 0: Bloqueantes Críticos y Fallos de Autenticación (Inmediato - P0)
1. **Unificar `supabase/schema.sql`:**
   - Incorporar `handle_new_user()` y el trigger `on_auth_user_created`.
   - Incorporar la función RPC `get_dashboard_stats(p_realtor_id uuid, p_today date)`.
   - Agregar las políticas RLS `FOR UPDATE` en `storage.objects` para los buckets `avatars` y `documents`.
   - Añadir restricciones CHECK en `clients` e índices compuestos faltantes.
2. **Corregir Fallback de Auth:**
   - Añadir fallback `window.location.origin` en [app/(auth)/login/page.tsx:32](file:///Users/eduardotorres/Developer/Really-CRM/app/(auth)/login/page.tsx#L32).

### Fase 1: Seguridad, Integridad y Corrección de Bugs de Negocio (Corto Plazo - P1)
1. **Bloquear SSRF por Redirecciones:**
   - Modificar `fetch` en [lib/claude/propertyMatch.ts:107](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107) con `redirect: 'error'` o validación manual de cada salto contra `assertUrlAllowed`.
2. **Subsanar Desfase de Zona Horaria en Correos:**
   - Reemplazar `parseISO` por `parse(..., 'yyyy-MM-dd', new Date())` en [app/api/send-followup-email/route.ts:49](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L49) y [app/api/cron/send-daily-followups/route.ts:70](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L70).
3. **Validación Zod Server-Side en Server Actions:**
   - Validar `ClientInput` con el schema Zod en [app/actions/clients.ts](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts).
4. **Prevenir Timeouts en Bulk Email:**
   - Refactorizar [app/api/bulk-email/route.ts](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts) para usar la API Batch de Resend o procesamiento concurrente acotado.

### Fase 2: Arquitectura y Rendimiento (Mediano Plazo - P2)
1. **Eliminar Duplicación de Historial:**
   - Remover el `.insert()` manual en `createClientAction` y delegar en el trigger `trg_audit_clients`.
2. **Limpieza de Archivos Huérfanos en Storage:**
   - Borrar el archivo de Supabase Storage en [app/actions/documents.ts](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts) al eliminar el registro de documento.
3. **Paginación y Virtualización en Pipeline:**
   - Acotar la consulta de [app/(app)/pipeline/page.tsx](file:///Users/eduardotorres/Developer/Really-CRM/app/(app)/pipeline/page.tsx) a clientes relevantes o activos.
4. **Migración Arquitectónica Next.js 16:**
   - Renombrar `middleware.ts` a `proxy.ts`.

### Fase 3: Calidad, Testing y Limpieza de Código (P3)
1. **Eliminar Archivos y Tipos Muertos:**
   - Borrar `ClientList.tsx`, `components/ui/select.tsx`, `components/ui/skeleton.tsx`, y `ruvector.db`.
   - Limpiar los 9 tipos no usados en `types/`.
2. **Ajustes de Linter y Compilador:**
   - Ignorar `landing/**` en `eslint.config.mjs`.
   - Elevar `watch('sale_type')` en `ClientForm.tsx`.
   - Eliminar `_score` sin uso en `propertyMatch.ts`.
3. **Configurar Suite de Tests:**
   - Configurar Vitest en `package.json` para validar lógica de matching (`propertyMatch.ts`), templates (`applyTemplate`) y SSRF (`assertUrlAllowed`).
