# Reporte de Auditoría: Seguridad y Errores en Código (Security & Bugs)
**Repositorio Auditado:** Really-CRM ([`Really-CRM`](file:///Users/eduardotorres/Developer/Really-CRM))  
**Fecha de Evaluación:** 24 de Agosto, 2026  
**Alcance:** Código fuente completo de la aplicación (Next.js 16 App Router, TypeScript 5, React 19, Supabase SSR & Storage, Resend API).  
**Severidad Real:** CRITICAL / HIGH / MEDIUM / LOW  

---

## 1. Resumen Ejecutivo y Matriz de Hallazgos

Se ha realizado una auditoría exhaustiva línea por línea del código fuente de Really-CRM, abarcando middleware, rutas de servidor (Server Components), API route handlers, componentes cliente, gestión de estado, utilidades de almacenamiento y llamadas a APIs de terceros.

Se han identificado **9 vulnerabilidades de seguridad** y **7 errores de lógica / runtime**:

| ID | Categoría | Título del Hallazgo | Severidad | Ubicación en Código |
| :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | Seguridad / SSRF | Server-Side Request Forgery en Parser de Propiedades | 🚨 **CRITICAL** | [`lib/claude/propertyMatch.ts:107-115`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107-L115) |
| **SEC-02** | Seguridad / Auth | Protección Incompleta de Rutas y APIs en Middleware | 🚨 **CRITICAL** | [`middleware.ts:42-49`](file:///Users/eduardotorres/Developer/Really-CRM/middleware.ts#L42-L49) |
| **SEC-03** | Seguridad / Privacidad | Exposición Pública de Documentos Confidenciales (PII / Contratos) | 🚨 **CRITICAL** | [`lib/storage/uploadFile.ts:18-19`](file:///Users/eduardotorres/Developer/Really-CRM/lib/storage/uploadFile.ts#L18-L19) |
| **SEC-04** | Seguridad / Rate Limit | Rate Limiter Volátil en Memoria Inefectivo en Serverless | 🔴 **HIGH** | [`lib/rateLimit.ts:2-15`](file:///Users/eduardotorres/Developer/Really-CRM/lib/rateLimit.ts#L2-L15) |
| **SEC-05** | Seguridad / Abuso | Endpoint de Envío de Email sin Rate Limiting | 🔴 **HIGH** | [`app/api/send-followup-email/route.ts:10-35`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L10-L35) |
| **SEC-06** | Seguridad / Phishing | Fallback de Dominio Hardcodeado a Host Externo en Cron | 🔴 **HIGH** | [`app/api/cron/send-daily-followups/route.ts:50`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L50) |
| **SEC-07** | Seguridad / Inyección | Inyección de Wildcards y Operadores en PostgREST ILIKE | 🔴 **HIGH** | [`app/(app)/clients/page.tsx:54-56`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L54-L56) |
| **SEC-08** | Seguridad / Auth UX | Ausencia de Fallback de Origen en Login Client-Side | 🟡 **MEDIUM** | [`app/(auth)/login/page.tsx:32`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28auth%29/login/page.tsx#L32) |
| **SEC-09** | Seguridad / CSP | Dominio Obsoleto de Anthropic en Content-Security-Policy | 🟢 **LOW** | [`next.config.ts:9`](file:///Users/eduardotorres/Developer/Really-CRM/next.config.ts#L9) |
| **BUG-01** | Bugs / Fechas | Desfase de Zona Horaria en Fechas de Follow-Up (`parseISO` UTC vs Local) | 🔴 **HIGH** | [`components/follow-ups/FollowUpCard.tsx:27-30`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L27-L30) |
| **BUG-02** | Bugs / Validación | Ausencia de Validación de Rangos Numéricos y Coerción NaN en Clientes | 🔴 **HIGH** | [`components/clients/ClientForm.tsx:31-45`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L31-L45) |
| **BUG-03** | Bugs / React | Invocación de Hook React Hook Form (`watch`) dentro de `.map()` | 🟡 **MEDIUM** | [`components/clients/ClientForm.tsx:239`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L239) |
| **BUG-04** | Bugs / Auditoría | Pérdida de Historial en Movimiento de Etapas en Kanban Pipeline | 🟡 **MEDIUM** | [`components/pipeline/PipelineBoard.tsx:50-65`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L50-L65) |
| **BUG-05** | Bugs / Serverless | Loop Secuencial de Envío Masivo Propenso a Timeout | 🟡 **MEDIUM** | [`app/api/bulk-email/route.ts:70-95`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L70-L95) |
| **BUG-06** | Bugs / Storage | Borrado de Documento Deja Archivo Físico Huérfano en Storage | 🟡 **MEDIUM** | [`components/documents/DocumentCard.tsx:48-55`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx#L48-L55) |
| **BUG-07** | Bugs / Timezone | Desalineación de Zona Horaria Servidor en Dashboard | 🟢 **LOW** | [`app/(app)/dashboard/page.tsx:16`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L16) |

---

## 2. Análisis Detallado de Vulnerabilidades de Seguridad

### SEC-01: Server-Side Request Forgery (SSRF) en Parser de Propiedades
- **Severidad:** 🚨 **CRITICAL**
- **Archivo:** [`lib/claude/propertyMatch.ts:107-115`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107-L115) y [`app/api/property-match/route.ts:33-42`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/property-match/route.ts#L33-L42)
- **Descripción Técnica:**  
  El endpoint `POST /api/property-match` recibe un parámetro `url` en el payload JSON y ejecuta `parsePropertyListing(url)`. En esta función se realiza un `fetch(safeUrl)` en el servidor Node.js sin validar el protocolo (`http:` / `https:`), sin resolver la IP previamente y sin bloquear rangos privados o servicios de metadatos cloud.
  ```typescript
  // lib/claude/propertyMatch.ts
  export async function parsePropertyListing(url: string): Promise<ParsedProperty> {
    const safeUrl = url.replace(/[\r\n\t]/g, ' ').slice(0, 2048)
    ...
    const res = await fetch(safeUrl, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ReallyCRM/1.0)' },
    })
  ```
- **Vector de Ataque / Impacto:**  
  Un usuario autenticado puede ingresar URLs apuntando a interfaces internas de red (`http://127.0.0.1:5432`, `http://localhost:8080`), servicios internos de VPC, o el servicio de metadatos de AWS/GCP (`http://169.254.169.254/latest/meta-data/`). La función extrae hasta 500,000 caracteres del cuerpo HTML y devuelve los primeros 500 caracteres en el campo `property.rawDescription`, permitiendo la fuga de secretos de infraestructura (tokens IAM, variables de entorno de la instancia) y reconocimiento de la red interna.
- **Remediación:**  
  1. Validar estrictamente que el protocolo sea `http:` o `https:`.
  2. Resolver el hostname mediante DNS lookup y rechazar IPs privadas (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`) y direcciones broadcast.
  3. Deshabilitar seguimiento automático de redirecciones hacia IPs no verificadas (`redirect: 'manual'`).

---

### SEC-02: Protección Incompleta de Rutas y APIs en Middleware
- **Severidad:** 🚨 **CRITICAL**
- **Archivo:** [`middleware.ts:42-49`](file:///Users/eduardotorres/Developer/Really-CRM/middleware.ts#L42-L49)
- **Descripción Técnica:**  
  La lógica de redirección del middleware contiene una lista estricta codificada manualmente de rutas protegidas:
  ```typescript
  if ((!user && pathname.startsWith('/dashboard')) ||
      (!user && pathname.startsWith('/clients')) ||
      (!user && pathname.startsWith('/profile')) ||
      (!user && pathname.startsWith('/property-match'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  ```
- **Vector de Ataque / Impacto:**  
  Rutas como `/pipeline` y `/templates` fueron agregadas al sistema pero **NO se incluyeron en el middleware**. Si bien `app/(app)/layout.tsx` realiza una comprobación secundaria en el Server Component, la omisión en el middleware permite que requests a nivel de Edge / CDN no sean interceptados uniformemente, generando discrepancias en caché y dejando endpoints de API (`/api/bulk-email`, `/api/property-match`, `/api/send-followup-email`) sin filtrado en la capa de borde.
- **Remediación:**  
  Reemplazar la lista positiva fragmentada por una regla de denegación por defecto para todas las rutas privadas o un matcher que agrupe `/(app)/:path*` y `/api/:path*`, excluyendo únicamente `/login`, `/auth/callback` y `/api/cron/*`.

---

### SEC-03: Exposición Pública de Documentos Confidenciales (PII / Contratos)
- **Severidad:** 🚨 **CRITICAL**
- **Archivo:** [`lib/storage/uploadFile.ts:18-19`](file:///Users/eduardotorres/Developer/Really-CRM/lib/storage/uploadFile.ts#L18-L19) y [`components/documents/DocumentUploadDialog.tsx:64-75`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L64-L75)
- **Descripción Técnica:**  
  La subida de documentos de clientes (identificaciones oficiales `id`, cartas de preaprobación financiera `pre_approval_letter`, contratos de compraventa `contract`) utiliza la función `uploadFile('documents', path, file)`. Esta función invoca `supabase.storage.from(bucket).getPublicUrl(path)` y persiste la URL pública en la columna `documents.file_url`:
  ```typescript
  // lib/storage/uploadFile.ts
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
  ```
- **Vector de Ataque / Impacto:**  
  Si el bucket `documents` en Supabase se configura como público, cualquier persona en posesión del enlace puede descargar identificaciones con números de Seguro Social, declaraciones de ingresos y contratos legales sin autenticación. Si el bucket se configura como privado, `getPublicUrl` genera enlaces rotos. En ambos casos se viola la privacidad de datos (GDPR / Leyes de Privacidad Financiera).
- **Remediación:**  
  Almacenar únicamente la ruta relativa del archivo (`storage_path`) en la tabla `documents`. Al momento de renderizar o descargar en [`components/documents/DocumentCard.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx), solicitar una URL firmada con tiempo de expiración corto mediante `supabase.storage.from('documents').createSignedUrl(path, 3600)`.

---

### SEC-04: Rate Limiter Volátil en Memoria Inefectivo en Entorno Serverless
- **Severidad:** 🔴 **HIGH**
- **Archivo:** [`lib/rateLimit.ts:2-15`](file:///Users/eduardotorres/Developer/Really-CRM/lib/rateLimit.ts#L2-L15)
- **Descripción Técnica:**  
  El limitador de tasa de peticiones se apoya en una estructura en memoria global `const store = new Map<string, { count: number; resetAt: number }>()`.
- **Vector de Ataque / Impacto:**  
  En entornos serverless (Vercel Serverless Functions / Edge), cada función se ejecuta en lambdas efímeras y aisladas. Un atacante puede ejecutar decenas de peticiones concurrentes a `/api/property-match` o `/api/bulk-email`; cada petición caerá en una instancia distinta con un `Map` vacío, inutilizando la protección contra abusos de scraping y consumo de cuotas.
- **Remediación:**  
  Implementar `@upstash/ratelimit` con Upstash Redis o KV distribuido para persistir los contadores atómicamente entre todas las instancias serverless.

---

### SEC-05: Endpoint de Envío de Email sin Rate Limiting
- **Severidad:** 🔴 **HIGH**
- **Archivo:** [`app/api/send-followup-email/route.ts:10-35`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L10-L35)
- **Descripción Técnica:**  
  A diferencia de `/api/property-match` y `/api/bulk-email`, el endpoint `POST /api/send-followup-email` carece de cualquier verificación de limitación de tasa (rate limit).
- **Vector de Ataque / Impacto:**  
  Un usuario autenticado malicioso o un script descontrolado puede ejecutar un bucle automatizado enviando miles de peticiones hacia este endpoint, consumiendo la cuota mensual de Resend API, incurriendo en sobrecostos financieros o provocando el bloqueo del dominio emisor por comportamiento de spam.
- **Remediación:**  
  Añadir comprobación de rate limit por usuario:
  ```typescript
  if (isRateLimited(`send-followup-email:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  ```

---

### SEC-06: Fallback de Dominio Hardcodeado a Host Externo en Cron
- **Severidad:** 🔴 **HIGH**
- **Archivo:** [`app/api/cron/send-daily-followups/route.ts:50`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L50)
- **Descripción Técnica:**  
  El cron job diario construye el enlace directo al perfil del cliente con un valor fallback no configurado:
  ```typescript
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.com'
  ```
- **Vector de Ataque / Impacto:**  
  Si `NEXT_PUBLIC_APP_URL` no se encuentra definida en el entorno de producción (o en previews de Vercel), los correos diarios automáticos enviados a los agentes contendrán enlaces hacia `https://yourapp.com/clients/{client.id}`. Si ese dominio es registrado por un tercero, los usuarios serán redirigidos a un sitio desconocido con fuga del UUID del cliente en la URL (vector de phishing).
- **Remediación:**  
  Validar que `NEXT_PUBLIC_APP_URL` esté presente y lanzar un error explícito de configuración en lugar de recurrir a un dominio ajeno.

---

### SEC-07: Inyección de Wildcards y Operadores en PostgREST ILIKE
- **Severidad:** 🔴 **HIGH**
- **Archivo:** [`app/(app)/clients/page.tsx:54-56`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L54-L56)
- **Descripción Técnica:**  
  El parámetro `search` proveniente de la URL se concatena directamente en la cláusula de búsqueda `query.ilike('name', `%${params.search}%`)`.
- **Vector de Ataque / Impacto:**  
  PostgREST interpreta caracteres especiales como `%`, `_`, comas y operadores en la sintaxis de filtros URI. Un término con `%` o secuencias de escape no sanitizadas altera la lógica del predicado SQL o genera comportamientos anómalos en el motor de base de datos.
- **Remediación:**  
  Escapar caracteres de control de PostgREST y SQL LIKE (`%`, `_`, `\`) antes de pasarlos a la consulta.

---

### SEC-08: Ausencia de Fallback de Origen en Login Client-Side
- **Severidad:** 🟡 **MEDIUM**
- **Archivo:** [`app/(auth)/login/page.tsx:32`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28auth%29/login/page.tsx#L32)
- **Descripción Técnica:**  
  La función `signInWithOtp` interpola la variable de entorno directamente en el navegador: `emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback``.
- **Impacto:**  
  Si la variable no está expuesta en el bundle de cliente (o en entornos preview), la cadena resultante es `"undefined/auth/callback"`, lo que provoca que Supabase Auth rechace la solicitud de inicio de sesión o que el enlace mágico redirija a una URL inválida.
- **Remediación:**  
  Utilizar un fallback dinámico en el navegador:
  ```typescript
  const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '')
  emailRedirectTo: `${origin}/auth/callback`
  ```

---

### SEC-09: Dominio Obsoleto de Anthropic en Content-Security-Policy
- **Severidad:** 🟢 **LOW**
- **Archivo:** [`next.config.ts:9`](file:///Users/eduardotorres/Developer/Really-CRM/next.config.ts#L9)
- **Descripción Técnica:**  
  La directiva `connect-src` de la cabecera Content-Security-Policy incluye `https://api.anthropic.com`, a pesar de que el SDK de Claude fue eliminado del proyecto en el commit `0b50319`.
- **Impacto:**  
  Permite conexiones innecesarias a dominios externos desde el navegador, violando el principio de mínimo privilegio en políticas de seguridad web.
- **Remediación:**  
  Remover `https://api.anthropic.com` de la lista de fuentes permitidas en `next.config.ts`.

---

## 3. Análisis Detallado de Bugs y Errores de Runtime

### BUG-01: Desfase de Zona Horaria en Fechas de Follow-Up (`parseISO` UTC vs Local)
- **Severidad:** 🔴 **HIGH**
- **Archivo:** [`components/follow-ups/FollowUpCard.tsx:27-30`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L27-L30)
- **Descripción del Fallo:**  
  La columna `scheduled_date` almacena una fecha en formato `YYYY-MM-DD` (ej. `"2026-08-24"`). En `FollowUpCard.tsx`, el código ejecuta:
  ```typescript
  const date = parseISO(followUp.scheduled_date)
  const isOverdue = !followUp.completed && isPast(date) && !isToday(date)
  const isDueToday = !followUp.completed && isToday(date)
  ```
  De acuerdo con el estándar ISO 8601 y la implementación de `date-fns`, una cadena date-only `"2026-08-24"` es parseada como medianoche UTC (`2026-08-24T00:00:00.000Z`).
- **Comportamiento Anómalo en Producción:**  
  Para cualquier usuario en husos horarios occidentales (ej. Puerto Rico AST UTC-4, Nueva York EDT UTC-4, California PDT UTC-7), la medianoche UTC equivale a las 8:00 PM o 5:00 PM del **día anterior** (`2026-08-23`). En consecuencia:
  1. `isPast(date)` evalúa como `true` de inmediato.
  2. `isToday(date)` evalúa como `false`.
  3. Toda tarea programada para el día de hoy se marca erróneamente como **"Overdue" (Vencida)** y se muestra en color rojo con la fecha del día anterior en el texto.
- **Remediación:**  
  Parsear la fecha en la zona horaria local del cliente dividiendo la cadena en año, mes y día (`new Date(year, month - 1, day)`), o comparar directamente las cadenas `YYYY-MM-DD` contra el día local actual:
  ```typescript
  // Comparación pura de cadenas YYYY-MM-DD
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isDueToday = !followUp.completed && followUp.scheduled_date === todayStr
  const isOverdue = !followUp.completed && followUp.scheduled_date < todayStr
  ```

---

### BUG-02: Ausencia de Validación de Rangos Numéricos y Coerción NaN en Clientes
- **Severidad:** 🔴 **HIGH**
- **Archivo:** [`components/clients/ClientForm.tsx:31-45`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L31-L45) y [`components/clients/ClientForm.tsx:128-133`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L128-L133)
- **Descripción del Fallo:**  
  El esquema Zod define los campos numéricos de preferencias (`budget_min`, `budget_max`, `bedrooms_min`, etc.) como `z.string().optional()`.
  En el manejador `onSubmit`, se ejecuta la conversión:
  ```typescript
  budget_min: values.budget_min !== '' ? Number(values.budget_min) : null
  ```
- **Comportamiento Anómalo en Producción:**  
  1. Si un usuario introduce texto no numérico o valores negativos (ej. `"abc"`, `"-50000"`), `Number(...)` genera `NaN` o valores negativos no válidos.
  2. No existe validación de consistencia lógica entre límites (`budget_min > budget_max`), permitiendo crear clientes con presupuestos invertidos que nunca coincidirán con ninguna propiedad en el algoritmo de matching.
- **Remediación:**  
  Refactorizar el esquema Zod para validar tipos numéricos con refinamientos lógicos:
  ```typescript
  const schema = z.object({
    // ...
    budget_min: z.string().optional().refine(val => !val || (!isNaN(Number(val)) && Number(val) >= 0), 'Debe ser un número positivo'),
    budget_max: z.string().optional().refine(val => !val || (!isNaN(Number(val)) && Number(val) >= 0), 'Debe ser un número positivo'),
  }).refine(data => {
    if (data.budget_min && data.budget_max) {
      return Number(data.budget_max) >= Number(data.budget_min)
    }
    return true
  }, { message: 'El presupuesto máximo debe ser mayor o igual al mínimo', path: ['budget_max'] })
  ```

---

### BUG-03: Invocación de Hook React Hook Form (`watch`) dentro de `.map()`
- **Severidad:** 🟡 **MEDIUM**
- **Archivo:** [`components/clients/ClientForm.tsx:239`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L239)
- **Descripción del Fallo:**  
  En el renderizado de los botones de selección de tipo de venta, la función `watch('sale_type')` se ejecuta en cada iteración del `.map()`:
  ```typescript
  {[
    { value: '', label: 'Not specified' },
    { value: 'cash', label: 'Cash' },
    { value: 'loan', label: 'Loan (Prestamo)' },
  ].map(({ value, label }) => {
    const saleType = watch('sale_type')
    return ( ... )
  })}
  ```
- **Impacto:**  
  Viola las reglas de optimización de React Compiler y genera la advertencia de ESLint `react-hooks/incompatible-library`. Además produce suscripciones redundantes en cada ciclo de render.
- **Remediación:**  
  Extraer `const saleType = watch('sale_type')` fuera del bloque de mapeo.

---

### BUG-04: Pérdida de Historial en Movimiento de Etapas en Kanban Pipeline
- **Severidad:** 🟡 **MEDIUM**
- **Archivo:** [`components/pipeline/PipelineBoard.tsx:50-65`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L50-L65)
- **Descripción del Fallo:**  
  Cuando un agente arrastra o mueve un cliente entre columnas de etapas del pipeline (Lead -> Contacted -> Showing -> Negotiation -> Closed -> Lost), se ejecuta una mutación directa sobre la tabla `clients`:
  ```typescript
  const { error } = await supabase
    .from('clients')
    .update({ stage })
    .eq('id', client.id)
  ```
- **Impacto:**  
  No se registra ningún evento en la tabla `client_history`. Como consecuencia, la pestaña **History** del cliente no refleja las transiciones de venta a pesar de ser la acción más crítica del flujo de trabajo de un CRM.
- **Remediación:**  
  Insertar un registro en `client_history` al completar la mutación en `PipelineBoard.tsx`, o preferiblemente delegar el registro a un trigger en PostgreSQL (`AFTER UPDATE OF stage ON clients`).

---

### BUG-05: Loop Secuencial de Envío Masivo Propenso a Timeout Serverless
- **Severidad:** 🟡 **MEDIUM**
- **Archivo:** [`app/api/bulk-email/route.ts:70-95`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L70-L95)
- **Descripción del Fallo:**  
  La ruta acepta hasta `MAX_RECIPIENTS = 100` y procesa los envíos en un ciclo `for...of` secuencial con dos llamadas asíncronas bloqueantes por cliente (`await sendClientEmail(...)` + `await supabase.from('client_history').insert(...)`).
- **Impacto:**  
  Cada llamada HTTP a Resend toma entre 200 ms y 400 ms, y cada inserción en base de datos toma ~50 ms. Para un lote de 50 a 100 clientes, el tiempo total de ejecución oscila entre 25 y 45 segundos, superando el límite por defecto de Vercel Serverless Functions (10s en plan Hobby / 15s en Pro default), provocando una interrupción abrupta con error `504 Gateway Timeout` y dejando el lote parcialmente enviado sin retroalimentación clara.
- **Remediación:**  
  Utilizar la API de envíos por lotes de Resend (`resend.batch.send`) e inserción masiva en `client_history` en una única transacción:
  ```typescript
  // Batch insert en client_history
  await supabase.from('client_history').insert(historyRows)
  ```

---

### BUG-06: Borrado de Documento Deja Archivo Físico Huérfano en Storage
- **Severidad:** 🟡 **MEDIUM**
- **Archivo:** [`components/documents/DocumentCard.tsx:48-55`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx#L48-L55)
- **Descripción del Fallo:**  
  Al presionar "Delete" en una tarjeta de documento, la función ejecuta:
  ```typescript
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  ```
- **Impacto:**  
  Se elimina la fila de metadatos en la base de datos PostgreSQL, pero **nunca se invoca el borrado del archivo físico en Supabase Storage** (`supabase.storage.from('documents').remove([path])`). Los archivos binarios permanecen acumulándose en el bucket indefinidamente, consumiendo espacio de almacenamiento.
- **Remediación:**  
  Extraer la ruta relativa del archivo en el storage y ejecutar `supabase.storage.from('documents').remove([storagePath])` antes o después de eliminar el registro en la base de datos.

---

### BUG-07: Desalineación de Zona Horaria Servidor en Dashboard
- **Severidad:** 🟢 **LOW**
- **Archivo:** [`app/(app)/dashboard/page.tsx:16`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L16)
- **Descripción del Fallo:**  
  En el Server Component del Dashboard, el cálculo del día actual se hace en el entorno del servidor:
  ```typescript
  const today = format(new Date(), 'yyyy-MM-dd')
  ```
- **Impacto:**  
  En Vercel los servidores operan en UTC (`00:00 UTC`). Cuando un agente en Puerto Rico o Estados Unidos utiliza la plataforma a las 8:30 PM (hora local), en el servidor ya es el día siguiente. Las estadísticas de "Overdue Follow-ups" y "Today's Follow-ups" presentarán discrepancias de un día durante las últimas horas de la noche.
- **Remediación:**  
  Obtener la zona horaria del cliente a través de una cookie o cabecera personalizada, o delegar el filtrado de tareas de hoy al componente cliente basándose en la fecha del dispositivo.
