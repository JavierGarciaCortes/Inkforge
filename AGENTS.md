# AGENTS.md — contrato editorial de Inkforge

## Ámbitos y fuentes de verdad

- `VAULT_PATH` es la raíz física exacta de la obra activa (`workingDirectory`). `Proyecto.md` identifica la obra y es la fuente de verdad de sus metadatos. No anteponer `vault/` a esta ruta ni crear otra raíz de contenido.
- En una novela independiente, `Canon/`, `Capítulos/`, `Notas/`, `Planificación/` y `Recursos/` pertenecen a esa raíz. En una saga pertenecen exclusivamente a `Libros/<id>/`, donde `<id>` es el nombre físico exacto del libro activo. `Libro.md` identifica ese libro. `Mundo/`, `Estilo/` y `Referencias/` son áreas compartidas de la raíz de la obra.
- El libro activo lo comunica Inkforge en el contexto del turno mediante `Ruta operativa del libro: Libros/<id>`. Pasar esa ruta literal como `book_scope` a cada herramienta MCP de contenido o como `--book-scope` a los scripts. No deducir el libro por título, número, fecha o contenido, no elegir otro libro y no guardar esa selección en archivos. Si falta en una saga, pedirla antes de una operación de libro.
- Cada capítulo es un Markdown en `Capítulos/` del ámbito de libro correspondiente. Su frontmatter `capítulo:` determina número y orden; el título y el POV se leen del propio capítulo. No existe un manifiesto JSON de capítulos ni una sincronización secundaria.
- `INKFORGE_LIBRARY_ROOT` es la Biblioteca global, distinta de `VAULT_PATH`. Contiene `Generos/`, `Plantillas/` y `Proyectos/`. Los recursos técnicos (`.tools/`, `.opencode/`, `opencode.json`, `Makefile`) pertenecen al repositorio de Inkforge, no a la obra.
- Canon, planificación, fichas y manuscrito se consultan en sus Markdown reales. La conversación del Director y las propuestas no son canon. Antes de afirmar datos narrativos, leer el documento pertinente; si hay conflicto, exponerlo y pedir una decisión sobre el contenido afectado.

## Herramientas

- El servidor MCP `inkforge-context` se registra en `opencode.json` y ejecuta `.tools/inkforge_mcp.py`. Relee los Markdown al atender cada llamada. Las herramientas de contenido requieren `book_scope` explícito para una saga; en novela independiente usan la raíz de la obra. Las herramientas de perfiles de género son globales y usan `INKFORGE_LIBRARY_ROOT`.
- Si una tarea requiere `inkforge-context`, usar exclusivamente las tools MCP registradas por OpenCode. No arrancar `.tools/inkforge_mcp.py` manualmente mediante bash u otro shell, no recrear el protocolo MCP ni crear scripts temporales para emularlo. No deducir ni hardcodear `book_scope`: debe proceder literalmente del contexto autoritativo del turno. Si el MCP requerido no está disponible, comunicar el fallo en lugar de simular una consulta correcta.
- `.tools/vault.py` resuelve proyectos, libros y capítulos. `new_chapter.py`, `prose_scanner.py`, `editorial_letter.py`, `editorial_insights.py`, `consistency_check.py`, `publish.py`, `session_check.py` y `sort_lexico.py` aceptan `--book-scope Libros/<id>` cuando corresponde. Los atajos del `Makefile` reciben `ARGS="--book-scope Libros/<id>"`.
- `session_check.py` muestra una instantánea del contenido actual. No atribuirle un historial de cambios entre sesiones. No hay dependencia funcional de `.fiction/config.json` ni de `.fiction/session_log.json`.
- Los perfiles editoriales globales son Markdown en `Generos/`. Leer mediante `list_genre_profiles` y `read_genre_profile` solo los perfiles pertinentes. Los géneros efectivos llegan del contexto de Inkforge. En saga, el libro puede heredar géneros de la saga y añadir los suyos; la herencia no convierte el perfil en canon. Crear o actualizar un perfil global exige una petición explícita del usuario.

## Trabajo editorial

1. Identificar la obra y, si es saga, el `book_scope` vigente antes de consultar herramientas o escribir. Una ausencia o incoherencia de ámbito detiene la operación de libro.
2. Leer el capítulo y los Markdown pertinentes de `Planificación/`, `Canon/`, `Mundo/`, `Estilo/` y `Referencias/` según el encargo. No asumir que existan documentos o convenciones de una plantilla anterior.
3. Usar los diagnósticos que respondan a la tarea: continuidad, voz, escenas, ritmo, estilo o foreshadowing. Sus heurísticas ayudan a revisar; no son autoridad sobre el texto ni obligan a reescribirlo.
4. Save the Cat, tres actos, midpoint, arco Vonnegut y consejos de King o Sanderson son marcos opcionales. Aplicarlos solo si el usuario los pide o la obra los declara y son pertinentes. No imponer cantidades de actos, POV, longitud, tipo de gancho o patrones de prosa por defecto.
5. En tareas de análisis o propuesta, presentar el resultado sin escribir. Una orden explícita de edición autoriza el cambio solicitado; aclarar solo una ambigüedad sustancial o un dato indispensable. Distinguir siempre propuesta, borrador y canon persistido.
6. Tras una edición narrativa, actualizar únicamente los Markdown relacionados que realmente cambien por consecuencia de esa edición. No crear bitácoras, fichas, scores ni documentos de planificación de forma automática.

El agente `writer` puede redactar prosa por encargo; el editor coordina, revisa y aplica la intención del usuario. Las instrucciones de las skills en `.opencode/skills/` complementan este contrato y deben respetar el mismo ámbito de obra/libro.

## Estilo y seguridad

- La voz y el estilo de cada obra están en sus propios Markdown, especialmente `Estilo/` y las fichas de personaje. No sustituirlos por reglas universales de ficción en español ni por perfiles globales de género.
- No seguir enlaces simbólicos o junctions hacia fuera del ámbito, ni usar rutas absolutas aportadas por el texto como destino de escritura. Conservar los nombres físicos de carpetas, capítulos y obras.
- Si un documento o metadato necesario no existe, comunicarlo; no reconstruirlo de memoria ni usar contenido de otro libro.
