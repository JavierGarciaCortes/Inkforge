# Inkforge — Development Status

> Documento vivo para continuar el desarrollo entre conversaciones.
> Fuente principal del estado técnico, decisiones cerradas, validaciones, problemas conocidos y siguiente paso.

## 1. Proyecto

**Nombre:** Inkforge
**Repositorio:** https://github.com/JavierGarciaCortes/Inkforge.git
**Ruta local habitual:** `D:\Proyectos\Inkforge`
**Origen técnico:** https://github.com/quinwacca/fiction-vault

Inkforge es una aplicación de escritorio para escritura y gestión de novelas y sagas, basada inicialmente en fiction-vault, Electron, React, TypeScript y OpenCode. Está en fase alfa y desarrollo activo.

## 2. Forma de trabajo

- Trabajar paso a paso y respetar el alcance autorizado.
- Para comprobaciones de código, Git, lint, build o comportamiento, dar un solo comando o una sola comprobación por turno y esperar el resultado.
- Para cambios importantes, preparar un prompt completo con modelo y nivel de razonamiento.
- Modelo habitual: **GPT-5.6 Sol**; High para arquitectura y concurrencia, Medium para cambios normales y Low para cambios triviales.
- Salvo petición expresa, modificar únicamente mediante `apply_patch`, sin ejecutar Git, PowerShell, npm, tests, lint, build, Electron, OpenCode, staging ni temporales de validación.
- Priorizar integridad de manuscritos, datos y arquitectura.
- No cambiar decisiones cerradas sin señalarlo.
- Separar implementación, validación comunicada y comprobaciones nuevas.

Esta actualización documental recoge resultados de validación comunicados por el responsable del proyecto. No se han ejecutado nuevas comprobaciones para redactarla.

## 3. Arquitectura cerrada

```text
Inkforge Desktop
    ↓
OpenCode local
    ↓
agente primary
    ↓
subagentes / skills / MCP
    ↓
Markdown reales de la obra
```

Principios:

- Los Markdown reales son la fuente de verdad narrativa.
- No mantener una base de datos paralela de canon ni una memoria narrativa alternativa.
- OpenCode controla modelos y proveedores; Inkforge no los hardcodea ni introduce una abstracción propia de proveedores.
- La persistencia del chat es estado de conversación, no canon narrativo.
- `web/` es heredado y secundario.
- Las decisiones son generales para Inkforge, sin acoplamiento a *El Cambio*.

El primary actual es `editor`; los subagentes heredados son `writer`, `structurer`, `lector`, `critico` y `query`. Para el Director, Inkforge detecta exactamente un agente con `mode: "primary"`; no hay selector manual de agente.

### Raíz técnica y workspace narrativo

- **`infrastructureRoot`:** raíz técnica de Inkforge con `AGENTS.md`, configuración, skills y MCP.
- **`workingDirectory`:** obra gestionada activa.
- El MCP recibe la obra mediante `VAULT_PATH`.
- Cambiar de obra cambia el workspace y reconecta OpenCode.
- Cambiar de libro dentro de una saga mantiene el workspace de la saga y no reinicia OpenCode.
- Cada turno recibe el contexto autoritativo del libro activo desde Inkforge. No se deduce mediante fechas de modificación ni otras heurísticas.
- El contexto técnico se utiliza silenciosamente; no debe aparecer en la conversación normal.

Sin obra activa, OpenCode puede proporcionar infraestructura y catálogo de modelos para Ajustes. No puede crear sesiones ni enviar mensajes narrativos contra `projectRoot`, `vault`, `vault/Proyectos` u otra obra. El catálogo sin obra usa un directorio técnico separado.

## 4. Estructura de Biblioteca cerrada

Inkforge trabaja exclusivamente mediante la Biblioteca. La ubicación física sigue siendo `vault/Proyectos/`; el nombre Biblioteca del esquema es conceptual, no una migración de directorio.

```text
Biblioteca/
  Proyecto independiente/
    Proyecto.md
    Mundo/
    Estilo/
    Referencias/
    Capítulos/
    Planificación/
      Cronología.md
      Escaleta.md
      Estado.md
      Foreshadowing.md
      Fundamentos.md
      Guía editorial.md
      Índice.md
      Léxico.md
      Outliner.md
      Pendientes.md
      Trama.md
    Canon/
      Canon de libro.md
    Notas/
    Recursos/

  Saga/
    Proyecto.md
    Mundo/
    Estilo/
    Referencias/
    Libros/
      01 - Primer libro/
        Libro.md
        Capítulos/
        Planificación/
          Cronología.md
          Escaleta.md
          Estado.md
          Foreshadowing.md
          Fundamentos.md
          Guía editorial.md
          Índice.md
          Léxico.md
          Outliner.md
          Pendientes.md
          Trama.md
        Canon/
          Canon de libro.md
        Notas/
        Recursos/
```


Criterios cerrados:

- Novela independiente: capítulos, planificación, canon, notas y recursos cuelgan de la obra.
- Saga: `Mundo`, `Estilo` y `Referencias` son compartidos; cada libro tiene sus áreas propias bajo `Libros/<id>/...`.
- `vault/Proyectos/` contiene datos locales de Biblioteca, está ignorado mediante `.gitignore` y no se versiona junto al código.
- El contenido heredado directamente bajo `vault/` no se borra, mueve ni migra automáticamente. Ya no es un workspace activo de Inkforge.
- Se eliminó el proyecto ficticio de tipo `legacy`, incluido `LEGACY_PROJECT`, y el modo funcional «Vault actual».
- La representación de obra activa es `ActiveProject = LibraryProjectSummary | null`. `null` significa que no hay obra seleccionada, no un proyecto alternativo.

## 5. Historial Git relevante

El registro documental anterior recoge, entre otros, estos hitos históricos:

```text
3e2364d chore: initialize Inkforge from fiction-vault Windows base
41ada3c feat: add initial Inkforge desktop shell
686c601 feat: add read-only vault browser
75fb395 feat: add markdown editing and safe save flow
18a9cd0 feat: integrate OpenCode chat
358fd51 feat: prevent external file overwrite conflicts
cb8f8a6 feat: sync vault tree and protect window close
57e2c4c feat: localize interface and managed vault labels
```

Son referencias históricas, no una comprobación del checkout actual. No se afirma que los cambios recientes estén commiteados, mergeados, enviados ni que la rama esté limpia.

## 6. Rama y estado de trabajo actual

Rama de desarrollo conocida, comunicada para este hito:

```text
feature/chat-model-persistence
```

El estado funcional actual incluye Biblioteca exclusiva, chat persistente por obra, contexto del libro activo, filtrado de salida interna, preferencias globales de modelo/variante, restauración de Biblioteca, Ajustes, temas y estados sin obra.

La validación comunicada incluye lint y build limpios, arranque de Electron y los escenarios manuales de la sección 14. Los pendientes de la sección 16 no se consideran resueltos por esa validación.

## 7. OpenCode — estado conocido

La integración se probó inicialmente con OpenCode 1.18.31; no es una versión mínima rígida ni una afirmación sobre la versión instalada actualmente.

Arranque gestionado por Electron main:

```text
opencode serve --hostname 127.0.0.1 --port 0
```

El proceso principal concentra archivos, procesos, HTTP y SSE. El renderer accede mediante IPC estrecho y tipado, con:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
```

Están trabajados y validados el servidor local, salud, descubrimiento dinámico, primary, envío, streaming, retry de modelo incompatible y cierre del proceso gestionado. La configuración de proveedores y credenciales se realiza mediante OpenCode, fuera de Inkforge.

No depender de `/api/session/{id}/wait`: en la versión inicialmente probada devolvía 503.

Las operaciones narrativas exigen una obra válida y rechazan solicitudes cuyo workspace haya cambiado. No hay chat asociado a `projectId = null`.

## 8. Director, modelos y streaming

### Conversación visible por obra

El historial visible del Director persiste en `.inkforge/director-chat.json` dentro de cada obra gestionada.

- Se recupera tras reiniciar.
- Está aislado entre obras.
- Todos los libros de una saga comparten una conversación visible.
- Cambiar de libro no crea otro chat ni reinicia OpenCode.
- Las fronteras técnicas de las sesiones OpenCode no dividen la conversación visible.
- El remontaje de `EditorPanel` por proyecto se conserva.
- Continuidad del chat, memoria narrativa y canon son conceptos distintos. El historial no convierte una respuesta en canon.

### Modelo y variante globales

Modelo y variante se guardan como preferencias globales de Inkforge, fuera del contenido narrativo. Se conservan entre cambios de obra y reinicios.

Reglas:

- Catálogo dinámico de OpenCode, sin listas manuales de proveedores o modelos.
- No elegir simplemente el primer modelo.
- Se conserva la preferencia si sigue disponible y la variante si el modelo la admite.
- El fallback existente puede usar el default declarado cuando hay un único proveedor representado.
- Sin resolución válida, el usuario debe seleccionar un modelo.
- Variante vacía significa predeterminada.
- **Gratis / Otros modelos:** gratuidad identificada explícitamente por ID o nombre oficial; un coste reportado de cero no basta.

La persistencia y los selectores de variante están validados. El comportamiento completo de variants en interacciones reales sigue pendiente.

### Salida visible

El flujo de presentación filtra partes `reasoning`, `synthetic` e `ignored`. Solo se muestra texto visible de respuesta. La prueba manual confirmó que no aparecen trazas temporales de razonamiento durante el streaming.

Se conserva la reconciliación SSE por mensaje, rol y parte para evitar duplicados. El asistente se presenta como `Inkforge`. El retry de modelo incompatible está validado.

Permisos y questions tienen componentes implementados, pero su validación real completa sigue pendiente.

## 9. Vault y seguridad

El acceso documental se limita a Markdown de una obra gestionada activa:

- Rechazo de rutas absolutas, `..`, elementos ocultos y symlinks.
- Resolución con `realpath` y contención dentro del ámbito activo.
- Validación de títulos, manifiestos, rutas y colisiones.
- Lecturas y escrituras vinculadas al ID de la obra, para evitar guardar un documento en otra selección.

Contrato documental básico, además de metadatos opcionales de presentación:

```ts
interface VaultDocument {
  projectId: string
  name: string
  path: string
  content: string
  revision: string
}
```

`revision` es el SHA-256 hexadecimal del contenido UTF-8 exacto.

## 10. Guardado, conflicto y documento desaparecido

La edición empieza con `Editar`; el guardado es explícito, mediante botón o `Ctrl+S` / `Cmd+S`.

```ts
vault.write(
  relativePath: string,
  content: string,
  expectedRevision: string,
  projectId: string,
)
```

El resultado distingue éxito, conflicto externo y ruta desaparecida:

```ts
type VaultWriteResult =
  | { ok: true; document: VaultDocument }
  | { ok: false; reason: 'conflict'; currentDocument: VaultDocument }
  | { ok: false; reason: 'missing'; path: string }
```

`SaveState` incluye `idle`, `saving`, `error`, `conflict` y `missing`.

Se abre el archivo existente sin crearlo. Un único `FileHandle` permite releer, comparar la revisión y, solo después, escribir desde byte 0, truncar y sincronizar. Reduce TOCTOU; no constituye un CAS atómico del sistema operativo.

Comportamiento:

- **Conflicto:** no sobrescribe, conserva el borrador y bloquea el guardado. Al descartar se relee el disco.
- **Ruta desaparecida:** conserva el borrador; no infiere renombres, no adopta otra ruta ni recrea el archivo.
- **Error técnico o pérdida de ámbito:** informa del problema sin perder el borrador ni redirigir el guardado a otra obra.

## 11. Watchers y protección de borradores

El watcher del árbol utiliza `fs.watch` recursivo, debounce de 200 ms y `vault:changed`. Los refrescos ordinarios actualizan la estructura sin recargar documentos ni borrar borradores; ante un fallo de refresco conservan el árbol anterior.

La Biblioteca tiene su propio refresco y reconciliación de la selección activa. Si desaparece la obra:

- deja de considerarla activa y establece obra/libro en `null`;
- limpia la preferencia persistida;
- no selecciona otra obra ni interpreta otra carpeta como un renombrado;
- actualiza la UI y desvincula el workspace narrativo;
- no recrea la obra.

Si existe un borrador sin guardar, permanece en memoria con un aviso. Se bloquea su guardado para no sobrescribir contenido, escribirlo en otra obra ni recrear la ruta eliminada. El usuario puede copiarlo; antes de cambiar de obra debe cancelar la acción o confirmar el descarte.

Se ha probado manualmente la eliminación de la obra activa con un borrador sin guardar.

El cierre protegido se resuelve en Electron mediante `appWindow.onCloseRequested` y `appWindow.confirmClose`: Cancelar conserva el borrador y `Salir sin guardar` confirma el cierre. OpenCode también se detiene al cerrar Inkforge.

## 12. Biblioteca — selección y persistencia

La Biblioteca permite crear novelas y sagas, añadir libros, seleccionarlos explícitamente y renombrar obras/libros. El borrado desde Inkforge sigue pendiente.

### Sin obra activa

`activeProject = null` y `activeBook = null` son un estado válido. Si `vault/Proyectos` falta o no contiene obras válidas, Inkforge arranca sin crear contenido narrativo ni seleccionar carpetas arbitrariamente.

Biblioteca, Ajustes y Ayuda siguen disponibles. Se puede crear o seleccionar una obra. El Director muestra que necesita una obra activa.

### Restauración al arrancar

`library-selection.json` es una preferencia local versionada de Electron fuera del vault, con validación defensiva y escritura segura. Conserva última obra y último libro:

```json
{
  "version": 1,
  "activeProjectId": null,
  "activeBookId": null
}
```

- La selección se restaura antes de iniciar OpenCode.
- Si la obra existe, se restaura su ámbito.
- Si ya no existe, se limpia la selección y se arranca sin obra; las demás siguen visibles.
- No se selecciona otra novela o saga automáticamente ni se vuelve al contenido heredado.
- Si falta el último libro de una saga, se conserva la saga y se elige el primero válido disponible.
- Si la saga no tiene libros, sigue activa con `activeBook = null` y permite añadirlos.

Abrir un documento no cambia el libro activo. Cambiar de libro con un borrador requiere cancelar o descartar; ese descarte no escribe el borrador en disco.

## 13. Biblioteca — decisiones de interfaz cerradas

- `Nueva obra` aparece antes de `Obra activa`.
- Sin selección, el selector muestra `Selecciona una obra`; es un placeholder, no un proyecto.
- Se ocultan o deshabilitan las acciones que requieren obra o libro activos.
- En una saga: `Nueva obra` → `Obra activa` → `Renombrar saga` → `Añadir libro` → `Libro activo` → `Renombrar libro`.
- El explorador muestra `Proyecto.md`, las áreas compartidas y solo el libro activo.
- El rótulo del libro activo no es desplegable ni representa una carpeta artificial; las rutas siguen bajo `Libros/<id>/...`.
- En una novela se mantiene el árbol directo y no aparece selector de libro.

## 14. Validación confirmada

Resultados comunicados de la validación del código funcional actual:

| Área | Resultado confirmado |
|---|---|
| Comprobaciones de desarrollo | Lint limpio; build TypeScript/Vite limpio; Electron abre |
| Chat | Persistencia tras reinicio; aislamiento entre obras; misma conversación entre libros de una saga |
| Preferencias IA | Modelo y variante persistentes; grupos Gratis / Otros modelos |
| Restauración | Última obra y último libro recuperados cuando existen |
| Contexto y salida | Libro activo correcto; razonamiento interno no visible durante streaming |
| Apariencia | Claro, Oscuro y Sistema; Sistema reacciona en caliente |
| Conexión | Indicador de conexión y errores funcionales |
| Biblioteca vacía | Arranque sin obra y acceso a las funciones globales |
| Eliminación entre reinicios | Última obra ausente deja la selección vacía |
| Eliminación durante ejecución | Obra desvinculada; borrador sin guardar protegido |

El registro previo también recoge navegación y edición Markdown, guardado seguro, conflictos, `missing`, cierre protegido, navegación entre libros, localización en cuatro idiomas y Ayuda integrada.

Estos resultados proceden de comprobaciones ejecutadas manualmente; no acreditan una suite automática. Actualmente no hay suite automática propia confirmada. No equivalen a validación completa de permisos, questions o ejecución real de variants.

## 15. Ajustes, localización y Ayuda

El engranaje del encabezado abre Ajustes globales:

- **General:** idioma.
- **Apariencia:** Sistema / Oscuro / Claro.
- **IA / Director:** modelo / variante.

Las preferencias pertenecen a Inkforge, no a una obra, vault o Markdown. Idioma, tema y selección de modelo usan almacenamiento local de la aplicación.

### Apariencia y primera configuración

La preferencia estable es `system | dark | light`. Se persiste bajo `inkforge:theme`; Sistema resuelve `prefers-color-scheme` y reacciona al cambio del SO sin reiniciar. Los temas usan variables CSS semánticas y `data-theme`.

Si no existe selección de modelo persistida, Ajustes puede abrirse automáticamente para solicitarla. No se confunde con catálogo pendiente, reconexión o remontaje del Director. El diálogo puede cerrarse y la aplicación sigue siendo utilizable manualmente sin IA.

Si un catálogo cargado correctamente confirma que falta el modelo guardado, se conserva el fallback válido; si no hay resolución válida, se solicita otra selección con un aviso y sin reapertura continua.

### Estado de OpenCode

El indicador del encabezado sustituye el encabezado técnico y los textos permanentes de conexión del Director:

- Verde: conectado.
- Naranja: iniciando o reconectando.
- Rojo: error o desconectado.

Tiene descripción accesible y localizada. Los errores funcionales y reintentos existentes siguen visibles cuando corresponden. Modelo y variante están en Ajustes.

### Localización

La interfaz usa `i18next` y `react-i18next` con español, inglés, catalán y coreano. El idioma se cambia desde Ajustes, se persiste como `inkforge:locale` y actualiza `document.documentElement.lang`. La detección inicial se limita a idiomas compatibles; español es el respaldo.

Solo se traduce texto propio de la interfaz. Markdown, rutas, títulos del usuario y mensajes literales externos no se traducen.

Las etiquetas estructurales gestionadas usan claves de presentación explícitas del proceso principal. `name` y `path` permanecen literales; los nodos no reconocidos usan su nombre físico. No se renombra contenido ni se infiere estructura por coincidencias de texto.

### Ayuda e importación futura

El botón `?` abre Ayuda localizada, con cierre mediante Cerrar, Escape u overlay y scroll para ventanas pequeñas. Abrirla no modifica documento, borrador, obra ni libro.

Incluye una guía de preparación con las estructuras físicas de novela y saga. **No existe todavía un importador funcional.**

La primera importación sigue definida como:

- Solo estructuras compatibles.
- Validar antes de copiar.
- Copiar de forma no destructiva a la Biblioteca, sin modificar el original.
- Sin importador genérico, renombrado automático ni inferencia arbitraria.
- *El Cambio* como referencia de desarrollo, no como requisito ni acoplamiento.

## 16. Problemas conocidos y pendientes

### Problema conocido sin corregir

En una saga renombrada se detectó que el frontmatter de `Proyecto.md` contiene el título nuevo mientras el H1 conserva el anterior. La discrepancia todavía no está corregida; validar el renombrado básico no implica que ambos títulos estén sincronizados.

### Validación o desarrollo todavía incompletos

- Permisos reales de OpenCode.
- Questions en interacciones reales.
- Flujo real de variants, más allá del selector y su persistencia.
- Estrategia de motores IA e integración prevista, incluida la propuesta de Codex con cuenta ChatGPT y OpenCode multiproveedor.
- Portabilidad Windows/Linux.
- Packaging Windows y validación de `projectRoot` y rutas en el ejecutable.
- Importación compatible.
- Perfiles de género/estilo, herencia Saga → Libro y eliminación de supuestos editoriales heredados que no sean generales.
- Conflictos, diff, elección de versión y merge avanzados.
- Borrado de obras y libros.
- Evolución posterior de Biblioteca y del flujo IA.

## 17. Documentación y continuidad

- **README:** entrada al proyecto, arquitectura, requisitos, desarrollo, funciones actuales y límites importantes.
- **Ayuda integrada:** guía de uso de las funciones existentes.
- **Este documento:** estado técnico, decisiones, validaciones, problemas, pendientes y siguiente paso.

Para continuar en otra conversación: leer las instrucciones del proyecto y este documento, no pedir repetir información ya registrada y comprobar información dinámica solo cuando esté autorizado. Al cerrar nuevos hitos, actualizar el estado distinguiendo implementación de validación.

## 18. Roadmap y siguiente paso exacto

El siguiente paso es **validar permisos reales de OpenCode**. El bloque de trabajo queda ordenado así:

1. Validación real de permisos de OpenCode.
2. Validación real de questions.
3. Validación del flujo de variants.
4. Motores IA e integración prevista.
5. Portabilidad Windows/Linux.
6. Packaging Windows y validación de rutas.
7. Después, importación compatible.

La importación no es el siguiente hito inmediato. Cuando corresponda, debe validar antes de copiar, preservar el proyecto fuente y aceptar únicamente estructuras compatibles, sin importador genérico, renombrado automático ni inferencia de estructura.
