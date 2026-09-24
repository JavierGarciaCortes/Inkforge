# Inkforge — Development Status

> Documento vivo para continuar el desarrollo entre conversaciones.
> Actualizarlo al cerrar hitos importantes o antes de cambiar de chat.

## 1. Proyecto

**Nombre:** Inkforge
**Repositorio:** https://github.com/JavierGarciaCortes/Inkforge.git
**Ruta local habitual:** `D:\\Proyectos\\Inkforge`
**Origen técnico:** `https://github.com/quinwacca/fiction-vault`

Objetivo: aplicación de escritorio estable para escritura y gestión de novelas y sagas, basada inicialmente en fiction-vault, Electron, React, TypeScript y OpenCode.

## 2. Forma de trabajo

- Trabajar siempre paso a paso.
- Para comprobaciones de código, Git, lint, build o comportamiento, dar **un solo comando o una sola comprobación por turno**.
- Si se pide ejecutar un comando y devolver la salida, esperar esa respuesta antes de seguir.
- Para cambios importantes de código, preparar un prompt completo para Codex.
- Todo prompt para Codex debe indicar modelo y nivel de razonamiento.
- Modelo habitual: **GPT-5.6 Sol**. Usar High para arquitectura, concurrencia o cambios delicados; Medium para cambios normales; Low para cambios triviales.
- Salvo petición expresa, Codex modifica código únicamente: no ejecuta Git, PowerShell, tests, lint, build, Electron, staging ni crea temporales de validación.
- Las comprobaciones deterministas se realizan manualmente.
- Priorizar integridad de manuscritos, datos y arquitectura frente a rapidez.
- No cambiar decisiones arquitectónicas cerradas sin señalarlo.
- Mostrar principalmente lo nuevo, lo que cambia, los problemas y el siguiente paso.

## 3. Arquitectura cerrada

Los Markdown reales del vault son la fuente de verdad.

```text
Inkforge Desktop
    ↓
OpenCode local
    ↓
agente primary
    ↓
subagentes / skills / MCP
    ↓
vault Markdown real
```

Principios:

- No introducir una base de datos propia de canon si OpenCode/fiction-vault ya resuelven el problema.
- No introducir memoria paralela innecesaria.
- No crear una abstracción propia de proveedores/modelos.
- OpenCode controla modelos y proveedores; Inkforge no debe hardcodearlos.
- `web/` es heredado y secundario.
- Las decisiones deben ser generales para Inkforge y no quedar acopladas a *El Cambio*.

Agentes heredados: `editor` (primary actual), `writer`, `structurer`, `lector`, `critico` y `query`. Inkforge detecta exactamente un agente con `mode="primary"`; no hay selector de agente en la UI.

## 4. Estructura de Biblioteca cerrada

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

Criterio cerrado:

- Proyecto independiente: todo cuelga directamente del proyecto.
- Saga: `Mundo`, `Estilo` y `Referencias` son compartidos; cada libro posee sus capítulos, planificación, canon, notas y recursos.
- Las rutas reales de un libro de saga permanecen bajo `Libros/<id>/...`.
- La Biblioteca debe soportar tanto novelas independientes como sagas y varios libros, sin asumir un único caso de uso.
- `vault/Proyectos/` contiene datos y manuscritos locales generados por la Biblioteca. Está ignorado mediante `.gitignore` y no se versiona junto al código.

Pendiente futuro: perfiles de género/estilo, herencia Saga/Libro y eliminar supuestos de fantasía/Sanderson heredados de fiction-vault.

## 5. Historial Git relevante

Base:

```text
3e2364d chore: initialize Inkforge from fiction-vault Windows base
```

Hitos cerrados anteriores:

```text
41ada3c feat: add initial Inkforge desktop shell
3ba263b merge shell

686c601 feat: add read-only vault browser
7a0490d merge vault browser

75fb395 feat: add markdown editing and safe save flow
8b4cb3a merge editor

18a9cd0 feat: integrate OpenCode chat
2de990f merge: integrate OpenCode chat

358fd51 feat: prevent external file overwrite conflicts
ce356bf merge: add file reconciliation

cb8f8a6 feat: sync vault tree and protect window close
1a847ef merge: sync vault tree and protect window close
```

Tras `1a847ef` se confirmó `## main...origin/main`; `main` y `origin/main` estaban sincronizados. La rama `feature/vault-tree-sync` fue eliminada.

## 6. Rama y estado de trabajo actual

Rama de trabajo actual conocida:

```text
feature/interface-localization
```

El hito de Biblioteca —proyectos, sagas, libro activo, navegación y documentación— ya se ha comprometido localmente con este mensaje:

```text
feat: add library projects and saga navigation
```

No se ha solicitado push. Tampoco se ha registrado en este documento el estado exacto actual de `git status`; comprobarlo antes de cambiar de rama o continuar trabajo que dependa de esos datos.

La Biblioteca funcional y su último ajuste visual están implementados, revisados y validados mediante diff, lint, build y comprobación manual (véase sección 14).

`README.md` ya fue reescrito para reflejar la arquitectura actual, la Biblioteca, la seguridad del vault, OpenCode, los comandos reales y los pendientes vigentes.

La marca definitiva es **Inkforge**. Se comprobó que no hay referencias a «Studio de Escritura» ni «Taller de Escritura» en los archivos de código y documentación buscados.

## 7. OpenCode — estado conocido

Versión probada:

```text
OpenCode 1.18.31
```

Arranque:

```text
opencode serve --hostname 127.0.0.1 --port 0
```

Inkforge lanza OpenCode desde Electron main.

Seguridad Electron:

```text
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
```

Se han trabajado y validado: servidor local, detección de salud, modelos/proveedores dinámicos, agente primary, sesiones, envío, SSE, retry de modelo incompatible y cierre del proceso OpenCode al cerrar Inkforge.

No depender de `/api/session/{id}/wait`, porque devuelve 503 en OpenCode 1.18.31.

## 8. Modelos, primary y streaming

Reglas implementadas:

- No hardcodear proveedor ni elegir simplemente el primer modelo.
- Si hay varios proveedores, mostrar `Selecciona un modelo`.
- Si hay uno, usar su default declarado si existe en catálogo.
- Variante vacía = predeterminada.
- La configuración efectiva del agente se obtiene de OpenCode y debe haber exactamente un `config.agent[*].mode === "primary"`.

Ejemplos observados:

```text
default.openai = gpt-5.6-terra-fast
default.opencode = big-pickle
default.opencode-go = gpt-5.6-luna
```

Se corrigió la selección accidental de `gpt-5.3-codex-spark`, incompatible con la autenticación ChatGPT usada. Persistir el último modelo sigue pendiente.

SSE trabajado con `message.updated`, `message.part.updated`, `message.part.delta`, `session.status` y `session.idle`. Se corrigieron mensajes duplicados usando `messageID → role`; la etiqueta visible del asistente es `Inkforge`. El retry de modelo incompatible está validado en la misma sesión y sin duplicados.

Las variantes están implementadas pero no completamente validadas en vivo. Permisos y preguntas OpenCode están implementados (`OpenCodePermissionCard.tsx` y `OpenCodeQuestionCard.tsx`), pendientes de prueba manual real.

La integración con otros modelos se realiza mediante la configuración de proveedores y modelos en OpenCode. No se debe crear un backend paralelo de IA dentro de Inkforge.

## 9. Vault y seguridad

Solo Markdown.

Protecciones cerradas:

- No rutas absolutas, `..`, elementos hidden ni symlinks.
- `realpath` y prohibición de salir de `vaultRoot`.
- Solo `.md`.

```ts
interface VaultDocument {
  name: string
  path: string
  content: string
  revision: string
}
```

`revision` es SHA-256 hexadecimal del contenido UTF-8 exacto.

## 10. Guardado, conflicto y documento desaparecido

Contrato implementado y validado:

```ts
vault.write(
  relativePath: string,
  content: string,
  expectedRevision: string,
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

El guardado usa un único `FileHandle`: relee, calcula SHA-256, compara la revisión y solo entonces escribe desde byte 0, trunca y sincroniza. Reduce TOCTOU, aunque no constituye un CAS atómico del sistema operativo.

Comportamiento validado:

- **Conflicto:** si el archivo existe pero cambió fuera de Inkforge, no se sobrescribe; se conserva el borrador, Guardar/Ctrl+S quedan bloqueados y al descartar se relee el disco de nuevo.
- **Missing:** si la ruta abierta se renombra o elimina externamente, se conserva documento, modo edición y borrador; guardar pasa a estado `missing`, sin reintentar escribir ni degradarlo a error genérico. Solo puede recuperarse descartando el borrador o seleccionando otro documento.
- **Error técnico:** se comunica sin perder el borrador.

Reglas cerradas para `missing`:

- No inferir rename.
- No buscar un archivo equivalente por contenido ni adoptar otra ruta.
- No recrear silenciosamente la ruta antigua.
- No cerrar el editor, limpiar dirty ni perder el borrador.

## 11. Watcher del árbol y cierre protegido

Sincronización automática implementada con `fs.watch(..., { recursive: true })`:

- watcher único;
- debounce de 200 ms;
- evento `vault:changed`;
- refresh en background sin flicker de loading;
- si falla, conserva el árbol anterior;
- no toca documento abierto, borrador, dirty, conflicto, selección ni modo edición.

Validado con creación, renombrado y borrado externo; creación externa mientras hay borrador; y renombrado del documento abierto.

El antiguo `beforeunload` se eliminó. Electron intercepta el cierre mediante `appWindow.onCloseRequested` y `appWindow.confirmClose`:

- sin dirty, cierra;
- con dirty, abre el diálogo interno;
- Cancelar conserva el borrador;
- `Salir sin guardar` cierra.

También se confirmó el cierre de OpenCode al cerrar Inkforge.

## 12. Biblioteca multiproyecto — implementación validada

La primera implementación funcional de Biblioteca está realizada en `feature/library-project-bootstrap`.

Capacidades validadas manualmente:

- Crear una **novela independiente** solicitando su título.
- Crear una **saga** solicitando título de saga y título del primer libro.
- Añadir un libro a una saga; el nuevo libro queda activo automáticamente.
- Cambiar de libro solo mediante el selector `Libro activo`.
- Renombrar saga, novela independiente y libro de saga.
- Persistir obra y libro activos al trabajar con la Biblioteca.
- Mostrar un libro no disponible en el selector sin permitir renombrarlo.
- En una saga, ocultar del explorador los libros que no están activos.
- En una novela independiente, no mostrar selector de libro.
- Mantener el explorador como apertura de documentos, sin cambios indirectos de libro.

Protecciones de borrador validadas:

- Al cambiar de libro con cambios sin guardar, Cancelar conserva libro y borrador.
- Al elegir `Descartar cambios`, cambia de libro y no escribe el borrador en disco.
- Al pulsar `Nueva obra` con un borrador, confirmar descarte limpia realmente el estado antes de abrir el diálogo. Si se cancela ese diálogo, el borrador no reaparece ni llega al disco.

Comprobaciones realizadas tras el último ajuste visual:

```text
git diff --check   → sin errores (aviso LF/CRLF solo informativo)
npm --prefix .\\app run lint   → correcto
npm --prefix .\\app run build  → correcto
validación manual visual y de cambio de libro   → correcta
```

## 13. Biblioteca — decisiones de interfaz cerradas

La interfaz de Biblioteca debe respetar este comportamiento:

- `Nueva obra` aparece antes de `Obra activa`.
- Para una saga, el orden de controles es: `Nueva obra` → `Obra activa` → `Renombrar saga` → `Añadir libro` → `Libro activo` → `Renombrar libro`.
- Para una novela independiente solo se muestran los controles pertinentes: `Nueva obra`, `Obra activa` y `Renombrar libro`.
- El explorador no puede cambiar de libro.
- En una saga, la presentación debe mostrar primero `Proyecto.md` si existe y las secciones compartidas. Después debe aparecer un rótulo no desplegable del libro activo y, debajo, sus archivos y carpetas directamente.
- Ese rótulo no es un botón, no tiene chevrón y no representa una carpeta artificial. Solo cambia la presentación: las rutas reales siguen bajo `Libros/<id>/...`.
- En una novela se mantiene el árbol directo, sin contenedor artificial.

Estas reglas afectan solo a presentación y navegación; deben conservar ámbitos IPC, guardado, conflictos, `missing` y watchers.

El ajuste quedó revisado y validado: al cambiar el libro activo se sustituye correctamente su bloque visual y no aparecen otros libros.

## 14. Último cambio de Biblioteca — revisado y validado

Codex ha informado de una modificación limitada a:

```text
app/electron/main.cjs
app/src/types/inkforge.ts
app/src/components/Sidebar.tsx
app/src/App.css
```

Resultado comprobado:

- `Nueva obra` aparece antes de `Obra activa`;
- en una saga, el orden restante es `Renombrar saga` → `Añadir libro` → `Libro activo` → `Renombrar libro`;
- el árbol muestra primero `Proyecto.md`, `Mundo`, `Estilo` y `Referencias`;
- después muestra un rótulo no desplegable con el título del libro activo y sus hijos visibles directamente;
- al cambiar el libro activo, el bloque anterior se sustituye y no aparecen otros libros;
- las rutas reales y los comportamientos existentes se conservan.

La revisión de implementación abarcó `main.cjs`, `preload.cjs`, `project-library.cjs`, tipos, `Sidebar` y CSS. El módulo de Biblioteca valida títulos, manifiestos y rutas, rechaza symlinks y protege las operaciones de renombrado.

Estado: **revisado y validado** mediante `git diff --check`, lint, build y comprobación manual visual y de cambio de libro.

## 15. Internacionalización y pendientes posteriores

La base de internacionalización del renderer está implementada con `i18next` y `react-i18next`:

- recursos separados y estructuralmente equivalentes para español (`es`), inglés (`en`), catalán (`ca`) y coreano (`ko`);
- español como idioma por defecto y fallback;
- detección inicial limitada a esos cuatro idiomas mediante `navigator.language`;
- selector accesible en `AppHeader`, independiente del botón de Ajustes;
- persistencia local bajo la clave estable `inkforge:locale`;
- cambio inmediato desde el selector del encabezado;
- actualización de `document.documentElement.lang` al cambiar de idioma;
- traducción del texto propio de la interfaz, incluidos estados, diálogos, ayudas, placeholders y errores locales del renderer;
- exclusión deliberada de Markdown, rutas, nombres y títulos del usuario, contenido documental, proveedores y modelos, mensajes literales de OpenCode y mensajes procedentes del proceso principal Electron.

`getLibraryError` conserva el comportamiento previo: presenta literalmente los errores remotos y solo localiza sus fallbacks generados en el renderer. La implementación mantiene recursos extensibles para idiomas futuros.

Estado de validación: **implementado y validado**.

Comprobaciones realizadas:

```text
npm --prefix .\app run lint   → correcto
npm --prefix .\app run build  → correcto
cambio manual entre los cuatro idiomas   → correcto
persistencia del idioma tras reiniciar   → correcta
diálogo «Nueva obra» en coreano           → correcto, sin desbordamientos
```

### Etiquetas estructurales localizadas — implementadas, pendientes de validación

El proceso principal añade una clave de presentación opcional únicamente a carpetas estructurales, ficheros de sistema y presentaciones propias que reconoce dentro de proyectos gestionados por Biblioteca. El renderer resuelve esa clave en los recursos `es`, `en`, `ca` y `ko` y conserva el nombre físico como fallback.

Comportamiento implementado:

- solo se localizarán elementos explícitamente identificados como gestionados por Inkforge mediante claves estables;
- los nombres físicos y las rutas permanecerán invariantes;
- los nombres y títulos creados por el usuario permanecerán literales;
- los vaults heredados y los elementos externos no reconocidos permanecerán literales;
- no se inferirá que un elemento es estructural mediante coincidencias de texto.

La cobertura actual se limita a la estructura que Inkforge crea y reconoce hoy: manifiestos de proyecto y libro, áreas compartidas, carpetas de manuscrito, documentos de planificación, canon de libro y rótulo del libro activo. Este último localiza solo su parte fija e interpola literalmente el título del usuario.

Los metadatos de presentación acompañan el árbol y los documentos leídos o devueltos por el guardado; `name` y `path` reales continúan siendo la fuente operativa. No se han añadido migraciones, plantillas ni cambios al formato del proyecto.

Estado: **implementado, pendiente de validación específica**. No se han ejecutado lint, build, tests ni Electron para este añadido. Permanecen válidas las comprobaciones ya registradas del selector de idioma, incluida su persistencia y el diálogo `Nueva obra` en coreano.

### Decisión cerrada: primera importación de proyectos

La primera versión de importación aceptará únicamente proyectos que ya sean compatibles con la estructura de Inkforge.

Reglas cerradas:

- no habrá importador genérico;
- no se renombrarán ni adivinarán automáticamente carpetas, ficheros o ámbitos;
- la entrada se validará antes de importar;
- la operación será no destructiva y copiará el proyecto compatible dentro de la Biblioteca portable;
- `El Cambio` será el caso de migración e importación de referencia;
- la ayuda integrada futura incluirá una guía de preparación e importación.

Estado: **decidido, todavía no implementado**. Se abordará después del hito de etiquetas estructurales localizadas.

Pendientes posteriores conocidos:

- Validar las etiquetas estructurales en los cuatro idiomas para novela, saga, cambio de libro y documento abierto.
- Implementar después la importación validada y no destructiva de proyectos compatibles.
- Diseñar ayuda dentro de la app para explicar solo funciones realmente implementadas: novelas y sagas, libro activo, contenido compartido, guardar, renombrar y comportamiento ante cambios externos. No prometer todavía acciones de chat no implementadas.
- Persistencia de sesiones/chat entre reinicios.
- Persistencia del último modelo.
- Validación real de permisos y preguntas OpenCode.
- Validación completa de variantes.
- Packaging Windows y revisión de `projectRoot` para app empaquetada.
- Perfiles de género/estilo, herencia Saga/Libro y eliminación de supuestos de fantasía heredados.
- Mejoras futuras de conflictos: diff, elección de versión y merge.

## 16. Documentación

README y ayuda en la app son piezas distintas:

- **README:** documentación técnica y de desarrollo ya actualizada con funcionalidades verificadas, arquitectura, comandos y pendientes actuales.
- **Ayuda integrada:** guía de uso de producto, limitada a comportamientos existentes y comprobados.

`docs/DEVELOPMENT_STATUS.md` es el estado operativo del desarrollo; debe conservar decisiones cerradas, separar implementación de validación y reflejar el siguiente paso real.

## 17. Instrucción para una conversación nueva

1. Leer las instrucciones del proyecto y este archivo.
2. No pedir repetir información ya documentada.
3. Comprobar solo información dinámica que pueda haber cambiado.
4. Actualizar este archivo al cerrar avances adicionales.
5. Continuar desde el siguiente paso exacto.

## 18. Siguiente paso exacto

Validar el añadido de etiquetas estructurales localizadas antes de iniciar la importación compatible y su guía.
