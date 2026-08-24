# Reporte de Auditoría: Arquitectura, Rendimiento y Código Muerto (Architecture, Performance & Dead Code)
**Repositorio Auditado:** Really-CRM ([`Really-CRM`](file:///Users/eduardotorres/Developer/Really-CRM))  
**Fecha de Evaluación:** 20 de Agosto, 2026  
**Alcance:** Arquitectura de componentes, patrones Next.js 16 App Router, cuellos de botella de rendimiento, estado en cliente, código huérfano y configuración de herramientas.  

---

## 1. Resumen Ejecutivo de Arquitectura y Rendimiento

Really-CRM presenta una estructura basada en Next.js 16 con separación de rutas autenticadas `app/(app)` y públicas `app/(auth)`. El diseño visual utiliza Tailwind CSS y componentes de UI basados en `@base-ui/react`.

No obstante, se evidencian **problemas arquitectónicos de acoplamiento directo entre la interfaz y la base de datos**, **cascadas de consultas HTTP múltiples en el Dashboard**, **falta de paginación en listados grandes**, **importaciones dinámicas no cacheadas en controladores de eventos**, y **artefactos muertos que aumentan el peso del repositorio**.

---

## 2. Matriz de Hallazgos

| ID | Categoría | Título del Hallazgo | Severidad | Ubicación en Código |
| :--- | :--- | :--- | :---: | :--- |
| **ARCH-01** | Arquitectura | Acoplamiento Directo UI-Base de Datos sin Capa de Servicios | 🔴 **HIGH** | Múltiples componentes `components/**/*.tsx` |
| **PERF-01** | Rendimiento | Cascada de 6 Consultas HTTP en Carga del Dashboard | 🔴 **HIGH** | [`app/(app)/dashboard/page.tsx:26-33`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L26-L33) |
| **PERF-02** | Rendimiento | Ausencia de Paginación en Listado de Clientes | 🔴 **HIGH** | [`app/(app)/clients/page.tsx:48-64`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L48-L64) |
| **PERF-03** | Rendimiento | Carga Eager Innecesaria de Todas las Pestañas de Cliente | 🟡 **MEDIUM** | [`app/(app)/clients/[id]/page.tsx:29-34`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L29-L34) |
| **PERF-04** | Rendimiento | Consultas Duplicadas en Montaje de TemplatePicker | 🟢 **LOW** | [`components/templates/TemplatePicker.tsx:32-50`](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatePicker.tsx#L32-L50) |
| **ARCH-02** | Arquitectura | Verificación Duplicada de Sesión en Cada Página Server | 🟡 **MEDIUM** | Múltiples `app/(app)/**/page.tsx` |
| **ARCH-03** | Arquitectura | Nomenclatura Obsoleta en Módulo Local de Matching | 🟡 **MEDIUM** | [`lib/claude/propertyMatch.ts`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts) |
| **ARCH-04** | Rendimiento | Importación Dinámica `import()` en Event Handlers | 🟡 **MEDIUM** | [`components/clients/tabs/FollowUpsTab.tsx:62`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/FollowUpsTab.tsx#L62) |
| **DEAD-01** | Código Muerto | Componente Legado Huérfano (`ClientList.tsx`) | 🟡 **MEDIUM** | [`components/clients/ClientList.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx) |
| **DEAD-02** | Código Muerto | Base de Datos Binaria SQLite Huérfana (`ruvector.db` - 1.58 MB) | 🟡 **MEDIUM** | [`ruvector.db`](file:///Users/eduardotorres/Developer/Really-CRM/ruvector.db) |
| **DEAD-03** | Configuración | Brecha de Alcance ESLint para Artefactos de `landing/` | 🟢 **LOW** | [`eslint.config.mjs:9-15`](file:///Users/eduardotorres/Developer/Really-CRM/eslint.config.mjs#L9-L15) |
| **DEAD-04** | Calidad Código | Variable No Utilizada `_score` en Algoritmo de Matching | 🟢 **LOW** | [`lib/claude/propertyMatch.ts:250`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L250) |

---

## 3. Análisis Detallado de Arquitectura

### ARCH-01: Acoplamiento Directo UI-Base de Datos sin Capa de Servicios
- **Severidad:** 🔴 **HIGH**
- **Ubicaciones:**
  - [`components/clients/ClientForm.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientForm.tsx)
  - [`components/documents/DocumentCard.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/documents/DocumentCard.tsx)
  - [`components/follow-ups/FollowUpCard.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/follow-ups/FollowUpCard.tsx)
  - [`components/pipeline/PipelineBoard.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/pipeline/PipelineBoard.tsx)
  - [`components/profile/ProfileForm.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/profile/ProfileForm.tsx)
  - [`components/templates/TemplatesManager.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatesManager.tsx)
- **Problema:**  
  Los componentes cliente importan directamente `@/lib/supabase/client` y ejecutan consultas SQL/PostgREST en línea (`supabase.from('...').insert(...)`, `.update()`, `.delete()`).
- **Consecuencias:**
  1. **Dificultad de Testing:** Es imposible escribir pruebas unitarias de componentes sin mockear llamadas complejas de la librería de Supabase.
  2. **Reglas de Negocio Dispersas:** Si cambia la estructura de una tabla o se requiere validación previa a una mutación, es necesario editar múltiples componentes React en lugar de un único servicio central.
- **Recomendación:**  
  Migrar las mutaciones a Server Actions tipadas de Next.js (ej. `app/actions/clients.ts`, `app/actions/documents.ts`) o a módulos de servicios (`lib/services/`).

---

### ARCH-02: Verificación Duplicada de Sesión en Cada Página Server
- **Severidad:** 🟡 **MEDIUM**
- **Ubicaciones:**  
  [`app/(app)/clients/page.tsx:44`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L44), [`app/(app)/dashboard/page.tsx:13`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L13), [`app/(app)/pipeline/page.tsx:18`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/pipeline/page.tsx#L18), [`app/(app)/profile/page.tsx:18`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/profile/page.tsx#L18), [`app/(app)/templates/page.tsx:17`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/templates/page.tsx#L17), etc.
- **Problema:**  
  Cada Server Component repite manualmente `const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login')`.
- **Recomendación:**  
  Aprovechar la verificación centralizada en [`app/(app)/layout.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/layout.tsx) y en el [`middleware.ts`](file:///Users/eduardotorres/Developer/Really-CRM/middleware.ts), o envolver la llamada de usuario en una utilidad cacheada con `React.cache()`.

---

### ARCH-03: Nomenclatura Obsoleta en Módulo Local de Matching
- **Severidad:** 🟡 **MEDIUM**
- **Ubicación:** [`lib/claude/propertyMatch.ts`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts)
- **Problema:**  
  El motor de coincidencia de propiedades fue reemplazado por un algoritmo heurístico y determinista local sin llamadas a APIs externas de IA. Sin embargo, el directorio sigue llamándose `lib/claude/`, generando confusión en la arquitectura.
- **Recomendación:**  
  Renombrar el archivo a `lib/property-matching/matcher.ts` y actualizar las importaciones en `app/api/property-match/route.ts`.

---

### ARCH-04: Importación Dinámica `import()` en Event Handlers
- **Severidad:** 🟡 **MEDIUM**
- **Ubicaciones:** [`components/clients/tabs/FollowUpsTab.tsx:62`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/FollowUpsTab.tsx#L62) y [`components/clients/tabs/DocumentsTab.tsx:65`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/tabs/DocumentsTab.tsx#L65)
- **Problema:**  
  Dentro de la función `handleSuccess()`:
  ```typescript
  const { createClient } = await import('@/lib/supabase/client')
  ```
  `createClient` ya es una dependencia presente en el bundle principal. Realizar un `import()` dinámico en el callback de evento añade latencia asíncrona innecesaria a la respuesta de la interfaz.
- **Recomendación:**  
  Importar `createClient` de forma estática en la cabecera del archivo.

---

## 4. Análisis Detallado de Rendimiento

### PERF-01: Cascada de 6 Consultas HTTP en Carga del Dashboard
- **Severidad:** 🔴 **HIGH**
- **Ubicación:** [`app/(app)/dashboard/page.tsx:26-33`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/dashboard/page.tsx#L26-L33)
- **Código:**
  ```typescript
  const [
    { count: totalClients },
    { count: activeBuyers },
    { count: activeSellers },
    { count: overdueFollowUps },
    { data: todayFollowUps },
    { data: recentClients },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id).eq('client_type', 'buyer').eq('status', 'active'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id).eq('client_type', 'seller').eq('status', 'active'),
    supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('realtor_id', user.id).eq('completed', false).lt('scheduled_date', today),
    supabase.from('follow_ups').select('id, notes, clients(id, name)').eq('realtor_id', user.id).eq('scheduled_date', today).eq('completed', false).order('created_at', { ascending: true }),
    supabase.from('clients').select('*').eq('realtor_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])
  ```
- **Impacto:**  
  Aunque se ejecutan con `Promise.all`, cada consulta genera una petición HTTP independiente contra el endpoint de PostgREST de Supabase. Esto satura el pool de conexiones y suma latencias de red. Además, `count: 'exact'` fuerza a Postgres a calcular el conteo exacto en cada visita.
- **Recomendación:**  
  Reemplazar los 4 conteos con la función RPC `get_dashboard_stats(user.id, today)` que devuelve todos los totales en una única llamada de base de datos.

---

### PERF-02: Ausencia de Paginación en Listado de Clientes
- **Severidad:** 🔴 **HIGH**
- **Ubicación:** [`app/(app)/clients/page.tsx:48-64`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/page.tsx#L48-L64)
- **Problema:**  
  La consulta descarga todos los registros del agente sin límite (`.select('*')` sin `.range()` o `.limit()`).
- **Impacto:**  
  Para agentes con carteras de más de 500 clientes, la respuesta JSON transferida por red supera varios megabytes, ralentizando el renderizado del servidor y aumentando el consumo de memoria en el navegador.
- **Recomendación:**  
  Implementar paginación mediante cursores o páginas numeradas (`limit: 25`, `.range(from, to)`).

---

### PERF-03: Carga Eager Innecesaria de Todas las Pestañas de Cliente
- **Severidad:** 🟡 **MEDIUM**
- **Ubicación:** [`app/(app)/clients/[id]/page.tsx:29-34`](file:///Users/eduardotorres/Developer/Really-CRM/app/%28app%29/clients/%5Bid%5D/page.tsx#L29-L34)
- **Problema:**  
  Al visitar `/clients/[id]`, se ejecutan en paralelo las consultas de `clients`, `documents`, `follow_ups` y `client_history`, a pesar de que el usuario aterriza únicamente en la pestaña "Info".
- **Recomendación:**  
  Cargar los datos de `documents`, `follow_ups` y `history` de forma perezosa (lazy load) mediante React Server Actions o subrutas paralelas (`/clients/[id]/documents`, `/clients/[id]/history`).

---

### PERF-04: Consultas Duplicadas en Montaje de TemplatePicker
- **Severidad:** 🟢 **LOW**
- **Ubicación:** [`components/templates/TemplatePicker.tsx:32-50`](file:///Users/eduardotorres/Developer/Really-CRM/components/templates/TemplatePicker.tsx#L32-L50)
- **Problema:**  
  Cada instancia del componente `TemplatePicker` ejecuta un `useEffect` para consultar `email_templates` en mount sin ningún tipo de caché compartida entre componentes cliente.
- **Recomendación:**  
  Pasar las plantillas como props desde el Server Component padre o almacenar el resultado en un contexto / SWR / TanStack Query.

---

## 5. Análisis de Código Muerto y Desperdicio (Dead Code)

### DEAD-01: Componente Legado Huérfano (`ClientList.tsx`)
- **Severidad:** 🟡 **MEDIUM**
- **Ubicación:** [`components/clients/ClientList.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/clients/ClientList.tsx)
- **Detalle:**  
  Componente de 128 líneas que fue reemplazado por `SelectableClientList.tsx` (que añade selección múltiple para envíos de correo). No tiene ninguna importación activa en el proyecto.
- **Acción:**  
  Eliminar `components/clients/ClientList.tsx`.

---

### DEAD-02: Base de Datos Binaria SQLite Huérfana (`ruvector.db` - 1.58 MB)
- **Severidad:** 🟡 **MEDIUM**
- **Ubicación:** [`ruvector.db`](file:///Users/eduardotorres/Developer/Really-CRM/ruvector.db)
- **Detalle:**  
  Archivo binario SQLite de 1.58 MB ubicado en la raíz del proyecto. No es referenciado por Next.js ni por Supabase.
- **Acción:**  
  Eliminar `ruvector.db` y verificar que esté en `.gitignore`.

---

### DEAD-03: Brecha de Alcance ESLint para Artefactos de `landing/`
- **Severidad:** 🟢 **LOW**
- **Ubicación:** [`eslint.config.mjs:9-15`](file:///Users/eduardotorres/Developer/Really-CRM/eslint.config.mjs#L9-L15)
- **Detalle:**  
  Al ejecutar `npm run lint`, ESLint analiza tipos autogenerados de Astro dentro de `landing/.astro/`, arrojando 6 errores de TypeScript.
- **Acción:**  
  Agregar `"landing/.astro/**"` y `"landing/dist/**"` a `globalIgnores` en `eslint.config.mjs`.

---

### DEAD-04: Variable No Utilizada `_score` en Algoritmo de Matching
- **Severidad:** 🟢 **LOW**
- **Ubicación:** [`lib/claude/propertyMatch.ts:250`](file:///Users/eduardotorres/Developer/Really-CRM/lib/claude/propertyMatch.ts#L250)
- **Detalle:**  
  `map(({ score: _score, ...rest }) => rest)` genera una advertencia de ESLint (`@typescript-eslint/no-unused-vars`).
- **Acción:**  
  Eliminar la desestructuración no utilizada o renombrar a `({ score: _, ...rest })`.

---

## 6. Nota sobre Dependencias: `@base-ui/react`
En revisiones preliminares se reportó `@base-ui/react` como sospechosa de ser dependencia no utilizada. **Se ha verificado exhaustivamente que SÍ está en uso activo**:
`@base-ui/react` es el paquete base de componentes headless utilizado por los componentes de Shadcn UI en [`components/ui/dialog.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/dialog.tsx), [`button.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/button.tsx), [`select.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/select.tsx), [`popover.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/popover.tsx), [`tabs.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/tabs.tsx) y [`avatar.tsx`](file:///Users/eduardotorres/Developer/Really-CRM/components/ui/avatar.tsx). Por lo tanto, **NO debe ser eliminada**.
