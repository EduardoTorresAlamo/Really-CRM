# Auditoría de Código: Arquitectura, Rendimiento y Deuda Técnica
**Repositorio:** [Really-CRM](file:///Users/eduardotorres/Developer/Really-CRM)

---

## 1) Componentes Dios y Acoplamiento

### [MEDIUM] Acoplamiento de UI, sub-estados desarticulados de RHF y lógica de mutación en ClientForm
**Evidencia:** [`components/clients/ClientForm.tsx:96-186`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L96-L186)  
**Impacto:** El componente acumula más de 400 líneas centralizando la definición y validación del esquema Zod, la gestión manual de estados fuera de React Hook Form (selección de etiquetas de ubicación y tipos de propiedad en `useState` independientes en [líneas 98-102](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L98-L102)), parsing/coerción numérica string-a-número/null, y la orquestación directa de creación/edición con redirección de router. Además, acepta la prop `userId` en [`ClientFormProps`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L88) pero la ignora completamente en los argumentos de la función ([línea 96](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L96)), reflejando un acoplamiento confuso entre las props recibidas y las dependencias reales del componente.  
**Fix sugerido:** Extraer los selectores de etiquetas ([`selectedPropertyTypes`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L98) y [`locations`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L101)) a componentes controlados o integrarlos dentro del árbol de campos de React Hook Form mediante `Controller`. Mover la lógica de coerción de datos a un helper puro reutilizable y eliminar la prop muerta `userId`.

---

### [MEDIUM] Acoplamiento directo de persistencia en componentes de presentación (Bypass de Server Actions)
**Evidencia:** [`components/pipeline/PipelineBoard.tsx:55-60`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L55-L60) y [`components/templates/TemplatesManager.tsx:59-77`](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatesManager.tsx#L59-L77)  
**Impacto:** En lugar de interactuar mediante una capa de servicio o Server Actions (como se hace para clientes y documentos en [`app/actions/`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions)), estos componentes instancian directamente el cliente de navegador de Supabase (`createClient()`) y ejecutan mutaciones SQL (`.update()`, `.insert()`, `.delete()`) acopladas a los eventos de UI. Esto impide centralizar la revalidación de caché de Next.js (`revalidatePath`), dispersa el control de errores y fragmenta la arquitectura entre componentes que usan Server Actions y componentes que mutan la base de datos en el cliente.  
**Fix sugerido:** Crear Server Actions dedicadas (por ejemplo `updateClientStageAction` en [`app/actions/clients.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts) y acciones de templates en `app/actions/templates.ts`) y delegar en ellas la mutación y la revalidación de caché.

---

## 2) Fetching de Datos: Waterfalls, N+1, Queries Sin Paginar, Sobre-Fetch al Cliente

### [HIGH] Bucle secuencial N+1 y query sin límite en Cron diario (Riesgo de Timeout en Serverless)
**Evidencia:** [`app/api/cron/send-daily-followups/route.ts:39-82`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L39-L82)  
**Impacto:** La query de la [línea 39](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L39) recupera **todos** los follow-ups pendientes de toda la base de datos sin paginación ni límite (`.limit()`). Posteriormente, el bucle `for (const fu of followUps)` ([línea 58](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L58)) ejecuta dos operaciones de red en serie por cada registro: una llamada HTTP a la API de Resend ([`sendFollowUpEmail`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L66)) y una actualización individual a Supabase ([`supabase.from('follow_ups').update(...)`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L76)). En un entorno serverless como Vercel (con timeout por defecto de 10-15s), un volumen moderado de recordatorios (20-30+) causará la cancelación forzada de la función por timeout, dejando recordatorios sin procesar de forma indeterminada.  
**Fix sugerido:** Procesar en lotes con concurrencia controlada (`p-limit` o `Promise.allSettled` en chunks de 5-10 envíos), paginar la query inicial con un límite máximo por corrida, y agrupar la actualización de estados de los follow-ups enviados mediante una sola query `in('id', sentIds)`.

---

### [HIGH] Bucle secuencial N+1 y escrituras individuales en envío masivo de correos
**Evidencia:** [`app/api/bulk-email/route.ts:70-95`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L70-L95)  
**Impacto:** La ruta permite seleccionar hasta 100 clientes ([`MAX_RECIPIENTS = 100`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L9)). El bucle ejecuta secuencialmente un `await sendClientEmail(...)` seguido de un `await supabase.from('client_history').insert(...)` individual por cada cliente. 100 destinatarios implican 200 llamadas de red secuenciales que tomarán entre 30 y 60 segundos, provocando un error 504 Gateway Timeout en la mayoría de los proveedores cloud y dejando el envío en un estado parcialmente completado sin reporte claro para el usuario.  
**Fix sugerido:** Ejecutar los envíos en paralelo con concurrencia limitada (`Promise.allSettled` por bloques de 5) y acumular los registros de auditoría para insertarlos en una única llamada batch `supabase.from('client_history').insert(records)`.

---

### [MEDIUM] Queries sin paginar ni límites en Pipeline, Property Match y Client Detail
**Evidencia:**  
- [`app/(app)/pipeline/page.tsx:20-25`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/pipeline/page.tsx#L20-L25)  
- [`app/api/property-match/route.ts:48-54`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/property-match/route.ts#L48-L54)  
- [`app/(app)/clients/[id]/page.tsx:31-34`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L31-L34)  
**Impacto:** En [`PipelinePage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/pipeline/page.tsx#L15), se descargan todos los clientes del agente sin `.limit()`. En [`PropertyMatch`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/property-match/route.ts#L11), se traen todos los compradores activos a memoria sin límite para calcular compatibilidad. En [`ClientDetailPage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L18), las tablas `client_history`, `follow_ups` y `documents` se consultan completas. A medida que un agente acumula historial y clientes, el payload JSON transferido al cliente se degrada significativamente.  
**Fix sugerido:** Establecer límites razonables (ej. `.limit(50)` en historial y pipeline) o implementar paginación / carga infinita en las pestañas con alto volumen de registros.

---

### [LOW] Sobre-fetch de columnas no utilizadas (`select('*')`) en vistas de lista
**Evidencia:** [`app/(app)/clients/page.tsx:61`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L61) y [`app/(app)/dashboard/page.tsx:26`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L26)  
**Impacto:** En el listado de clientes y en la tarjeta de clientes recientes del dashboard, se utiliza `.select('*')`, trayendo columnas pesadas como `notes`, `preferred_locations`, rangos de habitaciones y baños completos, cuando las tablas de presentación solo renderizan el nombre, email, estado y tipo de cliente.  
**Fix sugerido:** Reemplazar `.select('*')` por proyecciones explícitas con los campos necesarios: `.select('id, name, email, client_type, status, budget_min, budget_max, preferred_locations, created_at')`.

---

## 3) Re-renders Innecesarios y Estado Duplicado

### [MEDIUM] Estado duplicado y desincronización entre Server Component y Client State
**Evidencia:** [`app/(app)/clients/[id]/page.tsx:60-66`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L60-L66) frente a [`components/clients/tabs/DocumentsTab.tsx:34`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/DocumentsTab.tsx#L34) y [`components/clients/tabs/FollowUpsTab.tsx:34`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/FollowUpsTab.tsx#L34)  
**Impacto:** [`ClientDetailPage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L18) calcula y muestra el número de documentos y follow-ups pendientes en los badges del encabezado de pestañas (`docs.length` y `followUps.filter(...).length`) usando datos del Server Component. Sin embargo, los componentes hijos inicializan su propio estado con `useState(initialDocs)` y `useState(initialFollowUps)`. Cuando el usuario sube o elimina un documento en [`DocumentsTab`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/DocumentsTab.tsx#L33) o completa un follow-up en [`FollowUpsTab`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/FollowUpsTab.tsx#L33), el estado interno del tab cambia pero los badges del encabezado de la página principal quedan desincronizados mostrando los conteos viejos. Además, si el Server Component se re-renderiza, `useState(initialDocs)` ignora las nuevas props entrantes.  
**Fix sugerido:** Manejar la sincronización mediante `router.refresh()` tras mutaciones exitosas en lugar de mantener estado local desconectado del servidor, o sincronizar las props con `useEffect` / `key` en los componentes de pestañas.

---

### [LOW] Re-computación sin memoización de filtros por columna en PipelineBoard
**Evidencia:** [`components/pipeline/PipelineBoard.tsx:70-71`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L70-L71)  
**Impacto:** En cada render de [`PipelineBoard`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L42), se itera el array completo de clientes 6 veces consecutivas (`clients.filter((c) => c.stage === stage.value)`) sin `useMemo`. Cada vez que se mueve una tarjeta o cambia un estado, todas las columnas y tarjetas se vuelven a evaluar generando nuevas funciones inline para cada botón. Aunque el impacto es menor con pocos registros, con tableros de más de 100 tarjetas introduce micro-bloqueos en el hilo principal durante interacciones rápidas.  
**Fix sugerido:** Agrupar los clientes por etapa una sola vez mediante `useMemo` (e.g. `Object.groupBy(clients, c => c.stage)`) antes de mapear las columnas.

---

## 4) Tamaño de Bundle y Imports Pesados

### [LOW] Dependencia de desarrollo (`shadcn`) incluida en runtime dependencies
**Evidencia:** [`package.json:27`](file:///Users/eduardotorres/Developer/Really-CRM/package.json#L27)  
**Impacto:** La herramienta CLI `"shadcn": "^4.4.0"` está declarada dentro del bloque `"dependencies"` en lugar de `"devDependencies"`. Aunque no se importe en el bundle de cliente directamente, se empaqueta en las dependencias de despliegue para producción, incrementando el tiempo de resolución e instalación en entornos CI/CD y despliegues serverless.  
**Fix sugerido:** Mover `"shadcn"` a `"devDependencies"` o desinstalarla del package si ya se generaron los componentes.

---

### [LOW] Dependencia muerta de `next-themes` sin Provider configurado
**Evidencia:** [`package.json:21`](file:///Users/eduardotorres/Developer/Really-CRM/package.json#L21), [`components/ui/sonner.tsx:3, 8`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/sonner.tsx#L3), y [`app/layout.tsx:44-56`](file:///Users/eduardotorres/Developer/Really-CRM/app/layout.tsx#L44-L56)  
**Impacto:** Se importa `useTheme` de `next-themes` en el componente [`Toaster`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/sonner.tsx#L7) para configurar Sonner. Sin embargo, en [`app/layout.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/app/layout.tsx) no existe ningún `<ThemeProvider>` envolviendo la aplicación, por lo que `useTheme()` siempre retorna el valor por defecto `"system"`. Se está cargando la librería en el cliente sin ninguna funcionalidad real.  
**Fix sugerido:** Si la aplicación es únicamente de tema claro (como indica [`DESIGN.md`](file:///Users/eduardotorres/Developer/Really-CRM/DESIGN.md)), eliminar `next-themes`, pasar `theme="light"` o `theme="system"` estático en [`components/ui/sonner.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/sonner.tsx) y desinstalar el paquete.

---

## 5) Duplicación de Lógica Entre Cliente y Servidor

### [HIGH] Doble registro de auditoría en `client_history` por concurrencia entre DB Trigger y Server Action
**Evidencia:** [`supabase/migrations/20260824_full_audit_remediation.sql:38-58`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L38-L58) y [`app/actions/clients.ts:51-56`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56)  
**Impacto:** En la base de datos existe el trigger `trg_audit_clients` que ante un `INSERT` en `clients` ejecuta automáticamente:
```sql
INSERT INTO client_history (client_id, realtor_id, event_type, description, metadata)
VALUES (NEW.id, NEW.realtor_id, 'created', 'Client "' || NEW.name || '" was created', jsonb_build_object('source', 'database_trigger'));
```
Al mismo tiempo, la Server Action [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39) en la [línea 51](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51) ejecuta manualmente:
```typescript
await supabase.from('client_history').insert({
  client_id: data.id,
  realtor_id: user.id,
  event_type: 'created',
  description: `Client "${input.name}" was created`,
})
```
Cada vez que se crea un cliente desde la aplicación, **se insertan dos filas de auditoría idénticas** de tipo `'created'` en `client_history`, corrompiendo la cronología del historial de auditoría del cliente.  
**Fix sugerido:** Eliminar la inserción manual en [`app/actions/clients.ts:51-56`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56) y confiar exclusivamente en el trigger de base de datos para garantizar consistencia atómica.

---

### [HIGH] Esquema de validación Zod exclusivo del cliente y ausente en Server Actions
**Evidencia:** [`components/clients/ClientForm.tsx:48-84`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L48-L84) frente a [`app/actions/clients.ts:39-48`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L48)  
**Impacto:** En [`ClientForm.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx) se define un esquema Zod detallado con validaciones de formato de email, rangos lógicos (`budget_min <= budget_max`, `bedrooms_min <= bedrooms_max`), etc. Sin embargo, en el servidor, [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39) y [`updateClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L63) reciben [`ClientInput`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L16) como TypeScript puro sin ejecutar `schema.safeParse(input)` ni validar los datos antes de insertarlos en la base de datos. Cualquier cliente HTTP puede saltarse la UI y enviar valores no saneados o payloads inconsistentes.  
**Fix sugerido:** Mover el esquema Zod a un archivo compartido (ej. `lib/validations/client.ts`) y ejecutar `clientSchema.parse(input)` al inicio de [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39) y [`updateClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L63).

---

### [LOW] Componente duplicado muerto en la base de código (`ClientList.tsx`)
**Evidencia:** [`components/clients/ClientList.tsx:1-128`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx#L1-L128) y [`components/clients/SelectableClientList.tsx:1-203`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/SelectableClientList.tsx#L1-L203)  
**Impacto:** [`ClientList.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx) es un archivo huérfano de 128 líneas que duplica casi en su totalidad el JSX, estilos y lógica auxiliar (`formatBudget`) de [`SelectableClientList.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/SelectableClientList.tsx). Ningún archivo del repositorio importa `ClientList`.  
**Fix sugerido:** Eliminar el archivo [`components/clients/ClientList.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx).

---

## 6) Tests: Qué NO Está Cubierto y Cuál Es el Riesgo Real

### [CRITICAL] 0% de Cobertura de Tests en Toda la Aplicación y Ausencia Total de Test Runner
**Evidencia:** [`package.json:5-10`](file:///Users/eduardotorres/Developer/Really-CRM/package.json#L5-L10)  
No existe suite de tests configurada (`vitest`, `jest`, `playwright` o `cypress`). No existe un solo archivo `.test.ts` ni `.spec.ts` en todo el repositorio.

Los flujos críticos descubiertos con riesgo real de rotura son:

1. **Flujo de Cron de Recordatorios Diarios ([`app/api/cron/send-daily-followups/route.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts)):**
   - **Lo que NO está cubierto:** Verificación de timing-attack en `timingSafeEqual`, queries con Service Role Key (bypasseando RLS), manejo de errores ante caída de la API de Resend y actualización atómica de `email_sent = true`.
   - **Riesgo Real:** **CRITICAL**. Si la tarea cron falla silenciosamente por timeout o si un correo rechaza la conexión, el proceso se corta sin reintento y los agentes pierden citas de compraventa, firmas notariales o inspecciones, ocasionando pérdida económica directa a los clientes.
2. **Envío Masivo de Correos y Motor de Plantillas ([`app/api/bulk-email/route.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts) y [`lib/email/templates.ts`](file:///Users/eduardotorres/Developer/Really-CRM/lib/email/templates.ts)):**
   - **Lo que NO está cubierto:** Reemplazo de tokens (`{{clientName}}`, `{{propertyAddress}}`) cuando los campos son nulos, control de rate-limit y control de destinatarios sin email.
   - **Riesgo Real:** **HIGH**. Correos enviados con placeholders rotos o clientes recibiendo información de propiedades erróneas.
3. **Mecanismo Anti-SSRF y Matching de Propiedades ([`lib/security/ssrf.ts`](file:///Users/eduardotorres/Developer/Really-CRM/lib/security/ssrf.ts) y [`lib/claude/propertyMatch.ts`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts)):**
   - **Lo que NO está cubierto:** Filtrado de IPs privadas (RFC 1918, metadata de cloud `169.254.169.254`, IPv6 mapeado) y condición de carrera TOCTOU entre la validación DNS de [`assertUrlAllowed`](file:///Users/eduardotorres/Developer/Really-CRM/lib/security/ssrf.ts#L40) y el segundo `fetch()` de [`parsePropertyListing`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L107).
   - **Riesgo Real:** **HIGH**. Vulnerabilidad a DNS rebinding permitiendo peticiones HTTP forjadas desde el servidor hacia infraestructura interna o metadatos de Vercel/AWS.
4. **Políticas de Aislamiento RLS en Base de Datos ([`supabase/schema.sql:120-135`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L120-L135)):**
   - **Lo que NO está cubierto:** Pruebas de integración de multi-inquilino (tenant isolation) que verifiquen que un usuario autenticado nunca pueda consultar, modificar o borrar registros (`clients`, `documents`, `follow_ups`) pertenecientes a otro `realtor_id`.
   - **Riesgo Real:** **CRITICAL**. Exposición de datos confidenciales (contratos inmobiliarios, cédulas y pre-aprobaciones hipotecarias) entre corredores.

---

## 7) Qué Deuda Pagar Primero, Ordenado, y Qué NO Vale la Pena Pagar Todavía

### Deuda a pagar primero (Priorizada por ROI e impacto operativo)

1. **Prioridad 1 — Corregir la duplicación de auditoría en la Server Action**
   - **Acción:** Eliminar [`app/actions/clients.ts:51-56`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56). El trigger [`trg_audit_clients`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L56) ya se encarga de registrar la creación en la base de datos de manera atómica.
   - **ROI:** Inmediato. Corrige la corrupción de datos y registros duplicados en el historial de cada cliente nuevo.
2. **Prioridad 2 — Batching y paginación en Cron y Bulk Email para evitar Timeouts**
   - **Acción:** En [`app/api/cron/send-daily-followups/route.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts) y [`app/api/bulk-email/route.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts), paginar la query inicial con un `.limit()`, procesar envíos con concurrencia controlada (`p-limit` o chunks) y agrupar las inserciones/actualizaciones en Supabase en una sola consulta batch.
   - **ROI:** Alto. Previene caídas por 504 Gateway Timeout y asegura que los correos y recordatorios se envíen consistentemente en producción.
3. **Prioridad 3 — Borrado real de archivos en Storage al eliminar documentos**
   - **Acción:** En [`app/actions/documents.ts:10-27`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L10-L27), obtener la ruta `file_url` del documento antes de borrar la fila de la base de datos y llamar a `supabase.storage.from('documents').remove([file_url])`.
   - **ROI:** Alto. Evita fugas de almacenamiento con archivos huérfanos que contienen datos sensibles de clientes y previene costos de almacenamiento innecesarios.
4. **Prioridad 4 — Centralizar validación Zod en Server Actions**
   - **Acción:** Extraer el schema de [`components/clients/ClientForm.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx) a `lib/validations/client.ts` y validar el input en [`app/actions/clients.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts).
   - **ROI:** Medio-Alto. Cierra brechas de integridad de datos en mutaciones directas.
5. **Prioridad 5 — Instalar Vitest y crear pruebas unitarias/integración para rutas críticas**
   - **Acción:** Instalar `vitest` y escribir pruebas para `ssrf.ts`, `templates.ts`, `propertyMatch.ts` y la ruta de cron diario.
   - **ROI:** Medio-Alto. Ofrece una red de seguridad contra regresiones en los flujos principales de negocio.

---

### Qué NO vale la pena pagar todavía

1. **Reemplazar el parser heurístico de propiedades por llamadas a LLMs externos:**
   - La implementación actual en [`lib/claude/propertyMatch.ts`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts) es determinista, corre localmente a costo $0 y sin latencia externa. Reincorporar un LLM comercial solo incrementaría el costo por petición y los puntos de falla sin una justificación de negocio probada.
2. **Implementar una suite E2E completa con Playwright:**
   - Para el estado actual del proyecto, montar y mantener suites E2E con orquestación de autenticación de Supabase y servicios externos (Resend) generará una carga de mantenimiento desproporcionada. Pruebas unitarias y de integración para Server Actions y API routes ofrecen 90% del valor a una fracción del costo.
3. **Virtualización de listas en Pipeline o Clientes (e.g. TanStack Virtual):**
   - El volumen normal de clientes de un agente inmobiliario promedio es de decenas o cientos, no de 50,000 elementos. Implementar virtualización en este punto es optimización prematura. La paginación en servidor implementada en [`ClientsPage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx) es suficiente para la escala actual.
4. **Reemplazar `@base-ui/react` o reescribir componentes UI primitivos:**
   - Los componentes de `@base-ui/react` y Tailwind v4 funcionan adecuadamente y cumplen los lineamientos de diseño. Reescribir o cambiar de librería UI no aporta valor al negocio y consumiría tiempo crítico de ingeniería.
