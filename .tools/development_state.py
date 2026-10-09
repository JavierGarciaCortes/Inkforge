"""Estado objetivo del desarrollo de una obra, derivado de sus Markdown."""

import os
from pathlib import Path

from vault import (
    current_book,
    get_chapters,
    planning_file,
    project_root,
    reference_dirs,
    style_dir,
    world_dirs,
)


PLANNING_DOCUMENTS = (
    ("Cronología.md", "# Cronología"),
    ("Escaleta.md", "# Escaleta"),
    ("Estado.md", "# Estado"),
    ("Foreshadowing.md", "# Foreshadowing"),
    ("Fundamentos.md", "# Fundamentos"),
    ("Guía editorial.md", "# Guía editorial"),
    ("Índice.md", "# Índice"),
    ("Léxico.md", "# Léxico"),
    ("Outliner.md", "# Outliner"),
    ("Pendientes.md", "# Pendientes"),
    ("Trama.md", "# Trama"),
)
CANON_DOCUMENT = ("Canon de libro.md", "# Canon de libro")
PATH_PREVIEW_LIMIT = 20


def _is_link(path: Path) -> bool:
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def _safe_child_directory(root: Path, name: str) -> Path:
    directory = root / name
    if not directory.exists():
        return directory
    if _is_link(directory):
        raise ValueError(f"La carpeta {name} no puede ser un enlace simbólico.")
    if not directory.is_dir() or directory.resolve(strict=True).parent != root:
        raise ValueError(f"La carpeta {name} sale de su ámbito.")
    return directory


def _document_state(path: Path, expected_heading: str) -> str:
    if not path.exists():
        return "missing"
    if _is_link(path):
        raise ValueError(f"Documento no seguro: {path}")
    if not path.is_file() or path.resolve(strict=True).parent != path.parent.resolve(strict=True):
        raise ValueError(f"El documento sale de su ámbito: {path}")
    text = path.read_text(encoding="utf-8")
    normalized = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n").rstrip()
    return "template" if normalized == expected_heading else "content"


def _markdown_files(directory: Path, allowed_root: Path) -> list[Path]:
    if not directory.exists():
        return []
    if _is_link(directory):
        raise ValueError(f"Directorio no seguro: {directory}")
    if not directory.is_dir():
        raise ValueError(f"El área de contenido no es una carpeta: {directory}")

    root = directory.resolve(strict=True)
    scope = allowed_root.resolve(strict=True)
    if not root.is_relative_to(scope):
        raise ValueError(f"El área de contenido sale de su ámbito: {directory}")

    result: list[Path] = []
    for current, dirs, files in os.walk(directory, followlinks=False):
        parent = Path(current)
        safe_dirs = []
        for name in sorted(dirs):
            candidate = parent / name
            if (_is_link(candidate) or not candidate.is_dir()
                    or not candidate.resolve(strict=True).is_relative_to(root)):
                continue
            safe_dirs.append(name)
        dirs[:] = safe_dirs
        for name in sorted(files):
            path = parent / name
            if (path.suffix.lower() != ".md" or _is_link(path)
                    or not path.is_file()
                    or not path.resolve(strict=True).is_relative_to(root)):
                continue
            result.append(path)
    return result


def _inventory(directories: list[Path], allowed_root: Path) -> dict:
    relative_paths = sorted({
        path.relative_to(allowed_root).as_posix()
        for directory in directories
        for path in _markdown_files(directory, allowed_root)
    })
    preview = relative_paths[:PATH_PREVIEW_LIMIT]
    return {
        "count": len(relative_paths),
        "paths": preview,
        "additional_count": len(relative_paths) - len(preview),
    }


def get_development_state() -> dict:
    """Obtiene una instantánea objetiva del libro y la obra actuales."""
    book = current_book()
    root = project_root()
    chapters = get_chapters()

    planning_documents = {
        name: _document_state(planning_file(name), heading)
        for name, heading in PLANNING_DOCUMENTS
    }

    canon_directory = _safe_child_directory(book.root, "Canon")
    canon_name, canon_heading = CANON_DOCUMENT
    canon_document = {
        "path": (canon_directory / canon_name).relative_to(root).as_posix(),
        "state": _document_state(canon_directory / canon_name, canon_heading),
    }

    notes = _inventory([_safe_child_directory(book.root, "Notas")], root)
    shared_material = {
        "world": _inventory(world_dirs(), root),
        "style": _inventory([style_dir()], root),
        "references": _inventory(reference_dirs(), root),
    }
    chapter_items = [
        {
            "number": chapter.number,
            "title": chapter.title,
            "pov": chapter.pov,
            "file": chapter.path.name,
            "path": chapter.path.relative_to(root).as_posix(),
        }
        for chapter in chapters
    ]

    has_inventory = notes["count"] > 0 or any(
        inventory["count"] > 0 for inventory in shared_material.values()
    )
    blank_scaffold = (
        not chapter_items
        and not has_inventory
        and all(state != "content" for state in planning_documents.values())
        and canon_document["state"] != "content"
    )

    return {
        "project": book.project.title,
        "project_type": book.project.type,
        "book": book.title,
        "book_number": book.number,
        "book_scope": book.scope,
        "chapter_count": len(chapter_items),
        "chapters": chapter_items,
        "planning_documents": planning_documents,
        "canon_document": canon_document,
        "notes": notes,
        "shared_material": shared_material,
        "blank_scaffold": blank_scaffold,
    }
