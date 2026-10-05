# Inkforge

Inkforge es una aplicación de escritorio para escribir y gestionar novelas y sagas mediante una Biblioteca de proyectos Markdown. Utiliza Electron, React y TypeScript, y mantiene los archivos Markdown reales como fuente de verdad narrativa.

El proyecto evoluciona desde [fiction-vault](https://github.com/quinwacca/fiction-vault): conserva su base editorial, sus herramientas y su organización en archivos, y añade una interfaz de escritorio para trabajar con novelas independientes, sagas, libros y asistencia mediante OpenCode.

## Estado actual

Inkforge está en fase alfa y desarrollo activo. El estado técnico, las validaciones y el siguiente bloque de trabajo se recogen en [DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md).

La aplicación de escritorio ya permite:

- navegar y leer documentos Markdown;
- activar la edición de forma explícita;
- guardar mediante el botón de la interfaz o con `Ctrl+S` / `Cmd+S`;
- proteger cambios sin guardar al cambiar de documento, libro u obra y al cerrar la aplicación;
- detectar conflictos causados por modificaciones externas;
- conservar el borrador cuando la ruta original desaparece o se renombra fuera de Inkforge;
- actualizar el árbol del vault mediante un watcher;
- gestionar una Biblioteca con novelas independientes y sagas de varios libros;
- crear obras y gestionar desde un único diálogo el renombrado de novelas, sagas y libros, un guardado conjunto de géneros y la incorporación de libros a sagas;
- eliminar definitivamente novelas, sagas completas o libros individuales mediante una confirmación explícita y sin papelera;
- reordenar los libros de una saga conservando su identidad activa y convertir un libro en novela independiente sin activarla automáticamente;
- asignar varios perfiles editoriales de género a obras y libros, con herencia configurable en sagas;
- utilizar la interfaz en español, inglés, catalán o coreano;
- abrir una Ayuda integrada y localizada con documentación de las funciones disponibles;
- consultar una guía informativa para preparar proyectos compatibles con una futura importación;
- conservar una conversación del Director por obra, también después de reiniciar; todos los libros de una saga comparten esa conversación;
- recordar la última obra y el último libro activos;
- usar OpenCode local con streaming y modelos obtenidos dinámicamente de sus proveedores configurados;
- conservar globalmente el modelo y la variante entre obras y reinicios;
- configurar idioma, apariencia e IA desde Ajustes;
- elegir tema Sistema, Oscuro o Claro, con cambio inmediato al variar el tema del sistema operativo;
- arrancar con una Biblioteca vacía, sin crear ni seleccionar una obra automáticamente;
- reintentar en la misma sesión cuando el modelo elegido resulta incompatible.

Las solicitudes de permisos y las preguntas interactivas están implementadas y validadas manualmente, incluida su recuperación tras recargar el renderer y el tratamiento de una interacción interrumpida tras reiniciar OpenCode. También se comprobó manualmente el envío de una variante compatible en un mensaje real; quedan escenarios secundarios por comprobar.

## Idiomas de interfaz

Inkforge ofrece la interfaz en español, inglés, catalán y coreano. El idioma se cambia desde **Ajustes → General**, se aplica inmediatamente y se conserva al reiniciar. En el primer arranque se utiliza un idioma compatible del sistema cuando existe; español es el idioma de respaldo.

La traducción se limita al texto propio de la interfaz. No se traducen manuscritos Markdown, rutas, nombres o títulos creados por el usuario, contenido documental, proveedores o modelos, ni mensajes literales recibidos desde OpenCode o desde el proceso principal de Electron.

En los proyectos gestionados por Inkforge, el explorador también muestra etiquetas localizadas para las carpetas estructurales y los ficheros de sistema reconocidos. Los nombres físicos, las rutas y el contenido permanecen intactos; los nombres creados por el usuario y los elementos no reconocidos se muestran literalmente.

## Ajustes globales

El engranaje del encabezado abre un diálogo con tres secciones:

- **General:** idioma.
- **Apariencia:** Sistema, Oscuro o Claro. Sistema sigue el tema del sistema operativo y reacciona a sus cambios sin reiniciar.
- **IA / Director:** modelo y variante.

Estas preferencias son globales y se conservan entre obras y reinicios. Los modelos se agrupan en **Gratis** y **Otros modelos**; la agrupación gratuita requiere una identificación explícita en su ID o nombre oficial, no simplemente un coste reportado de cero.

Si no hay una selección de modelo guardada, Ajustes puede abrirse para solicitarla. Durante una reconexión, la selección se mantiene visible aunque el control esté temporalmente deshabilitado. La carga pendiente del catálogo no significa que se haya perdido la preferencia. La lectura y la edición manual siguen disponibles sin IA.

La cabecera muestra Inkforge y su lema, un punto de estado con texto localizado (Conectado, Conectando… o Error), Ayuda y Ajustes. El punto es verde cuando OpenCode está conectado, naranja mientras inicia o reconecta y rojo ante error o desconexión; conserva una descripción accesible del contexto. El Director no contiene selectores permanentes ni un encabezado técnico de conexión.

## Ayuda integrada

El botón de Ayuda del encabezado abre una guía localizada en los cuatro idiomas de la interfaz. Explica Biblioteca, `Gestionar obra`, el guardado conjunto de géneros y herencia, borrado sin papelera, reordenación y extracción sin autoactivación ni fallback, lectura y edición Markdown, protección ante cambios externos, Ajustes de IA, OpenCode y localización. Abrirla o cerrarla no altera el documento, el borrador, la obra ni el libro activos.

La Ayuda incluye una guía de preparación que muestra las estructuras físicas de referencia para una novela independiente y una saga. Es únicamente documentación: la importación real, la selección y validación de proyectos externos y la copia a la Biblioteca todavía no están implementadas.

## Arquitectura

~~~text
Inkforge Desktop
    ↓
OpenCode local
    ↓
agente primary
    ↓
subagentes / skills / MCP
    ↓
Markdown reales de la obra
~~~

Markdown es la fuente de verdad. Inkforge no mantiene una base de datos paralela para el canon ni una memoria alternativa del manuscrito. `.fiction`, `session_log.json` y `manifiesto.json` no forman parte del estado operativo: la estructura, los manifiestos y la planificación se leen de los Markdown reales.

Las herramientas editoriales Python leen `Proyecto.md`, `Libro.md` y el frontmatter de cada capítulo. `VAULT_PATH` indica la raíz exacta de la obra; en una saga, cada llamada de contenido recibe además `book_scope: Libros/<id>` del libro seleccionado explícitamente. Cambiar de libro no crea otra conversación ni reinicia OpenCode. El servidor MCP se llama `inkforge-context`; se ejecuta desde la infraestructura de Inkforge aunque el workspace sea la obra activa y relee el contenido al atender cada llamada. Los capítulos se ordenan por `capítulo:` en sus Markdown, sin manifiesto JSON ni sincronización aparte. Los análisis de tres actos, Save the Cat y consejos de King o Sanderson son opcionales según la obra y el encargo.

OpenCode es el backend de integración con IA. Inkforge no implementa una abstracción propia de proveedores, no guarda claves de API y no se conecta directamente a servicios de modelos. El usuario puede utilizar los proveedores y modelos configurados en OpenCode, incluidos modelos locales como Ollama.

Actualmente Inkforge no incluye una pantalla para conectar proveedores ni administrar credenciales. Esa configuración se realiza fuera de la aplicación, mediante OpenCode.

El proceso principal de Electron concentra el acceso al sistema de archivos, los procesos locales, HTTP y SSE. El renderer recibe únicamente APIs IPC estrechas y tipadas mediante el preload. La ventana utiliza:

~~~text
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
~~~

## Biblioteca

Inkforge trabaja exclusivamente mediante la Biblioteca. Las obras gestionadas siguen almacenándose físicamente en:

~~~text
vault/
├── Generos/       Perfiles editoriales Markdown globales
├── Plantillas/    Recursos reutilizables
└── Proyectos/     Obras y sagas locales
~~~

Ese directorio contiene manuscritos y datos locales, está incluido en `.gitignore` y no se versiona junto al código.

La raíz global contiene recursos reutilizables. Cada obra y saga conserva sus Markdown propios bajo `Proyectos/`; `Estilo/` dentro de una obra es específico de esa obra y no equivale a los perfiles globales de `Generos/`.

Los perfiles son archivos `vault/Generos/<nombre>.md`, descubiertos al abrir los diálogos y por las herramientas MCP en cada consulta. Puedes añadirlos manualmente sin reiniciar. Una obra puede usar ninguno o varios, sin pesos ni jerarquía. En una saga, cada libro hereda los perfiles de la saga por defecto y puede añadir los suyos; al desactivar la herencia usa solo sus propios perfiles. Las asignaciones viven en `Proyecto.md` y `Libro.md`; los géneros efectivos se calculan, no se almacenan. Si falta un perfil asignado, la configuración conserva su nombre y lo muestra como no disponible. Los manifiestos antiguos sin estos campos siguen abriéndose sin migración automática.

Ya existen once perfiles base aprobados: Fantasía, Ciencia ficción, Misterio, Thriller, Romance, Terror, Histórica, Aventura, Distopía, Ficción política y Ficción social. `vault/Plantillas/perfil-genero.md` guía la creación de otros perfiles. Orientan la edición, sin establecer canon ni sustituir el Markdown de la obra. El Director puede leerlos mediante MCP y crear o actualizar un perfil cuando se le pide expresamente; no hay borrado de perfiles desde Inkforge.

Las carpetas heredadas directamente en la raíz de `vault/` ya se retiraron. La raíz conserva `Generos/`, `Plantillas/` y `Proyectos/`; las estructuras internas de cada obra se mantienen en su propio directorio.

Una Biblioteca vacía es un estado válido. Sin obra seleccionada se puede crear una novela o saga, seleccionar una existente y utilizar Ajustes y Ayuda. El Director requiere una obra; no trabaja narrativamente sobre el vault general ni sobre la raíz del repositorio.

Una novela independiente mantiene capítulos, planificación, canon, notas y recursos directamente bajo la raíz de la obra. Una saga separa las áreas compartidas de los libros:

~~~text
Saga/
├── Proyecto.md
├── Mundo/
├── Estilo/
├── Referencias/
└── Libros/
    ├── 01 - Primer libro/
    │   ├── Libro.md
    │   ├── Capítulos/
    │   ├── Planificación/
    │   ├── Canon/
    │   ├── Notas/
    │   └── Recursos/
    └── 02 - Segundo libro/
        └── ...
~~~

La barra lateral presenta la obra activa y su tipo, `Nueva obra`, `Gestionar obra`, el selector `Obra activa` y, en una saga, `Libro activo`; el árbol documental ocupa el resto. `Gestionar obra` agrupa renombrado y géneros; en sagas, también añadir, renombrar, reordenar, eliminar y sacar libros como novelas independientes. La zona de peligro separa el borrado irreversible de las acciones normales: Inkforge no tiene papelera y exige una confirmación inequívoca antes de eliminar archivos. En el explorador de una saga aparecen `Proyecto.md`, las áreas compartidas y solo el libro activo. Abrir un documento nunca cambia de libro: la selección se realiza mediante una acción explícita. Cambiar o reordenar libros conserva el workspace OpenCode de la saga; cambiar de obra cambia ese workspace.

Inkforge recuerda la última obra y, en una saga, el último libro activo mediante una preferencia local de Electron fuera del vault. La restauración usa sus identificadores persistidos y validados. Si la obra guardada ya no existe, arranca sin obra seleccionada y mantiene visibles las demás, sin elegir otra automáticamente. Si falta el libro guardado o la saga ya no contiene libros, conserva la saga activa con `activeBook = null`: no usa `books[0]`, no infiere otro libro y exige una selección o creación explícita antes del trabajo de libro.

Los títulos, manifiestos, rutas y ámbitos se validan en el proceso principal. La Biblioteca rechaza symlinks y colisiones y no sobrescribe contenido existente. Al renombrar una novela, saga o libro, actualiza `titulo:` y el H1 inicial gestionado solo si este coincide con el título anterior esperado; ante una discrepancia, rechaza el cambio antes de mover la carpeta. Los tres casos se comprobaron manualmente, incluido el rechazo seguro de una saga con H1 inconsistente y su posterior renombrado tras corregirlo.

## Edición y seguridad del vault

Inkforge abre los documentos en modo lectura. La edición requiere la acción `Editar` y el guardado siempre es explícito.

Cada lectura incluye una revisión SHA-256 del contenido UTF-8. Al guardar, Electron abre el archivo existente sin crearlo, relee su contenido mediante el mismo `FileHandle`, compara la revisión y solo entonces escribe, trunca y sincroniza.

El resultado distingue tres casos:

- **Guardado correcto:** actualiza el documento y su revisión.
- **Conflicto externo:** no sobrescribe el archivo y conserva el borrador.
- **Ruta desaparecida (`missing`):** no infiere renombres, no adopta otra ruta y no recrea el archivo anterior; el borrador permanece visible e intacto.

El acceso al vault rechaza rutas absolutas, segmentos ocultos, `..`, archivos que no sean Markdown, symlinks y rutas reales fuera del ámbito activo.

Si la obra activa desaparece mientras Inkforge está abierto, deja de estar seleccionada y se desvincula su workspace narrativo. Un borrador sin guardar se conserva en memoria con un aviso: no se guarda en otra obra, no recrea la ruta eliminada y no sobrescribe contenido. Antes de cambiar de obra, el usuario debe cancelar la acción o confirmar el descarte; puede copiar el borrador para conservarlo.

## OpenCode

Inkforge inicia un servidor OpenCode local enlazado a `127.0.0.1` y descubre sus capacidades en tiempo de ejecución. La integración:

- obtiene modelos y proveedores dinámicamente;
- exige exactamente un agente con `mode: "primary"`;
- conserva los subagentes, skills y MCP configurados en el proyecto;
- transmite respuestas mediante SSE;
- envía en cada turno el contexto operativo privado y autoritativo como una parte de texto `synthetic`, separada del mensaje visible;
- filtra partes internas de tipo reasoning, synthetic e ignored para mostrar únicamente texto visible de respuesta;
- mantiene la sesión al cambiar de modelo;
- envía la variante seleccionada en el campo `variant` del siguiente mensaje, sin reiniciar la conversación; la variante vacía usa el comportamiento predeterminado de OpenCode;
- permite reintentar tras un error de modelo incompatible;
- detiene el proceso local al cerrar Inkforge.

El agente primary actual es `editor`. Los subagentes definidos en `opencode.json` son `writer`, `structurer`, `lector`, `critico` y `query`.

La integración se validó inicialmente con OpenCode 1.18.31. El hito posterior de contexto `synthetic`, MCP y `cwd` portable se comprobó con OpenCode 1.18.34. La compatibilidad depende de las capacidades disponibles, no de una versión mínima rígida.

La raíz técnica de Inkforge mantiene agentes, skills y MCP; el directorio de trabajo narrativo es la obra activa. OpenCode recibe `INKFORGE_INFRASTRUCTURE_ROOT` para ejecutar `inkforge-context` desde esa infraestructura, mientras `VAULT_PATH` sigue señalando la obra e `INKFORGE_LIBRARY_ROOT` la Biblioteca global. En cada turno, Inkforge proporciona al Director el libro activo, su ruta operativa y los nombres de sus géneros efectivos de forma privada y autoritativa; la selección del turno sustituye cualquier selección antigua del historial. El Director no deduce libros ni simula el MCP mediante procesos o scripts temporales: si `inkforge-context` no está disponible, comunica el fallo. Los perfiles pertinentes se leen mediante MCP sin cargar todos sus textos en cada mensaje.

El chat visible se guarda en `.inkforge/director-chat.json` dentro de cada obra. Cambiar de libro en una saga no crea otra conversación, y las fronteras técnicas de las sesiones OpenCode no dividen el historial visible. Esta continuidad del chat **no es canon ni memoria narrativa**: los Markdown siguen siendo la fuente de verdad.

Sin obra activa, OpenCode puede ofrecer el catálogo de modelos para Ajustes, pero no crear sesiones ni enviar mensajes narrativos contra una raíz genérica.

Algunos modelos del catálogo pueden fallar por restricciones del proveedor, la cuenta o la región. Inkforge todavía puede sustituir el motivo útil devuelto por OpenCode o el proveedor por un error genérico; mejorar esa presentación está pendiente.

## Estructura del repositorio

~~~text
Inkforge/
├── app/                         Aplicación Electron + React + TypeScript
│   ├── electron/                Proceso principal, preload, Biblioteca y OpenCode
│   └── src/                     Interfaz, i18n, componentes, hooks y tipos
├── docs/
│   └── DEVELOPMENT_STATUS.md    Estado operativo y decisiones cerradas
├── vault/                       Biblioteca global
│   ├── Generos/                 Perfiles editoriales Markdown
│   ├── Plantillas/              Recursos reutilizables
│   └── Proyectos/               Obras locales creadas por la Biblioteca
├── .opencode/                   Skills editoriales
├── .tools/                      Herramientas Python y servidor MCP
├── web/                         Dashboard Astro heredado y secundario
├── AGENTS.md                    Contexto y flujo editorial
├── Makefile                     Atajos para herramientas editoriales
└── opencode.json                Agentes y servidor MCP de OpenCode
~~~

`web/` continúa presente como dashboard secundario para métricas, búsqueda y navegación. Su generador requiere `VAULT_PATH` y, en saga, `INKFORGE_BOOK_SCOPE=Libros/<id>` por invocación; el JSON resultante es un artefacto de presentación. La UI todavía conserva decisiones visuales heredadas y no es la aplicación principal de Inkforge.

## Requisitos

- Windows como plataforma principal actual;
- Node.js y npm;
- Python 3 para las herramientas editoriales y el servidor MCP;
- OpenCode disponible en el `PATH`.

El desarrollo se ha probado con Node.js 22. Esto describe el entorno utilizado, no establece una versión mínima garantizada.

En Windows, `opencode.json` utiliza `python` para iniciar `.tools/inkforge_mcp.py`. Para invocar scripts editoriales desde la consola, define `VAULT_PATH` con la raíz de una obra válida e `INKFORGE_LIBRARY_ROOT` con la Biblioteca global cuando el script necesite plantillas o perfiles. En sagas, pasa `--book-scope Libros/<id>`; con Makefile puede usarse `ARGS="--book-scope Libros/<id>"`.

## Desarrollo de la aplicación

Los comandos se ejecutan desde la raíz del repositorio.

Instalar dependencias:

~~~powershell
npm --prefix .\app install
~~~

Iniciar Vite y Electron en desarrollo:

~~~powershell
npm --prefix .\app run dev
~~~

Ejecutar ESLint:

~~~powershell
npm --prefix .\app run lint
~~~

Generar el build de producción:

~~~powershell
npm --prefix .\app run build
~~~

`app/package.json` no define actualmente un script `test`.

### Dashboard heredado

~~~powershell
npm --prefix .\web install
npm --prefix .\web run dev
~~~

También están disponibles los scripts `build` y `preview` de Astro.

## Validado y pendiente

Las funciones principales de edición, Biblioteca, persistencia, Ajustes y Director cuentan con validación manual anterior. También se comprobaron el mecanismo de perfiles de género, los flujos principales de la nueva interfaz, el renombrado con H1 gestionado en novela, saga y libro, y el envío real de una variante compatible. El responsable del proyecto comunicó lint limpio y build TypeScript/Vite limpio tras la corrección de TS18047. Quedan casos adicionales de formato, variantes y presentación adaptable; el detalle se mantiene en [DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md). No hay una suite automática propia confirmada.

El responsable del proyecto confirmó manualmente la restauración exacta de `activeBookId`, los estados válidos sin libro y sin fallback, los cambios de libro en caliente, el transporte privado `synthetic` sin exposición en el historial y el funcionamiento de `inkforge-context` con `book_scope` y `cwd` portable. Las comprobaciones de desarrollo comunicadas para ese hito anterior incluyeron `git diff --check`, `git diff --cached --check`, `node --check`, validación de `opencode.json`, build, lint y `compileall`. En `feature/library-advanced-management` se ejecutaron satisfactoriamente, después de la implementación y de nuevo tras corregir el conflicto exacto del guardado unificado de géneros, `git diff --check` —sin errores, solo avisos LF → CRLF—, `node --check` sobre los módulos Electron modificados, incluido `app/electron/content-revision.cjs`, `npm --prefix app run lint` y `npm --prefix app run build`; no se ejecutaron las demás comprobaciones históricas, tests automáticos ni comprobaciones técnicas automatizadas de OpenCode/MCP.

La gestión avanzada de Biblioteca —borrado irreversible, reordenación y conversión de libro de saga a novela independiente— y el guardado único de géneros están implementados y validados manualmente en sus flujos principales, incluidos conflictos externos exactos, ausencia de fallback, protección de borradores, rechazo de un junction externo y revisión de la Ayuda en los cuatro idiomas. Quedan casos inducidos de resultado parcial y rollback, una prueba con symlink real y otras comprobaciones específicas; el detalle está en [DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md).

Inkforge conserva por separado el resumen controlado y el detalle textual útil recibido desde OpenCode o el proveedor cuando está disponible. La interfaz muestra el detalle externo literal sin traducirlo bajo una etiqueta localizada, sin presentar objetos arbitrarios ni excepciones JavaScript internas. Cuando el error es `unknown` y existe ese detalle, el resumen genérico propio de Inkforge también se localiza; los mensajes específicos existentes conservan su comportamiento actual. Se validó manualmente una respuesta normal con un modelo funcional y, posteriormente, un error real de proveedor con la interfaz en inglés; en este último caso el resumen propio de Inkforge apareció localizado y el detalle externo permaneció literal. Otros formatos y categorías permanecen como comprobaciones secundarias en [DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md).

### Estructura localizada e importación futura

La localización de etiquetas estructurales está implementada y validada mediante claves explícitas que el proceso principal añade exclusivamente a nodos reconocidos de proyectos gestionados. El renderer conserva siempre `name` y `path` reales y usa el nombre físico como fallback.

La guía informativa de preparación ya está disponible en la Ayuda integrada. La primera versión de importación real aceptará únicamente proyectos ya compatibles con la estructura de Inkforge. Será una operación validada y no destructiva, orientada a copiar el proyecto compatible dentro de la Biblioteca portable sin modificar el original: no incluirá un importador genérico ni renombrado, conversión o inferencia automática. `El Cambio` será el caso de referencia de desarrollo, no un requisito para el usuario. Esta importación todavía no está implementada.

Pendientes reales:

- completar validaciones secundarias de renombrado y variantes;
- definir la estrategia de motores IA y su integración prevista;
- desarrollar y validar la portabilidad Windows/Linux;
- preparar packaging para Windows y revisar `projectRoot` en la aplicación empaquetada;
- después, implementar la importación compatible, validada y no destructiva;
- ampliar posteriormente la personalización de estilo por obra;
- mejorar la resolución de conflictos con diff, elección de versión y merge;
- continuar la evolución posterior de Biblioteca y Director;
- incorporar tests automatizados cuando se planifique esa infraestructura.

La importación real todavía no está implementada.

## Créditos

Inkforge parte de [fiction-vault](https://github.com/quinwacca/fiction-vault), proyecto original de quinwacca. Conserva su enfoque basado en Markdown, sus herramientas editoriales y su integración con OpenCode como fundamento, mientras desarrolla una experiencia de escritorio propia.
