# Webmaster Skill — Desarrollo e iteración del dashboard Astro

> Arquitectura, flujo de datos, patrones y reglas para añadir, modificar o depurar
> el dashboard web de la bóveda. No es narrativa: es la app que sirve los datos.

---

## 0. Catálogo de componentes

Antes de crear uno nuevo, revisar esta tabla.

| Componente | Cuándo usarlo | Ejemplo |
|---|---|---|
| `Input.astro` | Cualquier `<input>` (buscador, filtro, login) | `<Input type="text" placeholder="..." />` |
| `FilterInput.astro` | Filtrar lista de cards/filas por `data-term` | `<FilterInput placeholder="..." target=".card" />` |
| `BackLink.astro` | Enlace «← Volver a» en fichas detalle | `<BackLink href="/dashboard/historia" label="Volver a historia" />` |
| `MdContent.astro` | Renderizar markdown de una ficha | `<MdContent content={entity.content} slugMap={map} />` |
| `Tag.astro` | Etiqueta de categoría con `color-mix()` | `<Tag text="Sangre pura" color="#7a5ea8" />` |
| `Card.astro` | Contenedor clickeable con hover unificado | `<Card href="/..." dataTerm="filtro"><slot /></Card>` |

---

## 1. Arquitectura general

```
Vault (.md, .json)           ← El usuario edita en Obsidian
        │
        ▼ push a GitHub → Vercel build
        │
┌───────┴────────┐
│  prebuild       │  scripts/generate-vault-data.mjs
│  Lee la bóveda  │  → src/data/vault.json
└───────┬────────┘
        ▼
┌───────┴────────┐
│  build (Astro)  │  astro build
│  Bundlea JSON   │  → dist/ + .vercel/output/
└───────┬────────┘
        ▼
┌───────┴────────┐
│  SSR runtime    │  @astrojs/vercel serverless
│  vault.ts       │  importa vault.json → getters
│  markdown.ts    │  marked + wiki links
│  Páginas .astro │  renderMd() + md-content
└────────────────┘
```

**Regla de oro**: todo dato visible viene de la bóveda o de `vault.json`. Nada hardcodeado en páginas.

---

## 2. Archivos clave

| Archivo | Rol |
|---|---|
| `scripts/generate-vault-data.mjs` | Parsea toda la bóveda → `src/data/vault.json` |
| `src/data/vault.json` | JSON intermedio, commiteado para dev |
| `src/lib/vault.ts` | Tipos + getters tipados desde vault.json |
| `src/lib/markdown.ts` | `renderMd()`, `buildSlugMap()` |
| `src/lib/auth.ts` | HMAC token, credenciales desde env (`AUTH_USER` / `AUTH_PASS`) |
| `src/middleware.ts` | Protege todo bajo cookie `auth_token` |
| `src/layouts/Dashboard.astro` | Layout con nav + `.md-content` global |
| `src/layouts/Base.astro` | Layout mínimo (login) |
| `src/components/BackLink.astro` | Enlace «← Volver a X» reutilizable |
| `src/components/MdContent.astro` | Wrapper de contenido markdown renderizado |
| `src/components/FilterInput.astro` | Input de filtro por `data-term` con JS inline |
| `astro.config.mjs` | SSR + `@astrojs/vercel` + `security.checkOrigin: false` |
| `vercel.json` | `npm ci` → `npm run build` → `dist/` |
| `package.json` | `predev`/`prebuild` ejecutan el generador |

---

## 3. Añadir una sección nueva al dashboard

Ejemplo: añadir «Eventos» desde `Referencias/Eventos.md`.

### 2.1 Generador (`scripts/generate-vault-data.mjs`)

1. Añadir función `getEventos()` que lea y parsee el archivo:
```js
function getEventos() {
  const fp = path.join(ROOT, "Referencias/Eventos.md");
  // ... parsear y devolver array/objeto
}
```
2. Llamarla en `// ── Main ──`:
```js
const eventos = getEventos();
```
3. Añadir al objeto `data`:
```js
eventos,
```

### 2.2 Tipos (`src/lib/vault.ts`)

1. Añadir interfaz:
```ts
export interface Evento { name: string; desc: string; }
```
2. Añadir getter:
```ts
export function getEventos(): Evento[] { return data.eventos as Evento[]; }
```

### 2.3 Página (`src/pages/dashboard/eventos.astro`)

```astro
---
import Dashboard from "../layouts/Dashboard.astro";
import { getEventos } from "../lib/vault";
const eventos = getEventos();
---
<Dashboard title="Eventos" section="eventos">
  <h2>Eventos</h2>
  <!-- renderizar -->
</Dashboard>
```

### 2.4 Nav (`src/layouts/Dashboard.astro`)

Añadir entrada al array `sections`:
```js
{ id: "eventos", label: "Eventos", href: "/dashboard/eventos" },
```

### 2.5 Regenerar

```bash
node scripts/generate-vault-data.mjs && npm run build
```

---

## 4. Añadir una ficha detalle (página [slug])

Cuando una sección tiene cards y necesitan ficha individual:
- La card usa `onclick={`location.href='...'`}` (NUNCA `<a>` envolvente con markdown dentro)
- La página `[slug].astro` importa `getXxxBySlug()` de vault.ts
- El contenido se envuelve en `<div class="md-content" set:html={renderMd(content, buildSlugMap())} />`
- El generador debe incluir un campo `content` con el texto completo del `.md` (tras el H1)

---

## 5. Añadir un campo nuevo a las fichas existentes

Ejemplo: añadir `combate` a personajes.

### 4.1 Generador

En `getCharacters()`, parsear la nueva sección `## Combate` del markdown y añadir al objeto.

Si es un **metadato** (`> **Clave:** Valor` en la cabecera del `.md`), se añade automáticamente a `properties`. Solo hay que filtrarlo en `personajes.astro` si no debe mostrarse como tag (ej: `Rol`, `Resumen`).

### 4.2 Tipo (`vault.ts`)

Añadir al interface `Character` si es un campo nuevo. Si es parte de `properties`, no hace falta.

---

## 6. Patrones de UI

### Cards clickeables
```astro
import Card from "../../components/Card.astro";
<Card href={`/dashboard/seccion/${item.slug}`} dataTerm={item.name.toLowerCase()}>
  <h3>{item.name}</h3>
  <p>{item.desc}</p>
</Card>
```
`Card.astro` aporta hover, transición, fondo y borde unificados. El contenido se pasa por `<slot>`.

### Tags de propiedad
```astro
import Tag from "../../components/Tag.astro";
<Tag text="Reino" color="#7a5ea8" />
```
El color se pasa como variable CSS. `Tag.astro` usa `color-mix()` para generar fondo (13%) y borde (25%) automáticamente desde el color. Funciona en ambos temas.

Las propiedades de personaje se generan automáticamente desde metadatos `> **Clave:** Valor` en los `.md`. En la página se mapean con `propColors` y se filtran las que no deben ser tags (`Rol`, `Resumen`).

### Contenido markdown
```astro
import MdContent from "../../components/MdContent.astro";
import { buildSlugMap } from "../../lib/markdown";

<!-- Con slugMap explícito: -->
<MdContent content={entity.content} slugMap={buildSlugMap()} />

<!-- Sin slugMap (lo construye el componente): -->
<MdContent content={trama.content} />
```
El componente `MdContent` envuelve el HTML renderizado en `<div class="md-content">` y aplica `renderMd()` internamente. La clase `.md-content` trae todos los estilos desde `Dashboard.astro` con `<style is:global>`.

### Back links
```astro
import BackLink from "../../components/BackLink.astro";
<BackLink href="/dashboard/historia" label="Volver a historia" />
```
Usar SIEMPRE este componente en fichas detalle — no duplicar el `<a class="back">`.

### Filtros de lista
```astro
import FilterInput from "../../components/FilterInput.astro";
<FilterInput placeholder="Filtrar..." target=".card" />
```
El componente busca elementos por el selector `target` y los filtra según su `data-term`. Hay que añadir `data-term={item.name.toLowerCase()}` a cada card/fila filterable.

### Tablas de datos (no markdown)
Para tablas como Léxico o Foreshadowing (datos estructurados, no contenido):
- CSS propio en la página (`.lex-table`, `.fs-table`)
- NO usar `.md-content`

---

## 7. Wikilinks

### Cómo funcionan
1. `renderMd()` reemplaza `[[target|display]]` → `<a href="...">display</a>`
2. Si el target contiene `Mundo/XXX/`, se usa la categoría para desambiguar (historia vs lugares vs personajes)
3. Si no, se busca por slug limpio en `buildSlugMap()`
4. `buildSlugMap()` incluye aliases: para nombres compuestos con espacios funciona directamente

### Debug de wikilinks rotos
- Verificar que el target existe como entidad/personaje/lugar en el slugMap
- Si es un nombre compuesto con `/`, el alias lo cubre
- Si el wikilink usa `\|` escapado (en tablas), `renderMd()` lo normaliza
- Si hay colisión (mismo nombre en historia y lugares), usar ruta completa: `[[Mundo/Historia/X]]`

---

## 8. Estilos

### Tema (`public/styles/theme.css`)
Archivo único con todas las variables CSS para dark y light. Cargado desde `Base.astro` vía `<link>`.

**Regla de oro**: NUNCA usar un color hexadecimal en una página. Siempre `var(--heading)`, `var(--text2)`, etc. Si necesitas un color nuevo, se añade al tema.

### Paleta

| Variable | Dark | Light | Uso |
|---|---|---|---|
| `--bg` | `#0d0d12` | `#ebebee` | Fondo de página |
| `--surface` | `#16161f` | `#f9f9fb` | Cards, bloques |
| `--surface2` | `#1e1e2a` | `#eeeeef` | Inputs, filas tabla |
| `--border` | `#2a2a3a` | `#d4d4da` | Bordes |
| `--text` | `#c8c8d4` | `#1a1a28` | Texto cuerpo |
| `--text2` | `#8888a0` | `#5a5a6e` | Texto secundario |
| `--heading` | `#eee` | `#111` | Títulos, tags |
| `--heading-inv` | `#0d0d12` | `#f9f9fb` | Texto sobre acento |
| `--accent` | `#c8a96e` | `#8b6500` | Oro, enlaces |
| `--accent2` | `#7a5ea8` | `#482d70` | Púrpura |
| `--danger` | `#e34a4a` | `#b33028` | Rojo, logout |
| `--warn` | `#e0a040` | `#8b6500` | Amarillo |
| `--ok` | `#4ac08a` | `#22703a` | Verde |
| `--logout` | `#c07070` | `#a05050` | Botón salir |
| `--font` | Inter | Inter | Tipografía |

### Tamaños de fuente

| Variable | Valor | Uso |
|---|---|---|
| `--fs-h1` | `1.8rem` | Título del header |
| `--fs-h2` | `1.3rem` | Título de sección |
| `--fs-h2d` | `1.4rem` | Título de ficha detalle |
| `--fs-h3` | `1.1rem` | Subtítulo, título de card |
| `--fs-h4` | `.95rem` | Título de entidad |
| `--fs-body` | `.88rem` | Texto de cuerpo (`line-height: 1.7`) |
| `--fs-small` | `.82rem` | Texto secundario |
| `--fs-xs` | `.75rem` | Meta, nota al pie |
| `--fs-card` | `.78rem` | Texto dentro de cards |
| `--fs-tag` | `.7rem` | Tags de categoría |
| `--fs-label` | `.75rem` | Labels de stat |

**Regla**: TODOS los `font-size` usan variables. Si necesitas un tamaño nuevo, lo añades aquí.

El toggle ☀️/🌙 en el nav aplica `data-theme="light"` al `<html>`, persistido en `localStorage`.

### Convenciones
- `.md-content` en `Dashboard.astro` con `<style is:global>` — estilos de contenido renderizado
- NO duplicar estilos de contenido en páginas individuales
- Cards: `cursor: pointer`, hover → `border-color: var(--accent)` + `transform: translateY(-2px)`
- Back link: componente `BackLink.astro`
- Responsive: `@media(max-width:640px)` → grid 1 columna, padding reducido

---

## 9. Flujo de deploy

1. Push a `main` → Vercel detecta el repo (auto-deploy)
2. `npm ci` → `npm run build` (que ejecuta `prebuild` antes)
3. `prebuild` → `scripts/generate-vault-data.mjs` regenera `src/data/vault.json`
4. `astro build` → bundlea vault.json en la serverless function
5. Deploy a Vercel SSR

**Sin GitHub Actions** — Vercel conectado directamente al repo.

---

## 10. Auth y seguridad

- Cookie `auth_token`, HMAC-SHA256, httpOnly, secure, sameSite: lax, 1 año
- Middleware protege todas las rutas salvo `/login`
- Credenciales: desde variables de entorno `AUTH_USER` / `AUTH_PASS` (ver `src/lib/auth.ts`)
- `/logout` borra la cookie y redirige a `/login`
- `astro.config.mjs`: `security: { checkOrigin: false }` para POST en Vercel

---

## 11. Debug común

| Síntoma | Causa probable | Fix |
|---|---|---|
| Sección vacía | El generador no parseó el archivo | Ver `vault.json` generado, comprobar regex |
| Wikilinks no clickeables | Falta `buildSlugMap()` en la página | Añadir `const slugMap = buildSlugMap()` |
| Tabla descuadrada | Falta `.md-content` o `is:global` | Usar `<div class="md-content" set:html={...} />` |
| Cards con texto cortado | `\|` escapado en tabla rompe `split()` | Usar `splitTable(line)` del generador |
| Estilos no aplican | Scoping de Astro los bloquea | Usar `<style is:global>` en layout |
| Anchor nesting | `<a>` envuelve markdown con links | Cambiar a `<div onclick={...}>` |
| Error CSRF en login | Astro bloquea POST cross-origin | `security: { checkOrigin: false }` en config |
