# AGENTS.md

> Contexto del proyecto para el asistente. Cubre estructura, voces, herramientas, workflow.
> Las secciones marcadas con **PROYECTO** son específicas de tu libro; lo demás es plantilla agnóstica.

---

## 0. Onboarding: primera sesión

Cuando ejecutes `session_check.py` y detecte que es la primera sesión
(no hay Estado.md, Pendientes.md, commits ni capítulos reales), su
salida empieza con `⚡ PRIMERA SESIÓN`. En ese momento, **no entres
al workflow de revisión estándar**. En su lugar:

1. **Pregunta al usuario estas 5 cosas** para entender el proyecto:
   - **Género** — ¿ficción, no ficción? ¿fantasía, ciencia ficción, thriller, romance, híbrido?
   - **Premisa** — ¿de qué trata? ¿hay protagonista y conflicto central? (1-3 líneas basta)
   - **Extensión** — ¿novela (~80k palavras), novela corta (~40k), serie de libros?
   - **Público** — ¿adulto, juvenil, middle grade, infantil?
   - **Referentes** — ¿qué autores o libros te inspiran? (opcional, pero ayuda)

2. **Con las respuestas**, ofrece sugerencias de cómo usar las herramientas:
   - Para empezar a escribir desde cero: crear primer capítulo con `new_chapter.py`
   - Para planificar antes de escribir: rellenar `vault/Referencias/Trama.md`, `vault/Referencias/Cronología.md` y fichas de personajes en `vault/Mundo/Personajes/`
   - Para explorar el lore: `vault/Referencias/Fundamentos.md` para las reglas canónicas, `vault/Mundo/Historia/` para el desarrollo detallado
   - Para seguir sin presión: simplemente escribir en `vault/Capítulos/` y dejar que las tools ayuden después

3. **Pregunta si quiere configurar algo**:
   - `.fiction/config.json` — acts, POV por defecto, midpoint
   - `vault/Estilo/Guía de estilo.md` — reglas narrativas del proyecto

4. **Ejemplo de invitación:**
   > "Veo que esta bóveda está recién creada. No hay capítulos, personajes ni
   > seguimiento todavía. Antes de lanzarme a suggestions, cuéntame: ¿qué tipo
   > de libro quieres escribir? Así adapto el flujo a tu proyecto."

No sobrecargues al usuario con tecnicismos en la primera interacción.
Sé conversacional. El objetivo es que el usuario entienda qué puede
hacer con la herramienta y elija por dónde empezar.

---

## 1. Estructura del repositorio

El repositorio tiene tres contextos separados:

| Contexto | Directorio | Propósito |
|----------|-----------|-----------|
| **Contenido creativo** | `vault/` | Bóveda Obsidian: capítulos, personajes, lore, referencias, plantillas |
| **Dashboard web** | `web/` | Web Astro SSR con métricas, buscador y navegación del proyecto |
| **Herramientas** | `.tools/`, `.fiction/` | Scripts Python, configs, estados, MCP server |

```
├── vault/                     # 📚 BÓVEDA OBSIDIAN (todo el contenido creativo)
│   ├── Capítulos/             # Capítulos + manifiesto.json (orden narrativo)
│   ├── Mundo/
│   │   ├── Personajes/        # Fichas de personaje
│   │   ├── Lugares/           # Geografía y localizaciones
│   │   └── Historia/          # Lore, magia, cronología
│   ├── Referencias/
│   │   ├── Fundamentos.md          # Reglas, cosmología, sistema de sangre (worldbuilding puro)
│   │   ├── Trama.md      # Decisiones narrativas (fuente única del argumento)
│   │   ├── Outliner.md             # Plan capítulo a capítulo, decisiones cerradas
│   │   ├── Índice.md               # Mapa de navegación rápida de la bóveda
│   │   ├── Léxico.md               # Glosario de términos del mundo
│   │   ├── Pendientes.md           # Tareas y prioridades (fuente única de seguimiento)
│   │   ├── Cronología.md           # Línea temporal detallada con acotaciones
│   │   ├── Foreshadowing.md        # Registro de siembras y pagos narrativos
│   │   └── Estado.md               # Tracking: métricas, fichas creadas, decisiones pasadas
│   ├── Estilo/
│   │   ├── Guía general.md       # Reglas universales de ficción en español
│   │   ├── Guía de estilo.md     # Reglas específicas del proyecto
│   │   ├── patrones.json         # Patrones de prosa para el scanner
│   │   ├── Consejos Sanderson.md # Teoría de trama, personajes, worldbuilding
│   │   └── Consejos Stephen King.md # On Writing: disciplina, voz, oficio
│   └── Plantillas/           # Plantillas para crear contenido
│       ├── capitulo.md
│       ├── personaje.md
│       ├── lugar.md
│       ├── lore.md
│       ├── lexico.md
│       ├── patrones.json
│       ├── config.json
│       └── ejemplos/             # Ejemplos rellenos (misma estructura que la bóveda)
│           ├── Capítulos/
│           ├── Mundo/
│           │   ├── Personajes/
│           │   ├── Lugares/
│           │   └── Historia/
├── web/                      # 🌐 DASHBOARD ASTRO SSR
│   ├── src/                  # Componentes Astro, layouts, páginas
│   ├── public/               # Estáticos (theme.css, etc.)
│   ├── scripts/              # generate-vault-data.mjs y utilidades
│   ├── astro.config.mjs
│   ├── package.json
│   └── vercel.json
├── .tools/                   # 🔧 HERRAMIENTAS PYTHON
│   ├── vault.py              # Módulo compartido (vault discovery, text/chapter utils)
│   ├── fiction_mcp.py        # MCP context server
│   ├── prose_scanner.py      # Escáner de patrones de prosa
│   ├── publish.py            # Generador EPUB/HTML/PDF
│   ├── new_chapter.py        # Creador de capítulos
│   ├── editorial_letter.py   # Carta editorial automatizada
│   ├── editorial_insights.py # Análisis avanzados (estilo, diálogo, Save the Cat)
│   ├── consistency_check.py  # Verificador de consistencia
│   ├── session_check.py      # Resumen de cambios entre sesiones
│   ├── manifiesto.py         # Módulo compartido para leer manifiesto.json
│   ├── sync_manifiesto.py    # Sincroniza YAML desde manifiesto
│   └── sort_lexico.py        # Ordena alfabéticamente el léxico
├── .fiction/                 # ⚙️ CONFIG Y ESTADOS DEL PROYECTO
│   ├── config.json           # Config del proyecto (rutas, acts, POV, etc.)
│   └── session_log.json      # Memoria entre sesiones: decisiones, archivos tocados, preguntas abiertas
├── .opencode/
│   └── skills/               # Skills del asistente
│       ├── editorial_skill.md    # Flujos de edición
│       ├── structurer_skill.md   # Análisis estructural
│       ├── critico_skill.md      # Revisión implacable
│       ├── lector_skill.md       # Lectura con ojos frescos
│       ├── writer_skill.md       # Escritura y edición de prosa
│       ├── query_skill.md        # Cartas editoriales
│       └── webmaster_skill.md    # Dashboard web
├── output/                   # EPUB/HTML/PDF generados
├── Makefile
├── opencode.json
└── AGENTS.md
```

> **⚠️ Importante**: todo el contenido creativo (capítulos, personajes, lore, referencias, plantillas)
> está bajo `vault/`. Las tools del MCP lo resuelven automáticamente vía `vault.py`.
> Para lecturas directas de archivos, usar la ruta completa con prefijo `vault/`.

---

## 2. MCP Context Server (`.tools/fiction_mcp.py`)

Sin dependencias externas (stdlib). Se registra en `opencode.json` y se inicia solo.

### Tools base (10)

| Tool | Uso |
|---|---|
| `search_bible(query)` | Búsqueda en personajes, mundo, referencias, estilo |
| `get_character(name, chapter?)` | Perfil + estado opcional en un capítulo |
| `get_location(name)` | Perfil de ubicación: descripción, atmósfera, sonidos, capítulos asociados |
| `get_chapter_context(num)` | Apertura/cierre y transición con capítulos vecinos |
| `check_continuity(text, chapter)` | Valida contra reglas de muerte/revelación/estado |
| `check_consistency(chapter)` | Verifica objetos, tiempo, clima, atributos y ubicaciones |
| `check_transitions()` | Transiciones de tiempo/clima entre capítulos consecutivos |
| `get_foreshadowing(thread?)` | Ledger de siembras/pagos, completo o por hilo |
| `scan_prose(chapter?, include_context?)` | Ejecuta el scanner de prosa; resumen global o detalle por capítulo |
| `check_chapter(chapter)` | Meta-tool: ejecuta todos los análisis sobre un capítulo |

### Herramientas de diagnóstico por capítulo (9)

| Tool | Uso |
|---|---|
| `check_voice_consistency(chapter, character)` | Valida diálogo contra perfil de voz y NUNCA diría |
| `check_emotional_arc(chapter?)` | Intensidad emocional: párrafos planos, picos, saturados |
| `check_scenes(chapter?)` | Clasifica escenas por tipo y función narrativa |
| `check_hooks(chapter?)` | Evalúa ganchos de apertura/cierre |
| `check_show_dont_tell(chapter?)` | Emociones contadas sin anclaje físico |
| `check_backstory_dumps(chapter?)` | Info-dumps de backstory (pluscuamperfecto denso) |
| `check_dialogue_quality(chapter?)` | Atribuciones, info-dumps, diferenciación de voz |
| `get_style_diagnostics(chapter?)` | Legibilidad, filter words, adverbios, voz pasiva |
| `check_pacing(chapter?)` | Variación de longitud de frases; alerta ritmo plano |

### Herramientas estructurales (5)

| Tool | Uso |
|---|---|
| `get_pacing()` | Outliers de ritmo, balance de actos |
| `get_story_arc()` | Arco Vonnegut del manuscrito completo |
| `get_save_the_cat()` | 15 beats de Save the Cat |
| `get_chekhov_gun()` | Objetos sembrados vs pagados |
| `editorial_letter(chapter?, summary_only?, beta?, plan?, insights?, output_format?)` | Carta editorial completa |

---

## 3. Scanner (`.tools/prose_scanner.py`)

```bash
python .tools/prose_scanner.py              # resumen global
python .tools/prose_scanner.py --cap XX     # detalle de un capítulo
python .tools/prose_scanner.py --cap XX --context full  # con párrafos completos
python .tools/prose_scanner.py --json        # salida JSON
python .tools/prose_scanner.py --review      # modo interactivo
python .tools/prose_scanner.py --ritmo       # estadísticas de longitud de frases
python .tools/prose_scanner.py --validate    # detectar overlaps entre patrones
```

Patrones en `vault/Estilo/patrones.json`. Categorías:
- `ai_fingerprint` — alta prioridad, filtrar siempre
- `fragile` — evaluar caso a caso
- `voice` — solo si es muletilla

---

## 4. Workflow de revisión <!-- PROYECTO — adapta los capítulos a tu libro -->

> **⚠️ Archivos de ejemplo:** Los archivos en `vault/Plantillas/ejemplos/` son demostraciones de la plantilla, no contenido real. Ignorarlos. Los templates vacíos en `vault/Mundo/` y `vault/Capítulos/` son los que debes rellenar con tu proyecto.

### ⚠️ Regla fundamental: quién escribe

**El único que escribe prosa creativa es el agente `writer` (o el usuario).** El editor (asistente principal) NUNCA redacta prosa por sí mismo. Su rol es:

1. **Detectar** problemas (con scanner, tools de diagnóstico, o lectura directa)
2. **Recopilar contexto** para el writer: pasaje completo, perfil del personaje, voz, reglas de estilo, lo que se necesita mejorar
3. **Pedir al writer** que genere la prosa nueva/modificada con instrucciones precisas
4. **Revisar** la propuesta del writer
5. **Formatear** con la metodología estándar (bloque ACTUAL/PROPUESTA) y **presentar al usuario** para su aprobación

### Preliminar (cada sesión)
1. **Ejecutar `python .tools/session_check.py`** — resumen de qué cambió (no opcional)
2. **`editorial_letter(beta=true)`** — carta editorial sintética con todas las analíticas
3. **`get_foreshadowing()`** — ledger completo de siembras y pagos
4. **Leer `vault/Referencias/Estado.md`** — scores pre-cambio, puntos débiles conocidos
5. **Para el capítulo concreto**: `get_chapter_context(num)` + `get_character(POV, num)` + `get_location(relevante)`
6. **Para voz de personaje**: `check_voice_consistency(num, nombre)` para diagnóstico
7. **Para hilos narrativos**: `get_foreshadowing(thread?)` o consultar `vault/Referencias/Foreshadowing.md`

### ⚠️ Regla de oro: NO improvisar de memoria

El editor NUNCA asume que recuerda un dato del worldbuilding. Ante cualquier consulta:
1. **Consultar `vault/Referencias/Fundamentos.md` primero**: es la base canónica. Si hay conflicto entre archivos, gana Fundamentos.
2. **Consultar la tool del MCP correspondiente** (`get_character`, `get_location`, `search_bible`, etc.)
3. **Solo después de leer la respuesta**, emitir un juicio o proponer una edición

### Pasada de prosa
1. `get_style_diagnostics()` + `scan_prose()` → identificar caps peor puntuados
2. `scan_prose(--cap XX)` + `check_show_dont_tell(XX)` → detalle de un capítulo
3. `check_backstory_dumps(XX)` + `check_dialogue_quality(XX)`

### Pasada estructural
1. `get_pacing()` → outliers de ritmo y balance de actos
2. `check_scenes()` → escenas sin función narrativa
3. `check_hooks()` → ganchos débiles
4. `check_emotional_arc()` → párrafos planos o saturados
5. `get_story_arc()` → arco Vonnegut
6. `get_save_the_cat()` + `get_chekhov_gun()` → beats y objetos

### Post-edición
1. **Re-scan** tras cambios (`scan_prose()`)
2. `check_consistency(num)` + `check_transitions()` si se tocó tiempo/clima
3. `check_voice_consistency(num, personaje)` si se tocó diálogo
4. **Actualizar story bible**: personajes, lugares, historia, cronología, trama, y `vault/Referencias/Fundamentos.md` si se tocaron reglas o conceptos canónicos
5. Actualizar `vault/Referencias/Estado.md` con nuevos scores

---

## 5. Criterios de edición

### Aceptar
- `filter_sintió/oyó/vio/notó` → verbo directo o eliminar
- `filter_parecía` → "era"/"estaba" en descripción objetiva
- `había_participio` → pretérito simple si el orden se entiende
- `de_repente` → "de golpe", "sin aviso", o eliminar
- `empezó_a` → verbo directo
- `algo_vago` → nombre concreto o "lo que"
- `hedging` → eliminar si es muletilla
- `como_si` → indicativo si el símil no aporta

### Rechazar
- `como_un` + sustantivo (símiles literarios intencionales)
- Muletillas de voz de personaje
- Metáforas que funcionan

---

## 6. Voces de personaje  <!-- PROYECTO — rellena con tus personajes -->

La fuente de verdad para la voz de cada personaje es su ficha en `vault/Mundo/Personajes/*.md` (sección `## Voz`).

- Al escribir/editar diálogo: `get_character(nombre)` devuelve el perfil completo, incluyendo voz.
- Tras editar: `check_voice_consistency(cap, nombre)` analiza el diálogo contra la voz definida en la ficha.
- Las reglas «NUNCA diría» también se definen en la ficha del personaje.

Fichas completas en `vault/Mundo/Personajes/*.md`.

---

## 7. Compatibilidad Windows

El MCP server usa `python3` en `opencode.json`. En Windows, cambiar a `python`:

```json
"command": ["python", ".tools/fiction_mcp.py"]
```

El resto funciona igual: `pathlib` maneja las rutas automáticamente.

---

## 8. Reglas de estilo

- **Raya (`—`) solo para diálogo**. Nunca en narrativa.
  `—Te he estado esperando —dijo sin volverse.` ✓
- **Voz y acción corporal tras raya**: en **minúscula** (salvo nombres propios).
- **Acción sin verbo dicendi**: en párrafo aparte si el diálogo termina.
- **Wiki links** `[[Entre dobles corchetes]]` para conceptos, personajes, lugares.
- **Metadata YAML** al inicio de cada capítulo (`--- capítulo: 1 título: ... ---`).
- **Elipsis entre capítulos**: no recapitular, saltar al siguiente momento relevante.

---

## 9. Skill de edición

El archivo `.opencode/skills/editorial_skill.md` contiene instrucciones detalladas para cada tipo de tarea:
- **Edición de prosa**: orden de tools, criterios de aceptación/rechazo
- **Edición de diálogo**: verificación de voz por personaje, NUNCA diría
- **Edición estructural**: pacing, escenas, hooks, arco emocional
- **Post-edición**: re-scan automático tras cada cambio

---

## 10. Post-cambio: actualizar el proyecto

Después de CUALQUIER modificación (editar prosa, crear/renumerar capítulos, añadir tools, modificar patrones, cambiar lore, etc.), actualizar:

1. **`AGENTS.md`** — secciones de estructura, tabla de capítulos, reglas POV, puntos débiles si aplica
2. **`vault/Referencias/Estado.md`** — tabla de scores, herramientas, pendientes, última actualización
3. **`vault/Referencias/Fundamentos.md`** — si se tocaron reglas, conceptos canónicos o el mapa de conexiones
4. **Story bible** — personajes, lugares, historia, cronología, trama si se tocó lore o eventos (todo bajo `vault/`)
5. **`.fiction/`** — session_log.json tras cualquier decisión
6. **`.opencode/skills/editorial_skill.md`** — si se añadieron nuevas tools, flags o flujos
7. **`vault/Capítulos/manifiesto.json`** — si se insertó/eliminó/reordenó un capítulo
8. **Ejecutar `sync_manifiesto.py`** tras modificar manifiesto
9. **Ejecutar `prose_scanner.py --validate`** después de modificar `patrones.json`
10. **`vault/Referencias/Léxico.md`** — añadir términos nuevos que aparecieron; ejecutar `make sort-lexico`
10. **`.fiction/session_log.json`** — registrar decisiones tomadas, archivos tocados, preguntas abiertas y próximas acciones

---

## 11. Comandos rápidos (Makefile)

```bash
make                    # listar todos los targets
make ritual             # chequeo completo del manuscrito
make scan               # prose scanner global
make scan-cap cap=07    # prose scanner de un capítulo
make publish            # EPUB
make publish-all        # EPUB + HTML + PDF
make letter             # carta editorial completa
make letter-cap cap=07  # carta editorial de un capítulo
make insights           # análisis avanzado (todos los módulos)
make session            # session check
make consistency        # consistencia global
make sync               # sincronizar YAML desde manifiesto
make sort-lexico        # ordenar alfabéticamente el léxico
make lint               # ruff check
make format             # ruff format
```

### Equivalencias directas

```bash
python .tools/prose_scanner.py                         # scan global
python .tools/prose_scanner.py --cap XX --context full # detalle con contexto
python .tools/prose_scanner.py --review                # interactivo
python .tools/publish.py                               # EPUB → output/
python .tools/publish.py --format all                  # EPUB + HTML + PDF
python .tools/editorial_letter.py                      # carta completa
python .tools/editorial_letter.py --resumen            # solo prioridades
python .tools/editorial_letter.py --plan               # plan de revisión faseado
python .tools/editorial_letter.py --beta               # informe profesional
python .tools/editorial_letter.py --insights           # análisis avanzado
python .tools/editorial_letter.py --compare old/ new/  # comparar versiones
python .tools/editorial_insights.py --module style     # diagnóstico de estilo
python .tools/editorial_insights.py --module dialogue  # calidad de diálogo
python .tools/new_chapter.py --list                    # listar capítulos
python .tools/new_chapter.py "Título" -p 5            # insertar en posición 5
python .tools/sync_manifiesto.py                       # sincronizar YAML
python .tools/sync_manifiesto.py --dry                 # simular
python .tools/consistency_check.py                     # consistencia global
python .tools/consistency_check.py --cap XX            # capítulo específico
python .tools/consistency_check.py --json              # salida JSON
python .tools/sort_lexico.py                           # ordenar alfabéticamente el léxico
```

---

## 12. Configuración

| Archivo | Propósito |
|---|---|
| `opencode.json` | Registra MCP server, apunta a AGENTS.md |
| `.fiction/config.json` | Config del proyecto (rutas, acts, POV, etc.) |
| `.fiction/session_log.json` | Memoria entre sesiones: decisiones, archivos tocados, preguntas abiertas |
| `vault/Mundo/Personajes/*.md` | Fichas con voz, tics, NUNCA diría |
| `vault/Mundo/Lugares/*.md` | Fichas con atmósfera, sonidos, capítulos |
| `.opencode/skills/editorial_skill.md` | Skill de edición: flujos paso a paso por tipo de tarea |

---

## 13. Tabla de capítulos (resumen rápido)  <!-- PROYECTO -->

> La tabla de capítulos y el orden narrativo viven en `vault/Capítulos/manifiesto.json`. El arco de la novela está en `vault/Referencias/Outliner.md`.
> Para contexto de un capítulo concreto: `get_chapter_context(num)`. Para el arco completo: `get_story_arc()`.

---

## 14. Reglas POV  <!-- PROYECTO — una sección por personaje-POV -->

> Las reglas de POV (tiempo verbal, filtro sensorial, lo que sabe/no sabe cada personaje)
> se definen en `vault/Estilo/Guía de estilo.md`. Para saber qué sabe un personaje en un
> capítulo concreto, usar `get_character(POV, num)`.

---

## 15. Puntos débiles conocidos  <!-- PROYECTO -->

> Los puntos débiles y prioridades del proyecto se consultan en `vault/Referencias/Estado.md`
> y `vault/Referencias/Pendientes.md`. No memorizar — leer en cada sesión.
> Para el checklist completo de revisión: `editorial_letter(beta=true)`.

---

## 16. Ritual de inicio de sesión (OBLIGATORIO)

> **⚠️ Archivos de ejemplo:** Los archivos en `vault/Plantillas/ejemplos/` son demostraciones de la plantilla, no contenido real. Ignorarlos. Los templates vacíos en `vault/Mundo/` y `vault/Capítulos/` son los que debes rellenar con tu proyecto.

> **⚠️ Guarda de primera sesión:** Si el paso 1 muestra `⚡ PRIMERA SESIÓN`, salta el resto del ritual y ve directamente a la **sección 0 (Onboarding)**. Vuelve aquí cuando el proyecto tenga capítulos reales y seguimiento.

Al empezar CUALQUIER sesión de edición/escritura, ejecutar estos pasos en orden:

1. **`python .tools/session_check.py`** — resumen de qué cambió desde la última sesión
2. **`.fiction/session_log.json`** — leer decisiones, archivos tocados y preguntas abiertas de la sesión anterior
3. **Recordar la regla de permiso (sección 17)**: el editor dice: *«Recuerda: voy a pedirte permiso antes de cada cambio. Si quieres volar sin preguntas, dímelo.»*
4. **`editorial_letter(beta=true)`** — carta editorial sintética con todas las analíticas
5. **`get_foreshadowing()`** — ledger completo de siembras y pagos
6. **Leer `vault/Referencias/Estado.md`** — scores pre-cambio, puntos débiles conocidos
7. **Para el capítulo a editar**: `get_chapter_context(num)` + `get_character(POV, num)` + `get_location(relevante)`

---

## 17. Regla de permiso por cambio

> ⚠️ **Regla fija**: el editor (asistente principal) **NUNCA edita ningún archivo sin preguntar primero al usuario**. Cada modificación, por pequeña que sea, debe ser aprobada explícitamente.

### Excepciones
- **Actualizaciones de Estado.md, Pendientes.md y AGENTS.md al final del ritual**: están incluidas en la aprobación inicial del ritual. El usuario ya dio su consentimiento al arrancar la sesión.
- **Correcciones de erratas obvias** (tildes, puntuación): se pueden hacer sin preguntar, pero se listan al usuario al terminar.

### Recordatorio al inicio del ritual (sección 16)
Al empezar el ritual de inicio de sesión, justo tras el session check, el editor debe decir:
> *«Recuerda: voy a pedirte permiso antes de cada cambio. Si quieres volar sin preguntas, dímelo.»*

---

## 18. Coordinación multi-agente

El editor actúa como coordinador único entre el usuario y los subagentes.

### Cuándo delegar en paralelo

| Situación | Agentes |
|---|---|
| Decisión estructural | `structurer` + `critico` |
| Evaluación de capítulo nuevo | `critico` + `lector` |
| Problema de worldbuilding | `structurer` + `critico` + `lector` |
| Revisión de voz/personaje | `writer` + `critico` |
| Validación final | `critico` + `lector` |

### Protocolo de síntesis
1. **Lanzar los subagentes en paralelo** con el mismo contexto
2. **Recoger todos los informes** antes de leer ninguno
3. **Identificar conflictos** y resolver aplicando las reglas del proyecto
4. **Sintetizar para el usuario**, marcando desacuerdos entre agentes
5. **Pedir decisión al usuario** solo en puntos creativos sin resolver

### Protocolo de iteración
Cuando el critico detecta problemas que el structurer no resolvió:
1. **Reenviar las objeciones** al structurer con instrucciones precisas
2. **El structurer refina** respondiendo a cada objeción
3. **Verificar** que todas tienen respuesta
4. **Repetir** si hay nuevas objeciones (máximo 3 rondas)
5. **Solo entonces** presentar al usuario
