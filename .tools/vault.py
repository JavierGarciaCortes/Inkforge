"""
vault.py — Módulo compartido para todas las tools del proyecto.

Centraliza:
- Vault discovery (ruta raíz, directorios)
- Config desde .fiction/config.json (todas las rutas)
- Text utilities (strip_yaml, strip_comments, strip_wikilinks, normalize)
- Chapter utils (título, número, archivos, lectura)
- Acceso a manifiesto

Uso:
    from vault import VAULT, CHAPTERS_DIR, normalize, get_chapter_files

Todas las rutas se resuelven desde .fiction/config.json con defaults
sensibles, lo que hace al sistema completamente agnóstico del proyecto.
"""

import json
import re
import sys
from pathlib import Path

# Keep CLI and MCP output valid when Windows starts Python with a legacy code page.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")

# ---------------------------------------------------------------------------
# Vault discovery
# ---------------------------------------------------------------------------

def _find_vault() -> Path:
    """Detecta la raíz del proyecto. Orden:
    1. VAULT_PATH env var
    2. tools/ es hijo directo de la raíz
    3. directorio actual
    """
    import os
    env = os.environ.get("VAULT_PATH", "")
    if env:
        return Path(env).resolve()
    script_dir = Path(__file__).resolve().parent
    if script_dir.name == ".tools":
        return script_dir.parent
    return Path.cwd().resolve()


REPO: Path = _find_vault()

# ---------------------------------------------------------------------------
# Config desde .fiction/config.json
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "chapters_dir": "Capítulos",
    "references_dirs": ["Referencias"],
    "characters_dirs": ["Mundo/Personajes"],
    "world_dirs": ["Mundo"],
    "style_dir": "Estilo",
    "manifest_file": "Capítulos/manifiesto.json",
    "foreshadowing_file": "Referencias/Foreshadowing.md",
    "estado_file": "Referencias/Estado.md",
    "pendientes_file": "Referencias/Pendientes.md",
    "templates_dir": "Plantillas",
    "output_dir": "output",
}

CONFIG_FILE = REPO / ".fiction" / "config.json"


def load_config() -> dict:
    """Lee .fiction/config.json y lo combina con defaults."""
    config = dict(DEFAULT_CONFIG)
    if CONFIG_FILE.exists():
        try:
            overrides = json.loads(CONFIG_FILE.read_text("utf-8"))
            # Solo tomar keys planas (no metadata)
            for k, v in overrides.items():
                if k in DEFAULT_CONFIG or not k.startswith("_"):
                    config[k] = v
        except (json.JSONDecodeError, OSError):
            pass
    return config


CONFIG = load_config()

# ---------------------------------------------------------------------------
# Content root: si existe vault/ → usarlo como base de contenido
# ---------------------------------------------------------------------------

_VAULT_SUB = REPO / "vault"
CONTENT_ROOT: Path = _VAULT_SUB if _VAULT_SUB.is_dir() else REPO

# Alias para compatibilidad
VAULT = CONTENT_ROOT

# ---------------------------------------------------------------------------
# Paths resolved from config
# ---------------------------------------------------------------------------

def _resolve_content(key: str) -> Path:
    """Resuelve rutas de contenido contra CONTENT_ROOT."""
    return (CONTENT_ROOT / str(CONFIG[key])).resolve()

def _resolve_repo(key: str) -> Path:
    """Resuelve rutas de infraestructura contra REPO."""
    return (REPO / str(CONFIG[key])).resolve()

def _resolve_content_list(key: str) -> list[Path]:
    raw = CONFIG.get(key, [])
    if isinstance(raw, str):
        raw = [raw]
    return [(CONTENT_ROOT / d).resolve() for d in raw if d]


CHAPTERS_DIR = _resolve_content("chapters_dir")
REFERENCES_DIRS = _resolve_content_list("references_dirs")
CHARACTERS_DIRS = _resolve_content_list("characters_dirs")
WORLD_DIRS = _resolve_content_list("world_dirs")
STYLE_DIR = _resolve_content("style_dir")
MANIFEST_FILE = _resolve_content("manifest_file")
FORESHADOWING_FILE = _resolve_content("foreshadowing_file")
ESTADO_FILE = _resolve_content("estado_file")
PENDIENTES_FILE = _resolve_content("pendientes_file")
TEMPLATES_DIR = _resolve_content("templates_dir")
OUTPUT_DIR = _resolve_repo("output_dir")

# ---------------------------------------------------------------------------
# Manifiesto access
# ---------------------------------------------------------------------------

def _import_manifiesto():
    if "manifiesto" in sys.modules:
        m = sys.modules["manifiesto"]
        return getattr(m, "manifiesto", m)
    tools_dir = str(REPO / ".tools")
    if tools_dir not in sys.path:
        sys.path.insert(0, tools_dir)
    import manifiesto as _manifiesto_mod
    return _manifiesto_mod.manifiesto


def get_manifiesto():
    return _import_manifiesto()

# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

YAML_FRONTMATTER_RE = re.compile(r"^---.*?---\s*", re.DOTALL)
WIKI_LINK_RE = re.compile(r"\[\[([^\]|]+(?:\|[^\]]+)?)\]\]")


def strip_yaml(text: str) -> str:
    return YAML_FRONTMATTER_RE.sub("", text, count=1)


COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


def strip_comments(text: str) -> str:
    return COMMENT_RE.sub("", text)


def strip_wikilinks(text: str) -> str:
    return WIKI_LINK_RE.sub(r"\1", text)


def normalize(text: str) -> str:
    text = strip_yaml(text)
    text = strip_wikilinks(text)
    return text.lower()


def strip_metadata_lines(text: str) -> str:
    lines = text.split("\n")
    result = []
    for line in lines:
        if re.match(r"^\w[\w_]*\s*:\s*.+", line):
            continue
        result.append(line)
    return "\n".join(result)

# ---------------------------------------------------------------------------
# Chapter utilities
# ---------------------------------------------------------------------------

def get_chapter_number(filename: str | Path) -> int | None:
    fname = Path(filename).name if isinstance(filename, Path) else filename
    try:
        m = get_manifiesto()
        n = m.get_numero(fname)
        if n is not None:
            return n
    except Exception:
        pass
    m = re.match(r"(\d+)", fname)
    return int(m.group(1)) if m else None


def get_chapter_title(text: str) -> str:
    m = re.search(r"^título:\s*(.+)$", text, re.MULTILINE)
    if m:
        return m.group(1).strip().strip("\"'")
    m = re.search(r"^#\s+(.+)", text, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return "(sin título)"


def get_chapter_files() -> list[Path]:
    try:
        m = get_manifiesto()
        return m.archivos_existentes()
    except Exception:
        return sorted(CHAPTERS_DIR.glob("*.md"))


def read_chapter(filepath: Path) -> tuple[int, str, str]:
    num = get_chapter_number(filepath.name)
    raw = filepath.read_text("utf-8")
    clean = normalize(raw)
    return num, raw, clean


def chapter_summary(filepath: Path) -> dict:
    num, raw, clean = read_chapter(filepath)
    title = get_chapter_title(raw)
    words = len(raw.split())
    return {
        "num": num,
        "title": title,
        "file": filepath.name,
        "words": words,
        "raw": raw,
        "clean": clean,
    }
