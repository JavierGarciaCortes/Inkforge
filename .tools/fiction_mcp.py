#!/usr/bin/env python3
"""
Fiction Context MCP Server — agnóstico.

Sirve contexto de escritura a asistentes AI vía protocolo MCP (JSON-RPC 2.0
sobre stdin/stdout). Sin dependencias externas.

Usa variable de entorno VAULT_PATH para localizar la bóveda de Obsidian.
Configuración opcional en .fiction/config.yaml dentro de la bóveda.

Tools expuestas:
  search_bible(query)        — búsqueda en documentos de referencia
  get_character(name, chapter?) — perfil de personaje
  get_chapter_context(num)   — metadatos del capítulo
  check_continuity(text, chapter) — valida contra reglas de continuidad
  check_consistency(chapter) — verifica objetos desde lore, tiempo/clima desde YAML
  get_foreshadowing(thread?) — consulta ledger de siembras/pagos
"""

import re
import sys
import json
import traceback
from pathlib import Path
from typing import Any

from vault import (
    VAULT, CHAPTERS_DIR, REFERENCES_DIRS, CHARACTERS_DIRS, WORLD_DIRS,
    STYLE_DIR, FORESHADOWING_FILE,
    strip_comments, get_chapter_number, get_chapter_title, get_manifiesto,
)

try:
    from tools import prose_scanner, editorial_letter
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import prose_scanner, editorial_letter

# Editorial insights — módulo avanzado opcional
HAS_INSIGHTS = False
try:
    from editorial_insights import (
        analyze_style_diagnostics, analyze_dialogue_quality,
        analyze_save_the_cat, analyze_chekhov_gun,
        analyze_backstory_dumps, analyze_scene_summary_ratio,
        classify_story_arc, analyze_revision_hotspots,
        format_markdown,
    )
    HAS_INSIGHTS = True
except ImportError:
    pass


# ---------------------------------------------------------------------------
# MCP Protocol — implementación minimalista sobre JSON-RPC 2.0
# ---------------------------------------------------------------------------

MCP_VERSION = "2024-11-05"
JSONRPC_VERSION = "2.0"


class MCPError(Exception):
    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data


# Códigos de error JSON-RPC estándar
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


class MCPServer:
    def __init__(self):
        self.tools: dict[str, dict] = {}
        self._initialized = False

    def tool(self, name: str, description: str, properties: dict, required: list[str] | None = None):
        """Decorador para registrar un tool handler."""
        def decorator(func):
            self.tools[name] = {
                "handler": func,
                "definition": {
                    "name": name,
                    "description": description,
                    "inputSchema": {
                        "type": "object",
                        "properties": properties,
                        "required": required or [],
                    },
                },
            }
            return func
        return decorator

    def _send(self, msg: dict):
        """Envía un mensaje JSON-RPC por stdout."""
        line = json.dumps(msg, ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

    def _error(self, id: Any, code: int, message: str, data: Any = None):
        self._send({
            "jsonrpc": JSONRPC_VERSION,
            "id": id,
            "error": {"code": code, "message": message, "data": data},
        })

    def _result(self, id: Any, result: Any):
        self._send({
            "jsonrpc": JSONRPC_VERSION,
            "id": id,
            "result": result,
        })

    def _handle_request(self, msg: dict):
        req_id = msg.get("id")
        method = msg.get("method", "")
        params = msg.get("params", {})

        # --- initialize ---
        if method == "initialize":
            client_info = params.get("clientInfo", {})
            client_version = params.get("protocolVersion", MCP_VERSION)
            self._result(req_id, {
                "protocolVersion": MCP_VERSION,
                "capabilities": {
                    "tools": {},
                },
                "serverInfo": {
                    "name": "fiction-context",
                    "version": "1.0.0",
                },
            })
            return

        # --- initialized notification (no response) ---
        if method == "notifications/initialized":
            self._initialized = True
            return

        # --- ping ---
        if method == "ping":
            self._result(req_id, {})
            return

        # --- tools/list ---
        if method == "tools/list":
            tool_defs = [t["definition"] for t in self.tools.values()]
            self._result(req_id, {"tools": tool_defs})
            return

        # --- tools/call ---
        if method == "tools/call":
            name = params.get("name", "")
            arguments = params.get("arguments", {})

            if name not in self.tools:
                self._error(req_id, METHOD_NOT_FOUND, f"Tool not found: {name}")
                return

            tool_info = self.tools[name]
            try:
                result_text = tool_info["handler"](**arguments)
                self._result(req_id, {
                    "content": [{"type": "text", "text": result_text}],
                })
            except TypeError as e:
                self._error(req_id, INVALID_PARAMS, str(e))
            except Exception as e:
                self._error(req_id, INTERNAL_ERROR, str(e), traceback.format_exc())
            return

        # --- método desconocido ---
        self._error(req_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def run(self):
        """Lee solicitudes JSON-RPC de stdin y las despacha."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                self._error(None, PARSE_ERROR, "Parse error")
                continue

            if not isinstance(msg, dict) or msg.get("jsonrpc") != JSONRPC_VERSION:
                self._error(msg.get("id"), INVALID_REQUEST, "Invalid Request")
                continue

            self._handle_request(msg)


# ---------------------------------------------------------------------------
# Vault Discovery (desde vault config, con fallback)
# ---------------------------------------------------------------------------

CHARACTERS_DIR = CHARACTERS_DIRS[0] if CHARACTERS_DIRS else None
REF_DIRS_LIST = REFERENCES_DIRS or []
WORLD_DIR_LIST = WORLD_DIRS or []
ESTILO_DIR = STYLE_DIR


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def list_markdown_files(directory: Path) -> list[Path]:
    """Lista archivos .md en un directorio."""
    if not directory or not directory.exists():
        return []
    return sorted(directory.glob("*.md"))


class DataStore:
    """Carga y referencia todos los documentos de la bóveda."""

    def __init__(self):
        self.sections: list[dict] = []
        self.documents: dict[str, str] = {}
        self._load_all()

    def _load_all(self):
        for ref_dir in REF_DIRS_LIST:
            for f in list_markdown_files(ref_dir):
                self._load_file(f.name, f)
        for world_dir in WORLD_DIR_LIST:
            for f in list_markdown_files(world_dir):
                self._load_file(f.name, f)
        if CHARACTERS_DIR:
            for f in list_markdown_files(CHARACTERS_DIR):
                self._load_file(f.name, f)
        if ESTILO_DIR:
            for f in list_markdown_files(ESTILO_DIR):
                self._load_file(f.name, f)

    def _load_file(self, name: str, path: Path):
        text = path.read_text("utf-8")
        text = strip_comments(text)
        self.documents[name] = text
        self._parse_sections(name, text)

    def _parse_sections(self, source: str, text: str):
        lines = text.split("\n")
        current_heading = "(top)"
        current_level = 0
        current_lines: list[str] = []

        for line in lines:
            m = re.match(r"^(#{1,4})\s+(.+)", line)
            if m:
                if current_lines:
                    content = "\n".join(current_lines).strip()
                    if content:
                        self.sections.append({
                            "source": source,
                            "heading": current_heading,
                            "level": current_level,
                            "content": content,
                        })
                current_heading = m.group(2).strip()
                current_level = len(m.group(1))
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            content = "\n".join(current_lines).strip()
            if content:
                self.sections.append({
                    "source": source,
                    "heading": current_heading,
                    "level": current_level,
                    "content": content,
                })

    def search(self, query: str, max_results: int = 10) -> list[dict]:
        query_lower = query.lower().strip()
        terms = [t for t in query_lower.split() if len(t) > 2]
        if not terms:
            terms = query_lower.split()

        # Siempre incluir la frase completa como búsqueda exacta
        scored: list[tuple[float, dict]] = []

        for sec in self.sections:
            text_lower = sec["content"].lower()
            heading_lower = sec["heading"].lower()
            combined = text_lower + " " + heading_lower

            # Puntuación: frase exacta pesa mucho, términos individuales pesan menos
            phrase_bonus = 50 if query_lower in combined else 0
            term_matches = sum(1 for t in terms if t in combined)
            match_ratio = term_matches / len(terms) if terms else 0

            if phrase_bonus or match_ratio >= 0.6:
                density = sum(combined.count(t) for t in terms)
                score = density + phrase_bonus + (match_ratio * 20)
                scored.append((score, sec))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [s[1] for s in scored[:max_results]]

    def get_source_text(self, name: str) -> str:
        return self.documents.get(name, "")


# ---------------------------------------------------------------------------
# Character states (lee desde la ficha .md de cada personaje)
# ---------------------------------------------------------------------------

def _get_character_arc(name: str) -> str:
    """Extrae la sección 'Arco narrativo' de la ficha del personaje."""
    profile_text = store.get_source_text(f"{name}.md")
    if not profile_text:
        for alt in (f"{name.replace(' ', '_')}.md", f"{name.lower()}.md"):
            profile_text = store.get_source_text(alt)
            if profile_text:
                break
    if not profile_text:
        return ""
    in_arc = False
    arc_lines = []
    for line in profile_text.split("\n"):
        if re.match(r"^##\s+Arco narrativo\s*$", line, re.IGNORECASE):
            in_arc = True
            continue
        if in_arc:
            if line.strip().startswith("##"):
                break
            clean = line.strip()
            if clean:
                arc_lines.append(clean)
    return "\n".join(arc_lines)


def get_character_state(name: str, chapter: int) -> str:
    """Devuelve el arco narrativo del personaje como contexto para el capítulo."""
    arc = _get_character_arc(name)
    if not arc:
        return ""
    # Si el arco contiene fases numeradas, mostrar solo la relevante
    return f"Arco de {name}: {arc}"


def get_character_state_hints(chapter: int) -> list[str]:
    """Devuelve arcos narrativos de todos los personajes con ficha."""
    hints = []
    for char_name in _get_available_characters():
        arc = _get_character_arc(char_name)
        if arc:
            hints.append(f"{char_name}: {arc}")
    return hints


# ---------------------------------------------------------------------------
# Inicializar store
# ---------------------------------------------------------------------------

store = DataStore()


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

server = MCPServer()


@server.tool(
    name="search_bible",
    description="Búsqueda de texto completo en documentos de referencia (personajes, mundo, lore, estilo).",
    properties={
        "query": {
            "type": "string",
            "description": "Términos de búsqueda (ej. 'magia', 'profecía', 'línea temporal')",
        },
    },
    required=["query"],
)
def search_bible(query: str) -> str:
    results = store.search(query, max_results=8)
    if not results:
        return f"Sin resultados para: {query}"

    out: list[str] = []
    for r in results:
        out.append(f"## [{r['source']}] {r['heading']}")
        content = r["content"]
        if len(content) > 2000:
            content = content[:2000] + "\n\n… (truncado)"
        out.append(content)
        out.append("")
    return "\n".join(out)


@server.tool(
    name="get_character",
    description="Perfil de personaje: voz, historia, arco. Si se indica capítulo, incluye estado en ese punto.",
    properties={
        "name": {
            "type": "string",
            "description": "Nombre del personaje",
        },
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional para conocer su estado en ese punto",
        },
    },
    required=["name"],
)
def get_character(name: str, chapter: int | None = None) -> str:
    name_lower = name.lower().strip()
    results = store.search(name_lower, max_results=10)
    if not results:
        return f"No se encontró información sobre: {name}"

    # Separar secciones de personajes del resto
    char_sections = []
    other_sections = []
    for r in results:
        if "personaje" in r["heading"].lower() or name_lower in r["heading"].lower():
            char_sections.append(r)
        else:
            other_sections.append(r)

    out: list[str] = []

    if char_sections:
        out.append("## Perfil del personaje")
        for s in char_sections[:5]:
            out.append(f"\n### {s['heading']}\n{s['content']}\n")

    if other_sections:
        out.append("## Referencias adicionales")
        for s in other_sections[:5]:
            content = s["content"]
            if len(content) > 1500:
                content = content[:1500] + "\n… (truncado)"
            out.append(f"\n### [{s['source']}] {s['heading']}\n{content}\n")

    if chapter is not None:
        out.append(f"\n## Estado en capítulo {chapter}")
        state = get_character_state(name_lower, chapter)
        if state:
            out.append(f"> {state}")
        # Buscar en secciones por menciones del capítulo
        for s in store.sections:
            if f"capítulo {chapter}" in s["content"].lower() or f"cap {chapter}" in s["content"].lower():
                if name_lower in s["content"].lower():
                    out.append(f"\nEn [{s['source']}] {s['heading']}:\n{s['content']}")

    return "\n".join(out)


def _find_chapters_with_location(name: str) -> list[int]:
    """Busca en qué capítulos aparece mencionada una ubicación."""
    name_lower = name.lower().strip()
    found = []
    for f in get_manifiesto().archivos_existentes():
        num = get_manifiesto().get_numero(f.name)
        if num is None:
            continue
        text = f.read_text("utf-8").lower()
        if name_lower in text:
            found.append(num)
    return sorted(found)


@server.tool(
    name="get_location",
    description="Perfil de ubicación: descripción, historia, lugares de interés, peligros, y capítulos donde aparece.",
    properties={
        "name": {
            "type": "string",
            "description": "Nombre de la ubicación a consultar",
        },
    },
    required=["name"],
)
def get_location(name: str) -> str:
    name_lower = name.lower().strip()

    # Buscar archivo de ubicación en directorios de world/lugares
    location_file = None
    for d in WORLD_DIRS:
        search_dirs = list(d.iterdir()) if d.is_dir() else [d]
        for sd in [d] + [p for p in search_dirs if p.is_dir()]:
            if sd.exists():
                for f in sorted(sd.glob("*.md")):
                    if name_lower in f.stem.lower():
                        location_file = f
                        break
            if location_file:
                break
        if location_file:
            break

    out: list[str] = []

    if location_file:
        text = location_file.read_text("utf-8")
        text = strip_comments(text)
        # Extraer secciones
        sections = []
        current_heading = ""
        current_lines = []
        for line in text.split("\n"):
            m = re.match(r"^(#{1,4})\s+(.+)", line)
            if m:
                if current_lines and current_heading:
                    sections.append((current_heading, "\n".join(current_lines).strip()))
                current_heading = m.group(2).strip()
                current_lines = []
            else:
                current_lines.append(line)
        if current_lines and current_heading:
            sections.append((current_heading, "\n".join(current_lines).strip()))

        out.append("## Perfil de la ubicación")
        for heading, content in sections:
            if content:
                out.append(f"\n### {heading}\n{content}\n")
    else:
        # Fallback: búsqueda en el store
        results = store.search(name_lower, max_results=8)
        if not results:
            return f"No se encontró información sobre: {name}"
        out.append("## Referencias")
        for r in results:
            content = r["content"]
            if len(content) > 1500:
                content = content[:1500] + "\n… (truncado)"
            out.append(f"\n### [{r['source']}] {r['heading']}\n{content}\n")

    # Capítulos donde aparece
    chapters = _find_chapters_with_location(name)
    if chapters:
        out.append(f"\n## Aparece en capítulos\n{', '.join(str(c) for c in chapters)}")

    return "\n".join(out)


@server.tool(
    name="get_chapter_context",
    description="Metadatos del capítulo: título, palabras, líneas de apertura/cierre, y contexto del capítulo anterior/siguiente.",
    properties={
        "chapter_number": {
            "type": "number",
            "description": "Número del capítulo",
        },
    },
    required=["chapter_number"],
)
def get_chapter_context(chapter_number: int) -> str:
    # Usar el orden del manifiesto
    chapters = get_manifiesto().archivos_existentes()
    idx = -1
    target = None
    for i, ch in enumerate(chapters):
        if get_manifiesto().get_numero(ch.name) == chapter_number:
            idx = i
            target = ch
            break

    if target is None:
        return f"Capítulo {chapter_number} no encontrado en el manifiesto."

    text = strip_comments(target.read_text("utf-8"))
    title = get_chapter_title(text)
    words = len(text.split())
    lines = [l for l in text.split("\n") if l.strip() and not l.startswith("#")]
    opening = "\n".join(lines[:5])
    closing = "\n".join(lines[-5:])

    out: list[str] = [
        f"# Capítulo {chapter_number}: {title}",
        f"**Archivo**: {target.name}",
        f"**Palabras**: {words:,}",
        f"\n## Apertura\n```\n{opening}\n```",
        f"\n## Cierre\n```\n{closing}\n```",
    ]

    if idx > 0:
        prev = chapters[idx - 1]
        prev_text = strip_comments(prev.read_text("utf-8"))
        prev_title = get_chapter_title(prev_text)
        prev_lines = [l for l in prev_text.split("\n") if l.strip() and not l.startswith("#")]
        prev_ending = "\n".join(prev_lines[-5:])
        out.append(
            f"\n## Cierre del capítulo anterior "
            f"(Cap {get_manifiesto().get_numero(prev.name)}: {prev_title})"
            f"\n```\n{prev_ending}\n```"
        )

    if 0 <= idx < len(chapters) - 1:
        nxt = chapters[idx + 1]
        nxt_text = strip_comments(nxt.read_text("utf-8"))
        nxt_title = get_chapter_title(nxt_text)
        nxt_lines = [l for l in nxt_text.split("\n") if l.strip() and not l.startswith("#")]
        nxt_opening = "\n".join(nxt_lines[:5])
        out.append(
            f"\n## Apertura del capítulo siguiente "
            f"(Cap {get_manifiesto().get_numero(nxt.name)}: {nxt_title})"
            f"\n```\n{nxt_opening}\n```"
        )

    return "\n".join(out)


@server.tool(
    name="check_continuity",
    description="Valida un pasaje de texto contra reglas de continuidad: personajes fallecidos, revelaciones de identidad, cambios de estado.",
    properties={
        "text": {
            "type": "string",
            "description": "Pasaje a verificar",
        },
        "chapter": {
            "type": "number",
            "description": "Número de capítulo donde aparece el pasaje",
        },
    },
    required=["text", "chapter"],
)
def check_continuity(text: str, chapter: int) -> str:
    text_lower = text.lower()
    warnings: list[str] = []

    # Leer foreshadowing para buscar muertes y revelaciones conocidas
    foreshadow_text = store.get_source_text("Foreshadowing.md") or ""
    foreshadow_lower = foreshadow_text.lower()

    # Detectar personajes mencionados como fallecidos en foreshadowing
    death_lines = []
    for line in foreshadow_text.split("\n"):
        if any(w in line.lower() for w in ("muere", "muerte", "sacrifica", "fallece", "asesinado")):
            death_lines.append(line)

    for line in death_lines:
        for char_name in _get_available_characters():
            if char_name.lower() in line.lower():
                char_lower = char_name.lower()
                if char_lower in text_lower:
                    idx = text_lower.index(char_lower) + len(char_lower)
                    rest = text_lower[idx:].strip()
                    next_word = rest.split()[0] if rest.split() else ""
                    if next_word and len(next_word) >= 3:
                        if next_word.endswith(("ó", "ía", "ió", "aba")):
                            warnings.append(
                                f"⚠ {char_name} podría estar muerto según foreshadowing, "
                                f"pero aparece activo en cap {chapter}: «{char_name} {next_word}». "
                                f"Si es flashback, asegura que el marco temporal sea claro."
                            )
                            break

    if not warnings:
        return f"Sin problemas de continuidad detectados en capítulo {chapter}."

    result = [f"Verificación de continuidad para capítulo {chapter}:\n"]
    for w in warnings:
        result.append(f"- {w}")
    return "\n".join(result)


@server.tool(
    name="get_foreshadowing",
    description="Consulta el ledger de siembras y pagos narrativos. Sin argumento, devuelve el ledger completo.",
    properties={
        "thread": {
            "type": "string",
            "description": "Hilo concreto a buscar. Opcional.",
        },
    },
)
def get_foreshadowing(thread: str | None = None) -> str:
    foreshadow_file = FORESHADOWING_FILE
    foreshadow_text = store.get_source_text(foreshadow_file.name) if foreshadow_file else None
    if not foreshadow_text:
        foreshadow_text = store.get_source_text("Foreshadowing.md")
    if not foreshadow_text:
        return "No se encontró archivo de foreshadowing en los documentos de referencia."

    if not thread:
        return foreshadow_text

    # Buscar el hilo específico
    thread_lower = thread.lower()
    results = store.search(thread_lower, max_results=8)
    # Filtrar resultados del archivo de foreshadowing por nombre o contenido
    fs_name = foreshadow_file.stem.lower() if foreshadow_file else "foreshadowing"
    relevant = [r for r in results if fs_name in r["source"].lower() or "siembra" in r["source"].lower()]

    if not relevant:
        # Devolver secciones que coincidan del propio texto
        out: list[str] = [f"## Foreshadowing: {thread}\n"]
        for line in foreshadow_text.split("\n"):
            if thread_lower in line.lower():
                out.append(line)
        return "\n".join(out) if len(out) > 1 else f"No se encontró el hilo: {thread}"

    out = [f"## Foreshadowing: {thread}\n"]
    for r in relevant:
        out.append(f"### [{r['source']}] {r['heading']}\n{r['content']}\n")
    return "\n".join(out)


@server.tool(
    name="check_consistency",
    description="Verifica consistencia fina de objetos, tiempo, clima, atributos y ubicaciones en un capítulo.",
    properties={
        "chapter_number": {
            "type": "number",
            "description": "Número del capítulo a verificar",
        },
    },
    required=["chapter_number"],
)
def check_consistency(chapter_number: int) -> str:
    chapters = _get_chapters(chapter_number)
    if not chapters:
        return f"Capítulo {chapter_number} no encontrado."
    c = chapters[0]
    text = c["text"]
    clean = text.lower()
    issues: list[str] = []
    ch_title = c["title"]

    # 1. Objetos: leer desde vault/Mundo/Historia/
    for d in WORLD_DIRS:
        if not d.is_dir():
            continue
        for hf in d.glob("*.md"):
            if hf.stem.startswith("_") or hf.stem.startswith("."):
                continue
            htext = hf.read_text("utf-8")
            # Extraer metadatos del objeto: > **Alias:** ..., > **Dueño:** ...
            name = hf.stem
            aliases = [name.lower()]
            alias_match = re.search(r">\s*\*\*Alias:\*\*\s*(.+)", htext)
            if alias_match:
                aliases = [a.strip().lower() for a in alias_match.group(1).split(",")]
            # Si algún alias aparece en el capítulo, reportar
            for alias in aliases:
                if alias in clean:
                    issues.append(f"ℹ Objeto «{name}» (alias: «{alias}») aparece en este capítulo.")
                    break

    # 2. Tiempo y clima desde YAML del capítulo
    yaml_time = ""
    yaml_weather = ""
    for line in text.split("\n"):
        if line.strip().startswith("tiempo:"):
            yaml_time = line.split(":", 1)[1].strip()
        if line.strip().startswith("clima:"):
            yaml_weather = line.split(":", 1)[1].strip()
        if yaml_time and yaml_weather:
            break

    if yaml_time:
        issues.append(f"ℹ Tiempo registrado: «{yaml_time}»")
    else:
        issues.append("⚠ Sin campo 'tiempo' en el YAML del capítulo.")
    if yaml_weather:
        issues.append(f"ℹ Clima registrado: «{yaml_weather}»")
    else:
        issues.append("⚠ Sin campo 'clima' en el YAML del capítulo.")

    result = [f"## Capítulo {chapter_number}: {ch_title}\n"]
    if not issues:
        result.append("Sin incidencias de consistencia.")
    else:
        for iss in issues:
            result.append(f"- {iss}")
    return "\n".join(result)


@server.tool(
    name="check_transitions",
    description="Verifica transiciones de tiempo y clima entre capítulos consecutivos.",
    properties={},
)
def mcp_check_transitions() -> str:
    # Leer tiempo y clima del YAML de cada capítulo
    chapter_data = []
    for f in sorted(get_manifiesto().archivos_existentes(), key=lambda x: get_manifiesto().get_numero(x.name) or 0):
        num = get_manifiesto().get_numero(f.name)
        if num is None:
            continue
        text = f.read_text("utf-8")
        tiempo = ""
        clima = ""
        for line in text.split("\n"):
            if line.strip().startswith("tiempo:"):
                tiempo = line.split(":", 1)[1].strip()
            if line.strip().startswith("clima:"):
                clima = line.split(":", 1)[1].strip()
            if tiempo and clima:
                break
        chapter_data.append({"num": num, "tiempo": tiempo, "clima": clima})

    if len(chapter_data) < 2:
        return "## Transiciones entre capítulos\n\nSe necesitan al menos 2 capítulos. ✓"

    issues: list[str] = []
    for i in range(1, len(chapter_data)):
        prev = chapter_data[i - 1]
        curr = chapter_data[i]
        if curr["num"] != (prev["num"] or 0) + 1:
            continue
        # Salto noche → mediodía
        if "noche" in prev["tiempo"] and "mediodía" in curr["tiempo"]:
            issues.append(
                f"⚠ Cap {prev['num']} termina de noche y cap {curr['num']} es mediodía. Transición sin justificación."
            )
        # Sin sol → sol
        if "sin sol" in prev["clima"] and "sol" in curr["clima"]:
            issues.append(
                f"ℹ Cambio climático cap {prev['num']}→{curr['num']}: «{prev['clima']}» → «{curr['clima']}». ¿Intencional?"
            )

    if not issues:
        return "## Transiciones entre capítulos\n\nSin incidencias. ✓"
    result = ["## Transiciones entre capítulos\n"]
    for iss in issues:
        result.append(f"- {iss}")
    return "\n".join(result)


@server.tool(
    name="scan_prose",
    description="Ejecuta el escáner de patrones de prosa. Con chapter_number, analiza un capítulo. Sin él, resumen global + tabla.",
    properties={
        "chapter_number": {
            "type": "number",
            "description": "Capítulo a escanear (opcional). Sin esto, devuelve resumen global.",
        },
        "include_context": {
            "type": "boolean",
            "description": "Incluir correlación con estados de personaje (default: true)",
        },
    },
)
def scan_prose(chapter_number: int | None = None, include_context: bool = True) -> str:
    if chapter_number is not None:
        num_str = f"{chapter_number:02d}"
        data = prose_scanner.scan_chapter(num_str, context_mode="short")
        if not data:
            return f"Capítulo {chapter_number} no encontrado."
        return _format_scan_chapter(data, include_context)
    else:
        all_data = prose_scanner.scan_all(context_mode="short")
        return _format_scan_global(all_data)


def _format_scan_chapter(data: dict, include_context: bool) -> str:
    out = [f"## Capítulo {data['cap']}: {data['archivo']}"]
    sev = data["severidad"]
    out.append(f"**Palabras**: {data['palabras']}  |  **Score**: {sev['score']}  |  **Tier**: {sev['tier']}")
    est = data.get("estructura")
    if est:
        out.append(f"**Párrafos**: {est['total_parrafos']}  |  **Media**: {est['media']} palabras  |  **Desv**: ±{est['desviacion']}")
    out.append("")

    # Patrones sobre target
    over = [(r["contribucion"], n, r) for n, r in data["resultados"].items() if r["sobre_target"] > 0]
    over.sort(key=lambda x: x[0], reverse=True)

    if not over:
        out.append("Sin patrones sobre target. ✓")
    else:
        for contrib, name, r in over:
            out.append(f"**{name}**: {r['count']} oc. ({r['densidad']}/{r['target']}/1k, contrib {contrib})")
            if r["clusters"]:
                for c_start, c_end, count in r["clusters"]:
                    out.append(f"  ⚠ Cluster: {count}x en palabras {c_start}-{c_end}")
        out.append("")

    # Correlación con estados de personaje
    if include_context:
        ch_num = int(data["cap"])
        states_hint = get_character_state_hints(ch_num)
        if states_hint:
            out.append(f"**Estados activos en este capítulo:**")
            for s in states_hint:
                out.append(f"  • {s}")
            out.append("")
    return "\n".join(out)


def _format_scan_global(all_data: list[dict]) -> str:
    if not all_data:
        return "No se encontraron capítulos."

    total_words = sum(d["palabras"] for d in all_data)
    total_patrones: dict[str, int] = {}
    for d in all_data:
        for name, r in d["resultados"].items():
            total_patrones[name] = total_patrones.get(name, 0) + r["count"]

    out = [f"## Prose Scanner — Resumen Global",
           f"**Total**: {total_words} palabras en {len(all_data)} capítulos\n"]

    # Tabla de capítulos
    headers = ["Cap", "Palabras", "Score", "Tier", "Problemas"]
    out.append(f"| {' | '.join(headers)} |")
    out.append(f"| {' | '.join('---' for _ in headers)} |")
    for d in sorted(all_data, key=lambda x: int(x["cap"])):
        sev = d["severidad"]
        problemas = sorted(
            [(r["contribucion"], n) for n, r in d["resultados"].items() if r["sobre_target"] > 0],
            reverse=True,
        )[:2]
        prob_parts = []
        for s, n in problemas:
            r = d["resultados"][n]
            prob_parts.append(f"{n}={r['densidad']:.1f}/1k")
        prob_str = ", ".join(prob_parts) if prob_parts else "—"
        out.append(f"| {d['cap']} | {d['palabras']} | {sev['score']} | {sev['tier']} | {prob_str} |")

    return "\n".join(out)


@server.tool(
    name="editorial_letter",
    description="Genera carta editorial automatizada con análisis profundo: estructura, función de escenas, "
                "arco emocional, inmersión sensorial, foreshadowing, show vs tell, hooks, y plan de revisión. "
                "Usa beta=true para informe completo; insights=true para estilo/diálogo/Save the Cat.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo específico para análisis detallado (opcional)",
        },
        "summary_only": {
            "type": "boolean",
            "description": "Solo tabla de prioridades (default: false)",
        },
        "beta": {
            "type": "boolean",
            "description": "Informe profesional sintético con todas las analíticas (default: false)",
        },
        "plan": {
            "type": "boolean",
            "description": "Generar plan de revisión faseado (default: false)",
        },
        "insights": {
            "type": "boolean",
            "description": "Análisis avanzado: estilo, diálogo, Save the Cat, Chekhov, arco Vonnegut (default: false)",
        },
        "output_format": {
            "type": "string",
            "description": "Formato de salida: 'markdown' (default) o 'json'",
            "enum": ["markdown", "json"],
        },
    },
)
def mcp_editorial_letter(
    chapter: int | None = None,
    summary_only: bool = False,
    beta: bool = False,
    plan: bool = False,
    insights: bool = False,
    output_format: str = "markdown",
) -> str:
    files = editorial_letter.get_chapter_files()
    chapters = [editorial_letter.read_chapter(f) for f in files]

    if output_format == "json":
        return editorial_letter.generate_json(chapters, chapter)

    if insights:
        if not editorial_letter.HAS_INSIGHTS:
            return "Error: módulo editorial_insights no disponible."
        try:
            advanced = editorial_letter.analyze_advanced_all(chapters)
            advanced["story_arc"] = classify_story_arc(None, chapters)
            return format_markdown(advanced)
        except Exception as e:
            return f"Error en insights: {e}"

    if beta:
        return editorial_letter.generate_beta_synthesis(chapters)

    if plan:
        struct = editorial_letter.analyze_structure(chapters)
        prose = editorial_letter.analyze_prose(chapters)
        voice = editorial_letter.analyze_voice(chapters)
        foreshadowing = editorial_letter.analyze_foreshadowing()
        pacing = editorial_letter.analyze_pacing(chapters)
        priorities = editorial_letter._generate_priorities(
            struct, prose, voice, foreshadowing, pacing, chapters,
        )
        return editorial_letter.generate_revision_plan(priorities)

    if summary_only:
        return editorial_letter.generate_summary(chapters)

    if chapter is not None:
        matching = [c for c in chapters if c["num"] == chapter]
        if not matching:
            return f"Capítulo {chapter} no encontrado."
        prose = editorial_letter.analyze_prose(chapters)
        voice = editorial_letter.analyze_voice(chapters)
        return editorial_letter._letter_for_chapter(matching[0], prose, voice)

    return editorial_letter.generate_letter(chapters)


# ---------------------------------------------------------------------------
# Helpers compartidos para nuevas tools
# ---------------------------------------------------------------------------

def _get_chapters(chapter: int | None = None) -> list[dict]:
    """Carga capítulos; si chapter no es None, filtra. Retorna lista vacía si no encuentra."""
    files = editorial_letter.get_chapter_files()
    chapters = [editorial_letter.read_chapter(f) for f in files]
    if chapter is not None:
        chapters = [c for c in chapters if c["num"] == chapter]
    return chapters


def _fmt_table(headers: list[str], rows: list[list[str]]) -> str:
    out = [f"| {' | '.join(headers)} |"]
    out.append(f"| {' | '.join('---' for _ in headers)} |")
    for row in rows:
        out.append(f"| {' | '.join(str(c) for c in row)} |")
    out.append("")
    return "\n".join(out)


# ═══════════════════════════════════════════════════════════════════════════
# Nuevas herramientas MCP — envuelven lógica existente de editorial_letter
# y editorial_insights, exponiéndola como tools individuales.
# ═══════════════════════════════════════════════════════════════════════════

# Perfiles de voz para check_voice_consistency (lee desde la ficha .md de cada personaje)
def _get_character_voice(name: str) -> str:
    """Extrae la sección 'Voz' de la ficha del personaje."""
    profile_text = store.get_source_text(f"{name}.md")
    if not profile_text:
        for alt in (f"{name.replace(' ', '_')}.md", f"{name.lower()}.md"):
            profile_text = store.get_source_text(alt)
            if profile_text:
                break
    if not profile_text:
        return ""
    in_voz = False
    voz_lines = []
    for line in profile_text.split("\n"):
        if re.match(r"^##\s+Voz\s*$", line, re.IGNORECASE):
            in_voz = True
            continue
        if in_voz:
            if line.strip().startswith("##"):
                break
            clean = line.strip()
            if clean and not clean.startswith("<!--") and not clean.endswith("-->"):
                voz_lines.append(clean)
    return " ".join(voz_lines)


def _get_available_characters() -> list[str]:
    """Lista personajes con ficha disponible."""
    names = []
    for d in CHARACTERS_DIRS:
        if d.is_dir():
            for f in d.glob("*.md"):
                if not f.name.startswith("_") and not f.name.startswith("."):
                    names.append(f.stem)
    return sorted(names)


def _get_character_names_str() -> str:
    """Devuelve lista de personajes para usar en descripciones de tool."""
    return ", ".join(_get_available_characters())


def _append_nunca_diria(out: list[str], character: str, text: str) -> None:
    """Busca patrones 'NUNCA diría' en la ficha del personaje y los cruza con el texto."""
    profile_text = store.get_source_text(f"{character}.md")
    if not profile_text:
        for alt in (f"{character.replace(' ', '_')}.md", f"{character.lower()}.md"):
            profile_text = store.get_source_text(alt)
            if profile_text:
                break
    if not profile_text:
        return
    nunca_section = ""
    in_section = False
    for line in profile_text.split("\n"):
        if re.search(r"(NUNCA|nunca\s+diría|no\s+diría)", line, re.IGNORECASE):
            in_section = True
        if in_section:
            nunca_section += line + "\n"
            if line.strip() == "" and len(nunca_section) > 50:
                break
    if nunca_section:
        for pattern_line in nunca_section.split("\n"):
            pattern = pattern_line.strip().strip("-* ").lower()
            if len(pattern) > 5 and pattern in text.lower():
                out.append(f"\n⚠ **NUNCA diría**: se detectó «{pattern[:60]}»")


@server.tool(
    name="check_voice_consistency",
    description="Valida el diálogo de un personaje en un capítulo contra su perfil de voz.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Número del capítulo",
        },
        "character": {
            "type": "string",
            "description": f"Nombre del personaje con perfil de voz registrado ({_get_character_names_str()})",
        },
    },
    required=["chapter", "character"],
)
def check_voice_consistency(chapter: int, character: str) -> str:
    chapters = _get_chapters(chapter)
    if not chapters:
        return f"Capítulo {chapter} no encontrado."
    c = chapters[0]
    text = c["text"]

    dialogue_lines = re.findall(r"^—([^—\n]*)", text, re.MULTILINE)
    dialogue_lines = [l.strip() for l in dialogue_lines if l.strip()]
    total = len(dialogue_lines)

    out = [f"## Voz de {character} — Capítulo {chapter}: {c['title']}"]

    voz = _get_character_voice(character)
    if voz:
        out.append(f"**Esperado**: {voz}")
    else:
        out.append(f"**Esperado**: (sin sección 'Voz' en la ficha de {character})")

    if not dialogue_lines:
        out.append("\n*Sin diálogo en este capítulo.*")
        # NUNCA diría check even without dialogue
        _append_nunca_diria(out, character, text)
        return "\n".join(out)

    questions = sum(1 for l in dialogue_lines if "?" in l)
    imperatives = sum(
        1 for l in dialogue_lines
        if re.search(r"\b(cállate|vamos|dame|mira|escucha|ven|termina|suelta|deja|no\s+|siéntate|levántate)\b", l, re.IGNORECASE)
    )
    ellipsis_count = sum(1 for l in dialogue_lines if "..." in l or "…" in l)
    short_lines = sum(1 for l in dialogue_lines if len(l.split()) <= 5)
    avg_words = round(sum(len(l.split()) for l in dialogue_lines) / total, 1)
    repite_yo = sum(1 for l in dialogue_lines if re.search(r"\byo\b", l, re.IGNORECASE))

    out.append(f"\n**{total} líneas**, media {avg_words} pal, "
               f"{questions} preg, {imperatives} imp, {ellipsis_count} elipsis, {repite_yo} 'yo'")

    # Derivar checks del texto de voz
    voz_lower = voz.lower() if voz else ""
    if any(w in voz_lower for w in ["pregunta", "duda", "cuestiona", "preguntativ"]):
        rate = questions / total if total else 0
        icon = "✓" if rate > 0.4 else "⚠"
        out.append(f"\n{icon} **Preguntas**: {rate:.0%} — {'alto (coherente con perfil preguntativo)' if rate > 0.4 else 'bajo para perfil preguntativo'}")
    if any(w in voz_lower for w in ["imperativo", "ordena", "manda"]):
        icon = "✓" if imperatives > 0 else "ℹ"
        out.append(f"\n{icon} **Imperativos**: {imperatives} — {'coherente con perfil imperativo' if imperatives > 0 else 'neutro (depende del capítulo)'}")
    if any(w in voz_lower for w in ["corto", "breve", "telegráfico", "seco", "lacónico"]):
        rate = short_lines / total if total else 0
        icon = "✓" if rate > 0.25 else "ℹ"
        out.append(f"\n{icon} **Líneas cortas (≤5 pal)**: {rate:.0%} — {'coherente con perfil telegráfico' if rate > 0.25 else 'neutro'}")
    if any(w in voz_lower for w in ["evasivo", "vacila", "titubea"]):
        icon = "✓" if ellipsis_count > 0 else "ℹ"
        out.append(f"\n{icon} **Elipsis**: {ellipsis_count} — {'coherente con perfil evasivo' if ellipsis_count > 0 else 'neutro'}")
    if any(w in voz_lower for w in ["humano", "roto", "vulnerable"]):
        icon = "✓" if repite_yo > 0 else "ℹ"
        out.append(f"\n{icon} **'yo' en diálogo**: {repite_yo} {'— coherente con perfil humano/roto' if repite_yo > 0 else '— neutro'}")
    if any(w in voz_lower for w in ["erudito", "culto", "extenso", "elaborado", "formal"]):
        icon = "✓" if avg_words >= 8 else "ℹ"
        out.append(f"\n{icon} **Longitud media**: {avg_words} pal/línea — {'coherente con perfil erudito' if avg_words >= 8 else 'corto para perfil erudito'}")

    # Buscar "NUNCA diría" en la ficha del personaje
    _append_nunca_diria(out, character, text)

    return "\n".join(out)


@server.tool(
    name="check_emotional_arc",
    description="Analiza la intensidad emocional por capítulo. Sin capítulo, resumen global.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional. Sin él, resumen de todos.",
        },
    },
)
def mcp_emotional_arc(chapter: int | None = None) -> str:
    chapters = _get_chapters(chapter)
    emotions = editorial_letter.analyze_emotional_timeline(chapters)
    if not emotions:
        return "Sin datos emocionales."

    out = ["## Arco Emocional"]
    if chapter is not None:
        e = emotions.get(chapter)
        if not e:
            return f"Sin datos emocionales para capítulo {chapter}."
        out.append(f"**Intensidad media**: {e['mean_intensity']}")
        out.append(f"**Párrafos planos**: {e['flat_paragraphs']} (máx {e['max_flat_streak']} seguidos)")
        out.append(f"**Párrafos saturados**: {e['saturated_paragraphs']}")
        if e.get("peak"):
            out.append(f"**Pico**: puntuación {e['peak']['score']} — «{e['peak']['preview'][:80]}»")
        if e.get("valley"):
            out.append(f"**Valle**: puntuación {e['valley']['score']} — «{e['valley']['preview'][:80]}»")
    else:
        rows = []
        for cn in sorted(emotions):
            e = emotions[cn]
            rows.append([
                f"{cn:02d}", str(e['mean_intensity']),
                str(e['flat_paragraphs']), str(e['max_flat_streak']),
                str(e['saturated_paragraphs']),
            ])
        out.append(_fmt_table(
            ["Cap", "Intensidad", "Planos", "Máx plana", "Saturados"], rows,
        ))
    return "\n".join(out)


@server.tool(
    name="check_scenes",
    description="Clasifica escenas por tipo y función narrativa. Sin capítulo, resumen global.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional.",
        },
    },
)
def mcp_scenes(chapter: int | None = None) -> str:
    chapters = _get_chapters(chapter)
    scenes = editorial_letter.analyze_scene_function(chapters)

    out = ["## Función de Escenas"]
    out.append(f"**Total escenas**: {scenes['total_scenes']}")
    out.append(f"**Sin función clara**: {scenes['weak_count']}\n")

    for cn in sorted(scenes["per_chapter"]):
        sc = scenes["per_chapter"][cn]
        out.append(f"### Capítulo {cn:02d} ({sc['scene_count']} escenas)")
        for s in sc["scenes"]:
            func_str = ", ".join(s["functions"]) if s["functions"] else "⚠ ninguna"
            out.append(f"- Escena {s['index']}: **{s['type']}** ({s['words']} pal) → {func_str}")
        out.append("")
    return "\n".join(out)


@server.tool(
    name="check_hooks",
    description="Evalúa la fuerza de los ganchos de apertura y cierre de cada capítulo.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional.",
        },
    },
)
def mcp_hooks(chapter: int | None = None) -> str:
    chapters = _get_chapters(chapter)
    hooks = editorial_letter.analyze_hooks(chapters)

    out = ["## Ganchos de Capítulo\n"]
    rows = []
    for cn in sorted(hooks):
        h = hooks[cn]
        op = h["opening"]
        cl = h["closing"]
        wfc = str(op["words_to_first_conflict"]) if op["words_to_first_conflict"] else "—"
        ant = "✓" if cl["anticipation"] else "—"
        rows.append([f"{cn:02d}", op["type"], wfc, cl["type"], cl["hook_strength"], ant])
    out.append(_fmt_table(
        ["Cap", "Apertura", "1er conflicto (pal)", "Cierre", "Hook", "Anticipa"], rows,
    ))
    return "\n".join(out)


@server.tool(
    name="check_show_dont_tell",
    description="Detecta emociones nombradas sin anclaje físico (telling).",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional.",
        },
    },
)
def mcp_show_dont_tell(chapter: int | None = None) -> str:
    chapters = _get_chapters(chapter)
    result = editorial_letter.analyze_show_dont_tell(chapters)

    out = ["## Show vs Tell"]
    out.append(f"**Total tells**: {result['total_tells']}\n")

    if result["total_tells"] == 0:
        out.append("Sin emociones sin anclaje detectadas. ✓")
        return "\n".join(out)

    for cn in sorted(result["per_chapter"]):
        st = result["per_chapter"][cn]
        if st["total_tells"] > 0:
            out.append(f"### Capítulo {cn:02d} ({st['total_tells']} tells)")
            for t in st["tells"][:5]:
                out.append(f"- «{t['emotion']}» → «{t['context'][:80]}…»")
            out.append("")
    return "\n".join(out)


@server.tool(
    name="get_pacing",
    description="Analiza el ritmo: outliers, balance de actos, distribución de palabras.",
    properties={},
)
def mcp_pacing() -> str:
    chapters = _get_chapters(None)
    struct = editorial_letter.analyze_structure(chapters)
    pacing = editorial_letter.analyze_pacing(chapters)

    out = ["## Ritmo"]
    out.append(f"**Media**: {pacing['mean']:.0f} pal (±{pacing['std_dev']:.0f})")
    out.append(f"**Más largo**: cap{struct['max_chapter']['num']:02d} ({struct['max_chapter']['words']} pal)")
    out.append(f"**Más corto**: cap{struct['min_chapter']['num']:02d} ({struct['min_chapter']['words']} pal)\n")

    if pacing.get("outliers"):
        out.append("**Outliers:**")
        for o in pacing["outliers"]:
            dir_str = "↑ largo" if o["direction"] == "long" else "↓ corto"
            out.append(f"- Cap {o['chapter']:02d} ({o['words']} pal) {dir_str}")
        out.append("")

    out.append("**Balance por acto:**")
    rows = []
    for act_num in sorted(pacing["act_words"]):
        a = pacing["act_words"][act_num]
        expected = round(100 / 3, 1)
        actual = round(a["total"] / struct["total_words"] * 100, 1)
        diff = round(actual - expected, 1)
        rows.append([str(act_num), a["label"], f"{a['total']} pal", f"{actual}%", f"{'+' if diff > 0 else ''}{diff}%"])
    out.append(_fmt_table(["Acto", "Nombre", "Palabras", "%", "vs equilibrio"], rows))
    return "\n".join(out)


@server.tool(
    name="get_story_arc",
    description="Clasifica el arco narrativo según las formas de Vonnegut.",
    properties={},
)
def mcp_story_arc() -> str:
    if not HAS_INSIGHTS:
        return "Error: módulo editorial_insights no disponible."

    chapters = _get_chapters(None)
    emotions = editorial_letter.analyze_emotional_timeline(chapters)
    timeline = {k: {"mean_intensity": v.get("mean_intensity", 0)} for k, v in emotions.items()}
    result = classify_story_arc(timeline, None)

    out = ["## Arco Narrativo (Vonnegut)"]
    if result.get("arc") and result["arc"] not in ("unknown", "insuficiente", "error"):
        out.append(f"**Arco**: {result['arc']}")
        out.append(f"**Confianza**: {result.get('confidence', 0)}")
        shape = result.get("shape", {})
        if shape:
            out.append(f"- Tercio inicial: {shape.get('first_third', '—')}")
            out.append(f"- Tercio medio: {shape.get('middle_third', '—')}")
            out.append(f"- Tercio final: {shape.get('last_third', '—')}")
    else:
        out.append(f"*{result.get('arc', 'No se pudo clasificar')}*")
    return "\n".join(out)


@server.tool(
    name="check_backstory_dumps",
    description="Detecta párrafos con alta densidad de pluscuamperfecto (info-dumps de backstory).",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional.",
        },
    },
)
def mcp_backstory_dumps(chapter: int | None = None) -> str:
    if not HAS_INSIGHTS:
        return "Error: módulo editorial_insights no disponible."

    chapters = _get_chapters(chapter)
    result = analyze_backstory_dumps(chapters)

    out = ["## Backstory Dumps"]
    dg = result.get("global", {})
    out.append(f"**Total dumps**: {dg.get('total_dumps', 0)} párrafos")
    out.append(f"**Caps afectados**: {dg.get('chapters_with_dumps', 0)}")
    out.append(f"**Densidad pluscuamperfecto**: {dg.get('density_per_1k', 0)}/1k pal\n")

    if chapter is not None and chapter in result.get("per_chapter", {}):
        pc = result["per_chapter"][chapter]
        for d in pc.get("dumps", []):
            out.append(f"- Párrafo {d['paragraph']}: {d['density_pct']}% ({d['past_perfect_count']} pp) — «{d['preview'][:80]}…»")
    elif chapter is None:
        caps_con_dumps = [(cn, pc) for cn, pc in result.get("per_chapter", {}).items() if pc.get("dumps_found", 0) > 0]
        if caps_con_dumps:
            out.append("**Por capítulo:**")
            for cn, pc in sorted(caps_con_dumps):
                out.append(f"- Cap {cn:02d}: {pc['dumps_found']} dumps")
    return "\n".join(out)


@server.tool(
    name="check_dialogue_quality",
    description="Analiza calidad del diálogo: atribuciones, info-dumps, diferenciación de voz.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional.",
        },
    },
)
def mcp_dialogue_quality(chapter: int | None = None) -> str:
    if not HAS_INSIGHTS:
        return "Error: módulo editorial_insights no disponible."

    chapters = _get_chapters(chapter)
    result = analyze_dialogue_quality(chapters)

    out = ["## Calidad de Diálogo"]
    dg = result.get("global", {})
    out.append(f"**Atribuciones**: {dg.get('total_attributions', 0)} total")
    out.append(f"**«dijo»**: {dg.get('said_pct', 0)}% | **Creativas**: {dg.get('creative_pct', 0)}%")

    top = dg.get("top_verbs", [])
    if top:
        verbs_str = ", ".join(f"{v['verb']} ({v['count']})" for v in top[:5])
        out.append(f"**Top verbos**: {verbs_str}")

    vd = result.get("voice_differentiation", {})
    if vd.get("uniformity_warning"):
        out.append(f"\n⚠ {vd['uniformity_warning']}")

    if chapter is not None and chapter in result.get("per_chapter", {}):
        pc = result["per_chapter"][chapter]
        if pc.get("info_dump_candidates", 0) > 0:
            out.append(f"\n**Info-dumps candidatos ({pc['info_dump_candidates']}):**")
            for ll in pc.get("long_lines", [])[:3]:
                out.append(f"- {ll['words']} pal: «{ll['preview'][:60]}…»")
    return "\n".join(out)


@server.tool(
    name="get_style_diagnostics",
    description="Diagnóstico de estilo: legibilidad, filter words, adverbios, voz pasiva, etc.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional. Sin él, tabla global.",
        },
    },
)
def mcp_style_diagnostics(chapter: int | None = None) -> str:
    if not HAS_INSIGHTS:
        return "Error: módulo editorial_insights no disponible."

    chapters = _get_chapters(chapter)
    result = analyze_style_diagnostics(chapters)
    pc = result.get("per_chapter", {})
    g = result.get("global", {})

    out = ["## Diagnóstico de Estilo\n"]

    if chapter is not None and chapter in pc:
        s = pc[chapter]
        r = s.get("readability", {})
        out.append(f"**Legibilidad**: {r.get('score', '—')} ({r.get('label', '—')})")
        out.append(f"**Voz pasiva**: {s.get('passive_voice', 0)}")
        out.append(f"**Adverbios -mente**: {s.get('adverbs_mente', {}).get('density', 0)}/1k")
        out.append(f"**Filter words**: {s.get('filter_words', {}).get('density', 0)}/1k")
        out.append(f"**Verbos débiles**: {s.get('weak_verbs', {}).get('density', 0)}/1k")
        out.append(f"**Nominalizaciones**: {s.get('nominalizations', {}).get('density', 0)}/1k")
        out.append(f"**Varianza oración**: ±{s.get('sentence_length', {}).get('std', '—')} pal")
    else:
        rows = [
            ["Legibilidad", f"{g.get('readability', {}).get('mean_score', '—')}", "60-70+"],
            ["Voz pasiva", f"{g.get('passive_voice', {}).get('density', 0)}/1k", "< 2/1k"],
            ["Adverbios -mente", f"{g.get('adverbs_mente', {}).get('density', 0)}/1k", "< 3/1k"],
            ["Verbos débiles", f"{g.get('weak_verbs', {}).get('density', 0)}/1k", "< 30/1k"],
            ["Filter words", f"{g.get('filter_words', {}).get('density', 0)}/1k", "< 3/1k"],
            ["Nominalizaciones", f"{g.get('nominalizations', {}).get('density', 0)}/1k", "< 8/1k"],
        ]
        out.append(_fmt_table(["Métrica", "Global", "Referencia"], rows))

        # Peor capítulo por métrica
        if pc:
            worst_fw = max(pc.items(), key=lambda x: x[1]["filter_words"]["density"])
            worst_adv = max(pc.items(), key=lambda x: x[1]["adverbs_mente"]["density"])
            out.append(f"- ⚠ **Más filter words**: cap {worst_fw[0]:02d} ({worst_fw[1]['filter_words']['density']}/1k)")
            out.append(f"- ⚠ **Más adverbios**: cap {worst_adv[0]:02d} ({worst_adv[1]['adverbs_mente']['density']}/1k)")
    return "\n".join(out)


@server.tool(
    name="get_save_the_cat",
    description="Detecta los 15 beats de Save the Cat en el manuscrito.",
    properties={},
)
def mcp_save_the_cat() -> str:
    if not HAS_INSIGHTS:
        return "Error: módulo editorial_insights no disponible."

    chapters = _get_chapters(None)
    result = analyze_save_the_cat(chapters)

    out = ["## Save the Cat — 15 Beats"]
    out.append(f"**Completitud**: {result.get('completion_pct', 0)}% ({result.get('beats_found', 0)}/{result.get('total_beats', 15)})\n")

    if result.get("missing"):
        out.append("**No detectados:**")
        for b in result["missing"]:
            out.append(f"- *{b['beat']}* (esperado ~{b['expected_position_pct']}%)")
        out.append("")

    if result.get("found"):
        out.append("**Detectados:**")
        rows = []
        for b in result["found"]:
            cap = b.get("expected_chapter", "—")
            sig = b.get("signal_strength", "—")
            rows.append([b["beat"], f"cap {cap:02d}", sig])
        out.append(_fmt_table(["Beat", "Capítulo", "Señal"], rows))
    return "\n".join(out)


@server.tool(
    name="get_chekhov_gun",
    description="Rastrea objetos narrativos sembrados vs pagados (Chekhov's Gun).",
    properties={},
)
def mcp_chekhov_gun() -> str:
    if not HAS_INSIGHTS:
        return "Error: módulo editorial_insights no disponible."

    chapters = _get_chapters(None)
    result = analyze_chekhov_gun(chapters)

    out = ["## Chekhov's Gun — Objetos"]
    out.append(f"**Rastreados**: {result.get('objects_tracked', 0)}")
    out.append(f"**Detectados en texto**: {len(result.get('objects_found', []))}")
    nos = result.get("objects_not_found", [])
    out.append(f"**No encontrados**: {', '.join(nos) if nos else 'ninguno'}\n")

    pnp = result.get("planted_not_paid", [])
    if pnp:
        out.append("**Sembrados pero no pagados:**")
        for o in pnp:
            out.append(f"- {o['object']} (caps {o['first_seen']}–{o['last_seen']})")

    up = result.get("unplanted_payoffs", [])
    if up:
        out.append("**Pagados sin siembra:**")
        for o in up:
            out.append(f"- {o['object']} (primera vez cap {o['first_seen']})")

    return "\n".join(out)


@server.tool(
    name="check_pacing",
    description="Analiza variación de longitud de frases para detectar ritmo plano. Sin capítulo, todos.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional. Sin él, todos los capítulos.",
        },
    },
)
def mcp_check_pacing_handler(chapter: int | None = None) -> str:
    if chapter is not None:
        num_str = f"{chapter:02d}"
        data = prose_scanner.export_ritmo(num_str)
        if not data:
            return f"Capítulo {chapter} no encontrado."
        out = [f"## Ritmo — Capítulo {chapter:02d}"]
        out.append(f"**Frases**: {data['total_frases']}  |  **Media**: {data['media']} pal  |  **Desv**: ±{data['desviacion']}")
        out.append(f"**Frases planas**: {data['planos']} ({data['porcentaje_planos']}%)")
        if data["desviacion"] < 3:
            out.append("\n⚠ **Ritmo plano**: la mayoría de frases tienen longitud similar. Alterna frases cortas y largas.")
        elif data["porcentaje_planos"] > 60:
            out.append("\n⚠ **Muchas frases similares**: más del 60% están dentro de ±2 palabras de la media.")
        else:
            out.append("\n✓ **Ritmo variado**.")
        return "\n".join(out)

    all_data = prose_scanner.export_ritmo_all()
    if not all_data:
        return "Sin datos."
    out = ["## Ritmo — Resumen Global", ""]
    headers = ["Cap", "Frases", "Media", "Desv", "% Planas"]
    out.append(f"| {' | '.join(headers)} |")
    out.append(f"| {' | '.join('---' for _ in headers)} |")
    for cn in sorted(all_data, key=int):
        r = all_data[cn]
        if r["total_frases"] == 0:
            continue
        out.append(f"| {cn} | {r['total_frases']} | {r['media']} | {r['desviacion']} | {r['porcentaje_planos']}% |")
    return "\n".join(out)


@server.tool(
    name="check_king",
    description="Análisis Stephen King: adverbios en diálogo, voz pasiva, kill your darlings. Sin capítulo, todos.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional. Sin él, todos los capítulos.",
        },
    },
)
def mcp_check_king(chapter: int | None = None) -> str:
    out = ["## 🔴 Informe Stephen King — On Writing", ""]
    out.append("> *«El camino al infierno está empedrado de adverbios.»*")
    out.append("> *«Segundo borrador = primer borrador − 10%.»*")
    out.append("")
    if chapter is not None:
        num_str = f"{chapter:02d}"
        data = prose_scanner.export_king(num_str)
        if not data:
            return f"Capítulo {chapter} no encontrado."
        ks = data["king_score"]
        adv = data["adverbios_dialogo"]
        pas = data["voz_pasiva"]
        kd = data["kill_darlings"]
        out.append(f"### Capítulo {chapter:02d}")
        out.append(f"**King Score**: {ks}")
        out.append(f"**Adverbios en diálogo**: {adv}")
        out.append(f"**Voz pasiva**: {pas}")
        out.append(f"**Kill your darlings**: {kd['ocurrencias_sobre_target']} ocurrencias sobre target "
                   f"(target: −{kd['target_reduccion_10pct']} palabras)")
        if adv > 0:
            out.append(f"\n🚩 *«El adverbio no es tu amigo.»* {adv} adverbios en atribuciones. Usa contexto y acción.")
        if pas > 3:
            out.append(f"\n🚩 *Voz pasiva:* {pas} construcciones. La activa es más directa.")
        if ks > 15:
            out.append("\n🔴 **PUERTA CERRADA** — Sigue escribiendo. No edites aún.")
        else:
            out.append("\n🟢 **PUERTA ABIERTA** — Buen momento para editar.")
        return "\n".join(out)

    all_data = prose_scanner.export_king_all()
    if not all_data:
        return "Sin datos."
    total_ks = sum(d["king_score"] for d in all_data.values())
    total_adv = sum(d["adverbios_dialogo"] for d in all_data.values())
    total_pas = sum(d["voz_pasiva"] for d in all_data.values())
    out.append("### Resumen global")
    out.append(f"**King Score total**: {total_ks:.1f}")
    out.append(f"**Adverbios en diálogo**: {total_adv}")
    out.append(f"**Voz pasiva**: {total_pas}")
    out.append("")
    headers = ["Cap", "King Score", "Adv.Diál.", "Voz Pas.", "Patrones"]
    out.append(f"| {' | '.join(headers)} |")
    out.append(f"| {' | '.join('---' for _ in headers)} |")
    for cn in sorted(all_data, key=int):
        d = all_data[cn]
        pats = ", ".join(d["patrones_king"][:3]) if d["patrones_king"] else "—"
        out.append(f"| {cn} | {d['king_score']} | {d['adverbios_dialogo']} | {d['voz_pasiva']} | {pats} |")
    return "\n".join(out)


@server.tool(
    name="check_sanderson",
    description="Análisis Brandon Sanderson: magia sin coste, proactividad del POV, escalación. Sin capítulo, todos.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Capítulo opcional. Sin él, todos los capítulos.",
        },
    },
)
def mcp_check_sanderson(chapter: int | None = None) -> str:
    out = ["## 🏗️ Informe Brandon Sanderson — Promesa, Progreso, Pago", ""]
    out.append("> *«Las limitaciones importan más que los poderes.»*")
    out.append("")
    if chapter is not None:
        num_str = f"{chapter:02d}"
        data = prose_scanner.export_sanderson(num_str)
        if not data:
            return f"Capítulo {chapter} no encontrado."
        out.append(f"### Capítulo {chapter:02d} ({data['palabras']} palabras)")
        out.append("")
        out.append(f"**Términos mágicos**: {data['magic_terms']}")
        out.append(f"**Magia sin coste visible**: {data['magic_without_cost']} ({data['pct_with_cost']}% con coste)")
        out.append(f"**Verbos activos**: {data['active_verbs']}  |  **Verbos pasivos**: {data['passive_verbs']}")
        out.append(f"**Ratio proactividad**: {data['proactivity_ratio']} (activo/pasivo)")
        out.append(f"**Marcadores de escalación**: {data['escalation_markers']}")
        if data["magic_without_cost"] > 3:
            out.append(f"\n🚩 Magia sin coste (2ª Ley de Sanderson). Cada poder necesita un límite o coste.")
        if data["proactivity_ratio"] < 0.8:
            out.append(f"\n🚩 POV reactivo. El protagonista debe tomar decisiones, no solo reaccionar.")
        return "\n".join(out)

    all_data = prose_scanner.export_sanderson_all()
    if not all_data:
        return "Sin datos."
    out.append("### Resumen global")
    total_sin_cost = sum(d["magic_without_cost"] for d in all_data.values())
    total_act = sum(d["active_verbs"] for d in all_data.values())
    total_pas = sum(d["passive_verbs"] for d in all_data.values())
    ratio_global = round(total_act / (total_pas + 1), 1)
    out.append(f"**Magia sin coste total**: {total_sin_cost}")
    out.append(f"**Ratio proactividad global**: {ratio_global}")
    out.append("")
    headers = ["Cap", "Magia", "SinCost", "ConCost%", "Activo", "Pasivo", "Ratio", "Escal."]
    out.append(f"| {' | '.join(headers)} |")
    out.append(f"| {' | '.join('---' for _ in headers)} |")
    for cn in sorted(all_data, key=int):
        d = all_data[cn]
        out.append(f"| {cn} | {d['magic_terms']} | {d['magic_without_cost']} | "
                   f"{d['pct_with_cost']}% | {d['active_verbs']} | {d['passive_verbs']} | "
                   f"{d['proactivity_ratio']} | {d['escalation_markers']} |")
    return "\n".join(out)


@server.tool(
    name="check_chapter",
    description="Meta-tool: ejecuta todos los análisis sobre un capítulo y devuelve informe unificado.",
    properties={
        "chapter": {
            "type": "number",
            "description": "Número del capítulo a analizar (requerido)",
        },
    },
    required=["chapter"],
)
def mcp_check_chapter(chapter: int) -> str:
    num_str = f"{chapter:02d}"
    out = [f"# Informe completo — Capítulo {chapter:02d}", ""]

    # 1. Contexto del capítulo
    ctx = get_chapter_context(chapter_number=chapter)
    out.append("## Contexto")
    out.append(ctx)
    out.append("")

    # 2. Scan de prosa
    scan_data = prose_scanner.scan_chapter(num_str)
    if scan_data:
        out.append("## Prosa")
        out.append(_format_scan_chapter(scan_data, include_context=False))
        out.append("")

    # 3. Ritmo
    ritmo = prose_scanner.export_ritmo(num_str)
    if ritmo and ritmo["total_frases"] > 0:
        out.append("## Ritmo")
        if ritmo["desviacion"] < 3:
            flag = "⚠ Ritmo plano"
        elif ritmo["porcentaje_planos"] > 60:
            flag = "⚠ Muchas frases similares"
        else:
            flag = "✓ Variado"
        out.append(f"**Frases**: {ritmo['total_frases']}  |  **Media**: {ritmo['media']} pal  |  **Desv**: ±{ritmo['desviacion']}  |  **{flag}**")
        out.append("")

    # 4. Voz del POV
    chapters = _get_chapters(chapter)
    if chapters:
        ch = chapters[0]
        # Intentar detectar el POV desde metadata
        pov = ""
        meta_match = re.search(r"^POV:\s*(.+)$", ch["text"], re.MULTILINE)
        if meta_match:
            pov = meta_match.group(1).strip()
        else:
            # Intentar detectar POV desde el nombre del archivo o el primer personaje mencionado
            first_char = ""
            available_chars_lower = {c.lower() for c in _get_available_characters()}
            for token in re.findall(r"\b[A-Z][a-záéíóúñ]+(?: [A-Z][a-záéíóúñ]+)?\b", ch["text"][:300]):
                token_lower = token.strip().lower()
                if token_lower in available_chars_lower:
                    first_char = token.strip()
                    break
            if first_char:
                pov = first_char
        if pov:
            try:
                voice = check_voice_consistency(chapter=chapter, character=pov)
                out.append(f"## Voz: {pov}")
                out.append(voice)
                out.append("")
            except Exception:
                pass

    # 5. Hook
    try:
        hook_result = mcp_hooks(chapter)
        if hook_result and "Sin datos" not in hook_result:
            out.append("## Hooks")
            out.append(hook_result)
            out.append("")
    except Exception:
        pass

    # 6. Show / Tell
    try:
        sd_result = mcp_show_dont_tell(chapter)
        if sd_result and "Sin datos" not in sd_result:
            out.append("## Show / Tell")
            out.append(sd_result)
            out.append("")
    except Exception:
        pass

    # 7. Consistencia
    try:
        cons = check_consistency(chapter_number=chapter)
        if cons and "no encontrado" not in cons.lower():
            out.append("## Consistencia")
            out.append(cons)
            out.append("")
    except Exception:
        pass

    # 8. King
    try:
        king_result = mcp_check_king(chapter)
        if king_result and "Sin datos" not in king_result:
            out.append("## Stephen King")
            out.append(king_result)
            out.append("")
    except Exception:
        pass

    # 9. Sanderson
    try:
        sanderson_result = mcp_check_sanderson(chapter)
        if sanderson_result and "Sin datos" not in sanderson_result:
            out.append("## Brandon Sanderson")
            out.append(sanderson_result)
            out.append("")
    except Exception:
        pass

    return "\n".join(out)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        server.run()
    except KeyboardInterrupt:
        sys.exit(0)
    except BrokenPipeError:
        sys.exit(0)
