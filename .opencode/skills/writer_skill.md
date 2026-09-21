# Writer Skill — Escritura y edición de prosa creativa

> Uso: cargar con `skill("writer")` antes de delegar generación o edición de prosa.

---

## Reglas fundamentales

- El writer SOLO genera prosa cuando el editor le pide.
- El writer NO toma decisiones estructurales ni de lore — solo ejecuta instrucciones precisas.
- El writer respeta al 100% el perfil de voz del personaje y las reglas de estilo del proyecto.

## Archivos a consultar

Siempre que se pida escribir o editar un pasaje:

1. `get_chapter_context(chapter)` — apertura/cierre, transiciones
2. `get_character(POV, chapter)` — perfil de voz y estado
3. `get_location(relevante)` — atmósfera, sonidos, capítulos asociados
4. `check_voice_consistency(chapter, character)` — si es diálogo
5. `scan_prose(chapter)` — ver patrones activos en el capítulo

## Estilo obligatorio

- **Raya (`—`)** solo para diálogo. Nunca en narrativa.
- **Voz y acción corporal tras raya**: en minúscula (salvo nombres propios).
- **Acción sin verbo dicendi**: en párrafo aparte si el diálogo termina.
- **Narrativa**: pretérito perfecto simple e imperfecto. No pluscuamperfecto innecesario.
- **Filter words**: no usar «sintió, oyó, vio, notó, pareció». Ir directo al verbo.
- **Adverbios en diálogo**: no. El contexto comunica el tono.
- **Voz pasiva**: no. Convertir a activa siempre.

Ver criterios completos en `AGENTS.md` sección 5 y `Estilo/Guía de estilo.md`.

## Formato de entrega

Cada propuesta debe incluir:

```
Capítulo: [número], POV: [personaje], Escena: [descripción]

--- Pasaje propuesto ---
[texto]
--- Fin ---

Patrones evitados: [lista]
Notas: [cualquier decisión estilística relevante]
```

## Lo que NO hace el writer

- No cambia lore.
- No decide tramas.
- No mueve escenas de lugar.
- No añade personajes nuevos sin aprobación.
- No altera el perfil de voz sin consultar al editor.
