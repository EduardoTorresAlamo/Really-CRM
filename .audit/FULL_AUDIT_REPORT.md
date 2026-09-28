# FULL CODEBASE AUDIT & TECHNICAL REVIEW — REALLY-CRM
**Fecha de Auditoría:** 24 de Septiembre de 2026  
**Alcance:** Código Fuente Completo (`app/`, `components/`, `lib/`, `types/`, `supabase/`, configuraciones raíz)  
**Stack Evaluado:** Really-CRM v0.1.0 (Next.js 16.2.7, React 19.2.4, Tailwind CSS v4, Base UI, Supabase SSR / PostgreSQL, Resend)  
**Clasificación de Severidad:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW  

---

## 1. RESUMEN EJECUTIVO

Se ha ejecutado una auditoría exhaustiva, estática y arquitectónica del código fuente de **Really-CRM**. La aplicación es un CRM inmobiliario diseñado para agentes en Puerto Rico y Estados Unidos, implementado sobre el App Router de Next.js 16, React 19 y Supabase (Autenticación, Base de Datos PostgreSQL con Row Level Security y Storage de archivos).

El análisis identificó **25 hallazgos totales**, de los cuales **1 es CRITICAL** (bloqueo total para nuevos usuarios registrados por ausencia de trigger en el esquema base `schema.sql`), **6 son HIGH** (vulnerabilidades de red SSRF, bypass RLS en storage, desfase de fechas en correos de clientes, timeouts en funciones serverless, schema drift y omisión de validación de Server Actions), **9 son MEDIUM** y **9 son LOW**.

### Resumen Consolidado por Nivel de Severidad

| Severidad | Cantidad | Descripción General |
| :--- | :---: | :--- |
| 🔴 **CRITICAL** | **1** | Bloqueo fatal de nuevos usuarios por falta de trigger de inserción en `profiles` tras registro en Supabase Auth (`auth.users`) en el esquema base `schema.sql`. |
| 🟠 **HIGH** | **6** | Vector SSRF por saltos de redirección HTTP en parser de propiedades; falta de política RLS `UPDATE` en `storage.objects`; desfase de zona horaria (-1 día) en correos por `parseISO`; riesgo de Timeout 504 en `POST /api/bulk-email`; Schema Drift crítico (`get_dashboard_stats` y restricciones faltantes en `schema.sql`); falta de validación Zod server-side en Server Actions. |
| 🟡 **MEDIUM** | **9** | Rate limiter volátil en memoria inefectivo en Serverless (Vercel); ausencia de rate limiting en `POST /api/send-followup-email`; fallo en Magic Link por variable de entorno no declarada (`NEXT_PUBLIC_APP_URL`); fuga de archivos huérfanos en Storage al eliminar documentos; duplicación de eventos en historial de auditoría (`createClientAction` vs DB Trigger); disparidad arquitectónica en mutaciones (Server Actions vs browser SDK); deprecación de `middleware.ts` en Next.js 16; cálculo de fechas en UTC en Dashboard Server Component; carga masiva no acotada de clientes en Pipeline Kanban. |
| 🟢 **LOW** | **9** | Código muerto y archivos huérfanos (`ClientList.tsx`, `select.tsx`, `skeleton.tsx`, base de datos residual `ruvector.db`); tipos TypeScript no referenciados; advertencia de React 19 Compiler por `watch` dentro de `.map()`; persistencia de campos de comprador al conmutar a vendedor; CSP y variables obsoletas de Anthropic; omisión de carpeta `landing/` en ESLint raíz; falta de sanitización CRLF en interpolación de asuntos de correo; pérdida de selección al paginar clientes; ausencia de script `npm test`. |

---

## 2. MATRIZ CONSOLIDADA DE HALLAZGOS

| ID | Categoría | Severidad | Descripción Breve | Archivos y Líneas Afectadas |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-SCHEMA-01** | Seguridad / Schema | 🔴 **CRITICAL** | Bloqueo total de nuevos usuarios por falta de trigger `profiles` tras signup en Auth (base `schema.sql`) | `supabase/schema.sql`, `auth.users` |
| **SEC-SSRF-01** | Seguridad / Red | 🟠 **HIGH** | SSRF Bypass mediante HTTP Redirects en extracción de propiedades | `lib/claude/propertyMatch.ts:107-120`, `lib/security/ssrf.ts` |
| **BUG-RLS-01** | Seguridad / Storage | 🟠 **HIGH** | Falta de política RLS `FOR UPDATE` en `storage.objects` rompe `upsert: true` en avatares y documentos | `supabase/schema.sql:186-218`, `components/profile/AvatarUpload.tsx:52` |
| **BUG-TIMEZONE-01** | Bugs / Lógica | 🟠 **HIGH** | `parseISO` en strings date-only provoca desfase de 1 día en correos de seguimiento | `app/api/send-followup-email/route.ts:49`, `app/api/cron/send-daily-followups/route.ts:70` |
| **PERF-API-01** | Rendimiento / Backend | 🟠 **HIGH** | Envío secuencial bloqueante y riesgo de Timeout 504 en `POST /api/bulk-email` | `app/api/bulk-email/route.ts:70-95` |
| **SCHEMA-DRIFT-01** | Base de Datos | 🟠 **HIGH** | Función RPC `get_dashboard_stats` y restricciones CHECK omitidas en `schema.sql` base | `supabase/schema.sql`, `app/(app)/dashboard/page.tsx:24` |
| **SEC-ACTION-01** | Seguridad / Backend | 🟠 **HIGH** | Falta de validación Zod server-side en Server Actions `createClientAction` y `updateClientAction` | `app/actions/clients.ts:39-90` |
| **SEC-RATELIMIT-01** | Seguridad / Escalabilidad | 🟡 **MEDIUM** | Rate limiting en memoria `Map` volátil es eludible en runtime Serverless (Vercel) | `lib/rateLimit.ts:1-16` |
| **SEC-RATELIMIT-02** | Seguridad / Abuso | 🟡 **MEDIUM** | Falta de rate limiting en `POST /api/send-followup-email` permite spam y agotamiento de cuota | `app/api/send-followup-email/route.ts:10-61` |
| **BUG-ENV-FALLBACK-01** | Auth / Frontend | 🟡 **MEDIUM** | Fallo en Magic Link / Login por falta de fallback en `NEXT_PUBLIC_APP_URL` | `app/(auth)/login/page.tsx:32-34` |
| **STORAGE-LEAK-01** | Almacenamiento | 🟡 **MEDIUM** | Fuga de archivos huérfanos en Storage al eliminar registros de `documents` | `app/actions/documents.ts:10-27` |
| **ARCH-AUDIT-01** | Arquitectura / Datos | 🟡 **MEDIUM** | Duplicación de eventos en `client_history` por inserción simultánea en Action y DB Trigger | `app/actions/clients.ts:51-56`, `supabase/migrations/20260824_full_audit_remediation.sql:35-59` |
| **ARCH-MUTATION-01** | Arquitectura | 🟡 **MEDIUM** | Inconsistencia de diseño: mezcla de Server Actions con mutaciones directas de cliente Supabase | `PipelineBoard.tsx`, `FollowUpCard.tsx`, `TemplatesManager.tsx` |
| **ARCH-PROXY-01** | Compatibilidad Next.js | 🟡 **MEDIUM** | Convención `middleware.ts` deprecada en Next.js 16 (reemplazada por `proxy.ts`) | `middleware.ts` |
| **PERF-TIMEZONE-01** | Rendimiento / Lógica | 🟡 **MEDIUM** | `today = format(new Date(), ...)` en server component opera en UTC y descalibra el Dashboard por la noche | `app/(app)/dashboard/page.tsx:17` |
| **PERF-PIPELINE-01** | Rendimiento / Escalabilidad | 🟡 **MEDIUM** | Carga masiva sin paginación ni límite en Pipeline Kanban (`select('*')`) | `app/(app)/pipeline/page.tsx:20-25` |
| **DEAD-CODE-01** | Mantenimiento / Código | 🟢 **LOW** | Archivos huérfanos (`ClientList.tsx`, `select.tsx`, `skeleton.tsx`, `ruvector.db`) | `components/clients/ClientList.tsx`, `components/ui/` |
| **DEAD-TYPES-01** | Mantenimiento / Tipos | 🟢 **LOW** | Tipos exportados sin uso en el proyecto (`ClientInsert`, `DocumentInsert`, `ProfileUpsert`, etc.) | `types/*.ts` |
| **LINT-COMPILER-01** | Calidad / Rendimiento | 🟢 **LOW** | Invocación de `watch` dentro de `.map()` deshabilita optimización del React Compiler | `components/clients/ClientForm.tsx:259` |
| **BUG-UX-CLEANUP-01**| UX / Consistencia | 🟢 **LOW** | Persistencia accidental de presupuesto al cambiar tipo de cliente de Buyer a Seller | `components/clients/ClientForm.tsx:157-174` |
| **DEBT-CSP-CLEANUP** | Seguridad / Deuda | 🟢 **LOW** | Directiva CSP obsoleta de Anthropic y residuo de variables de entorno sin SDK activo | `next.config.ts:9`, `.env.example:7`, `lib/claude/` |
| **LINT-ESLINT-01** | Calidad / Build | 🟢 **LOW** | ESLint analiza archivos autogenerados de Astro en `landing/.astro/` provocando errores | `eslint.config.mjs:9-16` |
| **SEC-CRLF-01** | Seguridad / Email | 🟢 **LOW** | Asunto de correo interpolado sin sanitización de caracteres CRLF (`\r`, `\n`) | `lib/resend/sendClientEmail.ts:31`, `lib/resend/sendFollowUpEmail.ts:42` |
| **BUG-PAGINATION-01** | UX / Estado | 🟢 **LOW** | Pérdida de selección múltiple al paginar en `SelectableClientList.tsx` | `components/clients/SelectableClientList.tsx:57` |
| **TEST-MISSING-01** | QA / DevOps | 🟢 **LOW** | Script `npm test` ausente a pesar de estar documentado en `AGENTS.md` | `package.json`, `AGENTS.md` |

---

## 3. ANÁLISIS DETALLADO POR PILAR

### PILAR 1: SEGURIDAD (SECURITY)

#### 🔴 [SEC-SCHEMA-01] CRITICAL — Bloqueo Fatal de Nuevos Usuarios por Falta de Trigger en `auth.users`
- **Ubicación:** `supabase/schema.sql` y `app/auth/callback/route.ts`
- **Estado Actual (20 de Septiembre de 2026):** En el commit `b88f5e6` se añadió la migración aislada `supabase/migrations/20260920_handle_new_user_trigger.sql` que implementa este trigger para ejecuciones secuenciales mediante Supabase CLI. **Sin embargo, el archivo base `supabase/schema.sql` (utilizado para inicialización de nuevos entornos y proyectos) aún carece de esta función y trigger**, manteniendo el fallo latente para cualquier despliegue desde cero.
- **Mecanismo:** La tabla `profiles` tiene como primary key `id uuid primary key references auth.users(id) on delete cascade`. A su vez, la tabla `clients` requiere `realtor_id uuid not null references profiles(id) on delete cascade`. Al registrarse un usuario con Magic Link (`signInWithOtp`), Supabase crea la fila en `auth.users`, pero en el esquema base no existe ningún trigger `AFTER INSERT ON auth.users` que inserte la fila en `profiles`.
- **Impacto Real:** Cuando el nuevo agente se autentica y navega a `/clients/new` para crear su primer cliente, `createClientAction` falla inmediatamente con el error fatal:  
  `violates foreign key constraint "clients_realtor_id_fkey" - Key (realtor_id)=(...) is not present in table "profiles".`  
  El usuario queda en un callejón sin salida hasta que visita `/profile` y envía manualmente el formulario de perfil.
- **Remediación SQL:**
  ```sql
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
  AS $$
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

#### 🟠 [SEC-SSRF-01] HIGH — SSRF Bypass por Redirecciones HTTP en `parsePropertyListing`
- **Ubicación:** `lib/claude/propertyMatch.ts:107-120`, `lib/security/ssrf.ts`, `app/api/property-match/route.ts`
- **Mecanismo:** En `app/api/property-match/route.ts`, se invoca `assertUrlAllowed(url)`. Esta validación verifica la IP del dominio inicial. Sin embargo, en `lib/claude/propertyMatch.ts`:
  ```typescript
  const res = await fetch(safeUrl, {
    signal: controller.signal,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
  })
  ```
  La función `fetch` nativa de Node.js sigue automáticamente las redirecciones HTTP (301, 302, 307). Un atacante puede proporcionar una URL pública que redirija a `http://169.254.169.254/latest/meta-data/` o `http://localhost:3000/api/...`. El cuerpo de la respuesta es procesado y retornado al usuario en `rawDescription`.
- **Impacto Real:** Exfiltración de credenciales del cloud metadata service (AWS/GCP/Vercel) o acceso no autorizado a microservicios internos en la red local.
- **Remediación:** Configurar `redirect: 'manual'` y verificar cada salto de redirección contra `assertUrlAllowed`:
  ```typescript
  export async function safeFetchHtml(initialUrl: string, maxRedirects = 3): Promise<string> {
    let currentUrl = initialUrl;
    for (let i = 0; i <= maxRedirects; i++) {
      await assertUrlAllowed(currentUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
      });
      clearTimeout(timeout);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (res.ok) {
        return (await res.text()).slice(0, 500_000);
      }
      break;
    }
    return '';
  }
  ```

---

#### 🟠 [BUG-RLS-01] HIGH — Falta de Política RLS `FOR UPDATE` en `storage.objects`
- **Ubicación:** `supabase/schema.sql:186-218` y `components/profile/AvatarUpload.tsx:43-54`
- **Mecanismo:** `AvatarUpload` define la ruta del avatar como `${userId}/avatar.${ext}` y llama a `uploadFile(..., { upsert: true })`. En Supabase Storage, si el archivo ya existe, `upsert: true` ejecuta una operación SQL `UPDATE` sobre la tabla `storage.objects`. `schema.sql` solo tiene políticas `INSERT`, `SELECT` y `DELETE`.
- **Impacto Real:** Todo usuario que intente cambiar o actualizar su foto de perfil existente recibe un error 403 de violación de RLS (`Failed to upload photo`).
- **Remediación SQL:**
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

#### 🟠 [SEC-ACTION-01] HIGH — Falta de Validación Server-Side (Zod) en Server Actions
- **Ubicación:** `app/actions/clients.ts:39-90`
- **Mecanismo:** `createClientAction(input: ClientInput)` y `updateClientAction(id, input)` confían ciegamente en el objeto `input` recibido. Aunque el formulario en el cliente usa `zodResolver`, las Server Actions son endpoints HTTP públicos (`Next-Action`). Cualquier cliente o script puede enviar peticiones POST directas con nombres vacíos, números negativos o estructuras malformadas.
- **Impacto Real:** Corrupción de datos, evasión de reglas de negocio e inserción de datos inconsistentes en PostgreSQL.
- **Remediación:** Importar y validar con el esquema Zod en el servidor:
  ```typescript
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  ```

---

#### 🟡 [SEC-RATELIMIT-01] MEDIUM — Rate Limiter en Memoria Inefectivo en Serverless
- **Ubicación:** `lib/rateLimit.ts:1-16`
- **Mecanismo:** La variable `const store = new Map<string, { count: number; resetAt: number }>()` reside en la memoria volátil del proceso Node.js.
- **Impacto:** En Vercel Serverless, cada petición puede inicializar una función lambda distinta o reiniciarse tras inactividad. Los atacantes pueden eludir fácilmente el límite de 10 peticiones/minuto haciendo peticiones concurrentes. Además, las entradas antiguas no se purgan nunca, lo que produce una fuga de memoria lenta en entornos con procesos de larga duración.
- **Remediación:** Implementar un rate limiter distribuido con `@upstash/ratelimit` sobre Redis, o registrar contadores atómicos en PostgreSQL.

---

#### 🟡 [SEC-RATELIMIT-02] MEDIUM — Ausencia de Rate Limiting en Envío Manual de Recordatorios
- **Ubicación:** `app/api/send-followup-email/route.ts:10-61`
- **Mecanismo:** Mientras que `POST /api/bulk-email` (1 req/10s) y `POST /api/property-match` (10 req/min) implementan llamadas a `isRateLimited`, el endpoint `POST /api/send-followup-email` omite por completo cualquier control de tasa.
- **Impacto:** Un usuario autenticado (o un atacante con sesión activa) puede bombardear el endpoint en un bucle automatizado rápido, saturando la cuota de la API de Resend, generando costos imprevistos o provocando bloqueo por spam del dominio remitente (`RESEND_FROM_EMAIL`).
- **Remediación:** Añadir `isRateLimited(`send-followup-email:${user.id}`, 5, 60_000)` al inicio de la función en `app/api/send-followup-email/route.ts`.

---

### PILAR 2: BUGS & LÓGICA DE NEGOCIO

#### 🟠 [BUG-TIMEZONE-01] HIGH — Desfase de -1 Día en Correos por `parseISO`
- **Ubicación:** `app/api/send-followup-email/route.ts:49` y `app/api/cron/send-daily-followups/route.ts:70`
- **Mecanismo:** La columna `follow_ups.scheduled_date` almacena cadenas tipo `"2026-09-10"`. Los endpoints de servidor ejecutan `format(parseISO(fu.scheduled_date), 'MMMM d, yyyy')`. `parseISO` interpreta la cadena date-only como UTC medianoche (`2026-09-10T00:00:00.000Z`). En servidores configurados en UTC-4 (Puerto Rico AST) o UTC-5 (Este de EE.UU.), las 00:00 UTC corresponden a las 8:00 PM del día anterior (`2026-09-09`).
- **Impacto Real:** Los agentes reciben correos indicando que la cita es para el **día anterior** a la fecha realmente agendada en la plataforma.
- **Remediación:** Parsear los componentes de la fecha como fecha local del calendario:
  ```typescript
  import { parse, format } from 'date-fns'

  const date = parse(fu.scheduled_date, 'yyyy-MM-dd', new Date())
  const followUpDate = format(date, 'MMMM d, yyyy')
  ```

---

#### 🟡 [STORAGE-LEAK-01] MEDIUM — Fuga de Archivos en Storage al Eliminar Documentos
- **Ubicación:** `app/actions/documents.ts:10-27`
- **Mecanismo:** `deleteDocumentAction` ejecuta `supabase.from('documents').delete().eq('id', id)`, pero nunca envía la orden de borrado al bucket de Supabase Storage.
- **Impacto Real:** Los documentos binarios (identificaciones personales, cartas de preaprobación bancaria) permanecen huérfanos indefinidamente en el bucket privado, acumulando costos de almacenamiento y generando riesgos de privacidad.
- **Remediación:**
  ```typescript
  export async function deleteDocumentAction(id: string, clientId: string): Promise<DocumentActionResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data: doc } = await supabase
      .from('documents')
      .select('file_url')
      .eq('id', id)
      .eq('realtor_id', user.id)
      .single()

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('realtor_id', user.id)

    if (error) return { ok: false, error: 'Failed to delete' }

    if (doc?.file_url && !/^https?:\/\//i.test(doc.file_url)) {
      await supabase.storage.from('documents').remove([doc.file_url])
    }

    revalidatePath(`/clients/${clientId}`)
    return { ok: true }
  }
  ```

---

#### 🟡 [ARCH-AUDIT-01] MEDIUM — Duplicación de Eventos en Historial de Auditoría
- **Ubicación:** `app/actions/clients.ts:51-56` vs `supabase/migrations/20260824_full_audit_remediation.sql:35-59`
- **Mecanismo:** El trigger de base de datos `trg_audit_clients` se ejecuta `AFTER INSERT ON clients` e inserta automáticamente un registro `'created'` en `client_history`. Simultáneamente, `createClientAction` en Next.js ejecuta un `.insert()` manual del mismo evento `'created'`.
- **Impacto Real:** Cada cliente nuevo creado muestra dos registros idénticos de creación en su pestaña "History".
- **Remediación:** Eliminar la inserción manual en `createClientAction` y permitir que el trigger de PostgreSQL gestione la auditoría de creación.

---

#### 🟡 [BUG-ENV-FALLBACK-01] MEDIUM — Fallo en Magic Link / Login por Falta de Fallback en `NEXT_PUBLIC_APP_URL`
- **Ubicación:** `app/(auth)/login/page.tsx:32-34`
- **Mecanismo:** Al solicitar el enlace de acceso mágico (`signInWithOtp`), el cliente envía `emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback``. Si `NEXT_PUBLIC_APP_URL` no está definida en el archivo de variables de entorno o en un entorno de vista previa (preview deployment), la URL se evalúa como `"undefined/auth/callback"`. Supabase Auth rechaza la petición por URL de redirección no autorizada.
- **Impacto Real:** Bloqueo total de inicio de sesión en cualquier entorno donde no se configure explícitamente la variable de entorno.
- **Remediación:** Usar `window.location.origin` como fallback en el navegador:
  ```typescript
  const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? '')
  const emailRedirectTo = `${origin}/auth/callback`
  ```

---

#### 🟢 [BUG-UX-CLEANUP-01] LOW — Persistencia Accidental de Preferencias al Cambiar a Vendedor
- **Ubicación:** `components/clients/ClientForm.tsx:157-174`
- **Mecanismo:** Si el agente llena los campos de comprador (presupuesto, habitaciones, baños) y posteriormente cambia el tipo a "Seller", la interfaz oculta la sección, pero los valores se mantienen en el estado de `react-hook-form` y se envían en el payload.
- **Remediación:** En `onSubmit`, si `values.client_type === 'seller'`, forzar los campos exclusivos de comprador a `null`.

---

#### 🟢 [BUG-PAGINATION-01] LOW — Pérdida de Selección Múltiple al Paginar en `SelectableClientList.tsx`
- **Ubicación:** `components/clients/SelectableClientList.tsx:57`
- **Mecanismo:** El estado de selección `selected` vive en la memoria local del componente (`useState<Set<string>>(new Set())`). Al navegar a la página siguiente (`/clients?page=2`), el componente se reinicia y se pierde el conjunto de clientes previamente seleccionados para envío masivo de correos.
- **Remediación:** Elevar el estado de selección al layout de clientes o sincronizarlo con URL search params / Context API.

---

### PILAR 3: ARQUITECTURA & COMPATIBILIDAD

#### 🟡 [ARCH-MUTATION-01] MEDIUM — Inconsistencia en la Capa de Mutación
- **Ubicación:** `PipelineBoard.tsx`, `FollowUpCard.tsx`, `FollowUpForm.tsx`, `TemplatesManager.tsx`, `ProfileForm.tsx`
- **Análisis:** Existen dos patrones de mutación opuestos en el código:
  1. **Server Actions (`app/actions/*`)**: Utilizado para clientes y documentos.
  2. **Browser SDK (`createClient()` client-side)**: Utilizado en Pipeline (cambio de etapa), Follow-ups (crear, completar, borrar), Email Templates (CRUD) y Perfil.
- **Impacto:** Dificulta la revalidación de rutas (`revalidatePath`), dispersa la validación de schemas Zod y expone la lógica de base de datos en los componentes de cliente.
- **Recomendación:** Centralizar todas las operaciones de escritura en Server Actions bajo `app/actions/`.

---

#### 🟡 [ARCH-PROXY-01] MEDIUM — Deprecación de `middleware.ts` en Next.js 16
- **Ubicación:** `middleware.ts`
- **Análisis:** Next.js 16 reemplazó la convención `middleware.ts` por `proxy.ts`.
- **Remediación:** Renombrar `middleware.ts` a `proxy.ts` en la raíz del proyecto para asegurar la compatibilidad con futuras versiones de Next.js.

---

### PILAR 4: RENDIMIENTO (PERFORMANCE)

#### 🟠 [PERF-API-01] HIGH — Procesamiento Secuencial y Riesgo de Timeout en Bulk Email
- **Ubicación:** `app/api/bulk-email/route.ts:70-95`
- **Mecanismo:** La ruta acepta hasta 100 clientes y los procesa en un ciclo secuencial `for ... of` con dos llamadas asíncronas bloqueantes por destinatario (`await sendClientEmail(...)` + `await supabase.from('client_history').insert(...)`).
- **Impacto Real:** Para 50 clientes, el tiempo de ejecución alcanza 20-30 segundos, excediendo el timeout por defecto de Vercel Serverless Functions (10 segundos en Hobby, 15 segundos en Pro), provocando un error `504 Gateway Timeout` y dejando el lote parcialmente enviado sin retroalimentación clara.
- **Remediación:** Utilizar la API de envío masivo de Resend (`resend.batch.send`) y realizar un `insert` por lotes en `client_history`:
  ```typescript
  // Batch insert en client_history
  await supabase.from('client_history').insert(historyRows);
  ```

---

#### 🟡 [PERF-TIMEZONE-01] MEDIUM — Cálculo de Fecha en UTC en Dashboard Server Component
- **Ubicación:** `app/(app)/dashboard/page.tsx:17`
- **Mecanismo:** `const today = format(new Date(), 'yyyy-MM-dd')` se evalúa en el servidor Node.js (UTC en Vercel).
- **Impacto Real:** A partir de las 8:00 PM en Puerto Rico (UTC-4), en el servidor ya es el día siguiente. Las tarjetas de "Today's Follow-ups" y "Overdue Follow-ups" se consultan con la fecha adelantada durante las noches.
- **Remediación:** Obtener la zona horaria del cliente vía cabecera o cookie, o computar los filtros de seguimiento pendiente con rangos de tolerancia.

---

#### 🟡 [PERF-PIPELINE-01] MEDIUM — Carga Masiva sin Límite ni Paginación en Tablero Kanban
- **Ubicación:** `app/(app)/pipeline/page.tsx:20-25`
- **Mecanismo:** La página del Pipeline ejecuta `supabase.from('clients').select('*').eq('realtor_id', user.id).order('created_at', { ascending: false })` sin cláusula `.limit()` ni paginación por cursor/rango.
- **Impacto Real:** A diferencia de `/clients` (que pagina a 25 registros), un agente inmobiliario con 500 a 2,000 clientes cargará el árbol completo en memoria y transferirá megabytes de JSON por cada visita a `/pipeline`, degradando el tiempo de respuesta (TTFB) y saturando el renderizado del DOM en dispositivos móviles.
- **Remediación:** Acotar la consulta inicial en el servidor a clientes activos o con etapas activas (`status != 'closed'`), o implementar paginación virtualizada por columna en `PipelineBoard.tsx`.

---

### PILAR 5: CÓDIGO MUERTO (DEAD CODE)

#### 🟢 [DEAD-CODE-01] LOW — Componentes y Archivos Huérfanos
1. **`components/clients/ClientList.tsx` (128 líneas):** Totalmente huérfano, sustituido por `SelectableClientList.tsx`.
2. **`components/ui/select.tsx` (202 líneas):** Componente Radix no utilizado; todos los formularios usan `<select>` estándar de HTML.
3. **`components/ui/skeleton.tsx` (13 líneas):** No se importa en ningún componente.
4. **`ruvector.db` (1.58 MB):** Base de datos SQLite residual en la raíz.

#### 🟢 [DEAD-TYPES-01] LOW — Tipos Exportados sin Referencias
- `ClientInsert`, `ClientUpdate` (`types/client.ts`)
- `DocumentInsert`, `DocumentUpdate` (`types/document.ts`)
- `FollowUpInsert`, `FollowUpUpdate` (`types/followUp.ts`)
- `EmailTemplateInsert` (`types/emailTemplate.ts`)
- `ProfileUpsert` (`types/profile.ts`)

#### 🟢 [LINT-COMPILER-01] LOW — Invocación de `watch` dentro de `.map()` en ClientForm
- **Ubicación:** `components/clients/ClientForm.tsx:259`
- **Mecanismo:** `const saleType = watch('sale_type')` se ejecuta dentro del callback de `.map()`. Viola las directrices del **React 19 Compiler**, forzando al compilador a descartar la memoización automática del componente.
- **Remediación:** Extraer `const saleType = watch('sale_type')` al nivel superior del componente.

#### 🟢 [LINT-ESLINT-01] LOW — Análisis Accidental de `landing/.astro` en ESLint
- **Ubicación:** `eslint.config.mjs:9-16`
- **Mecanismo:** `eslint.config.mjs` no incluye `landing/**` en `globalIgnores`. Al ejecutar `npm run lint`, analiza los archivos autogenerados de TypeScript de Astro y falla con 6 errores de tipo.
- **Remediación:** Agregar `"landing/**"` a `globalIgnores`.

#### 🟢 [SEC-CRLF-01] LOW — Asunto de Correo sin Sanitización contra Inyección CRLF
- **Ubicación:** `lib/resend/sendClientEmail.ts:31`, `lib/resend/sendFollowUpEmail.ts:42`
- **Mecanismo:** Los campos `subject` y `clientName` (interpolado en `Follow-up reminder: ${clientName}`) se pasan directamente al cliente de Resend sin purgar retornos de carro ni saltos de línea (`\r`, `\n`). Aunque Resend sanitiza parte de las cabeceras HTTP en su API REST, la falta de sanitización local permite introducir saltos en clientes de correo si se introducen nombres con saltos de línea deliberados.
- **Remediación:** Aplicar `.replace(/[\r\n]+/g, ' ').trim()` a los asuntos y nombres antes de transmitirlos a Resend.

#### 🟢 [TEST-MISSING-01] LOW — Ausencia de Script y Suite de Pruebas Automatizadas
- **Ubicación:** `package.json:5-10`, `AGENTS.md`
- **Mecanismo:** `AGENTS.md` estipula como directriz obligatoria ejecutar `npm test` antes de integrar a `main`. Sin embargo, `package.json` no define el script `"test"` y el proyecto carece de tests unitarios o de integración, arrojando código de error 1 al intentar probar el código.
- **Remediación:** Instalar y configurar Vitest con tests básicos para el motor de parsing de propiedades, emparejamiento y Server Actions.

---

### PILAR 6: ESQUEMA Y BASE DE DATOS (SCHEMA & SUPABASE)

#### 🟠 [SCHEMA-DRIFT-01] HIGH — Desincronización Crítica de `supabase/schema.sql`
- **Ubicación:** `supabase/schema.sql` vs `supabase/migrations/20260824_full_audit_remediation.sql`
- **Análisis:** `schema.sql` es el script referenciado por el `README.md` para configurar nuevos proyectos. Sin embargo, carece de elementos vitales presentes en la migración de remediación:
  1. Función RPC `get_dashboard_stats(p_realtor_id uuid, p_today date)`.
  2. Restricciones de integridad CHECK de presupuestos, habitaciones y baños en `clients`.
  3. Restricción `UNIQUE (email)` en `profiles`.
  4. Índices de optimización: `follow_ups(client_id)`, `follow_ups(realtor_id, scheduled_date)`, `documents(realtor_id, created_at DESC)`, `client_history(realtor_id, created_at DESC)`.
  5. Políticas RLS `FOR UPDATE` en `storage.objects`.
  6. Trigger de auditoría `trg_audit_clients`.
  7. Trigger de inicialización de perfiles `handle_new_user` en `auth.users`.
- **Impacto Real:** Cualquier desarrollador o entorno nuevo que inicialice la base de datos con `schema.sql` tendrá un sistema roto al cargar el Dashboard o crear clientes.

---

## 4. PLAN DE REMEDIACIÓN PRIORIZADO

### Fase 1: P0 — Correcciones Críticas de Seguridad y Operatividad (Inmediato)
1. **[SEC-SCHEMA-01]** Instalar el trigger `handle_new_user` en Supabase Auth (`auth.users`) para aprovisionar perfiles automáticamente al registrarse.
2. **[BUG-RLS-01]** Añadir las políticas RLS `FOR UPDATE` en `storage.objects` para los buckets `avatars` y `documents`.
3. **[SEC-SSRF-01]** Reemplazar el `fetch` directo con `redirect: 'manual'` en `lib/claude/propertyMatch.ts` para sellar el vector de SSRF.

### Fase 2: P1 — Alta Prioridad: Lógica, Rendimiento y Validación (1-2 días)
4. **[BUG-TIMEZONE-01]** Reemplazar `parseISO` por `parse(..., 'yyyy-MM-dd', new Date())` en los endpoints de correo para corregir el desfase de 1 día.
5. **[PERF-API-01]** Migrar `app/api/bulk-email/route.ts` al envío masivo por lotes (`resend.batch.send` e inserción masiva en `client_history`).
6. **[SEC-ACTION-01]** Agregar validación server-side con Zod en `app/actions/clients.ts`.
7. **[SCHEMA-DRIFT-01]** Actualizar y consolidar `supabase/schema.sql` con todas las funciones RPC, restricciones, políticas e índices.
8. **[BUG-ENV-FALLBACK-01]** Añadir fallback en URL de redirección de Magic Link en `app/(auth)/login/page.tsx:32`.

### Fase 3: P2 — Media Prioridad: Integridad y Arquitectura (3-5 días)
9. **[STORAGE-LEAK-01]** Implementar borrado del archivo físico en Supabase Storage dentro de `deleteDocumentAction`.
10. **[ARCH-AUDIT-01]** Eliminar la inserción manual en `createClientAction` para evitar eventos duplicados en el historial.
11. **[ARCH-MUTATION-01]** Unificar las mutaciones del Pipeline, Follow-ups, Templates y Perfil en Server Actions (`app/actions/`).
12. **[ARCH-PROXY-01]** Migrar `middleware.ts` a `proxy.ts` de acuerdo a la convención de Next.js 16.
13. **[PERF-TIMEZONE-01]** Calibrar detección de fechas en Dashboard considerando el huso horario local (UTC-4) para evitar adelanto nocturno.
14. **[SEC-RATELIMIT-01]** & **[SEC-RATELIMIT-02]** Implementar rate limiting distribuido (Redis/Upstash) y cubrir `POST /api/send-followup-email`.
15. **[PERF-PIPELINE-01]** Acotar la consulta inicial en el servidor a clientes activos o implementar paginación en `app/(app)/pipeline/page.tsx`.

### Fase 4: P3 — Baja Prioridad: Limpieza y Calidad (1 semana)
16. **[DEAD-CODE-01]** & **[DEAD-TYPES-01]** Eliminar archivos huérfanos (`ClientList.tsx`, `select.tsx`, `skeleton.tsx`, `ruvector.db`) y tipos no utilizados.
17. **[LINT-COMPILER-01]** Mover `watch('sale_type')` fuera de `.map()` en `ClientForm.tsx`.
18. **[BUG-UX-CLEANUP-01]** Forzar valores nulos en campos de comprador al conmutar a Seller en `ClientForm.tsx`.
19. **[DEBT-CSP-CLEANUP]** Eliminar `api.anthropic.com` de la directiva CSP en `next.config.ts` y limpiar residuos de Claude.
20. **[LINT-ESLINT-01]** Añadir `"landing/**"` a `globalIgnores` en `eslint.config.mjs`.
21. **[SEC-CRLF-01]** Sanitizar retornos de carro (`\r`, `\n`) en asuntos y nombres antes de enviar correos con Resend.
22. **[BUG-PAGINATION-01]** Elevar el estado de selección múltiple de clientes para preservarlo entre páginas.
23. **[TEST-MISSING-01]** Implementar suite de pruebas automatizadas con Vitest según estipula `AGENTS.md`.

---

## 5. CONCLUSIÓN

Really-CRM cuenta con una base sólida, diseño visual intuitivo y una interfaz moderna. La resolución de los hallazgos críticos de base de datos (trigger de perfiles y políticas RLS de storage) y de seguridad de red (SSRF en el parser) posicionará a la plataforma en un estado óptimo de estabilidad, confiabilidad y cumplimiento para su operación en producción.
