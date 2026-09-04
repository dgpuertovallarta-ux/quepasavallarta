# Qué Pasa Vallarta — Next.js (MVP de producción)

Este es el proyecto real de producción: **Next.js 16 (App Router) + React 19 + TypeScript +
Tailwind CSS 4**, tal como pide el brief original. Es la evolución del prototipo estático en
`/../assets` (la carpeta padre de este directorio) — mismo diseño, mismo contenido demo, ahora
como una aplicación real con SSG, rutas dinámicas y build de producción verificado.

Ver también la documentación general del proyecto en [`/../docs`](../docs) (arquitectura, base
de datos, automatización n8n, roles, monetización, guía del dueño, roadmap).

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) (o el puerto que uses).

Build de producción (ya verificado en este proyecto):

```bash
npm run build
npm run start
```

## Qué incluye

- Todas las secciones del MVP: Home, Vallarta Ahora, Vallarta Explica, Vive Vallarta (Agenda),
  Vallarta Guía, Vallarta Conecta, Mi Vallarta, Pregúntale a Vallarta, Buscador, Alertas y un Panel
  editorial de referencia (solo lectura).
- Contenido **100% demo**, marcado explícitamente como tal en la interfaz — ver
  [`src/lib/data.ts`](src/lib/data.ts).
- Diseño oscuro por defecto con fotografía real de Puerto Vallarta (Wikimedia Commons, uso
  libre) en hero, tarjetas y banners — ver [`src/lib/photos.ts`](src/lib/photos.ts) y
  [`/../docs/PHOTO_ATTRIBUTIONS.md`](../docs/PHOTO_ATTRIBUTIONS.md) antes de producción real.
- Páginas de contenido (noticia, categoría, explica, agenda, guía, zona) pre-renderizadas como
  HTML estático en build (`generateStaticParams`) para SEO y Core Web Vitals.
- Intro de marca con `sessionStorage`, `prefers-reduced-motion` y botón de saltar.
- Modo claro/oscuro sin parpadeo (inline script antes del primer pintado, patrón recomendado por
  Next.js 16 — ver `src/components/ThemeInitScript.tsx`).
- Filtros de Agenda/Guía y zonas de Mi Vallarta implementados vía `searchParams`/rutas dinámicas
  (sin JavaScript de cliente extra, siguiendo el patrón recomendado de Next.js).

## Qué falta para producción real

Ver [`/../docs/ROADMAP.md`](../docs/ROADMAP.md) y [`/../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
En resumen: conectar WordPress como CMS headless, n8n para automatización, una base de datos real
(esquema ya definido en [`/../docs/DATABASE_SCHEMA.sql`](../docs/DATABASE_SCHEMA.sql)), y las
integraciones externas (clima, tránsito, aeropuerto, IA) que hoy son placeholders explícitamente
marcados como "Demo".

## Notas técnicas — Next.js 16

Este proyecto usa Next.js 16, que introdujo varios cambios importantes respecto a versiones
anteriores (Turbopack por defecto, `params`/`searchParams` asíncronos, etc.). Antes de modificar
rutas o componentes, revisa `node_modules/next/dist/docs/` (la documentación viene empaquetada
localmente) o `AGENTS.md` en la raíz de este proyecto.
