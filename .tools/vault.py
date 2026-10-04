"""Resolución de obras Inkforge y lectura de capítulos desde sus Markdown."""

import json
import os
import re
import sys
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")


_book_scope: ContextVar[str | None] = ContextVar("inkforge_book_scope", default=None)
_library_path = os.environ.get("INKFORGE_LIBRARY_ROOT")
LIBRARY_ROOT: Path | None = Path(_library_path).resolve() if _library_path else None
GENRES_DIR: Path | None = LIBRARY_ROOT / "Generos" if LIBRARY_ROOT else None


@dataclass(frozen=True)
class ProjectContext:
    root: Path
    type: str
    title: str


@dataclass(frozen=True)
class BookContext:
    project: ProjectContext
    root: Path
    scope: str
    title: str
    number: int | None


@dataclass(frozen=True)
class Chapter:
    path: Path
    number: int
    title: str
    pov: str


def _safe_entry(path: Path, kind: str) -> None:
    if path.is_symlink() or getattr(path, "is_junction", lambda: False)():
        raise ValueError(f"{kind} no puede ser un enlace simbólico.")
    if not path.exists():
        raise FileNotFoundError(f"{kind} no existe: {path}")


def _frontmatter(text: str) -> dict[str, str]:
    lines = text.lstrip("\ufeff").splitlines()
    if not lines or lines[0] != "---":
        raise ValueError("El Markdown no tiene frontmatter válido.")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValueError("El frontmatter Markdown no está cerrado.") from error
    fields: dict[str, str] = {}
    for line in lines[1:end]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            try:
                parsed = json.loads(value)
                value = parsed if isinstance(parsed, str) else value
            except json.JSONDecodeError:
                pass
        fields[key.strip()] = value
    return fields


def _manifest(path: Path) -> dict[str, str]:
    _safe_entry(path, "El manifiesto")
    if not path.is_file():
        raise ValueError(f"El manifiesto no es un archivo: {path}")
    return _frontmatter(path.read_text(encoding="utf-8"))


def _valid_genres(fields: dict[str, str]) -> bool:
    raw = fields.get("generos")
    if raw is None:
        return True  # Los manifiestos anteriores no incluían el campo.
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return False
    if not isinstance(parsed, list):
        return False
    for name in parsed:
        if not isinstance(name, str):
            return False
        clean = name.strip()
        if (not clean or clean.startswith(".") or clean.endswith((".", " "))
                or re.search(r'[<>:"/\\|?*\x00-\x1f]', clean)
                or re.match(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)", clean, re.I)):
            return False
    return True


def resolve_project(root: str | Path | None = None) -> ProjectContext:
    """Lee Proyecto.md en la raíz exacta indicada por VAULT_PATH o el cwd."""
    source = root or os.environ.get("VAULT_PATH") or Path.cwd()
    candidate = Path(source).expanduser()
    _safe_entry(candidate, "La obra")
    if not candidate.is_dir():
        raise ValueError("La raíz de obra no es un directorio.")
    candidate = candidate.resolve(strict=True)
    fields = _manifest(candidate / "Proyecto.md")
    if (fields.get("inkforge") != "1" or fields.get("tipo") not in ("novela", "saga")
            or not _valid_genres(fields)):
        raise ValueError("Proyecto.md no identifica una obra Inkforge válida.")
    title = fields.get("titulo", "").strip()
    if not title:
        raise ValueError("Proyecto.md no contiene un título válido.")
    return ProjectContext(candidate, fields["tipo"], title)


def resolve_book(scope: str | None = None, project: ProjectContext | None = None) -> BookContext:
    """Resuelve un libro de saga exclusivamente desde Libros/<id> explícito."""
    project = project or resolve_project()
    if project.type == "novela":
        if scope not in (None, "", "."):
            raise ValueError("Una novela independiente usa la raíz de la obra como scope de libro.")
        return BookContext(project, project.root, ".", project.title, None)
    if not isinstance(scope, str) or not scope:
        raise ValueError("Falta book_scope: indica Libros/<id> del libro de saga seleccionado.")
    parts = scope.replace("\\", "/").split("/")
    if (len(parts) != 2 or parts[0] != "Libros" or not parts[1]
            or parts[1] in (".", "..") or ":" in parts[1]):
        raise ValueError("book_scope debe ser una ruta relativa Libros/<id> válida.")
    books_dir = project.root / "Libros"
    book_dir = books_dir / parts[1]
    _safe_entry(books_dir, "La carpeta Libros")
    _safe_entry(book_dir, "El libro")
    if not books_dir.is_dir() or not book_dir.is_dir():
        raise ValueError("El scope indicado no es un libro.")
    real_books = books_dir.resolve(strict=True)
    real_book = book_dir.resolve(strict=True)
    if real_books.parent != project.root or real_book.parent != real_books:
        raise ValueError("El scope del libro sale de la obra.")
    fields = _manifest(real_book / "Libro.md")
    raw_number = fields.get("numero", "")
    if (fields.get("inkforge") != "1" or fields.get("tipo") != "libro"
            or not fields.get("titulo", "").strip() or not raw_number.isdecimal()
            or str(int(raw_number)) != raw_number or not 1 <= int(raw_number) <= 99
            or fields.get("hereda_generos", "true") not in ("true", "false")
            or not _valid_genres(fields)):
        raise ValueError("Libro.md no identifica un libro Inkforge válido.")
    return BookContext(project, real_book, f"Libros/{parts[1]}", fields["titulo"].strip(), int(raw_number))


@contextmanager
def scoped_book(scope: str | None):
    """Asocia un scope solo a la llamada actual; nunca lo persiste."""
    resolve_book(scope)
    token = _book_scope.set(scope)
    try:
        yield
    finally:
        _book_scope.reset(token)


def current_book() -> BookContext:
    return resolve_book(_book_scope.get())


def _directory_child(root: Path, name: str) -> Path:
    directory = root / name
    if directory.is_symlink() or getattr(directory, "is_junction", lambda: False)():
        raise ValueError(f"La carpeta {name} no puede ser un enlace simbólico.")
    if directory.exists():
        _safe_entry(directory, f"La carpeta {name}")
        if not directory.is_dir() or directory.resolve(strict=True).parent != root:
            raise ValueError(f"La carpeta {name} sale de su ámbito.")
    return directory


def chapter_dir() -> Path:
    return _directory_child(current_book().root, "Capítulos")


def planning_file(name: str) -> Path:
    if Path(name).name != name or name.startswith(".") or not name.endswith(".md"):
        raise ValueError("Nombre de documento de planificación no válido.")
    return _directory_child(current_book().root, "Planificación") / name


def project_root() -> Path:
    return resolve_project().root


def project_field(name: str) -> str:
    return _manifest(project_root() / "Proyecto.md").get(name, "")


def book_field(name: str) -> str:
    book = current_book()
    manifest = book.root / ("Proyecto.md" if book.scope == "." else "Libro.md")
    return _manifest(manifest).get(name, "")


def world_dirs() -> list[Path]:
    return [_directory_child(project_root(), "Mundo")]


def character_dirs() -> list[Path]:
    return [_directory_child(_directory_child(project_root(), "Mundo"), "Personajes")]


def reference_dirs() -> list[Path]:
    return [_directory_child(project_root(), "Referencias")]


def style_dir() -> Path:
    return _directory_child(project_root(), "Estilo")


def templates_dir() -> Path:
    if LIBRARY_ROOT is None:
        raise RuntimeError("INKFORGE_LIBRARY_ROOT es necesario para las plantillas globales.")
    return LIBRARY_ROOT / "Plantillas"


def _chapter(path: Path) -> Chapter:
    _safe_entry(path, "El capítulo")
    if not path.is_file() or path.suffix.lower() != ".md":
        raise ValueError(f"No es un capítulo Markdown: {path}")
    fields = _frontmatter(path.read_text(encoding="utf-8"))
    raw_number = fields.get("capítulo", "")
    if not raw_number.isdecimal():
        raise ValueError(f"Falta capítulo numérico en {path.name}.")
    number = int(raw_number)
    title = fields.get("título", "").strip()
    if not title:
        title = get_chapter_title(path.read_text(encoding="utf-8"))
    return Chapter(path, number, title, fields.get("pov", fields.get("POV", "")).strip())


def get_chapters() -> list[Chapter]:
    directory = chapter_dir()
    if not directory.exists():
        return []
    _safe_entry(directory, "La carpeta Capítulos")
    if not directory.is_dir() or directory.resolve(strict=True).parent != current_book().root:
        raise ValueError("La carpeta Capítulos no pertenece al libro seleccionado.")
    chapters = [_chapter(path) for path in directory.iterdir()
                if path.suffix.lower() == ".md" and not path.name.startswith(".")]
    numbers = [chapter.number for chapter in chapters]
    if len(numbers) != len(set(numbers)):
        raise ValueError("Hay números de capítulo duplicados en los Markdown.")
    return sorted(chapters, key=lambda chapter: (chapter.number, chapter.path.name))


def get_chapter_files() -> list[Path]:
    return [chapter.path for chapter in get_chapters()]


def get_chapter_number(filename: str | Path) -> int | None:
    if isinstance(filename, Path) and filename.is_file():
        return _chapter(filename).number
    name = Path(filename).name
    return next((chapter.number for chapter in get_chapters() if chapter.path.name == name), None)


def get_chapter_pov(filename: str | Path) -> str:
    if isinstance(filename, Path) and filename.is_file():
        return _chapter(filename).pov
    name = Path(filename).name
    return next((chapter.pov for chapter in get_chapters() if chapter.path.name == name), "")


def get_chapter_field(filepath: Path, field: str) -> str:
    _safe_entry(filepath, "El capítulo")
    return _frontmatter(filepath.read_text(encoding="utf-8")).get(field, "").strip()


YAML_FRONTMATTER_RE = re.compile(r"^\ufeff?---\r?\n.*?\r?\n---\r?\n?", re.DOTALL)
WIKI_LINK_RE = re.compile(r"\[\[([^\]|]+(?:\|[^\]]+)?)\]\]")
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


def strip_yaml(text: str) -> str:
    return YAML_FRONTMATTER_RE.sub("", text, count=1)


def strip_comments(text: str) -> str:
    return COMMENT_RE.sub("", text)


def strip_wikilinks(text: str) -> str:
    return WIKI_LINK_RE.sub(r"\1", text)


def normalize(text: str) -> str:
    return strip_wikilinks(strip_yaml(text)).lower()


def strip_metadata_lines(text: str) -> str:
    return "\n".join(line for line in text.split("\n")
                     if not re.match(r"^\w[\w_]*\s*:\s*.+", line))


def get_chapter_title(text: str) -> str:
    try:
        title = _frontmatter(text).get("título", "").strip()
        if title:
            return title
    except ValueError:
        pass
    heading = re.search(r"^#\s+(.+)", text, re.MULTILINE)
    return heading.group(1).strip() if heading else "(sin título)"


def read_chapter(filepath: Path) -> tuple[int, str, str]:
    number = _chapter(filepath).number
    raw = filepath.read_text(encoding="utf-8")
    return number, raw, normalize(raw)


def chapter_summary(filepath: Path) -> dict:
    number, raw, clean = read_chapter(filepath)
    return {"num": number, "title": get_chapter_title(raw), "file": filepath.name,
            "words": len(raw.split()), "raw": raw, "clean": clean}
