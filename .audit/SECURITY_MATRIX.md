# MATRIZ DE RIESGO Y SEGURIDAD — REALLY-CRM
**Fecha de Evaluación:** 24 de Septiembre de 2026  
**Alcance:** Código Fuente Completo — Seguridad, Bugs, Arquitectura, Rendimiento, Código Muerto y Esquema  
**Total de Hallazgos:** 25 (🔴 1 CRITICAL, 🟠 6 HIGH, 🟡 9 MEDIUM, 🟢 9 LOW)

| ID | Hallazgo | Severidad Real | Capa Afectada | Vector / Causa Raíz | Estado |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **SEC-SCHEMA-01** | Bloqueo fatal de nuevos usuarios por falta de trigger `profiles` tras registro Auth | 🔴 **CRITICAL** | Auth / PostgreSQL | Foreign key `clients.realtor_id -> profiles.id` sin trigger en `schema.sql` (mitigado en migración CLI `20260920`, pendiente en base) | Parcial / Drift Activo |
| **SEC-SSRF-01** | SSRF Bypass mediante HTTP Redirects (301/302) en parser de propiedades | 🟠 **HIGH** | Red / Node.js Runtime | `fetch` sigue redirecciones por defecto hacia `169.254.169.254` o `localhost`, exfiltrando datos en `rawDescription` | Pendiente |
| **BUG-RLS-01** | Falta de política RLS `FOR UPDATE` en `storage.objects` rompe `upsert: true` | 🟠 **HIGH** | Storage / RLS | `uploadFile` con `upsert: true` rechaza sobreescritura de fotos de perfil y documentos con error 403 | Pendiente |
| **BUG-TIMEZONE-01** | Desfase de -1 día en correos de seguimiento por `parseISO` en strings date-only | 🟠 **HIGH** | Lógica / APIs / Cron | `parseISO` en strings date-only asume medianoche UTC, generando desfase en husos horarios occidentales (UTC-4/5) | Pendiente |
| **PERF-API-01** | Cuello de botella secuencial y riesgo de Timeout 504 en bulk email | 🟠 **HIGH** | Rendimiento / Backend | Envío secuencial en bucle `for...of` supera los límites serverless de Vercel (10s/15s) para lotes grandes | Pendiente |
| **SCHEMA-DRIFT-01** | Función RPC `get_dashboard_stats`, restricciones CHECK e índices omitidos en `schema.sql` | 🟠 **HIGH** | Base de Datos | `schema.sql` base desincronizado de la migración de remediación; rompe `/dashboard` en DBs nuevas | Pendiente |
| **SEC-ACTION-01** | Falta de validación Zod server-side en Server Actions | 🟠 **HIGH** | Seguridad / Backend | `createClientAction` y `updateClientAction` reciben inputs sin parsear Zod en el servidor | Pendiente |
| **SEC-RATELIMIT-01** | Rate limiter volátil en memoria `Map` inefectivo en serverless y con fuga de memoria | 🟡 **MEDIUM** | Seguridad / Infra | `Map` en memoria local se reinicia entre cold starts de Vercel y no expira llaves inactivas | Pendiente |
| **SEC-RATELIMIT-02** | Ausencia total de rate limiting en `POST /api/send-followup-email` | 🟡 **MEDIUM** | Seguridad / Abuso | Endpoint de envío manual de correo no implementa control de tasa, permitiendo saturación de cuota | Pendiente |
| **BUG-ENV-FALLBACK-01** | Fallo en Magic Link / Login por falta de fallback en `NEXT_PUBLIC_APP_URL` | 🟡 **MEDIUM** | Auth / Frontend | `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` evalúa a `"undefined/auth/callback"` si falta env var | Pendiente |
| **STORAGE-LEAK-01** | Fuga de archivos binarios huérfanos en Supabase Storage al borrar documentos | 🟡 **MEDIUM** | Almacenamiento | `deleteDocumentAction` elimina fila en DB pero no invoca `supabase.storage.remove()` | Pendiente |
| **ARCH-AUDIT-01** | Eventos duplicados en `client_history` al crear cliente | 🟡 **MEDIUM** | Arquitectura / Datos | Inserción concurrente en `createClientAction` y trigger de DB `trg_audit_clients` | Pendiente |
| **ARCH-MUTATION-01** | Disparidad de mutaciones (Server Actions vs Browser SDK) | 🟡 **MEDIUM** | Arquitectura Frontend | Falta de estandarización en operaciones de escritura (mezcla Server Actions con client SDK) | Pendiente |
| **ARCH-PROXY-01** | Convención `middleware.ts` deprecada en Next.js 16 | 🟡 **MEDIUM** | Framework Next.js | Next.js 16 emite advertencias de deprecación; requiere migración a `proxy.ts` | Pendiente |
| **PERF-TIMEZONE-01** | Desfase de fecha servidor en Dashboard Server Component | 🟡 **MEDIUM** | Rendimiento / Lógica | `today` en UTC genera discrepancias nocturnas (después de 8pm) para agentes en Puerto Rico (UTC-4) | Pendiente |
| **PERF-PIPELINE-01** | Carga masiva sin límite ni paginación en Tablero Kanban | 🟡 **MEDIUM** | Rendimiento / Escalabilidad | `select('*')` sin paginación en `/pipeline` satura el DOM y ancho de banda al escalar clientes | Pendiente |
| **DEAD-CODE-01** | Código muerto y archivos huérfanos (`ClientList.tsx`, `ruvector.db`, UI select/skeleton) | 🟢 **LOW** | Mantenibilidad | Componentes y archivos no referenciados en el bundle de la aplicación | Pendiente |
| **DEAD-TYPES-01** | Tipos exportados sin uso en el proyecto (`ClientInsert`, `ProfileUpsert`, etc.) | 🟢 **LOW** | Tipos / Código | Múltiples tipos TypeScript declarados en `types/*.ts` sin consumidores | Pendiente |
| **LINT-COMPILER-01** | Invocación de `watch` dentro de `.map()` en `ClientForm.tsx:259` | 🟢 **LOW** | Calidad / Compilador | Deshabilita optimización automática de React 19 Compiler (`react-hooks/incompatible-library`) | Pendiente |
| **BUG-UX-CLEANUP-01**| Persistencia accidental de presupuesto y preferencias al cambiar a Seller | 🟢 **LOW** | UX / Lógica | Valores de comprador ocultos en UI se mantienen en form state y se persisten en DB | Pendiente |
| **DEBT-CSP-CLEANUP** | Directiva CSP obsoleta de Anthropic y residuo de variables de entorno | 🟢 **LOW** | Configuración Web | Dominio externo innecesario en `connect-src` (`api.anthropic.com`) y carpeta `lib/claude` | Pendiente |
| **LINT-ESLINT-01** | ESLint analiza archivos autogenerados de Astro en `landing/.astro` | 🟢 **LOW** | Calidad / Build | `landing/**` omitido en `globalIgnores` de `eslint.config.mjs`, provocando 6 errores de lint | Pendiente |
| **SEC-CRLF-01** | Asunto de correo interpolado sin sanitización contra inyección CRLF | 🟢 **LOW** | Seguridad / Email | `clientName` y `subject` se envían a Resend sin purgar `\r` ni `\n` | Pendiente |
| **BUG-PAGINATION-01** | Pérdida de selección múltiple al paginar en `SelectableClientList.tsx` | 🟢 **LOW** | UX / Estado | Estado de selección vive en memoria local del componente de página actual, perdiéndose al navegar | Pendiente |
| **TEST-MISSING-01** | Script `npm test` ausente a pesar de estar documentado en `AGENTS.md` | 🟢 **LOW** | QA / DevOps | `npm test` falla por `Missing script: "test"`; 0 pruebas automatizadas en el repositorio | Pendiente |
