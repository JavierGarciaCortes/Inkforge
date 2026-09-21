# Fiction Vault

Estructura base para arrancar un proyecto de escritura con [opencode](https://opencode.ai).

Compatible con [Obsidian](https://obsidian.md) — todo el contenido creativo son archivos Markdown con wikilinks `[[enlaces]]`. Los capítulos, fichas de personaje, ubicaciones y lore se editan en Obsidian; las tools Python trabajan directamente sobre los `.md`.

El repositorio tiene **tres contextos** separados: contenido creativo (`vault/`), dashboard web (`web/`), y herramientas (`.tools/`, `.fiction/`).

## Qué incluye

- **Obsidian-ready**: bóveda lista para arrastrar a Obsidian. Wikilinks, YAML metadata, todo Markdown.
- **MCP server** con 24 tools: personajes, lore, continuidad, foreshadowing, voz, emociones, escenas, hooks, show/tell, ritmo, arco narrativo, Save the Cat, Chekhov's Gun.
- **Siete agentes especializados**: `writer`, `editor`, `critico`, `lector`, `structurer`, `query`, `webmaster` — cada uno con su skill y herramientas.
- **Dashboard web** (Astro SSR): buscador, fichas de personaje, lugares, historia, léxico, cronología, foreshadowing, Fundamentos.
- **Tools de escritura**: scanner de prosa, carta editorial, insights avanzados, verificador de consistencia, resumen de sesión, publicador EPUB/HTML/PDF, ordenador de léxico.
- **Plantillas**: fichas de personaje, ubicaciones, lore, capítulos, léxico.
- **Memoria entre sesiones**: `.fiction/session_log.json` — decisiones, archivos tocados, preguntas abiertas.
- **Configuración data-driven**: acts, POV, midpoint, todo en `.fiction/config.json`.
- **Fuente única de verdad**: las fichas `.md` en `vault/Mundo/` son el canon. Voz de personaje, arco narrativo, estados — todo en las fichas, no en JSONs externos.

Sin dependencias externas en el lado Python — solo stdlib (3.11+). El dashboard web usa Astro + Node.

## Cómo usar

```bash
git clone https://github.com/quinwacca/fiction-vault.git mi-libro
cd mi-libro
# Abrir con opencode, o arrastrar vault/ a Obsidian
```

**Primera vez en Obsidian**: abre la carpeta `vault/` como bóveda, ve a *Settings → Community plugins → Safe Mode (desactivar)* e instala estos plugins desde la comunidad:

| Plugin | ID | Para qué |
|---|---|---|
| [Typewriter Mode](https://obsidian.md/plugins?search=typewriter-mode) | `typewriter-mode` | Modo máquina de escribir, enfoque en la línea actual |
| [Typographer](https://obsidian.md/plugins?search=typographer) | `typographer` | Comillas latinas «», rayas —, puntos suspensivos … |
| [Reading Time](https://obsidian.md/plugins?search=obsidian-reading-time) | `obsidian-reading-time` | Tiempo de lectura estimado |

Typewriter Mode y Typographer ya vienen preconfigurados.

**Nota sobre archivos de ejemplo**: `vault/Plantillas/ejemplos/` contiene demostraciones de la plantilla, no contenido real. Bórralos cuando empieces tu proyecto.

Los **nombres de archivo de capítulos no llevan número** — el orden y numeración se definen en `vault/Capítulos/manifiesto.json` y en el YAML de cada capítulo (`capítulo: N`). Así puedes insertar, renombrar y reordenar sin romper nada.

## Trabajar con la IA: tu editor de viaje

Esta herramienta no es un chatbot al que le pides cosas sueltas. Es un **editor** que se sienta a tu lado durante todo el proceso de escribir: desde el primer borrador hasta la versión final. Conoce tu manuscrito, entiende tu mundo, y te ayuda a tomar decisiones.

No tienes que explicarle quién es cada personaje ni qué pasó en el capítulo anterior — lo sabe. No tienes que recordar comandos ni flags — se anticipa a lo que necesitas.

### Cómo empieza cada sesión

Abre la bóveda y el editor ya está al día:

- Ejecuta `session_check.py` — ve qué cambió desde la última vez
- Lee `.fiction/session_log.json` — recupera decisiones, preguntas abiertas y contexto de la sesión anterior
- Lee los pendientes — sabe en qué te quedaste
- Consulta el estado del manuscrito — tiene los scores frescos

Y está listo. No hay ritual de puesta al día.

### Qué puedes pedirle

| Quieres… | Le dices… |
|---|---|
| Una foto general de la novela | «Dame la carta editorial» |
| Revisar un capítulo a fondo | «Revisa el capítulo 7, céntrate en diálogo» |
| Saber si hay problemas de ritmo | «¿Cómo va el ritmo? ¿Hay capítulos que lastran?» |
| Verificar que un personaje suena auténtico | «Comprueba la voz del protagonista en el capítulo 5» |
| Detectar telling emocional | «Busca tellings en el capítulo 3» |
| Saber qué hilos dejaste abiertos | «¿Qué foreshadowing queda sin pagar?» |
| Comprobar si dos escenas se contradicen | «Verifica consistencia entre los capítulos 2 y 6» |

No necesitas saber qué tool hay detrás. El editor decide cómo obtener lo que pides.

### Su equipo de especialistas

El editor tiene colegas con enfoques distintos a los que puede llamar según lo que necesites:

- **`@writer`** — para generar prosa, diálogo, descripciones. Le dices el tono y lo que buscas; él escribe. Consulta perfiles de voz y contexto de capítulo antes de escribir.

  > ⚠️ *Advertencia de salud narrativa: el que escribe eres tú. Usa a @writer como un compañero de lluvia de ideas, no como un sustituto. Pídele borradores, versiones alternativas, desbloqueos cuando estés atascado. Pero no dejes que te robe el placer de poner tus propias palabras. Si sientes que ya no escribes tú, estás usando la herramienta al revés. Que sea tu ayudante, no tu relevo.*
- **`@critico`** — ojo de guionista, sin piedad. Busca agujeros, clichés, reglas rotas. Clasifica por gravedad: crítico / significativo / menor.
- **`@lector`** — lee como si no supiera nada del mundo ni de tus intenciones. Ideal para saber si lo que escribiste se entiende por sí solo.
- **`@structurer`** — para problemas de estructura, ritmo, arco narrativo, sistemas de magia. Él diseña; el crítico revisa su diseño.
- **`@query`** — crea cartas editoriales, loglines, sinopsis y comparables para presentar a editoriales o agentes literarios.
- **`@webmaster`** — mantiene y mejora el dashboard web.

Puedes pedir combinaciones: «Pasa el capítulo 7 por @critico y luego por @lector». O dejar que el editor coordine él solo cuando el problema es complejo — llama a los especialistas que hagan falta, les pasa el contexto, recoge sus informes y te devuelve una síntesis.

### Cómo se trabaja con él

```
Tú: Revisa el capítulo 4
→ El editor ejecuta get_chapter_context(4), check_consistency(4),
  check_voice_consistency(4, protagonista), scan_prose()…
  Te devuelve un diagnóstico con problemas encontrados.
Tú: La escena del bosque no termina de funcionar. Pásala por @critico.
→ El editor llama al @critico con el contexto de la escena.
  @critico: señala que el diálogo es demasiado expositivo.
Tú: @writer, reescribe ese fragmento con más subtexto.
→ El editor llama a @writer con las objeciones del crítico.
  @writer: propone una versión más contenida.
Tú: Aplica el cambio.
→ El editor edita el archivo, re-ejecuta scan_prose() para
  confirmar que mejora, actualiza los scores.
  «Aplicado. La densidad de patrones bajó de 1.8 a 0.9 en ese capítulo.»
```

Y si en algún momento sientes que no te entiende, que te da consejos genéricos o que sus análisis no encajan con lo que buscas — **díselo**. No se ofende. Puedes pedirle que ajuste su tono, que sea más o menos crítico, que se centre en lo que a ti te importa. Y también puedes pedirle que **cambie las herramientas**: que suba o baje el umbral de la carta editorial, que añada un patrón nuevo al escáner de prosa, que modifique cómo detecta el telling o que reajuste la longitud objetivo de los capítulos. El que manda eres tú.

## Estructura del repositorio

```
├── vault/                     # 📚 BÓVEDA OBSIDIAN (todo el contenido creativo)
│   ├── Capítulos/             # Capítulos + manifiesto.json (orden narrativo)
│   ├── Mundo/
│   │   ├── Personajes/        # Fichas de personaje (voz, arco, NUNCA diría)
│   │   ├── Lugares/           # Geografía y localizaciones
│   │   └── Historia/          # Lore, facciones, historia del mundo
│   ├── Referencias/
│   │   ├── Fundamentos.md     # Reglas canónicas, cosmología, worldbuilding
│   │   ├── Trama.md           # Decisiones narrativas (fuente única del argumento)
│   │   ├── Outliner.md        # Plan capítulo a capítulo
│   │   ├── Índice.md          # Mapa de navegación rápida
│   │   ├── Léxico.md          # Glosario de términos del mundo
│   │   ├── Pendientes.md      # Tareas y prioridades
│   │   ├── Cronología.md      # Línea temporal
│   │   ├── Foreshadowing.md   # Registro de siembras y pagos
│   │   ├── Estado.md          # Métricas, scores, decisiones pasadas
│   │   └── Guía carta editorial.md  # Cómo presentar a editoriales
│   ├── Estilo/
│   │   ├── Guía general.md    # Reglas universales de ficción en español
│   │   ├── Guía de estilo.md  # Reglas específicas del proyecto
│   │   ├── patrones.json      # Patrones de prosa para el scanner
│   │   ├── Consejos Sanderson.md
│   │   ├── Consejos Stephen King.md
│   │   └── Sanderson vs King.md
│   └── Plantillas/            # Templates para crear contenido
│       ├── capitulo.md
│       ├── personaje.md
│       ├── lugar.md
│       ├── lore.md
│       ├── lexico.md
│       ├── patrones.json
│       ├── config.json
│       └── ejemplos/          # Ejemplos de referencia (no editar)
├── web/                       # 🌐 DASHBOARD ASTRO SSR
│   ├── src/                   # Componentes, layouts, páginas
│   ├── public/                # Estáticos (theme.css)
│   ├── scripts/               # generate-vault-data.mjs
│   ├── astro.config.mjs
│   └── package.json
├── .tools/                    # 🔧 HERRAMIENTAS PYTHON
│   ├── vault.py               # Módulo compartido
│   ├── fiction_mcp.py         # MCP context server
│   ├── prose_scanner.py       # Escáner de patrones de prosa
│   ├── editorial_letter.py    # Carta editorial automatizada
│   ├── editorial_insights.py  # Análisis avanzados
│   ├── consistency_check.py   # Verificador de consistencia
│   ├── session_check.py       # Resumen de cambios entre sesiones
│   ├── publish.py             # Generador EPUB/HTML/PDF
│   ├── new_chapter.py         # Creador de capítulos
│   ├── manifiesto.py          # Lector de manifiesto.json
│   ├── sync_manifiesto.py     # Sincronizador YAML
│   ├── sort_lexico.py         # Ordenador alfabético del léxico
│   └── ruff.toml              # Config de lint
├── .fiction/                  # ⚙️ CONFIG Y ESTADOS
│   ├── config.json            # Config del proyecto
│   └── session_log.json       # Memoria entre sesiones
├── .opencode/
│   ├── skills/                # Skills de los 7 agentes
│   └── package.json
├── Makefile
├── opencode.json
├── AGENTS.md
└── README.md
```

## Dashboard web

El dashboard es una app Astro SSR con protección por contraseña. Muestra:

- **Resumen**: stats del proyecto + buscador global
- **Personajes**: fichas con voz, arco, relaciones
- **Historia**: lore, facciones, entidades del mundo
- **Lugares**: geografía y localizaciones
- **Trama**: premisa, conflicto, temas
- **Fundamentos**: reglas canónicas del mundo
- **Léxico**: glosario de términos
- **Cronología**: línea temporal interactiva
- **Foreshadowing**: ledger de siembras y pagos

Para arrancarlo:

```bash
cd web
npm install
npm run dev        # desarrollo local
npm run build      # build para producción
```

Credenciales por defecto: `admin` / `changeme`. Configurar con variables de entorno:
- `AUTH_USER` — usuario
- `AUTH_PASS` — contraseña
- `AUTH_SECRET` — semilla para el token

El dashboard despliega en Vercel con `astro.config.mjs` y `vercel.json` ya configurados.

## Personalización

1. Editar `.fiction/config.json` — título, autor, acts, POV map
2. Rellenar `vault/Mundo/Personajes/`, `vault/Mundo/Lugares/`, `vault/Mundo/Historia/`
3. Usar `vault/Referencias/Outliner.md` para planificar el manuscrito
4. Configurar reglas de estilo en `vault/Estilo/Guía de estilo.md`
5. Añadir patrones de prosa personalizados en `vault/Estilo/patrones.json`

## Windows

Cambiar `python3` por `python` en `opencode.json`:

```json
"command": ["python", ".tools/fiction_mcp.py"]
```

El resto funciona igual — `pathlib` maneja las rutas automáticamente.

## Tools

### `prose_scanner.py` — Escáner de patrones de prosa

Examina cada párrafo contra una batería de patrones (`vault/Estilo/patrones.json`) y reporta matches agrupados por categoría.

```bash
python .tools/prose_scanner.py                      # resumen global
python .tools/prose_scanner.py --cap 07             # detalle de un capítulo
python .tools/prose_scanner.py --cap 07 --context full  # con párrafos completos
python .tools/prose_scanner.py --json               # salida JSON
python .tools/prose_scanner.py --review             # modo interactivo
python .tools/prose_scanner.py --ritmo              # estadísticas de longitud de frases
python .tools/prose_scanner.py --validate           # detectar overlaps entre patrones
```

### `editorial_letter.py` — Carta editorial automatizada

Genera un informe narrativo completo: estructura, función de escenas, arco emocional, inmersión sensorial, foreshadowing, show vs tell, hooks de apertura/cierre, y un plan de revisión priorizado.

```bash
python .tools/editorial_letter.py                   # carta editorial completa
python .tools/editorial_letter.py --beta            # informe profesional sintético
python .tools/editorial_letter.py --cap 07          # análisis detallado de un capítulo
python .tools/editorial_letter.py --resumen         # solo tabla de prioridades
python .tools/editorial_letter.py --plan            # plan de revisión faseado
python .tools/editorial_letter.py --insights        # análisis avanzados
python .tools/editorial_letter.py --json            # salida JSON
python .tools/editorial_letter.py --compare old/ new/  # diff entre versiones
```

### `editorial_insights.py` — Análisis avanzados

```bash
python .tools/editorial_insights.py                          # todos los módulos
python .tools/editorial_insights.py --module style            # diagnóstico de estilo
python .tools/editorial_insights.py --module dialogue         # calidad de diálogo
python .tools/editorial_insights.py --module save_cat         # beats de Save the Cat
python .tools/editorial_insights.py --module chekhov          # Chekhov's Gun
python .tools/editorial_insights.py --module backstory        # info-dumps de backstory
python .tools/editorial_insights.py --module arc              # arco narrativo (Vonnegut)
python .tools/editorial_insights.py --json                    # salida JSON
```

### `consistency_check.py` — Verificador de consistencia

Compara el lore registrado en `vault/Referencias/Fundamentos.md` y las fichas contra el texto de los capítulos.

```bash
python .tools/consistency_check.py               # verificación global
python .tools/consistency_check.py --cap 07      # solo un capítulo
python .tools/consistency_check.py --json        # salida JSON
```

### `session_check.py` — Resumen de cambios entre sesiones

```bash
python .tools/session_check.py          # diff + scores
python .tools/session_check.py --quick  # solo diff, sin escáner
python .tools/session_check.py --json   # salida JSON
```

### `new_chapter.py` — Creador de capítulos

```bash
python .tools/new_chapter.py "Título del capítulo"      # al final del manuscrito
python .tools/new_chapter.py "Título" -p 5              # insertar después del capítulo 5
python .tools/new_chapter.py "Título" --pov Protagonista  # con POV predefinido
python .tools/new_chapter.py --list                     # listar capítulos
```

### `sync_manifiesto.py` — Sincronización YAML

```bash
python .tools/sync_manifiesto.py          # sincronizar
python .tools/sync_manifiesto.py --dry    # simular sin escribir
```

### `sort_lexico.py` — Ordenar léxico

```bash
python .tools/sort_lexico.py              # ordenar alfabéticamente vault/Referencias/Léxico.md
```

### `publish.py` — Publicación (EPUB / HTML / PDF)

```bash
python .tools/publish.py                         # EPUB → output/
python .tools/publish.py --format all            # EPUB + HTML + PDF
python .tools/publish.py --format html           # solo HTML
python .tools/publish.py --format pdf            # solo PDF (necesita weasyprint)
python .tools/publish.py --beta                  # HTML para beta readers (con nº de línea)
python .tools/publish.py -o ../mi-libro          # ruta de salida personalizada
python .tools/publish.py --title "Mi Libro" --author "Yo"  # metadatos
```

### `fiction_mcp.py` — MCP server (automático)

Provee contexto narrativo al asistente de opencode: perfiles de personaje, ubicaciones, lore, continuidad, foreshadowing, y escaneo de prosa. Se inicia solo — no hay que ejecutarlo manualmente. Registrado en `opencode.json`.

## Comandos rápidos (Makefile)

```bash
make                    # listar todos los targets
make ritual             # chequeo completo del manuscrito
make scan               # prose scanner global
make scan-cap cap=07    # prose scanner de un capítulo
make publish            # EPUB
make publish-all        # EPUB + HTML + PDF
make letter             # carta editorial completa
make letter-cap cap=07  # carta editorial de un capítulo
make insights           # análisis avanzado
make session            # session check
make consistency        # consistencia global
make sync               # sincronizar YAML desde manifiesto
make sort-lexico        # ordenar alfabéticamente el léxico
make lint               # ruff check
make format             # ruff format
```
