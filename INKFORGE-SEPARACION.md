# Inkforge — base Windows separada

Esta carpeta se ha generado a partir de la base limpia de `fiction-vault` incluida en la copia proporcionada, sin contenido narrativo de **El Cambio**.

## Qué conserva

- Estructura base de fiction-vault.
- `web/` original.
- Plantillas vacías y estructura inicial del `vault/`.
- Skills y herramientas originales de la base.
- Compatibilidad Windows recuperada de la copia de trabajo:
  - `opencode.json` usa `python` para arrancar el MCP local.
  - `.tools/vault.py` fuerza salida UTF-8 cuando Windows usa una página de códigos heredada.
  - `.tools/make.py` se conserva como lanzador multiplataforma basado en `sys.executable`.

## Qué NO contiene

- Capítulos de El Cambio.
- Personajes, países, instituciones o canon de El Cambio.
- Cronología, trama, escaleta o estilo específico de El Cambio.
- `.fiction/session_log.json` con historial de la novela.
- `.git`, `node_modules`, `__pycache__`, entornos virtuales ni cachés.

Esta es la carpeta adecuada para continuar el desarrollo general de Inkforge.
