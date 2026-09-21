# Query Skill — Creación de carta de presentación para editoriales

> Uso: cargar con `skill("query")` antes de delegar la creación de una carta editorial.
> El editor proporciona el contexto del proyecto; el skill guía el proceso completo.

---

## Archivos de referencia (genéricos)

- `Referencias/Trama.md` — premisa, conflicto, arco del protagonista
- `Referencias/Léxico.md` — términos del mundo
- `Referencias/Outliner.md` — plan capítulo a capítulo, decisiones cerradas
- `Mundo/Personajes/*.md` — fichas de personajes (protagonista y secundarios clave)
- `Referencias/Fundamentos.md` — base canónica del mundo
- `Mundo/Historia/*.md` — lore relevante para la premisa
- `AGENTS.md` — referentes del proyecto (sección 13 en la plantilla)

## Herramientas MCP a consultar

1. `get_character(Protagonista)` — entender su arco y motivación
2. `get_foreshadowing()` — ver qué hilos están abiertos (para no spoilearlos)
3. `search_bible(género + "referentes")` — buscar comparables ya mencionados

## Proceso (en orden)

### 1. Extraer los ingredientes

Leer la premisa, el conflicto central, los personajes principales y extraer:

| Qué buscar | Cómo extraerlo |
|------------|---------------|
| **Protagonista** | De `Mundo/Personajes/[POV principal].md`: nombre, rol, conflicto interno |
| **Conflicto** | De `Trama.md`: ¿qué quiere el protagonista y qué se lo impide? |
| **Setting** | De `Mundo/Lugares/`: dónde ocurre la historia, qué lo hace único |
| **Giro único** | ¿Qué diferencia este libro de otros del mismo género? |
| **Comparables** | De `AGENTS.md`: referentes del proyecto, autores vivos y publicando |

### 2. Escribir el logline (1 frase)

Fórmula: `[PROTAGONISTA] + [QUÉ QUIERE] + [QUÉ SE LO IMPIDE] + [QUÉ PASA SI FRACASA]`

### 3. Redactar la sinopsis (150-250 palabras)

- Presentar el mundo en 1-2 frases
- Protagonista: quién es, qué descubre, qué decide
- Las stakes: qué pasa si fracasa, qué se pierde
- **NO mencionar** a los Antiguos, la grieta lovecraftiana, ni la paradoja del colapso
- Terminar con un gancho: el lector (editor) quiere saber qué pasa después

### 4. Seleccionar comparables

De los referentes en AGENTS.md sección 13, elegir 2-3:
- Autores vivos y publicando
- Que ocupen un espacio similar (fantasía épica con toques de ciencia ficción)
- Evitar clásicos muertos o best-sellers globales sin matiz

### 5. Redactar la bio

Si el usuario tiene datos, usarlos. Si no, dejar placeholder.

### 6. Armar la carta completa

Formato:
- Encabezado (en PDF) o inicio directo (en email)
- Cuerpo: logline + sinopsis + comparables + bio + cierre
- NO incluir: análisis temático, spoilers de la paradoja, más de 3 personajes

### 7. Validar contra el checklist en `Referencias/Guía carta editorial.md`

Sección 7 de la guía: verificar cada punto.

## Formato de respuesta

```
## Carta generada

[Cuerpo completo de la carta]

## Notas
- Logline: [explicación de decisión]
- Comparables: [por qué estos]
- Spoilers evitados: [qué se dejó fuera y por qué]
- Checklist: [puntos verdes/rojos]
```

## Reglas de oro

- **No spoilear** el desenlace, la resolución del conflicto principal, ni giros argumentales del último tercio en la carta
- **Máximo 450 palabras** la carta completa
- **Tono profesional**, no suplicante. La carta vende, no pide
- **Personalizar** si se sabe a qué editorial o agente va dirigida (añadir saludo específico)
- **Mencionar solo 2-3 personajes** como máximo

## Interacción con el editor

- El editor revisa y aprueba cada bloque antes de armar la carta final
- Si el usuario no tiene datos de bio, el skill sugiere frases genéricas («vive en X, es Y, esta es su primera novela»)
- Si el usuario tiene preferencias sobre comparables, el skill las incorpora
