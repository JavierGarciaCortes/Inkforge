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
- `INKFORGE_LIBRARY_ROOT` identifica la Biblioteca global (`vault/`); no cambia el significado de `VAULT_PATH`.
- `INKFORGE_INFRASTRUCTURE_ROOT` identifica la raíz técnica usada como `cwd` del MCP local; no forma parte del vault ni del canon.
- Cambiar de obra cambia el workspace y reconecta OpenCode.
- Cambiar de libro dentro de una saga mantiene la conversación y el workspace de la saga, no reinicia OpenCode y aplica al turno el nuevo `book_scope` autoritativo.
- Cada turno recibe desde Inkforge una parte de texto `synthetic` con el contexto privado y autoritativo de la obra y el libro activos. La selección de ese turno sustituye cualquier selección anterior conservada en el historial.
- El libro activo no se deduce mediante fechas, contenido, títulos, números, posición ni otras heurísticas; no existe fallback `books[0]`.
- El contexto técnico se utiliza silenciosamente y se filtra del historial visible.

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
- La raíz `vault/` contiene recursos globales (`Generos/`, `Plantillas/`) y `Proyectos/`. No se migra automáticamente una obra antigua al abrirla.
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
3a39a03 feat: complete markdown vault runtime migration
78251af merge publicado en main del hito de runtime Markdown
```

Son referencias históricas, no una comprobación del checkout actual. No se afirma que los cambios recientes estén commiteados, mergeados, enviados ni que la rama esté limpia.

## 6. Rama y estado de trabajo actual

Los hitos cerrados se integran en `main`. La rama exacta es un dato dinámico que debe comprobarse con Git cuando sea necesario; este documento no fija una rama temporal ni un hash actual.

El estado funcional incluye Biblioteca exclusiva, chat persistente por obra, contexto del libro activo, filtrado de salida interna, perfiles de género, preferencias globales de modelo/variante, restauración de Biblioteca, Ajustes, Ayuda, temas y estados sin obra.

Las validaciones previas y las comunicadas para perfiles, renombrado, variantes y la nueva interfaz se detallan en la sección 14. Esta actualización no implica nuevas comprobaciones de ejecución.

### Validado en el hito anterior

- La selección persistida vuelve a incluir `activeProjectId` y `activeBookId`, con migración defensiva de formatos anteriores y restauración del ID exacto cuando todavía existe.
- Biblioteca, Director y MCP comparten el mismo `activeBook`; activar, crear o renombrar el libro activo persiste su ID, y su desaparición externa deja `activeBook = null` sin seleccionar otro.
- El contexto operativo privado se envía en cada turno como una parte `synthetic` efectiva para OpenCode 1.18.34, separada del mensaje visible y filtrada del historial de Inkforge.
- `inkforge-context` recibe un `cwd` portable mediante `INKFORGE_INFRASTRUCTURE_ROOT`, aunque el workspace narrativo sea una novela o saga.
- Las instrucciones prohíben arrancar manualmente el servidor MCP, recrear su protocolo, usar scripts temporales para emularlo o deducir y hardcodear `book_scope`.

El responsable confirmó manualmente la restauración y persistencia exactas del libro, los estados sin libro y sin fallback, el cambio en caliente Endless Two → Endless One sin reiniciar OpenCode, el contexto `synthetic` invisible, `inkforge-context`, los `book_scope` de ambos libros, el arranque MCP en sesiones nuevas, la selección puntual de ámbito sin persistirla y el `cwd` portable normalizado en Windows. Para ese hito anterior también comunicó como satisfactorios `git diff --check`, `git diff --cached --check`, `node --check` de los módulos Electron modificados, validación JSON de `opencode.json`, build, lint y `python -m compileall .tools`. En el hito actual `feature/library-advanced-management` se ejecutaron satisfactoriamente `git diff --check` —sin errores y únicamente con avisos de conversión LF → CRLF—, `node --check` sobre los módulos Electron modificados, incluido `app/electron/content-revision.cjs`, `npm --prefix app run lint` y `npm --prefix app run build`; se realizaron después de la implementación y se repitieron después de corregir el conflicto exacto del guardado unificado de géneros. En este hito no se ejecutaron `git diff --cached --check`, `python -m compileall`, una nueva validación de `opencode.json`, tests automáticos ni una comprobación técnica automatizada de OpenCode/MCP.

### Implementado en este hito; validado manualmente en sus flujos principales

- Borrado irreversible y confirmado de novelas, sagas completas y libros individuales, sin papelera ni fallback de selección.
- Reordenación contigua de libros mediante `numero:` y directorios físicos, con nombres temporales internos, rollback best-effort e identidad activa persistida.
- Conversión de libro de saga a novela independiente mediante copia validada antes de retirar el original; los fallos de retirada conservan la copia nueva y se presentan como resultado parcial.
- Protección selectiva de borradores, IPC semántico estrecho, refresco determinista y cadenas nuevas en español, inglés, catalán y coreano.
- Guardado único de géneros: una sola acción persiste la obra y, cuando hay libro activo en una saga, coordina `Proyecto.md`, `Libro.md` y `hereda_generos` después de validar ambos manifiestos; si falla la segunda escritura intenta restaurar la primera. Las revisiones son el mismo SHA-256 del contenido UTF-8 exacto usado por el editor del vault.

Durante la validación manual del guardado unificado se confirmó el caso normal y se detectó que la primera implementación comparaba solo los campos de género: un cambio externo en otra parte del manifest no producía conflicto. Se corrigió añadiendo revisiones exactas de `Proyecto.md` y `Libro.md`, comparadas para ambos antes de la primera escritura. La corrección se validó manualmente en novela, saga sin libro activo y saga con libro activo, incluidos conflictos externos ajenos a los géneros y un segundo guardado sin cerrar el diálogo.

El responsable del proyecto comunicó validaciones manuales de los flujos principales de borrado, reordenación, extracción, selección, protección de borradores, seguridad, confirmaciones y localización, detalladas en la sección 14. Los casos concretos restantes se delimitan en la sección 16. En esta actualización documental no se han ejecutado Git, tests, lint, build, Electron ni OpenCode.

## 7. OpenCode — estado conocido

La integración se probó inicialmente con OpenCode 1.18.31; no es una versión mínima rígida ni una afirmación sobre la versión instalada actualmente.

El transporte del contexto por una parte `synthetic` y el `cwd` configurable del MCP se comprobaron realmente con OpenCode 1.18.34; esta referencia no establece una versión mínima rígida.

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

El contrato de interacción de OpenCode está implementado y validado manualmente con anterioridad: las preguntas aparecen en la UI, admiten respuesta y rechazo, y se recuperan tras recargar el renderer; los permisos aparecen en la UI, admiten respuesta y también se recuperan tras la recarga. Tras un reinicio completo de OpenCode, una interacción interrumpida se muestra como no accionable, no reaparece una tarjeta obsoleta accionable y no se reintenta automáticamente. Una intención explícita de escritura se ejecuta sin confirmación redundante; una propuesta sin intención de escritura no escribe. Se comprobó el enrutado para obra independiente, saga, libro activo y áreas compartidas.

Antes de reutilizar una sesión OpenCode persistida, Inkforge valida que exista y que su workspace coincida con la obra activa. Los resultados `session_missing` y `session_workspace_mismatch` descartan esa sesión como activa, conservan el historial visible y permiten crear o utilizar después una sesión válida para el workspace actual, sin reenviar automáticamente un mensaje ambiguo. Este flujo está implementado y validado.

También está implementada y validada la corrección de la carrera entre la respuesta HTTP y los eventos SSE al responder preguntas o permisos. Si SSE demuestra que la interacción ya se resolvió, un error HTTP tardío no deja un falso error global; si el error HTTP llega primero, la resolución posterior por SSE lo retira. Completar una interacción anterior no elimina una pregunta nueva abierta mientras tanto y no se realiza retry automático.

Las operaciones narrativas exigen una obra válida y rechazan solicitudes cuyo workspace haya cambiado. No hay chat asociado a `projectId = null`.

El proceso OpenCode conserva como `directory` la obra activa. Para el MCP local, `opencode.json` usa `cwd: "{env:INKFORGE_INFRASTRUCTURE_ROOT}"`, de modo que `.tools/inkforge_mcp.py` se resuelve desde la infraestructura sin copiar herramientas al vault ni hardcodear rutas de desarrollo.

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

### Desarrollo guiado derivado de los Markdown

El Director dispone de `get_development_state` para iniciar o continuar de forma adaptativa el desarrollo de una obra. La herramienta relee el ámbito vigente y clasifica los documentos gestionados de planificación y `Canon de libro.md` como ausentes, plantilla intacta o con contenido. También incluye un inventario de capítulos y Markdown de `Notas/`, `Mundo/`, `Estilo/` y `Referencias/` mediante rutas relativas seguras y vistas acotadas.

No existe estado persistente de onboarding, porcentaje de completitud ni evaluación semántica de calidad. `blank_scaffold` solo indica que no se ha encontrado contenido narrativo añadido fuera de los encabezados iniciales contemplados. El Director no usa un cuestionario obligatorio: parte de la idea o material disponible, consulta después los Markdown pertinentes y continúa desde el punto real sin reiniciar obras parcialmente desarrolladas.

En una saga, la instantánea exige el `book_scope: Libros/<id>` autoritativo. Planificación, canon, capítulos y notas pertenecen solo al libro activo; mundo, estilo y referencias se muestran como material compartido de la obra. La conversación, el brainstorming y las propuestas siguen sin ser canon. Solo una orden explícita —incluida una autorización continuada para guardar decisiones confirmadas durante una tarea guiada— permite persistir los Markdown afectados.

La capa objetiva de desarrollo vive en `.tools/development_state.py`; `session_check.py` la reutiliza y conserva su salida de textos de planificación cuando se solicita `--full`. El hito no añade memoria narrativa, base de datos, fichero de onboarding ni selección paralela de libro; durante su validación también fue necesario endurecer en Electron y React la recuperación de sesiones OpenCode y la reconciliación de preguntas y permisos.

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

El selector y la persistencia de variante están implementados y cuentan con validación previa. La variante elegida se envía en el campo superior `variant` de cada mensaje, separado de `model`; la opción vacía omite ese campo para usar el comportamiento predeterminado de OpenCode. Cambiar solo la variante se aplica al siguiente mensaje sin reiniciar sesión, proceso ni chat. El catálogo se vuelve a consultar antes de enviar una variante explícita; si esta desaparece, se usa la opción predeterminada y se actualizan preferencia y UI. Se comprobó manualmente un envío real con un modelo compatible, GPT 5.6 luna y variante `medium`. Los escenarios secundarios figuran en la sección 16.

### Salida visible

El flujo de presentación filtra partes `reasoning`, `synthetic` e `ignored`. Solo se muestra texto visible de respuesta. La prueba manual confirmó que no aparecen trazas temporales de razonamiento durante el streaming.

El contexto operativo privado se vuelve a construir desde el estado Electron y se envía en cada turno como primera parte de texto con `synthetic: true`; la segunda parte contiene el mensaje real del usuario. No se crea una sesión nueva ni se reinicia OpenCode al cambiar de libro. Se confirmó manualmente el cambio de libro en caliente, el libro correcto recibido por el Director y la ausencia de la parte `synthetic` en el historial visible.

Se conserva la reconciliación SSE por mensaje, rol y parte para evitar duplicados. El asistente se presenta como `Inkforge`. El retry de modelo incompatible está validado.

El contrato de preguntas, permisos, recuperación y enrutado está implementado y validado manualmente, como se detalla en la sección 7.

## 9. Vault y seguridad

El acceso documental se limita a Markdown de una obra gestionada activa:

- Rechazo de rutas absolutas, `..`, elementos ocultos y symlinks.
- Resolución con `realpath` y contención dentro del ámbito activo.
- Validación de títulos, manifiestos, rutas y colisiones.
- Lecturas y escrituras vinculadas al ID de la obra, para evitar guardar un documento en otra selección.

En una saga, la exploración directa del filesystem respeta el mismo `book_scope`: puede acceder a `Proyecto.md`, `Mundo/`, `Estilo/`, `Referencias/` y al `Libros/<id>/` activo. No puede recorrer o enumerar globalmente `Libros/`, lanzar búsquedas recursivas desde la raíz que atraviesen otros libros ni consultar siquiera los nombres o la existencia de archivos bajo otro libro. Este aislamiento físico está implementado y validado.

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

La Biblioteca permite crear novelas y sagas, añadir libros, seleccionarlos explícitamente, renombrar obras/libros y ejecutar gestión avanzada. Las mutaciones de filesystem permanecen en Electron main y el renderer solo envía IDs semánticos validados, nunca rutas arbitrarias.

- El borrado es definitivo y no existe papelera. Solo actúa sobre obras o libros que vuelven a validarse mediante contención, `realpath`, manifest y rechazo de symlinks; la UI exige una confirmación específica con el título exacto.
- La reordenación persiste exclusivamente en `numero:` y en el prefijo físico `NN - Título`. Todos los libros se aíslan primero bajo nombres temporales únicos dentro de `Libros/`, se actualizan sus manifests y se publican con rollback best-effort ante fallo. No existe índice paralelo.
- Sacar un libro crea primero una novela completa en staging, copia `Mundo`, `Estilo` y `Referencias` de la saga, incorpora los ámbitos del libro y transforma `Libro.md` en `Proyecto.md` con los géneros efectivos. Solo tras publicar y validar la nueva obra intenta retirar el original; si esto último falla, conserva ambas copias e informa del resultado parcial.
- Eliminar o extraer el libro activo deja la saga con `activeBook = null`; eliminar otro libro conserva la selección. Reordenar actualiza y persiste el ID físico nuevo del mismo libro lógico. Ninguna de estas rutas elige otro libro ni activa automáticamente la novela extraída.

### Perfiles editoriales globales

El mecanismo de perfiles de género está implementado sobre Markdown, sin base de datos adicional. `vault/Generos/*.md` es el catálogo dinámico: los archivos directos y seguros se descubren en cada consulta, incluidos los añadidos manualmente durante una sesión. `vault/Plantillas/` conserva recursos globales reutilizables; `vault/Proyectos/` contiene las obras locales. `Estilo/` dentro de una obra o saga sigue siendo configuración específica de esa obra.

`Proyecto.md` guarda `generos`; `Libro.md` guarda `hereda_generos` y sus `generos` propios. El libro hereda los géneros de la saga por defecto y añade los propios; con herencia desactivada usa solo los suyos. Los géneros efectivos se derivan en cada lectura. La configuración admite cero o varios perfiles, conserva los nombres asignados cuyo Markdown falte y los presenta como no disponibles. Los manifiestos antiguos carecen de estos campos por defecto y no se reescriben al abrirse. Cada manifiesto se guarda por separado, conservando cuerpo y metadatos ajenos.

El Director recibe solo los nombres efectivos en su contexto privado y puede leer perfiles pertinentes con el MCP `inkforge-context`. `VAULT_PATH` continúa siendo la obra activa; `INKFORGE_LIBRARY_ROOT` es la Biblioteca global. Los perfiles son orientación editorial, no canon, y no tienen pesos ni jerarquía primaria/secundaria. Ya están aprobados once perfiles base en `vault/Generos/`: Fantasía, Ciencia ficción, Misterio, Thriller, Romance, Terror, Histórica, Aventura, Distopía, Ficción política y Ficción social. La guía global `vault/Plantillas/perfil-genero.md` define la creación de futuros perfiles. El Director puede crear o actualizar uno solo ante una petición explícita; no existe herramienta de borrado de perfiles.

Se comunicó validación manual del descubrimiento dinámico y la creación explícita de perfiles mediante Director/MCP; creación de saga y `Proyecto.md` con `generos`; primer `Libro.md` con `hereda_generos: true` y `generos: []`; segundo libro con herencia y perfil adicional; desactivación de herencia; cálculo de géneros efectivos; conservación de asignaciones no disponibles al guardar otros cambios; detección de cambios externos concurrentes en `Libro.md`; reconocimiento de perfiles efectivos por el Director y lectura de su Markdown real mediante MCP. La creación real de `Ficción social.md` por el Director usando la guía global se utilizó como prueba funcional y se revisó después. No existe script `npm test` ni suite automática confirmada; no se ejecutaron comprobaciones para esta actualización.

### Retirada de contenido heredado

La raíz global de `vault/` conserva `Generos/`, `Plantillas/` y `Proyectos/`. Con autorización explícita se retiraron `vault/.obsidian/`, `vault/Estilo/`, `vault/Mundo/`, `vault/Referencias/`, `vault/Plantillas/config.json`, `vault/Plantillas/ejemplos/` y el antiguo `vault/Capítulos/` vacío. Los directorios `Mundo/`, `Estilo/`, `Referencias/` y `Capítulos/` dentro de las obras gestionadas siguen siendo parte de su estructura.

También se retiró la carpeta legacy `.fiction/`, incluidos `config.json` y `session_log.json`, y su regla en `.gitignore`. No hay una configuración sustitutiva en `.inkforge/`; `.inkforge/director-chat.json` de cada obra es solo estado de conversación.

### Herramientas editoriales y desarrollo guiado

Las herramientas Python se han adaptado a la estructura de obras de Inkforge. `Proyecto.md` y `Libro.md` identifican obra y libro; cada capítulo aporta número, título y POV desde su Markdown. `VAULT_PATH` es la raíz exacta de la obra activa y las operaciones de libro en saga requieren `book_scope: Libros/<id>` proporcionado por Inkforge. El servidor `inkforge-context` construye su índice de Markdown para cada llamada y distingue documentos por ruta relativa, de modo que un cambio de libro no reutiliza el índice anterior ni necesita reiniciar OpenCode. `get_development_state` deriva en cada consulta el estado de planificación, canon, capítulos, notas y material compartido; `session_check.py` usa la misma capa en vez de mantener otra implementación. `INKFORGE_LIBRARY_ROOT` queda reservado para perfiles y plantillas globales.

Se retiraron los módulos de manifiesto JSON de capítulos y sincronización YAML, y se eliminó la dependencia funcional de `.fiction/config.json` y `.fiction/session_log.json` de scripts, MCP y atajos. La instantánea de `session_check.py` describe el estado actual y no pretende reconstruir diferencias entre sesiones. Los análisis basados en Save the Cat, tres actos, midpoint o consejos de King/Sanderson se ofrecen solo cuando el usuario o la obra eligen ese marco.

La capa de desarrollo guiado se validó con scaffold inicial de novela, planificación con contenido, capítulo sin planificación, material compartido de mundo, saga con `book_scope` exacto, cambio de libro en la misma sesión, formatos BOM y CRLF/LF, límites del inventario, junction sin recorrido, `session_check.py` en modos quick/full, flujo Director → Writer y guardado provisional sin contaminar canon. También se comprobó la ausencia de contaminación entre libros. Siguen pendientes las herramientas editoriales no enumeradas como confirmadas de extremo a extremo, entre ellas casos adicionales de creación e inserción de capítulos, análisis y publicación.

El dashboard Astro de `web/` es secundario. Su generador ya recibe una obra mediante `VAULT_PATH` y, para una saga, un scope explícito por invocación; lee metadatos y planificación Markdown sin `.fiction`. La UI del dashboard conserva visualizaciones heredadas y no se ha adaptado visualmente por completo a cualquier novela o saga. El JSON que genera es un artefacto de presentación, no una fuente de canon. Esta adaptación tampoco se ha ejecutado ni validado en esta intervención.

### Sin obra activa

`activeProject = null` y `activeBook = null` son un estado válido. Si `vault/Proyectos` falta o no contiene obras válidas, Inkforge arranca sin crear contenido narrativo ni seleccionar carpetas arbitrariamente.

Biblioteca, Ajustes y Ayuda siguen disponibles. Se puede crear o seleccionar una obra. El Director muestra que necesita una obra activa.

### Restauración al arrancar

`library-selection.json` es una preferencia local versionada de Electron fuera del vault, con validación defensiva y escritura segura. Conserva última obra y último libro:

```json
{
  "version": 3,
  "activeProjectId": null,
  "activeBookId": null
}
```

- La selección se restaura antes de iniciar OpenCode.
- Si la obra existe, se restaura su ámbito y, para una saga, exclusivamente el libro cuyo `activeBookId` persistido siga siendo válido.
- Si ya no existe, se limpia la selección y se arranca sin obra; las demás siguen visibles.
- No se selecciona otra novela o saga automáticamente ni se vuelve al contenido heredado.
- Si falta el último libro de una saga, se conserva la saga con `activeBook = null`, se persiste ese estado y no se elige otro libro.
- Si la saga no tiene libros, sigue activa con `activeBook = null` y permite crear uno explícitamente.
- Activar o crear un libro lo convierte en `activeBook` y persiste su ID. Renombrar el libro activo sustituye y persiste el ID real devuelto por la operación.
- Los formatos anteriores se migran de forma defensiva: un estado sin `activeBookId` produce `null`, y un ID anterior válido se conserva. Los campos malformados se rechazan.
- No existe fallback `books[0]`; el libro activo nunca se infiere.

Abrir un documento no cambia el libro activo. Cambiar de libro con un borrador requiere cancelar o descartar; ese descarte no escribe el borrador en disco.

## 13. Biblioteca — decisiones de interfaz cerradas

- La cabecera muestra Inkforge y su lema, punto de conexión con texto localizado (`Conectado`, `Conectando…`, `Error`), Ayuda y Ajustes. El contexto OpenCode sigue disponible de forma accesible en el indicador; no se muestran permanentemente el icono cuadrado `I`, `Biblioteca`, la versión ni la palabra `OpenCode` junto al estado.
- La barra lateral presenta el título y tipo de obra activa (`Saga` o `Novela`), `Nueva obra`, `Gestionar obra`, el selector `Obra activa` y, si es saga, `Libro activo`. El árbol documental ocupa el espacio restante. Ya no presenta encabezado `Biblioteca`, contador de documentos, pie redundante ni botones permanentes separados para renombrar, géneros o añadir libro.
- Sin selección, el selector muestra `Selecciona una obra`; es un placeholder, no un proyecto. Se ocultan o deshabilitan acciones que requieren obra o libro activos.
- `Gestionar obra` agrupa para novela renombrado y `Géneros`; para saga, renombrado, géneros, alta, listado ordenado, subida/bajada, extracción y gestión de todos sus libros. Un único diálogo de `Géneros` permite configurar conjuntamente la saga y los géneros propios y la herencia del libro activo.
- La `Zona de peligro` aparece al final y separa visualmente `Eliminar novela`, `Eliminar saga completa` y `Eliminar libro «Título»` de las acciones normales. La confirmación enfoca `Cancelar`, se cancela con Escape, advierte que se borran archivos del disco y que Inkforge no tiene papelera, y exige pulsar `Eliminar definitivamente`.
- `Sacar de la saga` no usa estilo destructivo: preserva el contenido convirtiéndolo en novela independiente. `Subir` y `Bajar` son controles explícitos y se deshabilitan en los extremos.
- La navegación es jerárquica: una acción secundaria abierta desde `Gestionar obra` muestra `Atrás` para volver allí; `Gestionar obra` muestra `Cerrar`. Guardar géneros mantiene abierto su diálogo y permite regresar con `Atrás`. Tras renombrar o añadir un libro, se vuelve a `Gestionar obra` si el contexto sigue válido; el libro nuevo queda activo.
- El explorador muestra `Proyecto.md`, las áreas compartidas y solo el libro activo; el selector de libro no representa una carpeta artificial y las rutas siguen bajo `Libros/<id>/...`. En una novela se mantiene el árbol directo y no aparece selector de libro.

## 14. Validación confirmada

Resultados comunicados por el responsable del proyecto, correspondientes a validaciones anteriores y manuales posteriores. Ninguna de ellas se ha repetido para esta actualización documental:

| Área | Resultado confirmado |
|---|---|
| Comprobaciones de desarrollo | Para el hito anterior se comunicaron `git diff --check`, `git diff --cached --check`, `node --check` de Electron, JSON de `opencode.json`, build, lint y `python -m compileall .tools` satisfactorios. En `feature/library-advanced-management` se ejecutaron satisfactoriamente, después de la implementación y de nuevo tras corregir el conflicto exacto de géneros, `git diff --check` —sin errores, solo avisos LF → CRLF—, `node --check` de los módulos Electron modificados, incluido `app/electron/content-revision.cjs`, lint y build; no se repitieron las demás comprobaciones históricas ni se ejecutaron tests automáticos o comprobaciones técnicas automatizadas de OpenCode/MCP. Para el hito de preservación de errores se comunicaron como satisfactorios `node --check app/electron/opencode-client.cjs`, `npm --prefix .\app run lint`, `npm --prefix .\app run build` y `git diff --check`, este último sin errores y únicamente con avisos LF → CRLF |
| Comprobaciones de `feature/guided-development` | Lint, build y `git diff --check` comunicados como satisfactorios tras el hito |
| Desarrollo guiado | Scaffold de novela; saga con `book_scope` exacto; planificación con contenido; capítulo sin planificación; material compartido de mundo; cambio de libro en la misma sesión; ausencia de contaminación entre libros; BOM y CRLF/LF; límites de inventario; junction sin recorrido; `session_check.py` quick/full; flujo Director → Writer; guardado provisional sin contaminar canon |
| Chat | Persistencia tras reinicio; aislamiento entre obras; misma conversación entre libros de una saga |
| Recuperación de sesión OpenCode | Sesión persistida validada contra el workspace; recuperación de `session_missing` y `session_workspace_mismatch`; historial visible conservado; sin reenvío automático ambiguo; sesión posterior válida para la obra activa |
| Preferencias IA | Modelo y variante persistentes; grupos Gratis / Otros modelos; envío real comprobado con GPT 5.6 luna y variante `medium` |
| Interacciones OpenCode | Preguntas y permisos visibles y respondidos en UI; rechazo de preguntas; recuperación tras recarga del renderer; interacción interrumpida no accionable, sin tarjeta obsoleta accionable ni reintento automático tras reinicio completo; carrera HTTP/SSE corregida en ambos órdenes, sin falso error global ni pérdida de una pregunta nueva; escritura según intención y enrutado correcto para obra independiente, saga, libro activo y áreas compartidas |
| Perfiles de género | Descubrimiento dinámico, asignación múltiple y herencia, perfiles no disponibles conservados, cambio externo detectado y lectura real por Director/MCP; creación explícita de `Ficción social.md` con la guía global y revisión posterior |
| Renombrado con H1 | Novela y libro: título y H1 actualizados; saga: rechazo seguro ante H1 inconsistente y renombrado correcto tras corregirlo |
| Interfaz de Biblioteca | Cabecera y barra lateral reorganizadas; `Gestionar obra`; `Géneros` → `Atrás` antes y después de guardar; renombrado → `Gestionar obra`; añadir libro → libro nuevo activo y `Gestionar obra` |
| Selección y `activeBookId` | Restauración exacta de obra/libro; reinicio con el libro correcto; ID ausente y saga sin libro dejan `null`; sin fallback aunque existan otros libros; desaparición y restauración física no reactivan; crear y renombrar actualizan y persisten el ID |
| Contexto `synthetic` | El Director recibe el libro correcto; Endless Two → Endless One funciona en caliente sin reiniciar OpenCode; el estado sin libro se comunica correctamente y la parte privada no aparece en el historial visible |
| MCP y ámbito | `inkforge-context` conectado; `book_scope` correcto para Endless One y tras cambiar a Endless Two; disponible desde el inicio de saga/sesión; un ámbito puntual no cambia `activeBook = null`; ese null sobrevive al reinicio; el agente no simula MCP; `cwd` portable funciona en Windows; la exploración física no enumera globalmente `Libros/` ni atraviesa otros libros |
| Apariencia | Claro, Oscuro y Sistema; Sistema reacciona en caliente |
| Conexión | Indicador de conexión y errores funcionales |
| Biblioteca vacía | Arranque sin obra y acceso a las funciones globales |
| Eliminación entre reinicios | Última obra ausente deja la selección vacía |
| Eliminación durante ejecución | Obra desvinculada; borrador sin guardar protegido |
| Libro no activo y último libro activo | Eliminar un libro no activo preservó el libro activo sin fallback. Eliminar el último libro activo dejó la saga con cero libros, la mantuvo activa con `activeBook = null`, mostró `Sin libro activo` y conservó ese estado tras reiniciar |
| Reordenación de tres libros | Con Alpha, Beta y Gamma y Gamma activa, subir Gamma produjo `01 Alpha`, `02 Gamma`, `03 Beta` y `numero: 1/2/3`; Gamma siguió activa con su ID nuevo, también tras reiniciar |
| Extracción con herencia | Sacar Beta no activa de Endless Saga la retiró de la saga y creó una novela independiente sin alterar Gamma activa. La novela contiene `Canon/`, `Capítulos/`, `Estilo/`, `Mundo/`, `Notas/`, `Planificación/`, `Recursos/`, `Referencias/` y `Proyecto.md`; este quedó como novela titulada Beta con `generos: ["Aventura"]`, materializando el género efectivo heredado |
| Extracción de libro activo | Sacar Gamma creó la novela independiente, dejó la saga con `activeBook = null`, no activó Alpha ni la novela nueva y conservó el estado tras reiniciar |
| Colisión de extracción | Con una obra Alpha ya existente, la operación mostró el error localizado equivalente, no sobrescribió el destino y mantuvo intacto el libro original |
| Eliminación de obras activas | Eliminar Endless Saga activa cerró el diálogo, retiró la saga y dejó `activeProject = null` sin autoactivar otra obra, también tras reiniciar. Eliminar una novela activa produjo el mismo estado vacío y persistente |
| Borradores y operaciones destructivas | Un borrador afectado de `Beta/Proyecto.md` mostró primero el aviso de cambios sin guardar; cancelar conservó el estado dirty y, tras descartar, apareció la confirmación destructiva y se pudo eliminar sin pérdida silenciosa. Un borrador no afectado de Test Two Renamed no bloqueó eliminar Test One y permaneció activo y dirty |
| Extracción sin herencia | En MCP Test, con saga Aventura y Test Two Renamed con herencia desactivada y Romance propio, la novela extraída quedó con `generos: ["Romance"]`, sin Aventura |
| Manifest inválido | Cambiar Security Test de `tipo: libro` a un valor inválido lo ocultó de la gestión, dejó la saga sin libro activo y preservó físicamente el directorio; al restaurar el manifest volvió a aparecer, sin borrado |
| Guardado único de géneros | Una sola acción guardó conjuntamente saga y libro activo y persistió `Proyecto.md` y `Libro.md`; en saga sin libro activo y en novela independiente persistió tras cerrar y reabrir. Un cambio externo ajeno a géneros en `Proyecto.md` provocó conflicto sin escribir el diálogo y preservó el cambio; el mismo caso en `Libro.md` evitó toda escritura parcial, dejó intacto `Proyecto.md` y preservó el libro externo. Un segundo guardado sin cerrar funcionó sin conflicto falso y con las revisiones renovadas |
| Seguridad de extracción | La creación de un symlink real en Windows no pudo probarse por falta de privilegios administrativos. Sí se creó un junction dentro de `MCP Test/Libros/01 - Security Test/Recursos` hacia `D:\Proyectos\Inkforge\docs`: la extracción fue rechazada con el mensaje localizado equivalente a «La operación fue rechazada por las reglas de seguridad de la Biblioteca», no copió contenido externo y, tras retirar el junction, la documentación original seguía intacta |
| IPC semántico de borrado | La llamada desde DevTools `window.inkforge.library.deleteProject({ projectId: 'D:\\Proyectos\\Inkforge\\docs' })` fue rechazada con «La obra solicitada ya no está activa o no está disponible.»; esta prueba confirma que ese IPC semántico no convierte una ruta externa arbitraria en objetivo de borrado |
| Confirmación destructiva | Escape canceló la eliminación de libro sin borrar. El foco inicial fue funcionalmente `Cancelar`: Enter inmediato canceló; una pulsación de Tab llevó a `Eliminar definitivamente`. Falta un indicador visual claro del foco inicial en `Cancelar`, registrado como mejora menor de accesibilidad/UX y no como bloqueo funcional |
| Ayuda y localización de gestión | Se revisó manualmente la Ayuda de gestión de obra en español, inglés, catalán y coreano. Las cuatro versiones describen reordenación, renombrado, extracción, borrado irreversible sin papelera, ausencia de fallback o autoactivación, comportamiento al extraer el libro activo y guardado único de géneros |
| Errores OpenCode/proveedor | Inkforge arrancó, OpenCode conectó y un mensaje normal respondió con un modelo funcional. Con la interfaz en inglés, un modelo que producía un error mostró el resumen localizado `OpenCode or the provider returned an error.` y, debajo, el motivo externo literal recibido. El caso concreto empleado para esta validación no establece una restricción general de Inkforge |

El registro previo también recoge navegación y edición Markdown, guardado seguro, conflictos, `missing`, cierre protegido, navegación entre libros, localización en cuatro idiomas y Ayuda integrada.

Estos resultados proceden de comprobaciones comunicadas, en su mayoría manuales; no acreditan una suite automática. Actualmente no hay suite automática propia confirmada. Las comprobaciones adicionales pendientes se delimitan en la sección 16.

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

- Verde y `Conectado`: conectado.
- Naranja y `Conectando…`: iniciando o reconectando.
- Rojo y `Error`: error o desconectado.

La cabecera presenta también Inkforge y su lema, Ayuda y Ajustes. El indicador tiene descripción accesible y localizada con contexto OpenCode. Los errores funcionales y reintentos existentes siguen visibles cuando corresponden. Modelo y variante están en Ajustes; no se muestra una etiqueta técnica permanente de OpenCode.

Los errores recibidos de OpenCode o del proveedor conservan por separado el resumen controlado por Inkforge y un `detail` textual opcional. Ese detalle se extrae únicamente de campos explícitos y estructuras conocidas, se limita a 500 caracteres, elimina caracteres de control peligrosos y no serializa objetos arbitrarios ni expone stacks, headers, cuerpos de solicitud o excepciones JavaScript internas. La UI lo presenta literalmente y sin traducir bajo una etiqueta localizada, lo omite si está vacío y evita duplicarlo respecto al resumen. Para errores externos `unknown` con detalle, el resumen genérico se localiza en español, inglés, catalán y coreano; los mensajes específicos existentes se conservan.

### Localización

La interfaz usa `i18next` y `react-i18next` con español, inglés, catalán y coreano. El idioma se cambia desde Ajustes, se persiste como `inkforge:locale` y actualiza `document.documentElement.lang`. La detección inicial se limita a idiomas compatibles; español es el respaldo.

Solo se traduce texto propio de la interfaz. Markdown, rutas, títulos del usuario y mensajes literales externos no se traducen.

Las etiquetas estructurales gestionadas usan claves de presentación explícitas del proceso principal. `name` y `path` permanecen literales; los nodos no reconocidos usan su nombre físico. No se renombra contenido ni se infiere estructura por coincidencias de texto.

### Ayuda e importación futura

El botón de Ayuda abre una guía localizada, con cierre mediante Cerrar, Escape u overlay y scroll para ventanas pequeñas. Explica Biblioteca, `Gestionar obra`, navegación `Atrás`/`Cerrar`, perfiles editoriales y herencia, lectura y edición, protección de borradores, idioma y modelo/variante desde Ajustes. Abrirla no modifica documento, borrador, obra ni libro.

Incluye una guía de preparación con las estructuras físicas de novela y saga. **No existe todavía un importador funcional.**

La primera importación sigue definida como:

- Solo estructuras compatibles.
- Validar antes de copiar.
- Copiar de forma no destructiva a la Biblioteca, sin modificar el original.
- Sin importador genérico, renombrado automático ni inferencia arbitraria.
- *El Cambio* como referencia de desarrollo, no como requisito ni acoplamiento.

## 16. Problemas conocidos y pendientes

### Hito resuelto

Inkforge preserva y presenta el motivo textual útil recibido desde OpenCode o el proveedor cuando está disponible, separado del resumen controlado. Cubre respuestas HTTP JSON con `message`, `detail` o `error` textual, respuestas HTTP de texto, errores embebidos del assistant, eventos `session.error` y `session.next.step.failed`, y estructuras conocidas bajo `error`, `data` y `data.error`. `classifyEmbeddedError()` conserva el `statusCode` interno y entrega el error embebido completo para no perder textos situados fuera de `data`. No se han alterado clasificación, retry, sesiones, fallback, modelos/proveedores ni arquitectura OpenCode.

### Implementado; validaciones específicas adicionales pendientes

- Inducir el fallo de la segunda escritura del guardado único de géneros y comprobar su rollback best-effort.
- Comprobar el resultado parcial de extracción cuando la novela ya se publicó pero falla la retirada del libro original.
- Completar una prueba con symlink real, distinta del junction ya validado; Windows impidió crear ese symlink sin privilegios administrativos.
- Mejorar, sin carácter bloqueante, el indicador visual del foco inicial en `Cancelar` de la confirmación destructiva.
- Ejercitar casos adicionales de rollback ante fallos del sistema de archivos.
- El renombrado de novela, saga y libro con H1 gestionado ya se comprobó manualmente, incluido el rechazo seguro de un H1 de saga inconsistente. Quedan casos de formato como BOM, CRLF/LF y metadatos adicionales.
- Un envío real con variante compatible ya se comprobó. Quedan la opción predeterminada, cambios repetidos de modelo/variante, persistencia en todos los escenarios, reconexión y desaparición de modelo o variante del catálogo en distintos estados. No hay retry automático de variante basado en texto de error; el reintento existente permite conservar el mensaje tras un fallo.
- Quedan comprobaciones adicionales de presentación adaptable.
- En la preservación de errores quedan comprobaciones secundarias con otros formatos HTTP JSON/texto, variantes de errores embebidos, ambos eventos SSE en más casos reales, payload sin detalle, truncado, caracteres de control, ausencia de exposición de errores JavaScript internos, duplicados, presentación en catalán y coreano, y categorías como cuota, credenciales y otros casos reales de retry.

Cualquier comprobación no enumerada como confirmada en este documento debe seguir considerándose pendiente.

### Desarrollo pendiente

- Evolución posterior de estilo por obra.
- Estrategia de motores IA e integración prevista.
- Portabilidad Windows/Linux.
- Packaging Windows y validación de `projectRoot` y rutas en el ejecutable.
- Importación compatible.
- Publicación y exportación.
- Herramientas editoriales todavía no cubiertas completamente de extremo a extremo.
- Conflictos, diff, elección de versión y merge avanzados.
- Evolución posterior de Biblioteca y Director.
- Tests automatizados; actualmente no hay script `npm test`.

## 17. Documentación y continuidad

- **README:** entrada al proyecto, arquitectura, requisitos, desarrollo, funciones actuales y límites importantes.
- **Ayuda integrada:** guía de uso de las funciones existentes.
- **Este documento:** estado técnico, decisiones, validaciones, problemas, pendientes y siguiente paso.

Para continuar en otra conversación: leer las instrucciones del proyecto y este documento, no pedir repetir información ya registrada y comprobar información dinámica solo cuando esté autorizado. Al cerrar nuevos hitos, actualizar el estado distinguiendo implementación de validación.

## 18. Roadmap y siguientes líneas de trabajo

El desarrollo guiado derivado de Markdown, el aislamiento estricto por `book_scope`, la recuperación segura de sesiones OpenCode persistidas y la reconciliación HTTP/SSE de preguntas y permisos están implementados y validados en los casos descritos en la sección 14. Los once perfiles base y la guía global están terminados. El renombrado con H1 se comprobó en novela, saga y libro; se probó el envío de una variante compatible en un mensaje real; la reorganización de cabecera, barra lateral y `Gestionar obra`, el guardado único de géneros y los flujos principales de la gestión avanzada de Biblioteca cuentan con validación manual. La preservación y presentación del motivo real de errores OpenCode/proveedor también está implementada y validada en el caso real descrito en la sección 14. Las comprobaciones específicas pendientes están en la sección 16 y no constituyen una repetición general de esos hitos.

Líneas funcionales pendientes, sin fijar aquí un orden arquitectónico nuevo:

- Completar los casos inducidos de resultado parcial y rollback, la prueba con symlink real, los formatos de archivo pendientes y la presentación adaptable descritos en la sección 16.
- Definir la estrategia futura de motores IA.
- Abordar portabilidad Windows/Linux y packaging Windows, incluidas las rutas del ejecutable.
- Implementar importación compatible y no destructiva.
- Completar publicación/exportación y la cobertura de extremo a extremo de herramientas editoriales.
- Ampliar la gestión de conflictos con diff, elección de versión y merge.
- Continuar la evolución posterior de Biblioteca y Director.
- Incorporar tests automatizados.

La importación compatible es una de las siguientes líneas lógicas, sin fijar aquí una decisión arquitectónica nueva ni un orden rígido. Cuando corresponda, debe validar antes de copiar, preservar el proyecto fuente y aceptar únicamente estructuras compatibles, sin importador genérico, renombrado automático ni inferencia de estructura.
