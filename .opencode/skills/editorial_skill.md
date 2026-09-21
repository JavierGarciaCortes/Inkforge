# Editorial Skill — Flujos de edición para ficción en español

> Instrucciones detalladas para el asistente según el tipo de tarea.
> Consultar AGENTS.md sección 5 (criterios de edición) y sección 3 (scanner).
>
> **Memoria entre sesiones**: `.fiction/session_log.json`. Leerlo al inicio y actualizarlo al cierre.

---

## 🟢 Inicio de sesión (OBLIGATORIO)

Al empezar cualquier sesión de edición/escritura, en este orden exacto. No saltarse pasos. Si la sesión es solo de consulta, omitir pasos 4-5.

1. **`python .tools/session_check.py`** — diff desde última sesión. Capítulos afectados, cambios en story bible.
2. **`cat .fiction/session_log.json`** — leer decisiones, archivos tocados y preguntas abiertas de la sesión anterior. Recuperar contexto inmediato.
3. **`editorial_letter(beta=true)`** — carta editorial sintética. Foto global: estructura, escenas, hooks, foreshadowing, show/tell. Imprescindible para no perder perspectiva a medida que crece el manuscrito.
4. **`get_foreshadowing()`** — ledger completo de siembras/pagos. Identificar hilos abiertos antes de tocar prosa.
5. **Leer `vault/Referencias/Estado.md`** — scores pre-cambio, puntos débiles, pendientes de rondas anteriores.
6. **Para cada capítulo a editar**: `get_chapter_context(num)` + `get_character(POV, num)` + `get_location(relevante)` antes de tocar el archivo.

### ⚠️ Regla de oro

El editor NUNCA responde de memoria sobre datos del worldbuilding (personaje, lugar, regla mágica, evento, hilo). Secuencia obligatoria:
1. **`vault/Referencias/Fundamentos.md`** — base canónica. Si hay conflicto, gana Fundamentos.
2. **Tools MCP** — `get_character`, `get_location`, `search_bible`, `get_foreshadowing`, etc.
3. **Solo después** de leer la respuesta, emitir juicio.

1. Consultar la tool MCP correspondiente
2. Solo DESPUÉS de leer la respuesta, emitir juicio o edición

Sin atajos. La memoria del editor es volátil; las tools y archivos son fuente de verdad.

---

## 0. Pasada Stephen King (opcional)

Antes de la edición de prosa fina, ejecutar `check_king(chapter?)` o `prose_scanner.py --king` para:

1. **Adverbios en diálogo**: «dijo suavemente», «preguntó bruscamente» → eliminar el adverbio, usar contexto
2. **Voz pasiva**: «era + participio» → convertir a activa
3. **Kill your darlings**: estimar el 10% de poda del capítulo
4. **Puerta cerrada / abierta**: si el King Score > 15, recomendar no editar aún (seguir escribiendo)

### Criterios King
- **adverbio_dialogo**: todo adverbio tras verbo de diálogo se elimina. El contexto y la acción deben comunicar el tono.
- **voz_pasiva_ser**: «La puerta fue abierta» → «Él abrió la puerta». Excepción: cuando el receptor de la acción es más relevante que el actor.
- **Atribuciones no-"dijo"**: «exclamó, masculló, repuso» → cambiar a «dijo» a menos que el verbo aporte información única.

---

## 1. Edición de prosa

### Orden de diagnóstico
1. `get_style_diagnostics(chapter?)` — legibilidad, filter words, adverbios, voz pasiva
2. `scan_prose(chapter?)` — densidad de patrones, clusters, severidad
3. `check_show_dont_tell(chapter?)` — emociones sin anclaje físico
4. `check_backstory_dumps(chapter?)` — info-dumps de backstory
5. `check_dialogue_quality(chapter?)` — atribuciones, info-dumps en diálogo, diferenciación de voz

### Criterios de aceptación/rechazo

**Aceptar automáticamente:**
- `filter_sintió/oyó/vio/notó` → verbo directo o eliminar
- `filter_parecía` → "era"/"estaba" en descripción objetiva
- `había_participio` → pretérito simple si el orden cronológico se entiende sin el auxiliar
- `de_repente` → "de golpe", "sin aviso", o eliminar
- `empezó_a` → verbo directo (ej: "empezó a caminar" → "caminó")
- `algo_vago` → nombre concreto o reestructurar con "lo que"
- `hedging` → eliminar si es muletilla sin función narrativa
- `como_si` → convertir a indicativo si el símil no aporta significado nuevo
- `explicación_adictiva` → eliminar el nombre de la emoción; el contexto ya la muestra

**Rechazar (dejar intacto):**
- `como_un` + sustantivo (símiles literarios intencionales)
- Muletillas de voz de personaje (tanteos, evasivas, imperativos — son identidad)
- Metáforas que funcionan
- Palabras temáticas del libro (ej: "silencio" en un libro sobre el Vacío)

### Formato de propuesta (estándar)
Cada edición debe presentarse **línea a línea** con contexto completo en formato diff:

```diff
 línea anterior
- línea a modificar (resaltada)
+ línea propuesta
 línea posterior
```

Incluir siempre:
- **Patrón**: [nombre] × N ocurrencias en el capítulo
- **Motivo**: 1 línea

Preguntar "¿Aplico?" antes de cada cambio. El usuario decide individualmente si acepta o rechaza.

---

## 2. Edición de diálogo

### Verificación de voz por personaje
1. `get_character(name, chapter?)` — perfil de voz del personaje
2. `check_voice_consistency(chapter, character)` — diagnóstico automatizado
3. Revisar manualmente contra el perfil de voz en AGENTS.md sección 6

### Qué revisar
- **Patrón dominante**: ¿el personaje habla como debería? (ej: protagonista pregunta 80% del tiempo; antagonista da órdenes cortas)
- **NUNCA diría**: frases que rompen la identidad del personaje
- **Info-dumps en diálogo**: ¿el personaje está soltando información que ya sabe solo para informar al lector?
- **Atribuciones**: ¿demasiadas? ¿faltan? ¿son siempre "dijo" o siempre "susurró/preguntó/gritó"?
- **Diferenciación**: ¿dos personajes suenan igual? Leer el diálogo sin etiquetas — ¿se distingue quién habla?

### Regla de atribuciones
- Usar "dijo" como default (invisible para el lector)
- Verbos específicos solo cuando el tono no se infiera del contenido
- Acción como atribución: mejor que un verbo dicendi inventado

---

## 3. Edición estructural

### Orden de diagnóstico
1. `get_pacing()` — outliers de ritmo, balance de actos (todo el manuscrito)
2. `check_scenes(chapter?)` — clasifica escenas por tipo y función narrativa
3. `check_hooks(chapter?)` — evalúa ganchos de apertura/cierre
4. `check_emotional_arc(chapter?)` — intensidad emocional: párrafos planos, picos, saturados
5. `get_story_arc()` — arco Vonnegut del manuscrito completo
6. `get_save_the_cat()` — 15 beats de Save the Cat
7. `get_chekhov_gun()` — objetos sembrados vs pagados

### Qué revisar en escenas
- **Toda escena debe cumplir una función**: avanzar trama, revelar personaje, crear tensión, o profundizar el mundo
- **Escenas sin función**: fusionar o eliminar
- **Duración**: una escena que dura más de lo que su función requiere → podar
- **Transiciones**: ¿cómo se conecta con la escena anterior? ¿cambio de lugar, tiempo, POV?

### Qué revisar en hooks
- **Apertura**: ¿planta una pregunta que obligue a seguir leyendo? (no descripción, no clima, no backstory)
- **Cierre**: ¿deja algo abierto, una tensión sin resolver, una pregunta? (no cerrar todo)
- **El gancho debe ser orgánico**: no forzado, no engañoso

---

## 4. Post-edición (obligatorio tras cada cambio)

1. **Re-scan** del capítulo editado: `scan_prose(chapter)` para verificar mejora
2. **Consistencia** si se tocó tiempo/clima: `check_consistency(chapter)` + `check_transitions()`
3. **Voz** si se tocó diálogo: `check_voice_consistency(chapter, character)`
4. **Actualizar story bible** si se añadieron/quitaron eventos, voces, relaciones o geografía:
   - `vault/Referencias/Fundamentos.md` — reglas canónicas, si se tocaron
   - `vault/Mundo/Historia/*.md` — lore, magia, objetos nuevos, cambios
   - `vault/Mundo/Personajes/*.md` — nuevos tics, gestos, revelaciones, cambios de voz
   - `vault/Mundo/Lugares/*.md` — atmósfera, sonidos, capítulos asociados
   - `vault/Referencias/Foreshadowing.md` — nuevas siembras o pagos añadidos al texto
   - `vault/Referencias/Cronología.md` — si se alteró la línea temporal
   - `vault/Referencias/Trama.md` — si cambió algún arco
   - `vault/Referencias/Outliner.md` — word counts, decisiones cerradas
5. **Actualizar `vault/Referencias/Estado.md`** con nuevos scores
6. **Actualizar `.fiction/session_log.json`** — registrar:
    - Decisiones tomadas (tema, decisión, alternativa descartada)
    - Archivos tocados
    - Preguntas abiertas
    - Siguientes acciones recomendadas
7. **Actualizar `AGENTS.md`** si se modificó estructura, tools, tabla de caps, reglas POV o puntos débiles

### Protocolo del léxico

Cada vez que se añada un término nuevo al universo (concepto, lugar, personaje, objeto):

1. **Comprobar** si ya está en `vault/Referencias/Léxico.md`
2. Si no está: **añadirlo** a la categoría correspondiente (Lugares, Lore, Personajes, Conceptos)
3. **Ejecutar** `make sort-lexico` para reordenar alfabéticamente
4. Si el término se usó en un capítulo: **verificar** que el wiki link `[[término]]` esté bien formado

### Canon vs. Ideas

Las fichas pueden tener una sección `## Ideas (no canon, posibles direcciones)`. Protocolo:

- **Canon**: lo que está fuera de esa sección. Se usa como fuente de verdad.
- **Ideas**: material disponible pero no vinculante. Se puede usar si encaja al escribir, pero no hay que justificar su ausencia.
- Al editar: no tratar las Ideas como lore establecido. Si una idea se vuelve canon, **moverla** fuera de la sección de Ideas.
- Al delegar al writer: indicar explícitamente si puede usar material de Ideas o solo canon.

---

## 🤝 Coordinación multi-agente

El editor actúa como coordinador entre el usuario y los subagentes. Para decisiones que afectan estructura, trama o worldbuilding, la delegación en paralelo evita que una opinión contamine otra.

### Patrones de delegación

| Decisión | Agentes en paralelo |
|----------|-------------------|
| Estructural (expansión, reorden, nuevo arco) | `structurer` + `critico` |
| Capítulo nuevo/reescrito | `critico` + `lector` |
| Worldbuilding complejo | `structurer` + `critico` + `lector` |
| Voz/personaje | `writer` + `critico` |
| Cierre de ronda de revisión | `critico` + `lector` |

### Protocolo

1. Lanzar agentes en **paralelo** (un solo mensaje, múltiples `task`)
2. Esperar a tener **todos** los informes antes de leer ninguno
3. Identificar conflictos y resolverlos con reglas del proyecto
4. Sintetizar para el usuario: hallazgos consolidados, desacuerdos marcados
5. Pedir decisión solo en puntos sin resolver o creativos

### Iteración structurer ↔ critico (OBLIGATORIO)

Cuando el critico detecta objeciones que el structurer no resolvió, el editor NO presenta el plan al usuario todavía. En su lugar:

1. **Reenviar objeciones** al structurer: «Responde a CADA punto. Impleméntalo o explica por qué lo rechazas.»
2. **El structurer refina** respondiendo explícitamente a cada una. Sin silencios.
3. **Verificar** que todas las objeciones tienen respuesta.
4. **Repetir** si el critico detecta nuevas objeciones (máx. 3 rondas).
5. **Solo al final** presentar al usuario.

Este protocolo aplica a TODA decisión estructural o de diseño. No es opcional.

### Reglas de rol

- **El critico es implacable.** No acepta medias tintas. Reitera objeciones ignoradas.
- **El structurer responde a todo.** Implementa o rechaza con argumento. El silencio no es opción.

### Anti-patrones

- No secuenciar agentes que pueden ir en paralelo
- No delegar al writer lo que el editor resuelve con una edición puntual
- No pedir al lector que evalúe worldbuilding (no tiene acceso a la bible)
