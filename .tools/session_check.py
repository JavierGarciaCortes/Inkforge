#!/usr/bin/env python3
"""Resumen del estado actual de un libro Inkforge, derivado de sus Markdown."""

import argparse
import json

from development_state import get_development_state
from vault import planning_file, scoped_book


LEGACY_PLANNING_DOCUMENTS = ("Estado.md", "Pendientes.md", "Foreshadowing.md")


def snapshot() -> dict:
    data = get_development_state()
    planning = {}
    for name in LEGACY_PLANNING_DOCUMENTS:
        path = planning_file(name)
        planning[name] = path.read_text(encoding="utf-8") if path.is_file() else None
    data["planning"] = planning
    return data


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
        print(f"Solo scaffold inicial: {'sí' if data['blank_scaffold'] else 'no'}")
        print("Planificación gestionada:")
        for name, state in data["planning_documents"].items():
            print(f"  {name}: {state}")
        print(f"Canon de libro: {data['canon_document']['state']}")
        print(f"Notas Markdown: {data['notes']['count']}")
        print("Material compartido Markdown: "
              f"Mundo {data['shared_material']['world']['count']}, "
              f"Estilo {data['shared_material']['style']['count']}, "
              f"Referencias {data['shared_material']['references']['count']}")
        if args.full:
            for name, content in data["planning"].items():
                print(f"{name}: {'presente' if content is not None else 'ausente'}")
                if content is not None:
                    print(content)


if __name__ == "__main__":
    main()
