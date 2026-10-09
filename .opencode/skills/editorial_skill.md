# Editorial — revisión y edición narrativa

Aplicar el contrato de `AGENTS.md`: `VAULT_PATH` es la obra, `INKFORGE_LIBRARY_ROOT` es la Biblioteca global y el `book_scope` de una saga es la ruta exacta `Libros/<id>` comunicada por Inkforge. Pasar ese scope a cada herramienta MCP de contenido. No inferir el libro activo ni usar archivos de otro libro.

En saga, no recorrer `Libros/` completo ni usar búsquedas recursivas desde la raíz que atraviesen otros libros: cualquier exploración específica de libro se limita al `book_scope` activo; desde la raíz solo se consultan `Proyecto.md` y las áreas compartidas `Mundo/`, `Estilo/` y `Referencias/`.

## Inicio de una tarea

1. Leer el capítulo o documento objeto del encargo y los Markdown relacionados que existan. `Planificación/` y `Canon/` son del libro; `Mundo/`, `Estilo/` y `Referencias/` son compartidos en una saga.
2. Consultar `get_chapter_context`, `get_character`, `get_location`, `search_bible` o `get_foreshadowing` solo cuando aporten contexto a la decisión. Si la obra no tiene un documento esperado, indicarlo sin inventar su contenido.
3. Usar `session_check.py` solo si hace falta una instantánea actual; no ofrece un diff histórico ni una memoria entre sesiones.

## Desarrollo guiado

Cuando el usuario quiera construir una obra desde cero, ordenar una idea o material parcial, continuar una obra poco desarrollada, plantear un libro de saga o revisar qué queda por definir, consultar primero `get_development_state`. Sus estados `missing`, `template` y `content`, sus inventarios y `blank_scaffold` describen archivos; no miden calidad ni completitud creativa.

Partir del material que el usuario aporte y avanzar con una o unas pocas preguntas relacionadas. No lanzar un cuestionario fijo, exigir un orden único ni obligar a definir toda la novela antes de escribir. Si ya existe contenido, leer los Markdown pertinentes y continuar desde él sin reiniciar el onboarding ni preguntar de nuevo lo que ya esté documentado.

En saga, tratar `Mundo/`, `Estilo/` y `Referencias/` como material compartido y mantener `Planificación/`, `Canon/`, `Capítulos/`, `Notas/` y `Recursos/` dentro del libro activo. No usar otro libro para completar huecos. La conversación y las propuestas no persisten por sí solas: una orden explícita de guardar se aplica sin reconfirmación; una autorización continuada para ir rellenando documentos cubre solo decisiones confirmadas dentro de esa tarea, no alternativas abiertas ni elecciones creativas pendientes.

## Diagnóstico

- Prosa: `get_style_diagnostics`, `scan_prose`, `check_show_dont_tell`, `check_backstory_dumps` y `check_dialogue_quality` cuando el pasaje lo justifique. Un patrón detectado es una señal para leer, no una orden de sustituir palabras.
- Diálogo: leer la ficha del personaje y, cuando exista, usar `check_voice_consistency`. Distinguir voz deliberada de inconsistencias.
- Estructura: `get_pacing`, `check_scenes`, `check_hooks`, `check_emotional_arc`, `get_chekhov_gun` o `get_story_arc` según la pregunta. `get_save_the_cat` y los diagnósticos de King/Sanderson son opcionales y solo se usan cuando el usuario o la obra solicitan ese marco.
- Género: leer únicamente los perfiles efectivos pertinentes mediante las herramientas globales de género. Un perfil orienta, no reemplaza canon, estilo propio ni instrucciones del usuario.

## Entrega y persistencia

En revisión o propuesta, separar el texto actual de la propuesta e indicar el motivo; no escribir. Si el usuario ordena editar, aplicar el cambio autorizado sin una confirmación redundante. Consultar cuando falte una decisión creativa sustancial. Tras escribir, actualizar solo los Markdown que el cambio afecte realmente. No generar automáticamente scores, bitácoras, léxicos ni fichas.
