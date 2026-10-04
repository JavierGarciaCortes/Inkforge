#!/usr/bin/env python3
"""Resumen del estado actual de un libro Inkforge, derivado de sus Markdown."""

import argparse
import json

from vault import current_book, get_chapters, planning_file, scoped_book


def snapshot() -> dict:
    book = current_book()
    chapters = get_chapters()
    planning = {}
    for name in ("Estado.md", "Pendientes.md", "Foreshadowing.md"):
        path = planning_file(name)
        planning[name] = path.read_text(encoding="utf-8") if path.is_file() else None
    return {
        "project": book.project.title,
        "project_type": book.project.type,
        "book": book.title,
        "book_scope": book.scope,
        "chapters": [{"number": chapter.number, "title": chapter.title,
                      "pov": chapter.pov, "file": chapter.path.name}
                     for chapter in chapters],
        "planning": planning,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Estado actual derivado de los Markdown del libro")
    parser.add_argument("--book-scope", help="Libros/<id> autoritativo; obligatorio en saga")
    parser.add_argument("--json", action="store_true", help="Salida JSON")
    parser.add_argument("--full", action="store_true", help="Mostrar textos de planificación")
    parser.add_argument("--quick", action="store_true", help="Resumen breve")
    args = parser.parse_args()
    with scoped_book(args.book_scope):
        data = snapshot()
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return
    print(f"{data['project']} — {data['book']} ({data['book_scope']})")
    print(f"Capítulos: {len(data['chapters'])}")
    for chapter in data["chapters"]:
        print(f"  {chapter['number']}: {chapter['title']} [{chapter['pov'] or 'POV sin declarar'}]")
    if not args.quick:
        for name, content in data["planning"].items():
            print(f"{name}: {'presente' if content is not None else 'ausente'}")
            if args.full and content is not None:
                print(content)


if __name__ == "__main__":
    main()
