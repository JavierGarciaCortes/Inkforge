#!/usr/bin/env python3
"""
make.py — ejecutor de tareas del proyecto (equivalente al Makefile).

Funciona igual en Windows, Linux y macOS: usa sys.executable para lanzar
los scripts, así siempre se invoca el mismo intérprete de Python.

Uso:
    python .tools/make.py <tarea> [args...]
    python .tools/make.py help

Ejemplos:
    python .tools/make.py scan --cap 07 --context full
    python .tools/make.py publish --format all --title "Cambio" --author "..."
    python .tools/make.py diagnose --cap 07
    python .tools/make.py ritual
"""

import shutil
import subprocess
import sys
import os
from pathlib import Path
from typing import Callable

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent
PY = sys.executable

TASKS: dict[str, str] = {}
TASKS_FN: dict[str, Callable[[list[str]], int]] = {}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def task(name: str, help_text: str):
    def deco(fn: Callable[[list[str]], int]) -> Callable[[list[str]], int]:
        TASKS[name] = help_text
        TASKS_FN[name] = fn
        return fn
    return deco


def _call(script: str, *args: str) -> int:
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")
    return subprocess.run([PY, str(TOOLS / script), *args], cwd=REPO, env=env).returncode


def _echo(text: str) -> None:
    print("")
    print("=" * 60)
    print(f"  {text}")
    print("=" * 60)
    print("")


@task("scan", "Escanear prosa (global o con --cap XX --context full)")
def _scan(args: list[str]) -> int:
    return _call("prose_scanner.py", *args)


@task("scan-full", "Escanear con contexto completo")
def _scan_full(args: list[str]) -> int:
    return _call("prose_scanner.py", "--context", "full", *args)


@task("scan-review", "Modo interactivo (pregunta por cada hallazgo)")
def _scan_review(args: list[str]) -> int:
    return _call("prose_scanner.py", "--review", *args)


@task("check", "Verificar consistencia global (o con --cap 5-8)")
def _check(args: list[str]) -> int:
    return _call("consistency_check.py", *args)


@task("check-transitions", "Verificar transiciones entre capítulos")
def _check_transitions(args: list[str]) -> int:
    return _call("consistency_check.py", "--cap", "all")


def _publish(extra: list[str], format_: str, title: str | None, author: str | None) -> int:
    cmd: list[str] = []
    if title:
        cmd += ["--title", title]
    if author:
        cmd += ["--author", author]
    return _call("publish.py", *cmd, "--format", format_, *extra)


@task("publish", "Generar EPUB/PDF. Para PDF de lector usa: --format pdf --reader")
def _publish_epub(args: list[str]) -> int:
    return _publish(*_parse_publish(args, default="epub"))


@task("publish-all", "EPUB + HTML + PDF")
def _publish_all(args: list[str]) -> int:
    return _publish(*_parse_publish(args, default="all"))


@task("publish-beta", "HTML con números de línea para beta readers")
def _publish_beta(args: list[str]) -> int:
    extra, format_, title, author = _parse_publish(args, default="beta")
    return _publish(extra + ["--beta"], format_, title, author)


def _parse_publish(args: list[str], default: str) -> tuple[list[str], str, str | None, str | None]:
    format_ = default
    title: str | None = None
    author: str | None = None
    extra: list[str] = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--format" and i + 1 < len(args):
            format_ = args[i + 1]
            i += 2
        elif a == "--title" and i + 1 < len(args):
            title = args[i + 1]
            i += 2
        elif a == "--author" and i + 1 < len(args):
            author = args[i + 1]
            i += 2
        else:
            extra.append(a)
            i += 1
    return extra, format_, title, author


@task("session", "Resumen de cambios desde última sesión")
def _session(args: list[str]) -> int:
    return _call("session_check.py", *args)


@task("session-full", "Resumen + Estado.md + checklist del ritual")
def _session_full(args: list[str]) -> int:
    return _call("session_check.py", "--full", *args)


@task("session-quick", "Solo diff + scores")
def _session_quick(args: list[str]) -> int:
    return _call("session_check.py", "--quick", *args)


@task("letter", "Carta editorial completa")
def _letter(args: list[str]) -> int:
    return _call("editorial_letter.py", *args)


@task("letter-beta", "Informe profesional sintético")
def _letter_beta(args: list[str]) -> int:
    return _call("editorial_letter.py", "--beta", *args)


@task("letter-plan", "Plan de revisión faseado")
def _letter_plan(args: list[str]) -> int:
    return _call("editorial_letter.py", "--plan", *args)


@task("letter-cap", "Carta de un capítulo. Usa: --cap XX")
def _letter_cap(args: list[str]) -> int:
    return _call("editorial_letter.py", *args)


@task("letter-insights", "Análisis avanzado (estilo, diálogo, Save the Cat, ...)")
def _letter_insights(args: list[str]) -> int:
    return _call("editorial_letter.py", "--insights", *args)


@task("diagnose", "Todos los diagnósticos de un capítulo. Usa: --cap XX")
def _diagnose(args: list[str]) -> int:
    rc = 0
    for module in ("style", "dialogue", "scene_summary"):
        rc = _call("editorial_insights.py", "--module", module, *args) or rc
    return rc


@task("style", "Diagnóstico de estilo. Usa: --cap XX")
def _style(args: list[str]) -> int:
    return _call("editorial_insights.py", "--module", "style", *args)


@task("dialogue", "Diagnóstico de diálogo. Usa: --cap XX")
def _dialogue(args: list[str]) -> int:
    return _call("editorial_insights.py", "--module", "dialogue", *args)


@task("sync", "Sincronizar YAML de capítulos desde el manifiesto")
def _sync(args: list[str]) -> int:
    return _call("sync_manifiesto.py", *args)


@task("sync-dry", "Simular sincronización")
def _sync_dry(args: list[str]) -> int:
    return _call("sync_manifiesto.py", "--dry", *args)


@task("sort-lexico", "Ordenar alfabéticamente el léxico")
def _sort_lexico(args: list[str]) -> int:
    return _call("sort_lexico.py", *args)


@task("lint", "Lint de las tools Python (ruff si está instalado)")
def _lint(args: list[str]) -> int:
    if shutil.which("ruff"):
        return subprocess.run(["ruff", "check", str(TOOLS / "*.py"), *args], cwd=REPO).returncode
    print("ruff no instalado. Omite.")
    return 0


@task("ritual", "Ritual de inicio de sesión: session + letter + foreshadowing")
def _ritual(args: list[str]) -> int:
    rc = _call("session_check.py", "--full")
    _echo("Siguiente: cat .fiction/session_log.json")
    _echo("Siguiente: editorial_letter(beta=true)")
    rc = _call("editorial_letter.py", "--beta") or rc
    _echo("Siguiente: get_foreshadowing()")
    print("  -> Consultar vault/Referencias/Foreshadowing.md")
    print("")
    return rc


@task("ready", "Resumen ejecutivo rápido antes de escribir")
def _ready(args: list[str]) -> int:
    _echo("READY - Resumen rápido")
    rc = _call("session_check.py", "--quick")

    _echo("--- .fiction/session_log.json ---")
    log = REPO / ".fiction" / "session_log.json"
    if log.exists():
        print(log.read_text("utf-8"))
    else:
        print("(vacío)")

    _echo("--- vault/Referencias/Pendientes.md (top 3) ---")
    pendientes = REPO / "vault" / "Referencias" / "Pendientes.md"
    if pendientes.exists():
        _print_pendientes(pendientes)
    else:
        print("(sin Pendientes.md)")

    print("")
    print("  Próximo paso recomendado:")
    print("    python .tools/make.py ritual  - chequeo completo")
    print("    python .tools/make.py scan    - escanear prosa global")
    return rc


def _print_pendientes(path: Path) -> None:
    lines = path.read_text("utf-8").split("\n")
    for i, line in enumerate(lines):
        if line.startswith("## Alta"):
            block = lines[i + 1:i + 6]
            print("\n".join(l for l in block if l.strip()))
            break


def print_help() -> None:
    print("Uso: python .tools/make.py <tarea> [args...]")
    print("")
    width = max(len(name) for name in TASKS) + 2
    for name, help_text in sorted(TASKS.items()):
        print(f"  {name:<{width}} {help_text}")
    print("")
    print("Cualquier argumento extra tras el nombre de la tarea se pasa")
    print("directamente al script subyacente (ej. --cap 07 --context full).")


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] in ("help", "-h", "--help"):
        print_help()
        return 0
    name, rest = args[0], args[1:]
    if name not in TASKS_FN:
        print(f"Tarea desconocida: {name}")
        print_help()
        return 2
    return TASKS_FN[name](rest)


if __name__ == "__main__":
    sys.exit(main())
