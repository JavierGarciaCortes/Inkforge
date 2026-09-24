# Inkforge

Inkforge es una aplicación de escritorio para gestionar proyectos de escritura narrativa basados en vaults Markdown. La aplicación principal utiliza Electron, React y TypeScript, y mantiene los archivos Markdown reales como fuente de verdad.

El proyecto evoluciona desde [fiction-vault](https://github.com/quinwacca/fiction-vault): conserva su base editorial, sus herramientas y su organización en archivos, y añade una interfaz de escritorio para trabajar con novelas independientes, sagas, libros y asistencia mediante OpenCode.

## Estado actual

La aplicación de escritorio ya permite:

- navegar y leer documentos Markdown;
- activar la edición de forma explícita;
- guardar mediante el botón de la interfaz o con `Ctrl+S` / `Cmd+S`;
- proteger cambios sin guardar al cambiar de documento, libro u obra y al cerrar la aplicación;
- detectar conflictos causados por modificaciones externas;
- conservar el borrador cuando la ruta original desaparece o se renombra fuera de Inkforge;
- actualizar el árbol del vault mediante un watcher;
- gestionar una Biblioteca con novelas independientes y sagas de varios libros;
- crear obras, añadir libros, cambiar el libro activo y renombrar novelas, sagas y libros;
- usar un chat integrado con OpenCode local, streaming y selección dinámica de modelos y proveedores;
- reintentar en la misma sesión cuando el modelo elegido resulta incompatible.

Las solicitudes de permisos, las preguntas interactivas y las variantes de modelo están implementadas, pero todavía no se han validado por completo en interacciones reales.

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
vault Markdown
~~~

Markdown es la fuente de verdad. Inkforge no mantiene una base de datos paralela para el canon ni una memoria alternativa del manuscrito.

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

Los proyectos creados por la aplicación se guardan en:

~~~text
vault/Proyectos/
~~~

Ese directorio contiene manuscritos y datos locales, está incluido en `.gitignore` y no se versiona junto al código.

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

En una saga, el explorador muestra `Proyecto.md`, las áreas compartidas y solo el libro activo. Cambiar de documento nunca cambia de libro: la selección se realiza exclusivamente mediante `Libro activo`.

Los títulos, manifiestos, rutas y ámbitos se validan en el proceso principal. La Biblioteca rechaza symlinks y colisiones, no sobrescribe contenido existente y conserva el resto del manifiesto al renombrar.

## Edición y seguridad del vault

Inkforge abre los documentos en modo lectura. La edición requiere la acción `Editar` y el guardado siempre es explícito.

Cada lectura incluye una revisión SHA-256 del contenido UTF-8. Al guardar, Electron abre el archivo existente sin crearlo, relee su contenido mediante el mismo `FileHandle`, compara la revisión y solo entonces escribe, trunca y sincroniza.

El resultado distingue tres casos:

- **Guardado correcto:** actualiza el documento y su revisión.
- **Conflicto externo:** no sobrescribe el archivo y conserva el borrador.
- **Ruta desaparecida (`missing`):** no infiere renombres, no adopta otra ruta y no recrea el archivo anterior; el borrador permanece visible e intacto.

El acceso al vault rechaza rutas absolutas, segmentos ocultos, `..`, archivos que no sean Markdown, symlinks y rutas reales fuera del ámbito activo.

## OpenCode

Inkforge inicia un servidor OpenCode local enlazado a `127.0.0.1` y descubre sus capacidades en tiempo de ejecución. La integración:

- obtiene modelos y proveedores dinámicamente;
- exige exactamente un agente con `mode: "primary"`;
- conserva los subagentes, skills y MCP configurados en el proyecto;
- transmite respuestas mediante SSE;
- mantiene la sesión al cambiar de modelo;
- permite reintentar tras un error de modelo incompatible;
- detiene el proceso local al cerrar Inkforge.

El agente primary actual es `editor`. Los subagentes definidos en `opencode.json` son `writer`, `structurer`, `lector`, `critico` y `query`.

La integración se validó inicialmente con OpenCode 1.18.31. La compatibilidad depende de las capacidades disponibles, no de una versión rígida.

## Estructura del repositorio

~~~text
Inkforge/
├── app/                         Aplicación Electron + React + TypeScript
│   ├── electron/                Proceso principal, preload, Biblioteca y OpenCode
│   └── src/                     Interfaz, componentes, hooks y tipos
├── docs/
│   └── DEVELOPMENT_STATUS.md    Estado operativo y decisiones cerradas
├── vault/                       Contenido narrativo Markdown
│   └── Proyectos/               Obras locales creadas por la Biblioteca
├── .opencode/                   Skills editoriales
├── .tools/                      Herramientas Python y servidor MCP
├── .fiction/                    Configuración y estado local heredado
├── web/                         Dashboard Astro heredado y secundario
├── AGENTS.md                    Contexto y flujo editorial
├── Makefile                     Atajos para herramientas heredadas
└── opencode.json                Agentes y servidor MCP de OpenCode
~~~

`web/` continúa presente como dashboard heredado para métricas, búsqueda y navegación. No es la aplicación principal de Inkforge.

## Requisitos

- Windows como plataforma principal actual;
- Node.js y npm;
- Python 3 para las herramientas heredadas y el servidor MCP;
- OpenCode disponible en el `PATH`.

El desarrollo se ha probado con Node.js 22. Esto describe el entorno utilizado, no establece una versión mínima garantizada.

En Windows, `opencode.json` ya utiliza `python` para iniciar `.tools/fiction_mcp.py`.

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

Están validados la navegación y edición Markdown, el guardado seguro, los estados de conflicto y `missing`, el watcher, el cierre protegido, la Biblioteca básica, la navegación entre libros, el streaming de OpenCode, los modelos y proveedores dinámicos y el retry por modelo incompatible.

Pendientes reales:

- completar la ayuda integrada y mantener la documentación sincronizada con el producto;
- internacionalización;
- validar completamente permisos, preguntas y variantes de OpenCode en interacciones reales;
- persistir sesiones de chat y el último modelo entre reinicios;
- preparar packaging e instalador para Windows;
- añadir perfiles de género y estilo y definir su herencia entre saga y libro;
- mejorar la resolución de conflictos con diff, elección de versión y merge.

El borrado de obras y libros se reserva para una etapa futura y no es prioritario. La Biblioteca básica ya está completada y no forma parte de estos pendientes.

## Créditos

Inkforge parte de [fiction-vault](https://github.com/quinwacca/fiction-vault), proyecto original de quinwacca. Conserva su enfoque basado en Markdown, sus herramientas editoriales y su integración con OpenCode como fundamento, mientras desarrolla una experiencia de escritorio propia.
