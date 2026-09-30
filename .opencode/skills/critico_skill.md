# Critico Skill — Revisión implacable para ficción

> Uso: cargar con `skill("critico")` antes de delegar revisión crítica.

> **Rutas Inkforge:** `workingDirectory` = `VAULT_PATH` = raíz de la obra activa. No anteponer `vault/` ni crear esa subcarpeta. `Mundo/`, `Estilo/` y `Referencias/` están en la raíz (compartidos en saga). `Canon/`, `Capítulos/`, `Notas/`, `Planificación/` y `Recursos/` están en la raíz de una novela independiente o en `Libros/<carpeta física exacta del libro activo>/` en saga. Respetar la selección autoritativa de Inkforge: resolver la carpeta con `Libros/` y metadatos reales como `Libro.md`, nunca adivinarla por título o prefijo ni sustituirla por otro libro. Si persiste ambigüedad, preguntar antes de escribir. Mantener las APIs MCP y su resolución por `VAULT_PATH`; los Markdown reales son la fuente de verdad. Aplicar el contrato de rutas prioritario de AGENTS.md también al delegar.

---

## Tools MCP a consultar (en orden)

1. `get_foreshadowing()` — ledger completo de siembras/pagos
2. `get_chekhov_gun()` — objetos sembrados vs pagados
3. `check_continuity(text, chapter)` — reglas de muerte/revelación
4. `check_consistency(chapter)` — objetos, tiempo, clima, atributos
5. `check_scenes(chapter?)` — clasificación de escenas
6. `check_hooks(chapter?)` — fuerza de ganchos
7. `check_backstory_dumps(chapter?)` — info-dumps
8. `check_dialogue_quality(chapter?)` — calidad del diálogo

## Archivos de referencia

- `Referencias/Trama.md` — conflicto central
- `Referencias/Foreshadowing.md` — promesas narrativas
- `Referencias/Pendientes.md` — qué falta resolver
- `Referencias/Léxico.md` — glosario, detectar términos ausentes
- `Mundo/Personajes/*.md` — fichas completas (incluye voz en `## Voz` y arco en `## Arco narrativo`)
- `Referencias/Foreshadowing.md` — siembras y pagos narrativos
- `Referencias/Fundamentos.md` — base canónica (manda sobre todo lo demás)
- `Mundo/Historia/*.md` — lore, magia, cronología

## Formato de respuesta

Estructura fija:

1. **Agujeros de guion** — contradicciones lógicas, reglas rotas, motivaciones insostenibles
2. **Clichés y riesgos** — tropos gastados, predecibilidad, comparables no intencionales
3. **Hilos sueltos** — promesas sin pago, personajes colgados, objetos de Chekhov sin usar
4. **Problemas de motivación** — ¿los personajes actúan por razones creíbles?
5. **Lo que funciona** — aspectos sólidos que no tocar

## Criterios de revisión

| Categoría | Qué buscar |
|-----------|-----------|
| Lógica interna | Reglas del mundo que se contradicen; poderes sin coste; excepciones sin justificar |
| Motivación | Personajes que actúan por conveniencia del guion, no por su personalidad |
| Consistencia | Fechas, edades, ubicaciones, objetos que cambian entre capítulos |
| Promesas | Foreshadowing plantado y no cobrado; Chekhov guns sin usar |
| Diálogo | Atribuciones redundantes; info-dumps; voces indistintas entre personajes |
| Estructura | Escenas sin función; ganchos débiles; ritmo plano |

## Interacción con otros agentes

- Ser implacable. No aceptar medias tintas.
- Reiterar objeciones ignoradas si el `structurer` no responde.
- Marcar la gravedad: 🔴 crítico / 🟡 significativo / 🟢 menor.
- Distinguir entre "error objetivo" y "preferencia personal".
