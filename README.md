# Inkforge

Inkforge es una aplicación de escritorio para escribir y desarrollar novelas con una bóveda Markdown y asistencia editorial mediante OpenCode.

El proyecto está en desarrollo temprano. Su objetivo actual es proporcionar una interfaz visual sobre el flujo editorial heredado de fiction-vault sin sustituir sus agentes, herramientas ni fuentes de verdad.

## Estado del proyecto

Estado actual de `app/`:

- Electron;
- React 19;
- TypeScript 6;
- Vite 8;
- ESLint;
- proceso principal de Electron seguro;
- preload mediante `contextBridge`;
- renderer sin acceso directo a Node;
- `contextIsolation: true`;
- `nodeIntegration: false`;
- `sandbox: true`;
- IPC explícito mediante los canales `app:get-info`, `vault:list`, `vault:read` y `vault:write`;
- navegación real de los documentos Markdown del vault desde el panel Biblioteca;
- apertura de documentos Markdown en modo lectura por defecto;
- edición mediante la acción explícita `Editar`;
- guardado explícito mediante botón, `Ctrl+S` o `Cmd+S`;
- modal integrado al cambiar de documento o volver a lectura con cambios sin guardar;
- aviso nativo al cerrar con cambios sin guardar;
- panel Editor reservado para OpenCode;
- arranque correcto de la shell en desarrollo y producción local;
- build de producción funcional;
- lint limpio.

La interfaz ya permite recorrer el vault actual y abre cada documento Markdown en modo lectura. La edición requiere pulsar `Editar`, y los cambios se guardan de forma explícita en los archivos reales. El panel Editor aún no está conectado a OpenCode.

Fuera de `app/`, también siguen disponibles el sistema editorial heredado de fiction-vault mediante el uso directo de OpenCode y el dashboard Astro heredado en `web/`.

Todavía no existen en la interfaz de escritorio:

- conexión con OpenCode;
- gestión de proyectos o bibliotecas;
- creación, renombrado o borrado de archivos y carpetas;
- autosave e historial de versiones;
- chat editorial;
- proveedores adicionales como Codex u Ollama;
- packaging, instalador o ejecutables distribuibles para Windows;
- un sistema propio de canon, memoria o acciones semánticas.

## Objetivo

Inkforge busca ofrecer una interfaz cómoda para trabajar con proyectos narrativos basados en archivos Markdown. OpenCode seguirá coordinando el editor, los subagentes, las skills y las herramientas MCP, mientras los documentos del vault permanecerán como fuentes de verdad.

La arquitectura prevista sigue este flujo:

```text
Inkforge Desktop
    |
    v
OpenCode
    |
    v
editor + subagentes + skills + MCP
    |
    v
archivos Markdown del vault
```

La interfaz debe crecer alrededor del sistema editorial existente. No debe exigir que el canon narrativo se reconstruya en una base de datos paralela.

## Origen

Inkforge parte de [fiction-vault](https://github.com/quinwacca/fiction-vault), creado por quinwacca, y evoluciona su flujo de trabajo hacia una aplicación de escritorio.

La base heredada conserva la bóveda Markdown, las skills de OpenCode, las herramientas editoriales en Python, el servidor MCP, la configuración local y el dashboard web. Inkforge añade una nueva capa de interfaz sin ocultar ni reemplazar ese origen.

## Arquitectura actual

```text
Inkforge/
|-- app/           Aplicación principal de escritorio
|-- vault/         Contenido narrativo y fuentes de verdad en Markdown
|-- .opencode/     Skills del sistema editorial
|-- .tools/        Herramientas Python y servidor MCP
|-- .fiction/      Configuración y estado local del proyecto
|-- web/           Dashboard Astro heredado
|-- AGENTS.md      Reglas, contexto y flujo editorial
`-- opencode.json  Configuración de OpenCode y del servidor MCP
```

La compatibilidad con Windows ha sido adaptada respecto a la base original. Windows es actualmente la plataforma principal del proyecto.

## Aplicación de escritorio

`app/` contiene la aplicación principal de Inkforge:

- Electron para el proceso de escritorio;
- React 19 para la interfaz;
- TypeScript 6;
- Vite 8 para desarrollo y build;
- ESLint para análisis estático.

El proceso principal crea una ventana segura con `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` y `webSecurity: true`. También bloquea ventanas nuevas y navegaciones externas inesperadas.

El preload expone la información de la aplicación y una API mínima del vault: `window.inkforge.vault.list()`, `window.inkforge.vault.read(relativePath)` y `window.inkforge.vault.write(relativePath, content)`. No ofrece acceso genérico a Node, al sistema de archivos, a procesos ni a comandos del sistema.

La Biblioteca representa el árbol real de archivos Markdown del vault y el área Documento muestra inicialmente el texto fuente en modo lectura. La acción `Editar` habilita el editor; el guardado es siempre explícito y solo admite documentos `.md` ya existentes cuya ruta real permanece dentro del vault. Un modal propio protege los cambios sin guardar al cambiar de documento o volver a lectura. No existen todavía autosave, historial ni acciones editoriales desde la interfaz.

## Sistema editorial heredado

El sistema procedente de fiction-vault continúa operativo mediante OpenCode:

- **editor principal**: coordina el trabajo, reúne contexto y presenta propuestas;
- **writer**: redacta o modifica prosa creativa;
- **structurer**: analiza estructura, ritmo y arquitectura narrativa;
- **lector**: evalúa el manuscrito con una lectura fresca;
- **critico**: busca problemas, contradicciones y puntos débiles;
- **query**: prepara consultas y materiales editoriales;
- **fiction-context MCP**: consulta capítulos, personajes, lugares, continuidad, estilo y estructura.

Los archivos de `vault/` siguen siendo las fuentes de verdad. Las reglas completas del workflow, las voces y las herramientas disponibles se documentan en [AGENTS.md](AGENTS.md).

## Dashboard web heredado

`web/` conserva el dashboard Astro de fiction-vault para métricas, búsqueda y navegación del proyecto. Sigue siendo útil como herramienta secundaria, pero no es la aplicación principal de Inkforge.

## Requisitos actuales

- Windows como plataforma principal actual;
- Node.js y npm;
- Python 3;
- OpenCode.

El desarrollo actual se ha probado con Node.js 22. Esto describe el entorno utilizado, no establece por sí solo una versión mínima compatible.

## Desarrollo

### Desktop

Instalación y desarrollo:

```powershell
cd app
npm install
npm run dev
```

Build y ejecución local de la versión compilada:

```powershell
npm run build
npx electron .
```

Lint:

```powershell
npm run lint
```

### Dashboard heredado

```powershell
cd web
npm install
npm run dev
```

## OpenCode

`opencode.json` ya configura el sistema editorial y su servidor MCP. Inkforge Desktop todavía no inicia ni controla OpenCode desde la interfaz.

Mientras se desarrolla esa integración, el flujo editorial existente puede utilizarse abriendo directamente la raíz de Inkforge con OpenCode. De este modo siguen disponibles las instrucciones de `AGENTS.md`, las skills, los subagentes y las herramientas que trabajan sobre el vault.

## Roadmap inmediato

1. Conectar Inkforge Desktop con OpenCode local.
2. Añadir selección y gestión de proyectos y vaults.
3. Incorporar el chat editorial dentro de Inkforge.
4. Preparar el empaquetado para Windows.

## Principios de desarrollo

- Markdown es la fuente de verdad del contenido narrativo.
- El canon no debe duplicarse innecesariamente en capas paralelas.
- El uso directo de OpenCode debe seguir siendo compatible.
- Las capacidades se incorporan de forma incremental y verificable.
- Si una capa nueva empeora el comportamiento editorial ya probado, debe revisarse antes de consolidarse.

## Créditos y origen

Inkforge existe gracias a la base y al enfoque de [fiction-vault](https://github.com/quinwacca/fiction-vault), proyecto original de quinwacca. La evolución hacia Inkforge mantiene ese sistema editorial como fundamento mientras desarrolla una experiencia de escritorio propia.
