# REPORTE DE AUDITORÍA: SEGURIDAD Y BUGS (SECURITY & BUG REPORT)
**Proyecto:** Really-CRM  
**Fecha:** 22 de Septiembre de 2026  
**Alcance:** Seguridad de Autenticación, RLS, Storage, Protocolos de Red, Manejo de Fechas, Errores Lógicos e Integridad de Datos  
**Clasificación:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW  

---

## 1. VULNERABILIDADES DE SEGURIDAD

### 🔴 [SEC-SCHEMA-01] CRITICAL — Ausencia de Trigger de Inicialización de Perfil tras Registro Auth (Base `schema.sql`)
- **Severidad:** 🔴 **CRITICAL**
- **CWE:** CWE-284 (Improper Access Control / Inconsistent Object Initialization)
- **Componentes Afectados:** `supabase/schema.sql`, `app/auth/callback/route.ts`, `app/actions/clients.ts`
- **Estado Actual (20 de Septiembre de 2026):** El commit `b88f5e6` introdujo la migración `supabase/migrations/20260920_handle_new_user_trigger.sql` que subsana este error para despliegues gestionados con Supabase CLI. No obstante, el archivo base `supabase/schema.sql` (que se referencia para nuevas instalaciones manuales) aún no incorpora esta función ni su trigger, persistiendo como un vector crítico de fallo para nuevos entornos.
- **Descripción del Fallo:**  
  Cuando un agente se registra mediante Magic Link (`supabase.auth.signInWithOtp`), Supabase Auth inserta un nuevo registro en la tabla del sistema `auth.users`. La tabla de negocio `clients` impone una restricción de clave foránea estricta: `realtor_id uuid not null references profiles(id) on delete cascade`.  
  Sin embargo, en `supabase/schema.sql` **no existe ningún trigger `AFTER INSERT ON auth.users`** que aprovisione la fila correspondiente en la tabla `profiles`.
- **Impacto Real en Producción:**  
  Cualquier agente recién autenticado que navega a `/clients/new` para registrar a su primer cliente y envía el formulario sufre un bloqueo total: `createClientAction` arroja el error fatal de PostgreSQL:  
  `violates foreign key constraint "clients_realtor_id_fkey" - Key (realtor_id)=(...) is not present in table "profiles".`  
  El usuario queda en un callejón sin salida sin poder utilizar la funcionalidad central del CRM a menos que visite manualmente `/profile` y guarde su información.
- **Remediación Defensiva (SQL Trigger):**
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

### 🟠 [SEC-SSRF-01] HIGH — SSRF Bypass mediante Saltos de Redirección HTTP en Parser de Propiedades
- **Severidad:** 🟠 **HIGH**
- **CWE:** CWE-918 (Server-Side Request Forgery)
- **Componentes Afectados:** `lib/claude/propertyMatch.ts:107-120`, `lib/security/ssrf.ts`, `app/api/property-match/route.ts`
- **Descripción del Fallo:**  
  En `app/api/property-match/route.ts:35`, se ejecuta la validación `await assertUrlAllowed(url)`. Esta rutina resuelve el hostname y verifica que la IP inicial no apunte a direcciones privadas (RFC 1918), loopback (`127.0.0.1`) o al endpoint de metadatos (`169.254.169.254`).  
  No obstante, inmediatamente después se invoca `parsePropertyListing(url)` en `lib/claude/propertyMatch.ts`:
  ```typescript
  const res = await fetch(safeUrl, {
    signal: controller.signal,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
  })
  ```
  La función nativa `fetch` en Node.js tiene como comportamiento predeterminado `redirect: 'follow'`. Un atacante puede apuntar a un dominio público legítimo bajo su control (ej. `https://attacker-domain.com/listing`) que supere `assertUrlAllowed`, y hacer que su servidor retorne un código de estado `302 Found` con la cabecera `Location: http://169.254.169.254/latest/meta-data/` o `http://127.0.0.1:3000/api/...`.  
  Node.js seguirá ciegamente la redirección hacia la dirección protegida sin volver a validar la nueva IP de destino.
- **Impacto Real:**  
  El cuerpo de la respuesta interna es leído (hasta 500,000 bytes) y los primeros 500 caracteres se asignan a `rawDescription`, el cual se **retorna íntegramente al cliente en el payload JSON** (`{ property: { rawDescription, ... } }`), permitiendo la exfiltración directa de tokens de IAM, variables de entorno del proveedor de nube o microservicios privados.
- **Remediación Defensiva:**  
  Configurar `redirect: 'manual'` en `fetch` y validar la cabecera `Location` contra `assertUrlAllowed` en un ciclo acotado (máximo 3 saltos):
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

### 🟠 [BUG-RLS-01] HIGH — Falta de Política RLS `FOR UPDATE` en `storage.objects` Rompe `upsert: true`
- **Severidad:** 🟠 **HIGH**
- **CWE:** CWE-285 (Improper Authorization)
- **Componentes Afectados:** `supabase/schema.sql:186-218`, `components/profile/AvatarUpload.tsx:43-54`, `lib/storage/uploadFile.ts:14`
- **Descripción del Fallo:**  
  En `AvatarUpload.tsx`, la ruta de almacenamiento se define con un nombre determinista por usuario: `const path = `${userId}/avatar.${ext}``. Luego se invoca `uploadFile('avatars', path, file)`, el cual utiliza `{ upsert: true }`.  
  En la arquitectura interna de Supabase Storage, si el objeto en la ruta ya existe, `upsert: true` emite una instrucción SQL `UPDATE` sobre la tabla `storage.objects`. Sin embargo, `supabase/schema.sql` únicamente define políticas para `INSERT`, `SELECT` y `DELETE`.
- **Impacto Real:**  
  Cualquier agente que intente cambiar o actualizar su foto de perfil existente recibe un error `403 Forbidden` de violación de política RLS (`Failed to upload photo`), imposibilitando la actualización del avatar.
- **Remediación Defensiva (SQL RLS Policies):**
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

### 🟠 [SEC-ACTION-01] HIGH — Falta de Validación Server-Side con Zod en Server Actions
- **Severidad:** 🟠 **HIGH**
- **CWE:** CWE-20 (Improper Input Validation)
- **Componentes Afectados:** `app/actions/clients.ts:39-90`
- **Descripción del Fallo:**  
  `createClientAction(input: ClientInput)` y `updateClientAction(id, input)` asumen implícitamente que los datos recibidos respetan la estructura tipada. Aunque el formulario cliente `ClientForm.tsx` valida los datos con `zodResolver(schema)`, en Next.js las Server Actions se exponen como endpoints HTTP públicos (accesibles por peticiones `POST` con la cabecera `Next-Action`).
- **Impacto Real:**  
  Cualquier atacante o script automatizado puede saltarse el frontend y enviar payloads malformados: nombres vacíos, números negativos, listas de localizaciones con inyecciones o estados no permitidos, persistiendo datos corruptos o provocando fallos en la base de datos.
- **Remediación Defensiva:**  
  Extraer el esquema Zod a un módulo común (`lib/validation/client.ts`) y parsear los argumentos dentro de cada Server Action:
  ```typescript
  import { clientInputSchema } from '@/lib/validation/client'

  export async function createClientAction(rawInput: unknown): Promise<ClientActionResult> {
    const parseResult = clientInputSchema.safeParse(rawInput)
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.issues[0].message }
    }
    const input = parseResult.data
    // Continuar con la inserción validada...
  }
  ```

---

### 🟡 [SEC-RATELIMIT-01] MEDIUM — Limitador de Peticiones en Memoria Volátil Inefectivo en Serverless
- **Severidad:** 🟡 **MEDIUM**
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Componentes Afectados:** `lib/rateLimit.ts:1-16`
- **Descripción:**  
  `isRateLimited` almacena contadores en `const store = new Map<string, { count: number; resetAt: number }>()`. En Vercel Serverless, cada petición puede ejecutarse en una función lambda independiente o reiniciarse tras inactividad. Un atacante puede eludir el límite de peticiones fácilmente lanzando peticiones concurrentes. Adicionalmente, las entradas de llaves inactivas nunca se borran si no se vuelven a consultar, causando una lenta fuga de memoria en instancias de larga duración.
- **Remediación:**  
  Reemplazar el `Map` por un rate limiter distribuido basado en Redis (`@upstash/ratelimit`) o contadores atómicos en PostgreSQL.

---

### 🟡 [SEC-RATELIMIT-02] MEDIUM — Ausencia de Rate Limiting en Envío Manual de Recordatorios
- **Severidad:** 🟡 **MEDIUM**
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Componentes Afectados:** `app/api/send-followup-email/route.ts:10-61`
- **Descripción:**  
  Mientras que `POST /api/bulk-email` (1 req/10s) y `POST /api/property-match` (10 req/min) cuentan con llamadas a `isRateLimited`, el endpoint `POST /api/send-followup-email` omite por completo cualquier control de tasa.
- **Impacto:**  
  Un usuario autenticado puede disparar cientos de peticiones en segundos, consumiendo rápidamente la cuota mensual de Resend y arriesgando la reputación del dominio remitente.
- **Remediación:**  
  Añadir control de tasa: `if (isRateLimited(`send-followup:${user.id}`, 5, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })`.

---

### 🟢 [SEC-CRLF-01] LOW — Asuntos y Nombres Interpolados en Emails sin Sanitización contra Inyección CRLF
- **Severidad:** 🟢 **LOW**
- **CWE:** CWE-93 (Improper Neutralization of CRLF Sequences / Header Injection)
- **Componentes Afectados:** `lib/resend/sendClientEmail.ts:31`, `lib/resend/sendFollowUpEmail.ts:42`
- **Descripción:**  
  Los campos `subject` y `clientName` (interpolado en `Follow-up reminder: ${clientName}`) se transmiten a la API de Resend sin sanear caracteres de control de retorno de carro (`\r`) ni salto de línea (`\n`). Si un cliente se registra con saltos de línea en su nombre, puede alterar la estructura de cabeceras en clientes de correo receptores.
- **Remediación:**  
  Sanitizar los textos con `.replace(/[\r\n]+/g, ' ').trim()`.

---

### 🟢 [SEC-08] LOW — Directiva CSP Obsoleta con Dominio Externo de Anthropic
- **Severidad:** 🟢 **LOW**
- **CWE:** CWE-16 (Configuration)
- **Componentes Afectados:** `next.config.ts:9`
- **Descripción:**  
  La directiva `connect-src` en Content-Security-Policy autoriza conexiones hacia `https://api.anthropic.com`. Dado que la funcionalidad de IA fue reemplazada por heurísticas locales y no existe cliente de Anthropic en el navegador, la regla expone un canal innecesario en la política de seguridad.
- **Remediación:**  
  Eliminar `https://api.anthropic.com` de `connect-src` en `next.config.ts`.

---

## 2. BUGS DE LÓGICA & INTEGRIDAD DE DATOS

### 🟠 [BUG-TIMEZONE-01] HIGH — Desfase de 1 Día en Fechas de Seguimiento por Uso de `parseISO`
- **Severidad:** 🟠 **HIGH**
- **Componentes Afectados:** `app/api/send-followup-email/route.ts:49`, `app/api/cron/send-daily-followups/route.ts:70`
- **Descripción del Fallo:**  
  La columna `scheduled_date` almacena fechas de tipo SQL `date` (cadenas `"YYYY-MM-DD"`). Al ejecutarse:
  ```typescript
  followUpDate: format(parseISO(fu.scheduled_date), 'MMMM d, yyyy')
  ```
  `parseISO("2026-09-15")` interpreta la cadena como medianoche UTC (`2026-09-15T00:00:00.000Z`). En servidores ejecutando en husos horarios occidentales (ej. Puerto Rico AST UTC-4 o US Eastern EDT UTC-4), las 00:00:00 UTC corresponden a las **8:00 PM del día anterior** (`2026-09-14 20:00:00`). Al formatear con `MMMM d, yyyy`, la fecha impresa es el **día anterior** a la fecha real de la cita.
- **Impacto:**  
  Los agentes inmobiliarios reciben notificaciones y recordatorios indicando que la cita es un día antes de lo pactado, generando confusión operativa y citas perdidas con clientes.
- **Nota Curiosa:**  
  El autor del componente `FollowUpCard.tsx:30` ya conocía este comportamiento y documentó:  
  `// scheduled_date is a date-only string. Parse it as LOCAL midnight so isToday/isPast compare against the user's calendar day — parseISO would treat it as UTC and shift the day for anyone west of UTC.`  
  Sin embargo, los endpoints de servidor nunca se actualizaron.
- **Remediación:**  
  ```typescript
  import { parse, format } from 'date-fns'

  const localDate = parse(fu.scheduled_date, 'yyyy-MM-dd', new Date())
  const followUpDate = format(localDate, 'MMMM d, yyyy')
  ```

---

### 🟡 [BUG-ENV-FALLBACK-01] MEDIUM — Fallo en Magic Link / Login por Falta de Fallback en `NEXT_PUBLIC_APP_URL`
- **Severidad:** 🟡 **MEDIUM**
- **Componentes Afectados:** `app/(auth)/login/page.tsx:32-34`
- **Descripción:**  
  Al solicitar el enlace de acceso mágico, el cliente ejecuta:
  ```typescript
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })
  ```
  Si la variable `NEXT_PUBLIC_APP_URL` no está definida en el entorno local (`.env.local`) o en un preview deployment de Vercel, la URL se evalúa como `"undefined/auth/callback"`. Supabase rechaza la petición por URL de redirección no autorizada, bloqueando el inicio de sesión.
- **Remediación:**  
  Usar `window.location.origin` como fallback en el navegador:
  ```typescript
  const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? '')
  const emailRedirectTo = `${origin}/auth/callback`
  ```

---

### 🟡 [BUG-STORAGE-LEAK-01] MEDIUM — Fuga de Archivos Huérfanos en Storage al Eliminar Documentos
- **Severidad:** 🟡 **MEDIUM**
- **Componentes Afectados:** `app/actions/documents.ts:10-27`
- **Descripción:**  
  `deleteDocumentAction` ejecuta `await supabase.from('documents').delete().eq('id', id)`, eliminando la fila de metadatos en PostgreSQL. Sin embargo, nunca solicita el borrado del archivo físico en Supabase Storage (`supabase.storage.from('documents').remove([file_url])`).
- **Impacto:**  
  Los archivos binarios (PDFs confidenciales, identificaciones, contratos) permanecen huérfanos indefinidamente en el bucket privado, acumulando costos de almacenamiento y generando riesgos de privacidad y cumplimiento normativo.
- **Remediación:**  
  Consultar la ruta `file_url` antes de eliminar la fila y ejecutar la eliminación en el Storage:
  ```typescript
  const { data: doc } = await supabase
    .from('documents')
    .select('file_url')
    .eq('id', id)
    .eq('realtor_id', user.id)
    .single()

  const { error } = await supabase.from('documents').delete().eq('id', id).eq('realtor_id', user.id)
  if (error) return { ok: false, error: 'Failed to delete' }

  if (doc?.file_url && !/^https?:\/\//i.test(doc.file_url)) {
    await supabase.storage.from('documents').remove([doc.file_url])
  }
  ```

---

### 🟡 [BUG-AUDIT-01] MEDIUM — Duplicación de Registros en `client_history` por Concurrencia Action + Trigger
- **Severidad:** 🟡 **MEDIUM**
- **Componentes Afectados:** `app/actions/clients.ts:51-56`, `supabase/migrations/20260824_full_audit_remediation.sql:35-59`
- **Descripción:**  
  La migración `20260824_full_audit_remediation.sql` añade el trigger `trg_audit_clients` que inserta automáticamente una fila `'created'` en `client_history` tras cada `INSERT ON clients`. Al mismo tiempo, `createClientAction` en Next.js ejecuta un `.insert()` manual del mismo evento.
- **Impacto:**  
  Cada nuevo cliente muestra dos filas idénticas de creación en la pestaña "History" del detalle de cliente.
- **Remediación:**  
  Retirar la inserción manual en `createClientAction` y permitir que el trigger gestione la auditoría.

---

### 🟢 [BUG-UX-01] LOW — Persistencia Residual de Preferencias al Cambiar de Comprador a Vendedor
- **Severidad:** 🟢 **LOW**
- **Componentes Afectados:** `components/clients/ClientForm.tsx:157-174`
- **Descripción:**  
  Si un usuario introduce valores en los campos de comprador (presupuesto, habitaciones, preferencias) y luego conmuta el tipo de cliente a "Seller", los campos se ocultan en la interfaz, pero se mantienen en el estado de `react-hook-form` y se persisten en PostgreSQL.
- **Remediación:**  
  En `onSubmit`, si `values.client_type === 'seller'`, forzar a `null` todos los campos exclusivos de comprador (`budget_min`, `budget_max`, `bedrooms_min`, `bedrooms_max`, `bathrooms_min`, `bathrooms_max`, `property_types`, `preferred_locations`).

---

### 🟢 [BUG-PAGINATION-01] LOW — Pérdida de Selección Múltiple al Paginar en `SelectableClientList.tsx`
- **Severidad:** 🟢 **LOW**
- **Componentes Afectados:** `components/clients/SelectableClientList.tsx:57`
- **Descripción:**  
  El estado `selected` se mantiene en memoria local en `useState<Set<string>>(new Set())`. Cuando el usuario navega a la página 2 mediante los enlaces de paginación (`/clients?page=2`), el componente se re-monta o recibe la nueva lista, perdiendo los clientes seleccionados en la página anterior.
- **Remediación:**  
  Persistir la selección en el estado del layout superior o mediante URL search params / context.
