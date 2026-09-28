# PLAN DE REMEDIACIÓN Y HOJA DE RUTA (REMEDIATION PLAN)
**Proyecto:** Really-CRM  
**Fecha:** 22 de Septiembre de 2026  
**Objetivo:** Guía de ejecución priorizada y sistemática para resolver los 25 hallazgos de seguridad, bugs, cuellos de botella de rendimiento, arquitectura, código muerto y desincronización de esquema.  

---

## FASE 1: PRIORIDAD P0 — BLOQUEANTES Y SEGURIDAD CRÍTICA (INMEDIATO / DÍA 1)

- [ ] **P0.1: Sincronizar Trigger de Perfiles en Base `schema.sql` y Aplicar en Producción (`SEC-SCHEMA-01`)**  
  *Acción:* Integrar la función y trigger `on_auth_user_created` en `supabase/schema.sql` (creada en la migración `20260920_handle_new_user_trigger.sql` en commit `b88f5e6`) y asegurar su ejecución en la base de datos de producción para garantizar que todo nuevo usuario registrado vía Magic Link tenga su fila en `public.profiles`, desbloqueando la creación de clientes.
- [ ] **P0.2: Añadir Políticas RLS `FOR UPDATE` en Supabase Storage (`BUG-RLS-01`)**  
  *Acción:* Crear las políticas `"Update own avatar"` y `"Update own documents"` en `storage.objects` para habilitar `upsert: true` al actualizar fotos de perfil y re-subir documentos sin recibir error 403 Forbidden.
- [ ] **P0.3: Blindar el Parser de Propiedades contra SSRF por Redirección HTTP (`SEC-SSRF-01`)**  
  *Acción:* Implementar `safeFetchHtml` con `redirect: 'manual'` y revalidación recursiva de IP contra `assertUrlAllowed` en `lib/claude/propertyMatch.ts` para sellar el vector de exfiltración de cloud metadata (AWS/GCP/Vercel) y servicios de red interna.

---

## FASE 2: PRIORIDAD P1 — INTEGRIDAD LÓGICA, RENDIMIENTO Y VALIDACIÓN (DÍAS 2 A 3)

- [ ] **P1.1: Corregir Desfase Horario de Recordatorios de Correo (`BUG-TIMEZONE-01`)**  
  *Acción:* Reemplazar `parseISO` por `parse(fu.scheduled_date, 'yyyy-MM-dd', new Date())` en `app/api/send-followup-email/route.ts` y `app/api/cron/send-daily-followups/route.ts` para erradicar el desfase de -1 día en clientes en zonas horarias AST / EDT.
- [ ] **P1.2: Refactorizar `POST /api/bulk-email` a Envío por Lotes (`PERF-API-01`)**  
  *Acción:* Migrar de bucle secuencial a la API de batch de Resend (`resend.batch.send`) e inserción masiva en `client_history`, reduciendo el tiempo de ejecución de ~40s a <1.5s y evitando el error `504 Gateway Timeout` en Vercel Serverless.
- [ ] **P1.3: Agregar Validación Server-Side con Zod en Server Actions (`SEC-ACTION-01`)**  
  *Acción:* Validar argumentos de `createClientAction` y `updateClientAction` en `app/actions/clients.ts` con el esquema Zod para blindar los endpoints públicos de mutación contra payloads manipulados o números negativos.
- [ ] **P1.4: Consolidar el Archivo Maestro `supabase/schema.sql` (`SCHEMA-DRIFT-01`)**  
  *Acción:* Reemplazar `supabase/schema.sql` con el script maestro consolidado que incluye la función RPC `get_dashboard_stats`, restricciones CHECK de presupuestos, unicidad de email, índices y triggers.
- [ ] **P1.5: Añadir Fallback en URL de Redirección de Magic Link (`BUG-ENV-FALLBACK-01`)**  
  *Acción:* Utilizar `window.location.origin` como respaldo si `NEXT_PUBLIC_APP_URL` no está definida en `app/(auth)/login/page.tsx:32`.

---

## FASE 3: PRIORIDAD P2 — ARQUITECTURA, ALMACENAMIENTO Y CONTROL DE TASA (DÍAS 4 A 7)

- [ ] **P2.1: Eliminar Inserción Manual Duplicada en `createClientAction` (`ARCH-AUDIT-01`)**  
  *Acción:* Retirar el bloque `supabase.from('client_history').insert` manual en `app/actions/clients.ts` para permitir que el trigger SQL `trg_audit_clients` gestione la auditoría sin duplicar entradas.
- [ ] **P2.2: Implementar Borrado Físico de Archivos en `deleteDocumentAction` (`STORAGE-LEAK-01`)**  
  *Acción:* Obtener la ruta `file_url` antes de eliminar el registro en PostgreSQL e invocar `supabase.storage.from('documents').remove([doc.file_url])` para evitar acumulación de binarios huérfanos.
- [ ] **P2.3: Centralizar Mutaciones en Server Actions (`ARCH-MUTATION-01`)**  
  *Acción:* Crear Server Actions para operaciones de Pipeline (`moveTo`), Follow-ups (`create`, `complete`, `delete`), Templates y Profile, estandarizando la capa de mutación y facilitando `revalidatePath`.
- [ ] **P2.4: Migrar `middleware.ts` a `proxy.ts` (`ARCH-PROXY-01`)**  
  *Acción:* Renombrar `middleware.ts` a `proxy.ts` de acuerdo con la convención estándar de Next.js 16 para eliminar advertencias de compilación.
- [ ] **P2.5: Calibrar Detección de Fechas en Dashboard (`PERF-TIMEZONE-01`)**  
  *Acción:* Ajustar el cálculo de `today` en `app/(app)/dashboard/page.tsx` considerando el huso horario local del agente (UTC-4) para evitar que las estadísticas muestren el día siguiente durante las horas de la noche.
- [ ] **P2.6: Rate Limiting Distribuido y Cobertura Completa (`SEC-RATELIMIT-01`, `SEC-RATELIMIT-02`)**  
  *Acción:* Reemplazar el `Map` en memoria local por Redis distribuido (ej. Upstash) y aplicar rate limiting a `POST /api/send-followup-email`.
- [ ] **P2.7: Optimización de Consulta en Pipeline Kanban (`PERF-PIPELINE-01`)**  
  *Acción:* Filtrar por clientes activos o agregar límite/virtualización en `app/(app)/pipeline/page.tsx` para prevenir degradación de memoria y ancho de banda al escalar la base de datos.

---

## FASE 4: PRIORIDAD P3 — CALIDAD DE CÓDIGO, LIMPIEZA Y QA (SEMANA 2)

- [ ] **P3.1: Eliminar Código Muerto y Archivos Residuales (`DEAD-CODE-01`, `DEAD-TYPES-01`)**  
  *Acción:* Borrar `components/clients/ClientList.tsx`, `components/ui/select.tsx`, `components/ui/skeleton.tsx`, `ruvector.db` y podar tipos TypeScript no utilizados en `types/*.ts`.
- [ ] **P3.2: Optimizar `ClientForm.tsx` para React 19 Compiler (`LINT-COMPILER-01`)**  
  *Acción:* Mover `const saleType = watch('sale_type')` fuera de `.map()` para restaurar la optimización del compilador de React.
- [ ] **P3.3: Limpieza de Campos en Formulario de Clientes (`BUG-UX-CLEANUP-01`)**  
  *Acción:* Forzar valores nulos en campos exclusivos de comprador cuando el cliente se guarda como "Seller".
- [ ] **P3.4: Limpieza de Cabecera CSP y Residuos de Claude (`DEBT-CSP-CLEANUP`)**  
  *Acción:* Eliminar `https://api.anthropic.com` de `next.config.ts`, purgar variables en `.env.example` y renombrar `lib/claude/` a `lib/matching/`.
- [ ] **P3.5: Corregir Configuración de ESLint (`LINT-ESLINT-01`)**  
  *Acción:* Añadir `"landing/**"` a `globalIgnores` en `eslint.config.mjs` para restaurar el paso exitoso de `npm run lint`.
- [ ] **P3.6: Sanitización contra Inyección CRLF en Correos (`SEC-CRLF-01`)**  
  *Acción:* Limpiar caracteres de retorno de carro y salto de línea (`\r`, `\n`) en `clientName` y `subject` en los módulos de Resend.
- [ ] **P3.7: Implementar Suite de Pruebas Automatizadas (`TEST-MISSING-01`)**  
  *Acción:* Instalar y configurar Vitest o Jest en `package.json`, creando pruebas para el parser de propiedades, la lógica de matching y la validación de schemas.
