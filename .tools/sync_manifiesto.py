#!/usr/bin/env python3
"""
sync_manifiesto.py — Sincroniza YAML de capítulos desde el manifiesto.

Lee Capítulos/manifiesto.json y actualiza el campo 'capítulo:' en el
frontmatter YAML de cada archivo de capítulo para que coincida con
su posición en el orden narrativo.

Uso:
    python tools/sync_manifiesto.py          # sincronizar todo
    python tools/sync_manifiesto.py --dry    # simular sin escribir
"""

import argparse
import re
from pathlib import Path

from vault import VAULT, CHAPTERS_DIR

MANIFIESTO_PATH = CHAPTERS_DIR / "manifiesto.json"


def sync(dry: bool = False):
    if not MANIFIESTO_PATH.exists():
        print("❌ No se encontró Capítulos/manifiesto.json")
        return

    import json
    data = json.loads(MANIFIESTO_PATH.read_text(encoding="utf-8"))
    orden = data.get("orden", [])

    updated = 0
    for i, entry in enumerate(orden):
        filename = entry["archivo"]
        cap_num = i  # 0-based: prólogo=0, cap 1=1, etc.
        fp = CHAPTERS_DIR / filename

        if not fp.exists():
            print(f"  ⚠️  {filename} — archivo no encontrado, saltando")
            continue

        text = fp.read_text(encoding="utf-8")

        # Actualizar campo capítulo en YAML frontmatter
        new_text = re.sub(
            r"^capítulo:\s*\d+",
            f"capítulo: {cap_num}",
            text,
            count=1,
            flags=re.MULTILINE,
        )

        if new_text != text:
            if not dry:
                fp.write_text(new_text, encoding="utf-8")
            print(f"  ✅ {filename} — capítulo {cap_num}")
            updated += 1
        else:
            print(f"  ·  {filename} — ya correcto (cap {cap_num})")

    print(f"\n{updated} archivos actualizados" + (" (dry-run)" if dry else ""))


def main():
    parser = argparse.ArgumentParser(description="Sincroniza YAML de capítulos desde el manifiesto")
    parser.add_argument("--dry", action="store_true", help="Simular sin escribir")
    args = parser.parse_args()
    sync(dry=args.dry)


if __name__ == "__main__":
    main()
