#!/usr/bin/env python3
"""Crea capítulos en el libro indicado; el orden reside en su frontmatter."""

import argparse
import json
import re
from pathlib import Path

from vault import chapter_dir, get_chapters, scoped_book, templates_dir


def _numbered(text: str, number: int) -> str:
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].lstrip("\ufeff").strip() != "---":
        raise ValueError("El capítulo no tiene frontmatter válido.")
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            break
        if re.match(r"^capítulo:\s*\d+\s*$", lines[index].strip()):
            ending = "\r\n" if lines[index].endswith("\r\n") else "\n"
            lines[index] = f"capítulo: {number}{ending}"
            return "".join(lines)
    raise ValueError("Falta capítulo numérico en el frontmatter.")


def _new_text(title: str, number: int, pov: str) -> str:
    yaml_title = json.dumps(title, ensure_ascii=False)
    template = templates_dir() / "capitulo.md"
    if template.is_file():
        text = template.read_text(encoding="utf-8")
        text = text.replace("capítulo: X", f"capítulo: {number}")
        text = text.replace("título: Título del capítulo", f"título: {yaml_title}")
        text = text.replace("# Capítulo X: Título del capítulo", f"# Capítulo {number}: {title}")
    else:
        text = f"---\ncapítulo: {number}\ntítulo: {yaml_title}\n---\n\n# Capítulo {number}: {title}\n"
    if pov:
        text = text.replace(f"título: {yaml_title}",
                            f"título: {yaml_title}\npov: {json.dumps(pov, ensure_ascii=False)}", 1)
    return text


def create_chapter(title: str, position: int = 0, pov: str = "") -> Path:
    if not title.strip() or any(character in title for character in "\r\n"):
        raise ValueError("El título del capítulo no es válido.")
    if any(character in pov for character in "\r\n"):
        raise ValueError("El POV del capítulo no es válido.")
    chapters = get_chapters()
    if position < 0:
        raise ValueError("La posición no puede ser negativa.")
    number = position if position else (chapters[-1].number + 1 if chapters else 1)
    if position and chapters and position > chapters[-1].number + 1:
        raise ValueError("La posición deja un hueco en el orden de capítulos.")
    directory = chapter_dir()
    directory.mkdir(exist_ok=True)
    slug = re.sub(r"[^\w-]+", "-", title.strip().lower()).strip("-")
    if not slug:
        raise ValueError("El título no produce un nombre de archivo válido.")
    target = directory / f"{slug}.md"
    if target.exists():
        raise FileExistsError(f"Ya existe: {target.name}")
    revisions: list[tuple[Path, bytes, bytes]] = []
    for chapter in chapters:
        if chapter.number < number:
            continue
        original = chapter.path.read_bytes()
        updated = _numbered(original.decode("utf-8"), chapter.number + 1).encode("utf-8")
        revisions.append((chapter.path, original, updated))
    content = _new_text(title.strip(), number, pov.strip())
    created = False
    changed: list[tuple[Path, bytes, bytes]] = []
    try:
        with target.open("x", encoding="utf-8", newline="") as stream:
            stream.write(content)
        created = True
        for path, original, updated in reversed(revisions):
            if path.read_bytes() != original:
                raise RuntimeError(f"El capítulo cambió externamente: {path.name}")
            path.write_bytes(updated)
            changed.append((path, original, updated))
    except BaseException:
        for path, original, updated in reversed(changed):
            if path.read_bytes() == updated:
                path.write_bytes(original)
        if created and target.is_file() and target.read_text(encoding="utf-8") == content:
            target.unlink()
        raise
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea un capítulo Markdown en la obra Inkforge activa.")
    parser.add_argument("title", nargs="?", help="Título del capítulo")
    parser.add_argument("--book-scope", help="Libros/<id> autoritativo; obligatorio para saga")
    parser.add_argument("--list", "-l", action="store_true", help="Listar capítulos")
    parser.add_argument("--pos", "-p", type=int, default=0, help="Número donde insertar; 0 añade al final")
    parser.add_argument("--pov", default="", help="POV del capítulo")
    args = parser.parse_args()
    with scoped_book(args.book_scope):
        if args.list:
            for chapter in get_chapters():
                words = len(chapter.path.read_text(encoding="utf-8").split())
                print(f"{chapter.number:>2}. {chapter.path.name} ({words} palabras) [POV: {chapter.pov or '-'}]")
            return
        if not args.title:
            parser.error("Indica el título del capítulo.")
        path = create_chapter(args.title, args.pos, args.pov)
        print(f"Capítulo creado: {path}")


if __name__ == "__main__":
    main()
