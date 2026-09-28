# REPORTE DE AUDITORÍA: ARQUITECTURA Y RENDIMIENTO
**Proyecto:** Really-CRM  
**Fecha:** 22 de Septiembre de 2026  
**Alcance:** Arquitectura Next.js 16 (App Router, Turbopack), React 19 Compiler, Server Actions, Rendimiento Serverless, Cuellos de Botella y Escalabilidad  
**Clasificación:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW  

---

## 1. EVALUACIÓN ARQUITECTÓNICA

### 1.1 Modelo de Renderizado (Server Components vs Client Components)
- **Diagnóstico:** El proyecto adopta una estructura sólida alineada con los estándares modernos de Next.js App Router:
  - Las páginas principales (`app/(app)/*`) son Server Components asíncronos (`async function Page()`) que ejecutan consultas directas a Supabase usando `createClient()` de servidor (`lib/supabase/server.ts`).
  - Las credenciales sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`) se mantienen exclusivamente en el entorno de servidor y jamás se filtran a los paquetes del navegador.
  - El layout compartido `app/(app)/layout.tsx` obtiene la fila de perfil del realtor durante el SSR, pasando el objeto como prop a `TopBar.tsx`, lo que previene parpadeos de contenido (FOUC) y cascadas de red (waterfalls).
  - El filtrado de clientes en `/clients` opera completamente en el servidor mediante `searchParams` y paginación acotada con `range(from, to)`.

---

### 1.2 Disparidad Arquitectónica en la Capa de Mutaciones
- **Severidad:** 🟡 **MEDIUM**
- **Archivo(s) Afectado(s):**
  - Mutaciones vía Server Actions: `app/actions/clients.ts`, `app/actions/documents.ts`
  - Mutaciones directas vía Browser SDK: `components/pipeline/PipelineBoard.tsx:55`, `components/follow-ups/FollowUpCard.tsx:38`, `components/follow-ups/FollowUpForm.tsx:39`, `components/templates/TemplatesManager.tsx:60,70`, `components/profile/ProfileForm.tsx:70`, `components/documents/DocumentUploadDialog.tsx:68`
- **Diagnóstico:**  
  Existe una clara fragmentación en el diseño de mutación de datos:
  1. Para `clients` y `documents` (borrado/estado), las mutaciones se ejecutan mediante Server Actions en `app/actions/`. Esto permite revalidar la caché del servidor (`revalidatePath`), registrar auditorías en un entorno controlado y abstraer la interacción con la base de datos.
  2. Para el cambio de etapa en Pipeline, las acciones de Follow-ups (crear, completar, eliminar), la creación/edición de plantillas y la actualización del perfil, los componentes de cliente instancian directamente el cliente de Supabase para navegador (`createClient()` de `@/lib/supabase/client`) y realizan mutaciones SQL directamente desde el cliente.
- **Impacto:**  
  - Dificulta la revalidación centralizada de rutas en el servidor.
  - Provoca que la auditoría de cambios en el pipeline dependa exclusivamente de triggers de base de datos en lugar de la lógica de aplicación.
  - Expone nombres de tablas y estructuras de consulta en el código JavaScript del cliente.
- **Recomendación:**  
  Estandarizar todas las operaciones de escritura en Server Actions bajo `app/actions/`:
  - `app/actions/pipeline.ts` -> `updateClientStageAction(id, stage)`
  - `app/actions/followUps.ts` -> `createFollowUpAction`, `completeFollowUpAction`, `deleteFollowUpAction`
  - `app/actions/templates.ts` -> `saveTemplateAction`, `deleteTemplateAction`
  - `app/actions/profile.ts` -> `saveProfileAction`

---

### 1.3 Deprecación de Convención `middleware.ts` en Next.js 16
- **Severidad:** 🟡 **MEDIUM**
- **Archivo Afectado:** `middleware.ts`
- **Diagnóstico:**  
  Durante la compilación (`next build`), Next.js 16 emite la advertencia formal:  
  `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy`
- **Recomendación:**  
  Renombrar `middleware.ts` a `proxy.ts` (exportando `export async function proxy(request: NextRequest)`) para alinearse con la especificación estable de Next.js 16.

---

### 1.4 Deuda Técnica y Residuos de Claude AI
- **Severidad:** 🟢 **LOW**
- **Archivo(s) Afectado(s):** `lib/claude/propertyMatch.ts`, `.env.example`, `next.config.ts`, `AGENTS.md`
- **Diagnóstico:**  
  El emparejamiento de propiedades fue reescrito para utilizar expresiones regulares y un algoritmo heurístico local sin dependencias externas ni llamadas de red a modelos LLM. Sin embargo:
  - El directorio sigue llamándose `lib/claude/`.
  - En `next.config.ts:9`, la directiva CSP mantiene `https://api.anthropic.com`.
  - En `AGENTS.md`, la documentación indica erróneamente: `Anthropic Claude API`.
- **Recomendación:**  
  Renombrar la carpeta a `lib/matching/` y actualizar la documentación y cabeceras CSP.

---

### 1.5 Ausencia de Suite y Script de Pruebas Automatizadas
- **Severidad:** 🟢 **LOW**
- **Archivo(s) Afectado(s):** `package.json`, `AGENTS.md`
- **Diagnóstico:**  
  `AGENTS.md` define como regla obligatoria de desarrollo: `Test before merge to main` y lista el comando `npm test`. No obstante, `package.json` **no tiene configurado ningún script `"test"`** y el repositorio no contiene ninguna prueba unitaria ni de integración. La ejecución de `npm test` finaliza con código de error 1: `Missing script: "test"`.
- **Recomendación:**  
  Configurar Vitest o Jest con React Testing Library en `package.json` para validar funciones de parseo, algoritmos de coincidencia y Server Actions.

---

## 2. EVALUACIÓN DE RENDIMIENTO

### 2.1 Cuello de Botella Secuencial y Riesgo de Timeout 504 en Bulk Email
- **Severidad:** 🟠 **HIGH**
- **Archivo Afectado:** `app/api/bulk-email/route.ts:70-95`
- **Diagnóstico de Latencia:**  
  El endpoint acepta hasta 100 clientes por petición (`MAX_RECIPIENTS = 100`). Procesa los envíos en un ciclo `for...of` estrictamente secuencial:
  ```typescript
  for (const client of (clients ?? []) as Client[]) {
    // 1. Llamada HTTP a Resend API (200 - 400 ms)
    await sendClientEmail(...)
    // 2. Inserción SQL en client_history (40 - 80 ms)
    await supabase.from('client_history').insert(...)
  }
  ```
  - Para 25 clientes: **6 a 12 segundos**.
  - Para 50 clientes: **15 a 25 segundos**.
  - Para 100 clientes: **30 a 50 segundos**.
- **Impacto Real en Vercel Serverless:**  
  Las funciones Serverless en Vercel tienen un tiempo de ejecución máximo por defecto de **10 segundos (plan Hobby)** o **15 segundos (plan Pro)**. Como `route.ts` no exporta `maxDuration`, cualquier envío masivo a más de 25-30 clientes supera el límite de ejecución, provocando un error **`504 Gateway Timeout`**.  
  El cliente recibe una notificación de fallo en el navegador a pesar de que parte del lote ya se transmitió, provocando reintentos accidentales y duplicación de correos.
- **Remediación:**  
  Utilizar la API de envío por lotes de Resend (`resend.batch.send`) e insertar todas las filas de historial en una sola transacción:
  ```typescript
  // 1. Preparar lote de correos y de historial
  const emailBatch = validClients.map(c => ({
    from: process.env.RESEND_FROM_EMAIL!,
    to: c.email,
    subject: applyTemplate(subject, { clientName: c.name, propertyAddress: c.preferred_locations?.[0] }),
    html: renderHtml(...),
  }))

  const historyRows = validClients.map(c => ({
    client_id: c.id,
    realtor_id: user.id,
    event_type: 'email',
    description: `Bulk email: ${subject}`,
    metadata: { channel: 'bulk_email' },
  }))

  // 2. Enviar en una sola llamada REST masiva
  await resend.batch.send(emailBatch)

  // 3. Inserción masiva en PostgreSQL
  await supabase.from('client_history').insert(historyRows)
  ```
  *Tiempo total reducido de ~40 segundos a menos de 1.5 segundos para 100 destinatarios.*

---

### 2.2 Desfase de Zona Horaria Servidor en Dashboard Server Component
- **Severidad:** 🟡 **MEDIUM**
- **Archivo Afectado:** `app/(app)/dashboard/page.tsx:17`
- **Diagnóstico:**  
  El cálculo del día actual se ejecuta como:
  ```typescript
  const today = format(new Date(), 'yyyy-MM-dd')
  ```
  En los servidores de Vercel configurados en UTC (`00:00:00 UTC`), a partir de las 8:00 PM AST (hora local de Puerto Rico, UTC-4), en el servidor ya es el día siguiente. Las consultas a `get_dashboard_stats` y el filtro `scheduled_date = today` se evalúan con la fecha de mañana, mostrando contadores de 0 tareas para "hoy" durante las noches.
- **Remediación:**  
  Obtener la zona horaria del cliente a través de una cookie o cabecera personalizada (`x-timezone`), o pasar la fecha local desde el cliente.

---

### 2.3 Carga Masiva No Acotada ni Paginada en Tablero Kanban
- **Severidad:** 🟡 **MEDIUM**
- **Archivo Afectado:** `app/(app)/pipeline/page.tsx:20-25`
- **Diagnóstico:**  
  A diferencia de `/clients` (que implementa paginación estricta de 25 elementos por página con `range(from, to)`), la página `/pipeline` ejecuta:
  ```typescript
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('realtor_id', user.id)
    .order('created_at', { ascending: false })
  ```
  Sin ninguna cláusula `.limit()` ni paginación.
- **Impacto:**  
  Para un agente con 500 a 2,000 clientes acumulados, la consulta transfiere cientos de kilobytes o megabytes de JSON sin comprimir en el payload RSC, saturando la memoria del servidor y congelando el DOM móvil al renderizar miles de nodos interactivos en 6 columnas.
- **Remediación:**  
  Filtrar por defecto solo clientes activos (`status: 'active'`) o con actividad en los últimos 90 días, o implementar carga virtualizada/paginada por columna en `PipelineBoard.tsx`.

---

### 2.4 Invocación de Hook dentro de `.map()` Deshabilita React 19 Compiler
- **Severidad:** 🟢 **LOW**
- **Archivo Afectado:** `components/clients/ClientForm.tsx:259`
- **Diagnóstico:**  
  En el renderizado de opciones de tipo de venta:
  ```typescript
  {[ { value: '', label: 'Not specified' }, ... ].map(({ value, label }) => {
    const saleType = watch('sale_type')
    return ( ... )
  })}
  ```
  La llamada a `watch('sale_type')` se ejecuta en cada iteración del bucle. ESLint reporta:  
  `259:34 warning Compilation Skipped: Use of incompatible library react-hooks/incompatible-library`
- **Impacto:**  
  El nuevo compilador de React 19 descarta por completo la memoización automática de este componente, forzando re-renderizados innecesarios del formulario en cada pulsación de tecla.
- **Remediación:**  
  Mover `const saleType = watch('sale_type')` fuera del `.map()`, en el cuerpo principal del componente.
