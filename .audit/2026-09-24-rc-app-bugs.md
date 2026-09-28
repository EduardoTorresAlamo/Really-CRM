# Auditoría de Código: Lógica de Negocio y Manejo de Errores

**Repositorio:** `/Users/eduardotorres/Developer/Really-CRM`  
**Alcance:** [`app/`](file:///Users/eduardotorres/Developer/Really-CRM/app), [`components/`](file:///Users/eduardotorres/Developer/Really-CRM/components), [`lib/`](file:///Users/eduardotorres/Developer/Really-CRM/lib), rutas API y esquemas asociados.

---

## 1. Pérdida o Corrupción de Data

### [HIGH] Actualizaciones inexistentes reportadas como exitosas y corrupción del log de auditoría
Evidencia: [app/actions/clients.ts:72-88](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L72-L88) en [`updateClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L63-L89)  
**Impacto:** En Supabase / PostgREST, ejecutar `.update(...).eq('id', id).eq('realtor_id', user.id)` sin encadenar `.select()` devuelve `{ error: null }` incluso si 0 filas coincidieron con los filtros (por ejemplo, si el cliente no existe o pertenece a otro realtor). El servidor continúa la ejecución, inserta un registro falso de `'edited'` en [`client_history`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L107-L115) para una entidad no modificada, y retorna `{ ok: true, id }`. La UI informa al usuario que los cambios se guardaron cuando en realidad nunca se persistieron.  
**Fix sugerido:** Encadenar `.select('id').single()` en la mutación de actualización o verificar la cantidad de filas afectadas (`count`). Si no se afectó ninguna fila, retornar `{ ok: false, error: 'Client not found or unauthorized' }` y abortar la inserción en [`client_history`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L107-L115).

---

### [MEDIUM] Duplicación sistemática de eventos de auditoría y falta de transacción en creación de clientes
Evidencia: [app/actions/clients.ts:44-59](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L44-L59) y [supabase/migrations/20260824_full_audit_remediation.sql:35-58](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L35-L58)  
**Impacto:** En [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L60), la inserción en la tabla `clients` dispara automáticamente el trigger de base de datos `trg_audit_clients` ([`fn_audit_client_changes`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/migrations/20260824_full_audit_remediation.sql#L35-L53)), el cual inserta un evento de tipo `'created'` en [`client_history`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L107-L115). Inmediatamente después, el código de TypeScript ejecuta manualmente un segundo `insert` en [`client_history`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L107-L115) con el mismo tipo de evento `'created'`. Además, al ser dos llamadas de red independientes fuera de una transacción, si la segunda falla el cliente queda con inconsistencia. Como resultado, cada cliente creado en la aplicación genera logs de creación duplicados en su historial.  
**Fix sugerido:** Eliminar la inserción manual en [`client_history`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56) dentro de [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L60) y delegar el registro de auditoría exclusivamente al trigger de PostgreSQL en base de datos.

---

### [HIGH] Desincronización y sobrescritura de etapas en UI optimista del tablero Kanban
Evidencia: [components/pipeline/PipelineBoard.tsx:50-66](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L50-L66) en [`moveTo`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L50-L66)  
**Impacto:** La función [`moveTo`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L50-L66) actualiza el estado local de forma optimista y guarda `previous = client.stage` tomado del argumento por valor recibido en el render. Si el usuario avanza rápidamente una tarjeta dos veces (por ejemplo, Lead → Contacted → Showing) antes de que la primera llamada de red finalice, la primera petición mantendrá `previous = 'lead'`. Si la primera petición falla tarde por latencia o error de red, ejecutará el rollback devolviendo el cliente a `'lead'`, sobrescribiendo tanto la segunda transición optimista como el valor real persistido si la segunda petición fue exitosa.  
**Fix sugerido:** Deshabilitar los botones de movimiento de la tarjeta mientras exista una mutación en vuelo para ese cliente específico, y ante un fallo en el catch, recargar los datos del cliente desde el servidor o revertir leyendo el estado atómico previo vía callback funcional de `setClients`.

---

## 2. Race Conditions y Doble Submit

### [HIGH] Disparo concurrente de transiciones en Kanban sin bloqueo de controles en vuelo
Evidencia: [components/pipeline/PipelineBoard.tsx:101-133](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx#L101-L133)  
**Impacto:** Los botones `◀`, `▶` y el menú `<select>` de cada tarjeta en el Kanban no cuentan con la propiedad `disabled` ligada al estado asíncrono de la mutación. Múltiples clics rápidos disparan peticiones concurrentes a `supabase.from('clients').update({ stage })`. Debido a que las respuestas HTTP pueden resolverse en desorden, una petición más antigua (e.g., stage='contacted') puede resolverse después de una más reciente (e.g., stage='showing'), fijando en base de datos una etapa desactualizada.  
**Fix sugerido:** Mantener en el estado local un conjunto de IDs en mutación (`loadingIds: Set<string>`) y deshabilitar los botones `◀`, `▶` y el `<select>` del cliente mientras su actualización esté pendiente.

---

### [HIGH] Envío duplicado de recordatorios por falta de idempotencia y verificación de estado
Evidencia: [app/api/send-followup-email/route.ts:29-56](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L29-L56) en [`POST`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L10-L61)  
**Impacto:** La ruta busca el seguimiento pero no valida si `followUp.email_sent === true`. Si el usuario hace doble clic en el botón de envío en [`FollowUpCard`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L59-L74), o si dos solicitudes entran en paralelo, ambas ejecutan [`sendFollowUpEmail`](file:///Users/eduardotorres/Developer/Really-CRM/lib/resend/sendFollowUpEmail.ts#L24-L61) a través de Resend antes de que `supabase.from('follow_ups').update({ email_sent: true })` se ejecute. Esto provoca el despacho de múltiples correos idénticos al cliente/realtor y consume cuota externa sin control.  
**Fix sugerido:** Validar `if (followUp.email_sent) return NextResponse.json({ error: 'Already sent' }, { status: 409 })` y ejecutar una actualización condicional atómica en base de datos (`UPDATE follow_ups SET email_sent = true WHERE id = ... AND email_sent = false RETURNING id`) antes de despachar el email, o aplicar rate limiting estricto por `followUpId`.

---

### [MEDIUM] Doble click y mutaciones DELETE concurrentes en gestor de plantillas
Evidencia: [components/templates/TemplatesManager.tsx:82-87](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatesManager.tsx#L82-L87) y [components/templates/TemplatesManager.tsx:166-172](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatesManager.tsx#L166-L172)  
**Impacto:** El botón para eliminar plantillas (`<button aria-label="Delete template">`) no cuenta con confirmación de usuario ni se deshabilita mientras [`handleDelete`](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatesManager.tsx#L82-L87) está en ejecución (`saving` solo se usa en `handleSave`). Varios clics rápidos ejecutan peticiones `DELETE` paralelas sobre el mismo recurso.  
**Fix sugerido:** Agregar confirmación previa (`confirm('Delete this template?')`), introducir un estado `deletingId: string | null` y deshabilitar el botón de borrado mientras la operación esté en curso.

---

### [MEDIUM] Pérdida de parámetros de filtrado en clientes por concurrencia en transiciones
Evidencia: [components/clients/ClientFilters.tsx:38-51](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientFilters.tsx#L38-L51) y [components/clients/ClientFilters.tsx:74-78](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientFilters.tsx#L74-L78)  
**Impacto:** En [`updateParams`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientFilters.tsx#L38-L51), `new URLSearchParams(searchParams.toString())` lee de `useSearchParams()`. Si el usuario interactúa rápidamente (por ejemplo, cambia un botón de estado e inmediatamente tipea en la búsqueda), la segunda llamada se ejecuta antes de que la transición de `router.push` termine de sincronizar `searchParams`. La segunda llamada reconstruye la URL utilizando los `searchParams` obsoletos, sobrescribiendo y eliminando el filtro aplicado milisegundos antes.  
**Fix sugerido:** Centralizar el estado de los filtros en un estado reactivo local que sincronice con la URL mediante debounce y mantenga los valores consolidados sin depender exclusivamente de `searchParams` durante las transiciones.

---

## 3. Errores Tragados en Silencio

### [HIGH] Promesa `.then()` sin `.catch()` y error de carga ignorado en selector de plantillas
Evidencia: [components/templates/TemplatePicker.tsx:34-49](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatePicker.tsx#L34-L49) en `useEffect`  
**Impacto:** `supabase.from('email_templates').select('*').order('name', { ascending: true }).then(({ data }) => { ... })` no tiene bloque `.catch()` encadenado. Cualquier fallo de red o rechazo de promesa provoca una excepción no controlada (`unhandled promise rejection`) en el navegador. Además, la función ignora la propiedad `error` retornada por Supabase (`if (!data) return`), provocando que si la consulta falla por permisos RLS o caída del servicio, el selector quede vacío en silencio sin advertir al usuario por qué no aparecen sus plantillas.  
**Fix sugerido:** Reescribir el hook utilizando `async/await` con `try/catch`, desestructurar `{ data, error }`, y mostrar un `toast.error('Failed to load templates')` si ocurre un error.

---

### [HIGH] Cron diario ignora errores de lectura y falla en silencio reportando éxito falso
Evidencia: [app/api/cron/send-daily-followups/route.ts:39-48](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L39-L48) y [app/api/cron/send-daily-followups/route.ts:76](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L76)  
**Impacto:** En `GET /api/cron/send-daily-followups`, la consulta `const { data: followUps } = await supabase.from('follow_ups')...` no captura ni valida la propiedad `error`. Si Supabase está inaccesible o la consulta falla por timeout, `followUps` es `undefined`, y la línea 46 ejecuta `return NextResponse.json({ sent: 0 })`. El cron responde HTTP 200 a Vercel simulando que no había tareas pendientes, enmascarando una caída del sistema. Además, en la línea 76, `await supabase.from('follow_ups').update({ email_sent: true }).eq('id', fu.id)` ignora el resultado de error; si la actualización falla, el cron no se entera y volverá a enviar el mismo email al día siguiente.  
**Fix sugerido:** Capturar `{ data: followUps, error }` y retornar un status 500 con log de error si `error` no es nulo. Validar también el resultado de la actualización de `email_sent`.

---

### [HIGH] Estado `email_sent` no verificado tras despacho de correo manual
Evidencia: [app/api/send-followup-email/route.ts:54-56](file:///Users/eduardotorres/Developer/Really-CRM/app/api/send-followup-email/route.ts#L54-L56)  
**Impacto:** La llamada `await supabase.from('follow_ups').update({ email_sent: true }).eq('id', followUpId)` no desestructura ni comprueba la propiedad `error`. Si la base de datos rechaza la actualización por problemas de conexión o bloqueo, el endpoint retorna igualmente `{ success: true }`. El email ya salió a través de Resend, pero en base de datos `email_sent` permanece en `false`. Como consecuencia, el cron de las 13:00 UTC recogerá este seguimiento y enviará un recordatorio duplicado.  
**Fix sugerido:** Desestructurar `const { error: updateError } = await supabase...` y, si existe error, registrar el incidente con severidad alta y retornar status 500 informando que el email se envió pero el estado no pudo actualizarse.

---

### [MEDIUM] Inserciones de auditoría en Server Actions ignoran errores en silencio
Evidencia: [app/actions/clients.ts:51-56](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L51-L56) y [app/actions/clients.ts:79-84](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L79-L84)  
**Impacto:** Tanto en [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L60) como en [`updateClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L63-L89), las llamadas a `supabase.from('client_history').insert(...)` se ejecutan sin capturar `{ error }`. Si la política RLS de inserción falla o la tabla se bloquea, el error se traga por completo y la función retorna `{ ok: true }`.  
**Fix sugerido:** Capturar `{ error: historyError }`, registrar el fallo con `console.error` y evaluar si la acción debe advertir al cliente sobre el fallo en la traza de auditoría.

---

### [LOW] Cláusulas catch vacías ocultan el motivo real del fallo en UI
Evidencia: [components/documents/DocumentUploadDialog.tsx:83-85](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L83-L85) y [components/follow-ups/FollowUpCard.tsx:67-71](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L67-L71)  
**Impacto:** En [`DocumentUploadDialog`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L38-L96), la cláusula `catch { toast.error('Upload failed') }` descarta el objeto de error. Lo mismo ocurre en [`FollowUpCard`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L22-L130) con `if (!res.ok) throw new Error(); ... catch { toast.error('Failed to send email') }`. Si el servidor rechaza la petición por cuota de almacenamiento, tamaño de archivo o error 401/429, el detalle técnico se pierde por completo impidiendo el diagnóstico tanto al usuario como en logs de telemetría.  
**Fix sugerido:** Utilizar `catch (err)` y propagar `err instanceof Error ? err.message : 'Error desconocido'` al toast o a la consola de desarrollo.

---

## 4. Validación de Entrada en el Servidor

### [CRITICAL] Ausencia total de validación de esquemas en Server Actions de clientes
Evidencia: [app/actions/clients.ts:39-89](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L89) en [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L60) y [`updateClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L63-L89)  
**Impacto:** Mientras que el formulario cliente [`ClientForm`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L96-L401) valida con Zod en el navegador, las Server Actions exportadas en [`app/actions/clients.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts) aceptan el payload [`ClientInput`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L16-L32) directamente sin ninguna validación en el servidor:
- No se valida que `name` no esté vacío o que no contenga millones de caracteres.
- No se valida el formato de `email`.
- No se validan enums en tiempo de ejecución (`client_type`, `status`, `sale_type`).
- No se valida la coherencia entre rangos mínimos y máximos (`budget_min <= budget_max`, `bedrooms_min <= bedrooms_max`).
Cualquier invocación RPC directa (a través del endpoint de Server Actions de Next.js) puede inyectar registros con nombres vacíos, correos malformados o datos inconsistentes que violan las reglas del negocio.  
**Fix sugerido:** Mover el esquema Zod de [`ClientForm.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx#L48-L82) a un archivo compartido (e.g. `lib/validations/client.ts`) y ejecutar `clientSchema.safeParse(input)` al inicio de [`createClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L39-L60) y [`updateClientAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/clients.ts#L63-L89), retornando `{ ok: false, error: 'Invalid input' }` ante fallos.

---

### [HIGH] Estado y parámetros sin validación de enum ni UUID en Server Actions de documentos
Evidencia: [app/actions/documents.ts:29-48](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L29-L48) en [`updateDocumentStatusAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L30-L48)  
**Impacto:** `updateDocumentStatusAction(id: string, clientId: string, status: DocStatus)` recibe `status` directamente desde la llamada del cliente. En tiempo de ejecución en Node.js, `status` no se valida contra la lista de estados válidos (`pending`, `received`, `verified`). Si se envía un string arbitrario, PostgreSQL arroja una excepción no capturada de tipo enum (`invalid input value for enum doc_status`) generando un error 500 no controlado. Tampoco se valida que `id` y `clientId` cumplan el formato UUID.  
**Fix sugerido:** Validar `['pending', 'received', 'verified'].includes(status)` y verificar el formato UUID mediante regex o Zod antes de consultar la base de datos.

---

### [HIGH] Payload de email masivo sin límites de longitud y sin validación UUID
Evidencia: [app/api/bulk-email/route.ts:32-47](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L32-L47) en [`POST`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts#L15-L98)  
**Impacto:** En [`app/api/bulk-email/route.ts`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/bulk-email/route.ts), las validaciones para `subject` y `body` solo verifican `typeof === 'string' && string.trim()`. No existe límite superior de caracteres: un usuario malicioso o script automatizado puede enviar cuerpos de decenas de megabytes, saturando la memoria del proceso y provocando fallos en la serialización hacia Resend. Adicionalmente, `clientIds` comprueba que los elementos sean strings, pero no valida que sean UUIDs válidos; strings maliciosos o malformados rompen la cláusula SQL `.in('id', clientIds)` arrojando un error 500 de Postgres (`invalid input syntax for type uuid`).  
**Fix sugerido:** Definir un límite estricto de caracteres (e.g. `subject` máx 200 caracteres, `body` máx 10,000 caracteres) y verificar que cada ID en `clientIds` coincida con la expresión regular estándar de UUID v4.

---

### [HIGH] Mutaciones directas de perfil y seguimientos desde cliente sin validación en servidor
Evidencia: [components/profile/ProfileForm.tsx:70-77](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/ProfileForm.tsx#L70-L77) y [components/follow-ups/FollowUpForm.tsx:39-46](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpForm.tsx#L39-L46)  
**Impacto:** Tanto el guardado de perfiles en [`ProfileForm`](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/ProfileForm.tsx#L50-L147) como la creación de seguimientos en [`FollowUpForm`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpForm.tsx#L28-L95) realizan mutaciones directas a Supabase usando el cliente de navegador (`createClient()`). La validación Zod reside únicamente en el componente React del formulario. Cualquier usuario autenticado puede abrir la consola de DevTools e insertar seguimientos con fechas imposibles (e.g. año 9999) o campos de notas con gigabytes de texto sin que exista validación en servidor que lo impida.  
**Fix sugerido:** Trasladar las mutaciones de perfiles y seguimientos a Server Actions dedicadas que ejecuten validación de esquemas Zod en el entorno del servidor antes de insertar en base de datos.

---

## 5. Estados Imposibles en la UI

### [HIGH] Bloqueo en empty state falso al filtrar clientes desde páginas avanzadas
Evidencia: [components/clients/ClientFilters.tsx:38-51](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientFilters.tsx#L38-L51) y [app/(app)/clients/page.tsx:53-81](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L53-L81)  
**Impacto:** Si un realtor se encuentra en la página 2 o superior de la lista de clientes (`/clients?page=2`) y selecciona un filtro (por ejemplo, status="inactive" o escribe una búsqueda) cuyos resultados totales son menores a 25 registros:
1) [`ClientFilters.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientFilters.tsx#L19-L115) actualiza los parámetros en la URL pero no resetea `page` a 1.
2) La URL resultante es `/clients?status=inactive&page=2`.
3) En [`ClientsPage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L42-L140), el cálculo de rango evalúa `from = (2 - 1) * 25 = 25`, por lo que la consulta a Supabase retorna `clients = []`.
4) [`ClientList`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx#L51-L127) recibe un array vacío y renderiza: *"No clients found. Create your first client to get started."*
5) Como el total de resultados es menor a 25, `totalPages = 1`, por lo que los controles de paginación se ocultan.
El usuario queda atrapado en una pantalla vacía sin poder regresar a la página 1 ni ver los registros que sí existen para ese filtro.  
**Fix sugerido:** En [`ClientFilters.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientFilters.tsx#L19-L115), dentro de `updateParams`, eliminar siempre el parámetro `page` (o forzarlo a `1`) cada vez que se modifique cualquier filtro o término de búsqueda.

---

### [HIGH] Desincronización de selección multi-página que genera modal con "Email 0 clients" y error 400
Evidencia: [components/clients/SelectableClientList.tsx:57-73](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/SelectableClientList.tsx#L57-L73) y [components/clients/SelectableClientList.tsx:84-118](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/SelectableClientList.tsx#L84-L118)  
**Impacto:** En [`SelectableClientList`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/SelectableClientList.tsx#L56-L202), la selección se guarda como un conjunto de IDs (`selected = Set<string>`). Si el usuario selecciona clientes en la Página 1 (e.g. 5 clientes) y navega a la Página 2:
1) La barra flotante muestra *"5 selected"* porque `selected.size` es 5.
2) El usuario pulsa *"Email selected"*.
3) La línea 84 calcula: `selectedClients = clients.filter((c) => selected.has(c.id))`. Pero la prop `clients` contiene únicamente los registros de la Página 2.
4) `selectedClients` resulta en un array vacío `[]`.
5) [`BulkEmailModal`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/BulkEmailModal.tsx#L43-L135) se abre con el título *"Email 0 clients"* y el botón *"Send to 0"*. Si el usuario presiona enviar, la API rechaza con 400 `clientIds required`.
6) Adicionalmente, el checkbox "Select all" (línea 115) comprueba `checked={selected.size === clients.length}`. Si la página 2 tiene 5 clientes, el checkbox aparece marcado aunque ninguno de los clientes de esa página esté seleccionado.  
**Fix sugerido:** Mantener en el estado los objetos completos seleccionados `{ id, name }` independientemente de la página visible, o resetear la selección al cambiar de página mediante un `useEffect` que detecte el cambio en `clients`.

---

### [MEDIUM] Descarga de documentos bloqueada silenciosamente por el navegador tras await
Evidencia: [components/documents/DocumentCard.tsx:50-65](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx#L50-L65) en [`handleDownload`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx#L50-L65)  
**Impacto:** En [`handleDownload`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx#L50-L65), se ejecuta `const signed = await getSignedUrl('documents', doc.file_url, 3600)` y posteriormente `window.open(signed, '_blank')`. Al ejecutarse `window.open` tras una resolución asíncrona de red (`await`), los navegadores modernos (Safari, Chrome, Firefox) revocan el token de interacción de usuario de confianza y bloquean la apertura de la nueva pestaña considerándola un popup no solicitado. El botón termina el estado de carga (`setDownloading(false)`), pero el archivo nunca se abre ni se descarga, dejando al usuario sin respuesta.  
**Fix sugerido:** Crear dinámicamente un elemento `<a href={signed} download target="_blank" rel="noopener noreferrer">` y disparar `.click()`, o abrir la ventana sincrónicamente antes del await (`const w = window.open('')`) y asignar `w.location.href = signed` una vez obtenida la URL firmada.

---

## 6. Fechas/Timezone en Scheduling

### [CRITICAL] Desaparición de tareas de "hoy" y fecha incorrecta en Dashboard por evaluación en UTC
Evidencia: [app/(app)/dashboard/page.tsx:17-26](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L17-L26) y [app/(app)/dashboard/page.tsx:46-48](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L46-L48)  
**Impacto:** [`DashboardPage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L12-L64) es un Server Component que se ejecuta en el servidor de Vercel/Node bajo la zona horaria UTC (`00:00:00Z`).
Para realtors en América (por ejemplo, Puerto Rico UTC-4, Nueva York EDT UTC-4, California PDT UTC-7):
A partir de las 8:00 PM (o 5:00 PM en California), en UTC ya es el día siguiente.
- `const today = format(new Date(), 'yyyy-MM-dd')` evalúa a la fecha de mañana.
- La consulta `.eq('scheduled_date', today)` en [`app/(app)/dashboard/page.tsx:25`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L25) pide los seguimientos de mañana. Todas las tareas programadas para el día actual desaparecen de la tarjeta *"Today's Follow-ups"*, mostrando las tareas de mañana etiquetadas como tareas de hoy.
- La función RPC `get_dashboard_stats` recibe `p_today` como la fecha de mañana, por lo que todas las tareas del día de hoy son contabilizadas erróneamente como `overdueFollowUps`.
- El encabezado del dashboard renderiza `{format(new Date(), "EEEE, d MMMM")}` mostrando a los usuarios el día de la semana y fecha de mañana.  
**Fix sugerido:** Obtener la zona horaria del usuario a través de una cookie de cliente, el header `x-vercel-ip-timezone`, o guardarla en el perfil del usuario. En el servidor, formatear `today` utilizando `date-fns-tz` ajustado a la zona horaria del realtor.

---

### [HIGH] Cron diario a las 13:00 UTC ejecuta sin soporte de zona horaria por usuario
Evidencia: [app/api/cron/send-daily-followups/route.ts:36-45](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L36-L45) en [`GET`](file:///Users/eduardotorres/Developer/Really-CRM/app/api/cron/send-daily-followups/route.ts#L11-L84)  
**Impacto:** El cron job configurado en [`vercel.json`](file:///Users/eduardotorres/Developer/Really-CRM/vercel.json) se ejecuta a una hora fija (13:00 UTC) y evalúa `const today = format(new Date(), 'yyyy-MM-dd')` contra todos los usuarios sin distinción geográfica. La tabla `profiles` en [`schema.sql`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L20-L30) no almacena la zona horaria del agente.
- Para un realtor en la costa oeste de EE. UU. (PDT, UTC-7), las 13:00 UTC son las 6:00 AM.
- Para un realtor en Hawái (UTC-10), son las 3:00 AM.
Los clientes y agentes reciben correos automáticos en horas intempestivas de la madrugada o con fechas desfasadas respecto a su jornada laboral real.  
**Fix sugerido:** Agregar la columna `timezone text NOT NULL DEFAULT 'UTC'` en la tabla `profiles` y parametrizar la ejecución del cron para despachar recordatorios únicamente cuando la hora local del usuario coincida con la ventana matutina deseada (e.g. 8:00 AM local).

---

### [MEDIUM] Herencia de hora del sistema en parseo de fechas en tarjetas de seguimiento
Evidencia: [components/follow-ups/FollowUpCard.tsx:27-34](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L27-L34)  
**Impacto:** En [`FollowUpCard`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx#L22-L130), `const date = parse(followUp.scheduled_date, 'yyyy-MM-dd', new Date())` utiliza `new Date()` como fecha de referencia. En `date-fns`, los tokens no especificados en el formato de parseo (`HH`, `mm`, `ss`, `SSS`) heredan los valores del objeto de referencia. Como consecuencia, `date` no se establece a medianoche local (`00:00:00`), sino a la hora, minuto y segundo exactos en los que se montó el componente. Cualquier comparación directa de instantes temporales resulta imprecisa. Más grave aún: la evaluación local en el navegador contrasta con la evaluación en UTC de [`DashboardPage`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L12-L64), generando que una tarea se visualice como *"Due Today"* dentro del detalle del cliente mientras que en el dashboard se clasifica como *"Overdue"* o no se lista.  
**Fix sugerido:** Utilizar `parse(followUp.scheduled_date, 'yyyy-MM-dd', startOfDay(new Date()))` y unificar los criterios de cálculo entre servidor y cliente.

---

## 7. Integridad Referencial en el Flujo de Clientes/Documentos

### [CRITICAL] Eliminación en base de datos sin borrado físico en Supabase Storage
Evidencia: [app/actions/documents.ts:18-24](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L18-L24) en [`deleteDocumentAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L10-L27)  
**Impacto:** La Server Action [`deleteDocumentAction`](file:///Users/eduardotorres/Developer/Really-CRM/app/actions/documents.ts#L10-L27) ejecuta únicamente:
```ts
const { error } = await supabase
  .from('documents')
  .delete()
  .eq('id', id)
  .eq('realtor_id', user.id)
```
Nunca consulta `file_url` ni llama a `supabase.storage.from('documents').remove([file_url])`. Al eliminarse la fila en PostgreSQL, la ruta del archivo se pierde de forma irreversible en la base de datos. El archivo físico (que contiene identificaciones personales, contratos firmados y cartas de pre-aprobación bancaria con información financiera sensible) queda huérfano de manera permanente en el bucket privado de Supabase Storage. Esto viola normativas de privacidad y retención de datos personales (GDPR/PII), satura la cuota de almacenamiento y deja data sensible descontrolada en la infraestructura.  
**Fix sugerido:** Antes de borrar la fila en PostgreSQL, consultar la ruta del archivo (`file_url`), eliminar el archivo del bucket mediante `supabase.storage.from('documents').remove([data.file_url])` y solo después borrar el registro en la base de datos.

---

### [HIGH] Ausencia de restricción cruzada de tenant permite asociar documentos a clientes ajenos
Evidencia: [supabase/schema.sql:75-78](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L75-L78) y [components/documents/DocumentUploadDialog.tsx:68-76](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L68-L76)  
**Impacto:** En el esquema de base de datos [`supabase/schema.sql`](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql):
```sql
create table documents (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  realtor_id uuid not null references profiles(id) on delete cascade,
```
Y la política RLS: `create policy "own documents" on documents for all using (auth.uid() = realtor_id);`.
No existe ninguna restricción de clave foránea compuesta ni check RLS que garantice que `documents.realtor_id === clients.realtor_id`.
Dado que [`DocumentUploadDialog.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentUploadDialog.tsx#L68-L76) inserta directamente a Supabase desde el cliente, un realtor autenticado (Agente A) puede enviar un `client_id` perteneciente al Agente B.
1) La inserción es aceptada porque `realtor_id` coincide con `auth.uid()`.
2) El Agente B no ve el documento ajeno porque su RLS filtra por su propio `realtor_id`.
3) Sin embargo, cuando el Agente B elimina su propio cliente, la restricción `on delete cascade` de `client_id` en PostgreSQL elimina silenciosamente el documento del Agente A sin su conocimiento ni autorización.  
**Fix sugerido:** En PostgreSQL, añadir una restricción de unicidad compuesta `UNIQUE (id, realtor_id)` en la tabla `clients` y crear la clave foránea compuesta en `documents`:
```sql
CONSTRAINT fk_documents_client_realtor 
FOREIGN KEY (client_id, realtor_id) 
REFERENCES clients(id, realtor_id) ON DELETE CASCADE;
```

---

### [HIGH] Cascada de eliminación de clientes en PostgreSQL abandona archivos físicos en Storage
Evidencia: [supabase/schema.sql:35-37](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L35-L37) y [supabase/schema.sql:75-78](file:///Users/eduardotorres/Developer/Really-CRM/supabase/schema.sql#L75-L78)  
**Impacto:** Cuando un cliente es eliminado en la tabla `clients`, la regla `ON DELETE CASCADE` de PostgreSQL borra automáticamente en cascada todas las filas asociadas en `documents`, `follow_ups` y `client_history`. Sin embargo, el motor relacional de PostgreSQL no tiene comunicación con el servicio de Supabase Storage. Todos los archivos cargados para ese cliente permanecen archivados indefinidamente en el bucket de Storage, sin referencias en la base de datos que permitan rastrearlos ni eliminarlos mediante la aplicación.  
**Fix sugerido:** Implementar una Server Action o Database Webhook/Edge Function para la eliminación de clientes que liste todos los `file_url` en `documents` para ese `client_id`, borre los objetos correspondientes en Supabase Storage en lote, y posteriormente ejecute la eliminación del registro del cliente.
