#!/usr/bin/env python3
"""
new_chapter.py — Crea un nuevo capítulo y lo registra en el manifiesto.

Uso:
    python tools/new_chapter.py "El bosque"          # Añade al final
    python tools/new_chapter.py "El bosque" -p 5    # Inserta en posición 5
    python tools/new_chapter.py --list                # Lista capítulos
"""

import argparse
import sys
from pathlib import Path

from vault import VAULT, CHAPTERS_DIR, TEMPLATES_DIR, get_manifiesto

TEMPLATE = TEMPLATES_DIR / "capitulo.md"


def slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def list_chapters():
    print("Capítulos en el manifiesto:\n")
    for i, c in enumerate(get_manifiesto().orden):
        fp = CHAPTERS_DIR / c["archivo"]
        words = len(fp.read_text("utf-8").split()) if fp.exists() else 0
        print(f"  {i:>2}. {c['archivo']} ({words} palabras) [POV: {c.get('pov', '-')}]")


def main():
    ap = argparse.ArgumentParser(description="Crea un nuevo capítulo.")
    ap.add_argument("title", nargs="?", default=None, help="Título del capítulo")
    ap.add_argument("--list", "-l", action="store_true", help="Listar capítulos")
    ap.add_argument("--pos", "-p", type=int, default=0,
                    help="Posición de inserción (0=final, 1=después del prólogo, etc.)")
    ap.add_argument("--pov", type=str, default="", help="POV del capítulo")
    args = ap.parse_args()

    if args.list:
        list_chapters()
        sys.exit(0)

    if not args.title:
        ap.print_help()
        sys.exit(1)

    if not CHAPTERS_DIR.exists():
        CHAPTERS_DIR.mkdir(parents=True)

    title = args.title.strip()
    file_slug = slugify(title)
    filename = f"{file_slug}.md"

    # Calcular posición
    total = get_manifiesto().total_capitulos()
    if args.pos > 0 and args.pos <= total:
        insert_pos = args.pos
    else:
        insert_pos = total  # al final (0-based index para insertar DESPUÉS del último)

    # Número para el YAML
    new_num = insert_pos  # 0-based: prólogo=0

    filepath = CHAPTERS_DIR / filename
    if filepath.exists():
        print(f"⚠ Ya existe: {filename}")
        sys.exit(1)

    # Crear archivo desde plantilla
    if TEMPLATE.exists():
        template_text = TEMPLATE.read_text("utf-8")
        chapter_text = (
            template_text
            .replace("capítulo: X", f"capítulo: {new_num}")
            .replace("título: Título del capítulo", f"título: {title}")
            .replace("# Capítulo X: Título del capítulo", f"# Capítulo {new_num}: {title}")
        )
    else:
        chapter_text = (
            f"---\ncapítulo: {new_num}\ntítulo: {title}\n---\n\n"
            f"# Capítulo {new_num}: {title}\n"
        )

    filepath.write_text(chapter_text, encoding="utf-8")
    print(f"✅ Creado: {filename}")

    # Registrar en el manifiesto
    # insert_pos es 0-based y es DONDE insertar. Queremos que el nuevo capítulo
    # tenga número new_num (= insert_pos). Los capítulos existentes desde insert_pos
    # en adelante se desplazan.
    if args.pos > 0:
        # Insertar en posición específica (1-based → 0-based)
        get_manifiesto().insertar(args.pos, filename, args.pov)
        print(f"📋 Insertado en posición {args.pos} del manifiesto")
    else:
        # Añadir al final
        get_manifiesto().insertar(total + 1, filename, args.pov)
        print(f"📋 Añadido al final del manifiesto (posición {total + 1})")

    # Sincronizar YAML de todos los capítulos afectados
    print("🔄 Sincronizando YAML...")
    import sync_manifiesto
    sync_manifiesto.sync(dry=False)


if __name__ == "__main__":
    main()
