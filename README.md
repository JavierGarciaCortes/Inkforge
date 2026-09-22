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
- servidor OpenCode local gestionado por Electron y limitado a `127.0.0.1`;
- chat integrado con streaming y selección dinámica de modelo y variante;
- interfaz implementada para permisos y preguntas de OpenCode, pendiente de validación manual en una interacción real;
- arranque correcto de la shell en desarrollo y producción local;
- build de producción funcional;
- lint limpio.

La interfaz permite recorrer el vault actual y abre cada documento Markdown en modo lectura. La edición requiere pulsar `Editar`, y los cambios se guardan de forma explícita en los archivos reales. El panel derecho conecta con OpenCode local y mantiene la misma sesión mientras se cambia de modelo o variante.

Fuera de `app/`, también siguen disponibles el sistema editorial heredado de fiction-vault mediante el uso directo de OpenCode y el dashboard Astro heredado en `web/`.

Todavía no existen en la interfaz de escritorio:

- gestión de proyectos o bibliotecas;
- creación, renombrado o borrado de archivos y carpetas;
- autosave e historial de versiones;
- gestión propia de proveedores o credenciales fuera de OpenCode;
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

El ejecutable `opencode` debe estar disponible en el `PATH`. Inkforge lo inicia desde la raíz del proyecto, detecta la URL local anunciada y comprueba sus capacidades en tiempo de ejecución.

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

`opencode.json` configura el sistema editorial, sus agentes y el servidor MCP. Inkforge Desktop inicia un servidor OpenCode local desde la raíz del proyecto, enlazado exclusivamente a `127.0.0.1`, y comprueba `/global/health` antes de habilitar el chat.

El panel derecho obtiene dinámicamente de OpenCode los modelos de los proveedores conectados, sin priorizar ningún proveedor por nombre. Con varios proveedores no selecciona un modelo automáticamente; con uno solo utiliza su modelo predeterminado cuando está disponible en el catálogo. El usuario selecciona el modelo y, cuando existe, su variante.

Inkforge lee la configuración efectiva de OpenCode, exige exactamente un agente con `mode="primary"` y lo utiliza como agente principal del proyecto; actualmente es `editor`. La interfaz no permite seleccionar agentes. Los subagentes continúan bajo la coordinación de OpenCode y del agente principal.

Las respuestas se transmiten mediante SSE. La interfaz y el soporte para solicitudes de permiso y preguntas interactivas están implementados, pero todavía no se han validado manualmente en una interacción real. Los permisos nunca se aceptan automáticamente.

Se han validado manualmente el catálogo dinámico de modelos, la selección sin proveedor preferido, el cambio de modelo dentro de la misma sesión, el streaming, el error por modelo no disponible, el cambio de modelo con reintento conservando el mismo `sessionID` y el cierre del proceso OpenCode gestionado por Inkforge. El soporte de variantes está implementado, pero pendiente de validación manual en una interacción real.

La compatibilidad se decide por las capacidades disponibles, no por un número de versión rígido. La integración se probó inicialmente contra OpenCode 1.18.31, pero otras versiones compatibles pueden utilizarse si ofrecen los endpoints necesarios. Si el cambio de modelo por sesión no está disponible, Inkforge conserva la selección y la envía explícitamente con cada mensaje.

Todo acceso a procesos, HTTP local y eventos SSE permanece en Electron main. El renderer recibe únicamente un contrato IPC tipado mediante el preload y no obtiene acceso directo a Node, `child_process` ni al servidor local.

El flujo editorial existente también puede seguir utilizándose abriendo directamente la raíz de Inkforge con OpenCode. Las instrucciones de `AGENTS.md`, las skills, los subagentes, el MCP y el vault Markdown continúan siendo la fuente de comportamiento y contexto.

## Roadmap inmediato

1. Añadir selección y gestión de proyectos y vaults.
2. Reforzar recuperación y persistencia de sesiones de chat entre aperturas.
3. Preparar el empaquetado para Windows.

## Principios de desarrollo

- Markdown es la fuente de verdad del contenido narrativo.
- El canon no debe duplicarse innecesariamente en capas paralelas.
- El uso directo de OpenCode debe seguir siendo compatible.
- Las capacidades se incorporan de forma incremental y verificable.
- Si una capa nueva empeora el comportamiento editorial ya probado, debe revisarse antes de consolidarse.

## Créditos y origen

Inkforge existe gracias a la base y al enfoque de [fiction-vault](https://github.com/quinwacca/fiction-vault), proyecto original de quinwacca. La evolución hacia Inkforge mantiene ese sistema editorial como fundamento mientras desarrolla una experiencia de escritorio propia.
