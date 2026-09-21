#!/usr/bin/env python3
"""
consistency_check.py — Verificador de consistencia fina.

Chequea objetos desde lore, tiempo/clima desde YAML de capítulos.
Lee objetos desde vault/Mundo/Historia/*.md y metadatos YAML.

Uso:
    python .tools/consistency_check.py                   # resumen global
    python .tools/consistency_check.py --cap 5           # detalle de un capítulo
    python .tools/consistency_check.py --cap 5-8         # rango
    python .tools/consistency_check.py --all             # todos los capítulos
    python .tools/consistency_check.py --json            # salida JSON
"""

import argparse
import json
import re
import sys
from pathlib import Path

from vault import (
    CONTENT_ROOT,
    CHAPTERS_DIR,
    WORLD_DIRS,
    get_chapter_files,
    get_chapter_number,
    read_chapter,
    get_chapter_title,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_lore_objects() -> list[dict]:
    """Extrae objetos con alias desde vault/Mundo/Historia/*.md."""
    objects = []
    for d in WORLD_DIRS:
        if not d.is_dir():
            continue
        for hf in sorted(d.glob("*.md")):
            if hf.stem.startswith("_") or hf.stem.startswith("."):
                continue
            text = hf.read_text("utf-8")
            name = hf.stem
            aliases = [name.lower()]
            alias_match = re.search(r">\s*\*\*Alias:\*\*\s*(.+)", text)
            if alias_match:
                aliases = [a.strip().lower() for a in alias_match.group(1).split(",")]
            objects.append({"name": name, "aliases": aliases})
    return objects


def _extract_yaml_field(text: str, field: str) -> str:
    """Extrae un campo del YAML frontmatter."""
    for line in text.split("\n"):
        if line.strip().startswith(f"{field}:"):
            return line.split(":", 1)[1].strip()
    return ""


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_objects(
    raw_text: str, clean_text: str, chapter: int, lore_objects: list[dict],
) -> list[dict]:
    issues = []
    for obj in lore_objects:
        for alias in obj["aliases"]:
            if alias in clean_text:
                issues.append({
                    "type": "object",
                    "severity": "info",
                    "msg": f"Objeto «{obj['name']}» (alias: «{alias}») aparece en el capítulo.",
                    "context": "",
                })
                break
    return issues


def check_yaml_metadata(
    raw_text: str, chapter: int,
) -> list[dict]:
    issues = []
    tiempo = _extract_yaml_field(raw_text, "tiempo")
    clima = _extract_yaml_field(raw_text, "clima")

    if tiempo:
        issues.append({
            "type": "time",
            "severity": "info",
            "msg": f"Tiempo registrado en YAML: «{tiempo}»",
            "context": "",
        })
    else:
        issues.append({
            "type": "time",
            "severity": "warn",
            "msg": "Sin campo 'tiempo' en el YAML del capítulo.",
            "context": "",
        })

    if clima:
        issues.append({
            "type": "weather",
            "severity": "info",
            "msg": f"Clima registrado en YAML: «{clima}»",
            "context": "",
        })
    else:
        issues.append({
            "type": "weather",
            "severity": "warn",
            "msg": "Sin campo 'clima' en el YAML del capítulo.",
            "context": "",
        })

    return issues


def check_transitions(chapter_files: list[Path]) -> list[dict]:
    """Verifica transiciones de tiempo/clima entre capítulos consecutivos."""
    issues = []
    prev_time = ""
    prev_clima = ""
    prev_num = 0

    for cf in sorted(chapter_files, key=lambda f: get_chapter_number(f) or 0):
        num, raw, _ = read_chapter(cf)
        if num is None:
            continue
        curr_time = _extract_yaml_field(raw, "tiempo")
        curr_clima = _extract_yaml_field(raw, "clima")

        if prev_time and curr_time and num == prev_num + 1:
            if prev_time != curr_time:
                issues.append({
                    "type": "time_transition",
                    "severity": "info",
                    "msg": f"Transición temporal cap {prev_num}→{num}: «{prev_time}» → «{curr_time}»",
                    "context": "",
                })

        if prev_clima and curr_clima and num == prev_num + 1:
            if prev_clima != curr_clima:
                issues.append({
                    "type": "weather_transition",
                    "severity": "info",
                    "msg": f"Cambio climático cap {prev_num}→{num}: «{prev_clima}» → «{curr_clima}»",
                    "context": "",
                })

        prev_time = curr_time
        prev_clima = curr_clima
        prev_num = num

    return issues


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

SEVERITY_LABELS = {
    "error": "✗ ERROR",
    "warn": "⚠ WARN",
    "info": "ℹ INFO",
}


def format_issues(issues: list[dict], chapter: int, title: str) -> str:
    if not issues:
        return ""

    lines = [f"--- Capítulo {chapter}: {title} ---"]
    for iss in sorted(issues, key=lambda x: ("error", "warn", "info").index(x["severity"])):
        label = SEVERITY_LABELS.get(iss["severity"], "•")
        lines.append(f"  {label} {iss['msg']}")
        if iss.get("context"):
            lines.append(f"        {iss['context']}")
    lines.append("")
    return "\n".join(lines)


def format_summary(results: list[dict]) -> str:
    if not results:
        return "Sin resultados."

    total_errors = sum(1 for r in results for i in r["issues"] if i["severity"] == "error")
    total_warns = sum(1 for r in results for i in r["issues"] if i["severity"] == "warn")
    total_infos = sum(1 for r in results for i in r["issues"] if i["severity"] == "info")
    total = total_errors + total_warns + total_infos

    lines = [
        "=" * 50,
        "VERIFICACIÓN DE CONSISTENCIA",
        "=" * 50,
        f"Capítulos analizados: {len(results)}",
        f"Total de incidencias: {total}",
        f"  {SEVERITY_LABELS['error']}: {total_errors}",
        f"  {SEVERITY_LABELS['warn']}: {total_warns}",
        f"  {SEVERITY_LABELS['info']}: {total_infos}",
        "",
    ]

    for r in results:
        issues = r["issues"]
        if not issues:
            lines.append(f"✓ Capítulo {r['chapter']}: {r['title']} — sin incidencias")
        else:
            lines.append(format_issues(issues, r["chapter"], r["title"]))

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_chapter_range(arg: str) -> set[int]:
    if arg in ("all", "--all", "*"):
        return {get_chapter_number(f) for f in get_chapter_files()}

    chapters = set()
    for part in arg.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            chapters.update(range(int(a), int(b) + 1))
        else:
            chapters.add(int(part))
    return chapters


def main():
    parser = argparse.ArgumentParser(description="Verificador de consistencia fina.")
    parser.add_argument(
        "--cap", "-c", type=str, default="all",
        help="Capítulo(s): número, rango (5-8), o 'all' (defecto)",
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Salida JSON",
    )
    args = parser.parse_args()

    lore_objects = _get_lore_objects()

    chapters_target = parse_chapter_range(args.cap)
    chapter_files = [
        f for f in get_chapter_files() if get_chapter_number(f) in chapters_target
    ]

    if not chapter_files:
        print(f"No se encontraron capítulos: {args.cap}")
        sys.exit(1)

    results = []
    for cf in chapter_files:
        num, raw, clean = read_chapter(cf)
        title = get_chapter_title(raw)

        issues = []
        issues.extend(check_objects(raw, clean, num, lore_objects))
        issues.extend(check_yaml_metadata(raw, num))

        results.append({
            "chapter": num,
            "title": title,
            "issues": issues,
        })

    # Transiciones entre capítulos (solo en modo global)
    if args.cap == "all":
        all_files = list(get_chapter_files())
        trans_issues = check_transitions(all_files)
        if trans_issues:
            if args.json:
                results.append({
                    "chapter": "transiciones",
                    "title": "Entre capítulos",
                    "issues": trans_issues,
                })
            else:
                print(format_issues(trans_issues, 0, "Transiciones entre capítulos"))

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(format_summary(results))


if __name__ == "__main__":
    main()
