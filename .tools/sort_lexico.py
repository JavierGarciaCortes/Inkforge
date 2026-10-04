#!/usr/bin/env python3
"""
sort_lexico.py — Ordena alfabéticamente las entradas del léxico.

Lee Planificación/Léxico.md del libro y reordena las filas de cada tabla
(Lugares, Lore, Personajes, Conceptos) por orden alfabético del término.

Uso:
    python .tools/sort_lexico.py          # ordenar y guardar
    python .tools/sort_lexico.py --dry    # simular sin escribir
"""

import argparse
import re
from vault import planning_file, scoped_book


def sort_table_lines(lines: list[str]) -> list[str]:
    """Ordena filas de una tabla markdown, ignorando cabecera y separador."""
    if len(lines) < 3:
        return lines
    header = lines[:1]
    separator = lines[1]
    rows = [l for l in lines[2:] if l.strip() and l.strip().startswith("|")]
    sorted_rows = sorted(rows, key=lambda r: r.strip().lower().lstrip("|").strip())
    return header + [separator] + sorted_rows


def sort_lexico(dry: bool = False) -> int:
    lexicon = planning_file("Léxico.md")
    if not lexicon.exists():
        print(f"❌ No se encontró {lexicon}")
        return 1

    text = lexicon.read_text(encoding="utf-8")
    lines = text.split("\n")

    # Find table sections: a ## header followed by a blank line, then a table
    # We'll scan for headers, then group table lines.
    sections = []  # list of (is_table_block, lines)
    i = 0
    while i < len(lines):
        # Detect start of a table: a |--- line after a blank+header sequence
        # Simpler: group by ## headers, then check each group for tables
        # Actually, let's just find table boundaries directly.
        pass
        i += 1

    # --- Simpler approach: find each table by its separator line ---
    # Find positions of |---|--- lines (table separators)
    table_seps = []
    for i, line in enumerate(lines):
        stripped = re.sub(r"[\s|]", "", line)
        if re.match(r"^\|[-| ]+\|$", line) and stripped and set(stripped) == {"-"}:
            table_seps.append(i)

    if not table_seps:
        print("ℹ️  No se encontraron tablas en el léxico.")
        return 0

    # Each table: header lines before sep, data lines after, until blank or EOF
    modifications = 0
    for sep_idx in table_seps:
        # Find start: go back 2 lines (header row + blank/sep)
        if sep_idx < 2:
            continue
        # header row is at sep_idx - 1
        # the |---|--- separator is at sep_idx
        header_idx = sep_idx - 1
        # Find end: from sep_idx + 1, take lines until empty or new header
        end_idx = sep_idx + 1
        while end_idx < len(lines) and lines[end_idx].strip().startswith("|"):
            end_idx += 1

        table_lines = lines[header_idx:end_idx]
        sorted_table = sort_table_lines(table_lines)

        if sorted_table != table_lines:
            lines[header_idx:end_idx] = sorted_table
            modifications += 1

    new_text = "\n".join(lines)

    if modifications == 0:
        print("✅ El léxico ya está ordenado.")
        return 0

    if dry:
        print(f"🔍 Simulación: {modifications} tabla(s) ordenada(s).")
        print(new_text)
    else:
        lexicon.write_text(new_text, encoding="utf-8")
        print(f"✅ {modifications} tabla(s) ordenada(s) y guardada(s) en {lexicon}.")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Ordena las tablas del léxico alfabéticamente")
    parser.add_argument("--dry", action="store_true", help="Simular sin escribir")
    parser.add_argument("--book-scope", help="Libros/<id> autoritativo; obligatorio en saga")
    args = parser.parse_args()
    with scoped_book(args.book_scope):
        return sort_lexico(dry=args.dry)


if __name__ == "__main__":
    exit(main())
