#!/usr/bin/env python3
"""
editorial_letter.py — Generador de carta editorial automatizada.

Analiza estructura, prosa, voces, ritmo y foreshadowing del manuscrito
completo y produce un informe editorial con prioridades.

Uso:
    python tools/editorial_letter.py               # carta completa (markdown)
    python tools/editorial_letter.py --json         # salida JSON
    python tools/editorial_letter.py --cap 05       # capítulo específico
    python tools/editorial_letter.py --resumen      # solo tabla de prioridades
"""

import argparse
import json
import re
import sys
from collections import defaultdict, Counter
from pathlib import Path

# Importar insights avanzados (opcional — fallback silencioso con placeholders)
HAS_INSIGHTS = False
_insights_module = None

def _insights_unavailable(*args, **kwargs):
    raise ImportError("Módulo editorial_insights no disponible. Verifica que el archivo existe.")

analyze_style_diagnostics = _insights_unavailable
analyze_dialogue_quality = _insights_unavailable
analyze_save_the_cat = _insights_unavailable
analyze_chekhov_gun = _insights_unavailable
analyze_first_pages = _insights_unavailable
analyze_backstory_dumps = _insights_unavailable
analyze_scene_summary_ratio = _insights_unavailable
classify_story_arc = _insights_unavailable
analyze_revision_hotspots = _insights_unavailable
analyze_advanced_all = _insights_unavailable

try:
    from tools import editorial_insights as _insights_module
    analyze_style_diagnostics = _insights_module.analyze_style_diagnostics
    analyze_dialogue_quality = _insights_module.analyze_dialogue_quality
    analyze_save_the_cat = _insights_module.analyze_save_the_cat
    analyze_chekhov_gun = _insights_module.analyze_chekhov_gun
    analyze_first_pages = _insights_module.analyze_first_pages
    analyze_backstory_dumps = _insights_module.analyze_backstory_dumps
    analyze_scene_summary_ratio = _insights_module.analyze_scene_summary_ratio
    classify_story_arc = _insights_module.classify_story_arc
    analyze_revision_hotspots = _insights_module.analyze_revision_hotspots
    analyze_advanced_all = _insights_module.analyze_all
    HAS_INSIGHTS = True
except ImportError:
    pass

from vault import (
    VAULT, CHAPTERS_DIR, CHARACTERS_DIRS, FORESHADOWING_FILE,
    CONFIG_FILE, get_chapter_files,
    get_chapter_number, strip_yaml, strip_wikilinks,
)

PERSONAJES_DIR = CHARACTERS_DIRS[0] if CHARACTERS_DIRS else VAULT / "Mundo" / "Personajes"

# ── Capítulos y acts (desde config, con auto-generación por defecto) ──

def _load_acts_config() -> tuple[dict, dict, dict, int]:
    """Carga ACTS, ACT_LABELS, POV_MAP y midpoint_chapter desde .fiction/config.json.
    Si no están definidos, genera 3 actos equilibrados desde el manifiesto.
    """
    midpoint = 0
    default_pov = "?"
    try:
        from vault import load_config
        cfg = load_config()
        acts_raw = cfg.get("acts")
        labels_raw = cfg.get("act_labels", {})
        pov_map_raw = cfg.get("pov_map", {})
        midpoint = cfg.get("midpoint_chapter", 0)
        default_pov = cfg.get("default_pov", "?")

        if acts_raw:
            acts = {int(k): v for k, v in acts_raw.items()}
            labels = {int(k): v for k, v in labels_raw.items()}
            pov_map = {int(k): v for k, v in pov_map_raw.items()}
            return acts, labels, pov_map, midpoint, default_pov
    except Exception:
        pass

    # Auto-generar 3 actos balanceados desde el manifiesto
    try:
        from vault import get_manifiesto
        m = get_manifiesto()
        total = m.total_capitulos()
        if total > 0:
            third = max(1, total // 3)
            acts = {
                1: list(range(0, third)),
                2: list(range(third, 2 * third)),
                3: list(range(2 * third, total)),
            }
            labels = {1: "Setup", 2: "Confrontación", 3: "Resolución"}
            return acts, labels, {}, midpoint, default_pov
    except Exception:
        pass

    return {1: [1], 2: [2], 3: [3]}, {1: "Setup", 2: "Confrontación", 3: "Resolución"}, {}, midpoint, default_pov


ACTS, ACT_LABELS, POV_MAP, MIDPOINT_CHAPTER, DEFAULT_POV = _load_acts_config()


def _get_project_title() -> str:
    """Lee el título del proyecto desde .fiction/config.json."""
    try:
        from vault import load_config
        return load_config().get("title", "Sin título")
    except Exception:
        return "Sin título"


def strip_dialogue(text: str) -> str:
    """Elimina líneas de diálogo (todo entre rayas de diálogo)."""
    return re.sub(r"—[^—\n]*?(?:\n|$)", "", text)


def read_chapter(filepath: Path) -> dict:
    num = get_chapter_number(filepath)
    raw = filepath.read_text("utf-8")
    clean = strip_yaml(raw)
    title_match = re.search(r"#\s*Capítulo\s+\d+[:\s]*(.+)", raw)
    title = title_match.group(1).strip() if title_match else ""
    words = len(clean.split())
    return {
        "num": num,
        "file": filepath.name,
        "title": title,
        "raw": raw,
        "text": clean,
        "words": words,
    }


# ── Análisis estructural ────────────────────────────────────

def analyze_structure(chapters: list[dict]) -> dict:
    total_words = sum(c["words"] for c in chapters)
    words_per_chapter = [c["words"] for c in chapters]
    mean = sum(words_per_chapter) / len(words_per_chapter)
    variance = sum((w - mean) ** 2 for w in words_per_chapter) / len(words_per_chapter)
    std_dev = variance ** 0.5

    act_stats = {}
    for act_num, cap_nums in ACTS.items():
        act_chapters = [c for c in chapters if c["num"] in cap_nums]
        act_words = sum(c["words"] for c in act_chapters)
        act_stats[act_num] = {
            "label": ACT_LABELS[act_num],
            "chapters": cap_nums,
            "words": act_words,
            "pct": round(act_words / total_words * 100, 1),
            "count": len(act_chapters),
        }

    # POV distribution
    pov_counts = Counter()
    for c in chapters:
        pov = POV_MAP.get(c["num"], DEFAULT_POV)
        pov_counts[pov] += 1

    max_chapter = max(chapters, key=lambda c: c["words"])
    min_chapter = min(chapters, key=lambda c: c["words"])
    return {
        "total_words": total_words,
        "total_chapters": len(chapters),
        "mean_words": round(mean, 0),
        "std_dev_words": round(std_dev, 0),
        "min_chapter": {"num": min_chapter["num"], "words": min_chapter["words"]},
        "max_chapter": {"num": max_chapter["num"], "words": max_chapter["words"]},
        "acts": act_stats,
        "pov": dict(pov_counts),
        "midpoint_chapter": MIDPOINT_CHAPTER,
        "midpoint_words": next((c["words"] for c in chapters if c["num"] == MIDPOINT_CHAPTER), 0),
    }


# ── Análisis de prosa ───────────────────────────────────────

def analyze_prose(chapters: list[dict]) -> dict:
    results = {}

    for c in chapters:
        text = c["text"]
        issues = {}

        # "como si" count
        como_si = len(re.findall(r"\bcomo\s+si\b", text, re.IGNORECASE))
        density_como_si = round((como_si / c["words"]) * 1000, 2) if c["words"] else 0

        # "como si" clusters within 150 words
        como_si_positions = [m.start() for m in re.finditer(r"\bcomo\s+si\b", text, re.IGNORECASE)]
        word_positions = []
        for pos in como_si_positions:
            word_pos = len(text[:pos].split())
            word_positions.append(word_pos)
        clusters = 0
        if len(word_positions) >= 3:
            i = 0
            while i < len(word_positions):
                end = word_positions[i] + 150
                group = [j for j in range(i, len(word_positions)) if word_positions[j] <= end]
                if len(group) >= 3:
                    clusters += 1
                    i = group[-1] + 1
                else:
                    i += 1

        # "había" + participle
        habia = len(re.findall(r"\bhab[íi][ao]\s+\w+do\b", text, re.IGNORECASE))
        density_habia = round((habia / c["words"]) * 1000, 2) if c["words"] else 0

        # Incisos narrativos con raya (em-dash in narrative, not dialogue)
        # We approximate: count em-dashes outside dialogue lines
        narrative_only = strip_dialogue(text)
        em_dashes = len(re.findall(r"—", narrative_only))
        density_em = round((em_dashes / c["words"]) * 1000, 2) if c["words"] else 0

        # Chapter ending classification
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        last_para = paragraphs[-1] if paragraphs else ""
        ending_type = _classify_ending(last_para, text)

        issues["como_si"] = {
            "count": como_si,
            "density": density_como_si,
            "clusters": clusters,
        }
        issues["habia_participio"] = {
            "count": habia,
            "density": density_habia,
        }
        issues["incisos_raya_narrativa"] = {
            "count": em_dashes,
            "density": density_em,
        }
        issues["ending"] = ending_type

        results[c["num"]] = issues

    # Global stats
    total_como_si = sum(r["como_si"]["count"] for r in results.values())
    total_habia = sum(r["habia_participio"]["count"] for r in results.values())
    total_em = sum(r["incisos_raya_narrativa"]["count"] for r in results.values())
    total_words = sum(c["words"] for c in chapters)

    endings = Counter(r["ending"]["type"] for r in results.values())

    return {
        "per_chapter": results,
        "global": {
            "como_si": {
                "total": total_como_si,
                "density": round((total_como_si / total_words) * 1000, 2) if total_words else 0,
            },
            "habia_participio": {
                "total": total_habia,
                "density": round((total_habia / total_words) * 1000, 2) if total_words else 0,
            },
            "incisos_raya_narrativa": {
                "total": total_em,
                "density": round((total_em / total_words) * 1000, 2) if total_words else 0,
            },
            "chapter_endings": dict(endings),
        },
    }


ENDING_PATTERNS = [
    ("sensorial", r"(olor|sonido|frío|calor|luz|oscuro|silenci|temblor|latir|brillar|vibración|aire)"),
    ("accion", r"^(.*?)(salió|caminó|corrió|miró|siguió|entró|saltó|cerró|abrió|se.*ó|fue|volvió)"),
    ("dialogo", r"^—"),
    ("reflexion", r"(pensó|sintió|supo|entendió|recordó|pregunta|certeza)"),
]


def _classify_ending(last_para: str, full_text: str) -> dict:
    if not last_para:
        return {"type": "unknown", "last_line": ""}

    last_lines = last_para.split("\n")
    last_line = last_lines[-1].strip() if last_lines else ""

    # Check if last line is dialogue
    if last_line.startswith("—") or last_line.startswith("»"):
        # Get the actual dialogue text for context
        return {"type": "dialogo", "last_line": last_line[:80]}

    # Check if last paragraph ends with action (verb in past tense)
    action_verbs = [
        r"\b(salió|entró|corrió|caminó|miró|siguió|saltó|cerró|abrió|desapareció|cayó|volvió|"
        r"empezó|terminó|apretó|levantó|puso|arrancó|partió|extendió)\b"
    ]

    # Check for sensory words in closing
    for pattern, keywords in [
        ("sensorial", r"(lat[ií]a|brillaba|temblaba|oscuridad|silenc|frío|calor|luz|sonid|olor)"),
        ("reflexion", r"(pensó|supo|sintió|recordó|entendió|certeza)"),
    ]:
        if re.search(keywords, last_line, re.IGNORECASE):
            return {"type": pattern, "last_line": last_line[:80]}

    # Default
    return {"type": "narrativo", "last_line": last_line[:80]}


# ── Análisis de voces (data-driven, con defaults genéricos) ──

def _load_character_names() -> dict[str, str]:
    """Detecta personajes desde archivos en characters_dirs y voz_profiles.
    Genera un dict {nombre: regex_para_buscar}."""
    names = {}
    # 1. Desde archivos de personaje en characters_dirs
    for cd in CHARACTERS_DIRS:
        if cd and cd.exists():
            for f in sorted(cd.glob("*.md")):
                name = f.stem.replace("-", " ").replace("_", " ")
                # Capitalizar para nombres propios
                name_parts = name.split()
                name = " ".join(p.capitalize() for p in name_parts)
                if len(name) > 1 and name not in names:
                    # Generar regex: nombre completo + posible primer nombre
                    first = name_parts[0].capitalize()
                    escaped = re.escape(name)
                    if len(name_parts) > 1:
                        names[name] = rf"\b({re.escape(first)}|{escaped})\b"
                    else:
                        names[name] = rf"\b{escaped}\b"
    # 2. Desde las fichas de personaje
    for d in CHARACTERS_DIRS:
        if d.is_dir():
            for f in d.glob("*.md"):
                char_name = f.stem
                if char_name and not char_name.startswith("_") and char_name not in names:
                    first = char_name.split()[0]
                    escaped = re.escape(char_name)
                    if " " in char_name:
                        names[char_name] = rf"\b({re.escape(first)}|{escaped})\b"
                    else:
                        names[char_name] = rf"\b{escaped}\b"
    # 3. Fallback: nombres hardcoded mínimos para funcionalidad básica
    if not names:
        names = {"Protagonista": r"\b(ella|él|protagonista)\b"}
    return names


def _load_dialogue_markers() -> dict[str, dict]:
    """Marcadores de diálogo por tipo para análisis de voz."""
    return {
        "questions": r"\b¿[^¿]*\?",
        "conditionals": r"\b(si\s+|quizá|tal\s+vez|a\s+lo\s+mejor)\b",
        "imperatives": r"\b(cállate|vamos|dame|mira|escucha|ven|no\s+\w+|siéntate|levántate|termina|suelta|deja)\b",
        "short_lines": r"^—\w{1,20}",
        "evasions": r"\b(no\s+lo\s+sé|quizá|puede\s+que|tal\s+vez|depende|es\s+complicado)\b",
        "pauses": r"\.\.\.",
    }


CHARACTER_NAMES = _load_character_names()
CHARACTER_DIALOGUE_MARKERS = _load_dialogue_markers()


def analyze_voice(chapters: list[dict]) -> dict:
    """Analyze dialogue patterns per character across chapters."""
    per_character = defaultdict(lambda: {
        "appearances": [],
        "total_lines": 0,
        "questions": 0,
        "imperatives": 0,
        "short_lines": 0,
        "avg_words": 0,
        "word_counts": [],
    })

    for c in chapters:
        text = c["text"]
        for char_name, pattern in CHARACTER_NAMES.items():
            if re.search(pattern, text, re.IGNORECASE):
                per_character[char_name]["appearances"].append(c["num"])

        # Extract dialogue lines and analyze
        dialogue_lines = re.findall(r"^—([^—\n]*)", text, re.MULTILINE)
        for line in dialogue_lines:
            line = line.strip()
            if not line:
                continue
            words = len(line.split())

            # Attributing dialogue to characters is complex.
            # Instead, we analyze dialogue patterns per chapter.
            pass

    # Analyze per-chapter dialogue patterns
    chapter_voice = {}
    for c in chapters:
        text = c["text"]
        dialogue_lines = re.findall(r"^—([^—\n]*)", text, re.MULTILINE)
        dialogue_lines = [l.strip() for l in dialogue_lines if l.strip()]

        if not dialogue_lines:
            continue

        total = len(dialogue_lines)
        questions = sum(1 for l in dialogue_lines if "?" in l)
        imperatives_sera = sum(
            1 for l in dialogue_lines
            if re.search(r"\b(cállate|vamos|dame|mira|escucha|ven|termina|suelta|deja|no\s+|siéntate)\b", l, re.IGNORECASE)
        )
        conditionals_lena = sum(
            1 for l in dialogue_lines
            if re.search(r"\b(si\s+|quizá|tal\s+vez)\b", l, re.IGNORECASE)
        )
        short_lines = sum(1 for l in dialogue_lines if len(l.split()) <= 5)
        avg_words = round(sum(len(l.split()) for l in dialogue_lines) / total, 1)

        chapter_voice[c["num"]] = {
            "total_lines": total,
            "questions": questions,
            "pct_questions": round(questions / total * 100, 1) if total else 0,
            "imperatives": imperatives_sera,
            "conditionals": conditionals_lena,
            "short_lines": short_lines,
            "pct_short": round(short_lines / total * 100, 1) if total else 0,
            "avg_words": avg_words,
        }

    return {
        "per_chapter": chapter_voice,
        "character_appearances": {k: v["appearances"] for k, v in per_character.items()},
    }


# ── Análisis de foreshadowing ────────────────────────────────

THREAD_STATUS_RE = re.compile(r"\*\*Status\*\*\s*\|\s*(.*?)(?:\n|$)")


def analyze_foreshadowing() -> dict:
    if not FORESHADOWING_FILE.exists():
        return {"error": "Foreshadowing.md no encontrado"}

    text = FORESHADOWING_FILE.read_text("utf-8")

    # Parse thread sections (## numbered + ### under Hilos abiertos)
    thread_pattern = re.compile(
        r"(?:##|###)\s+(\d+)\.\s+(.+?)\n.*?"
        r"\*\*Status\*\*\s*\|\s*(🔴|🟢|🟡)\s*(.*?)(?=\n(?:##|###)\s+\d+|\Z)",
        re.DOTALL,
    )

    threads = []
    for match in thread_pattern.finditer(text):
        num = int(match.group(1))
        name = match.group(2).strip()
        status_emoji = match.group(3)
        status_extra = match.group(4).strip() if match.group(4) else ""

        thread = {
            "num": num,
            "name": name,
            "status": "open" if "🔴" in status_emoji else "closed",
        }
        threads.append(thread)

    closed = sum(1 for t in threads if t["status"] == "closed")
    open_threads = [t for t in threads if t["status"] == "open"]

    return {
        "total": len(threads),
        "closed": closed,
        "pct_closed": round(closed / len(threads) * 100, 0) if threads else 0,
        "open": open_threads,
        "threads": threads,
    }


# ── Análisis de ritmo ───────────────────────────────────────

def analyze_pacing(chapters: list[dict]) -> dict:
    """Analyze word count distribution and structural balance."""
    words = [(c["num"], c["words"]) for c in sorted(chapters, key=lambda x: x["num"])]

    # Variance analysis
    word_list = [c["words"] for c in chapters]
    mean = sum(word_list) / len(word_list)
    std_dev = (sum((w - mean) ** 2 for w in word_list) / len(word_list)) ** 0.5

    # Identify outliers (chapters more than 1 std_dev from mean)
    outliers = [
        {"chapter": c["num"], "words": c["words"], "direction": "long" if c["words"] > mean + std_dev else "short"}
        for c in chapters
        if abs(c["words"] - mean) > std_dev
    ]

    # Act balance
    act_words = {}
    for act_num, cap_nums in ACTS.items():
        act_chapters = [c for c in chapters if c["num"] in cap_nums]
        act_words[act_num] = {
            "total": sum(c["words"] for c in act_chapters),
            "label": ACT_LABELS[act_num],
            "caps": [c["num"] for c in act_chapters],
        }

    return {
        "mean": round(mean, 0),
        "std_dev": round(std_dev, 0),
        "outliers": outliers,
        "act_words": act_words,
        "chapters": [{"num": n, "words": w} for n, w in words],
    }


# ── Análisis de función de escena ─────────────────────────────

SCENE_SEPARATOR = re.compile(r"\n\s*-[\s-]{2,}-\s*\n")  # --- or - - - between scenes


def analyze_scene_function(chapters: list[dict]) -> dict:
    """Clasifica cada escena por tipo y detecta si cumple funciones narrativas."""
    results = {}
    total_scenes = 0
    weak_scenes = []  # scenes that advance nothing

    for c in chapters:
        text = c["text"]
        scenes = [s.strip() for s in SCENE_SEPARATOR.split(text) if s.strip()]
        chapter_scenes = []

        for si, scene in enumerate(scenes):
            total_scenes += 1
            scene_lower = scene.lower()

            # Classify type
            has_dialogue = bool(re.search(r"^—", scene, re.MULTILINE))
            has_action = bool(re.search(
                r"\b(corrió|caminó|saltó|entró|salió|golpeó|levantó|apretó|arrancó|partió|"
                r"cayó|empujó|tiró|abrió|cerró|subió|bajó|disparó|lanzó|esquivó)\b",
                scene_lower,
            ))
            has_reflection = bool(re.search(
                r"\b(pensó|recordó|supo|sintió|entendió|reflexionó|se preguntó|imaginó)\b",
                scene_lower,
            ))
            has_description = len(scene.split()) > 30 and not has_dialogue and not has_action

            # Determine primary type
            if has_dialogue and has_action:
                scene_type = "acción+diálogo"
            elif has_dialogue:
                scene_type = "diálogo"
            elif has_action:
                scene_type = "acción"
            elif has_reflection:
                scene_type = "reflexión"
            else:
                scene_type = "descripción"

            # Detect functions
            advances_plot = bool(re.search(
                r"\b(descubrió|reveló|decidió|confrontó|escapó|traicionó|entregó|"
                r"robó|mató|destruyó|salvó|traicionó|mintió|confesó|negoció|"
                r"cambió|abandonó|unió|separó|anunció|declaró|ordenó)\b",
                scene_lower,
            ))
            deepens_character = bool(re.search(
                r"\b(recordó|pensó|sintió|supo|entendió|temió|dudó|quiso|necesitó|"
                r"ansió|tembló|lloró|sonrió|tragó|apretó)\b",
                scene_lower,
            ))
            builds_tension = bool(re.search(
                r"\b(peligro|amenaza|miedo|oscuridad|sombra|corrió|gritó|alarma|"
                r"temblor|estalló|rompió|golpe|herida|sangre|muerte)\b",
                scene_lower,
            ))

            functions = []
            if advances_plot:
                functions.append("trama")
            if deepens_character:
                functions.append("personaje")
            if builds_tension:
                functions.append("tensión")

            scene_info = {
                "index": si,
                "type": scene_type,
                "words": len(scene.split()),
                "functions": functions,
                "function_count": len(functions),
            }
            chapter_scenes.append(scene_info)

            if not functions:
                weak_scenes.append({
                    "chapter": c["num"],
                    "scene": si,
                    "type": scene_type,
                    "words": len(scene.split()),
                    "preview": scene[:100],
                })

        results[c["num"]] = {
            "scene_count": len(scenes),
            "scenes": chapter_scenes,
            "weak_scenes": [s for s in chapter_scenes if not s["functions"]],
        }

    return {
        "per_chapter": results,
        "total_scenes": total_scenes,
        "weak_scenes": weak_scenes,
        "weak_count": len(weak_scenes),
    }


# ── Análisis de línea temporal emocional ─────────────────────

HIGH_INTENSITY = {
    "muerte": 3, "morir": 3, "sangre": 3, "grito": 3, "gritó": 3,
    "abismo": 3, "vacío": 2, "oscuridad": 2, "sombra": 2, "temblor": 2,
    "tembló": 2, "herida": 2, "dolor": 2, "ardía": 2, "quemó": 2,
    "estalló": 3, "rompió": 2, "cayó": 2, "golpe": 2, "miedo": 2,
    "pánico": 3, "desesperación": 3, "rabia": 2, "odio": 2,
    "lloró": 2, "lágrimas": 2, "grieta": 2, "columna": 2,
}

LOW_INTENSITY = {
    "silencio": -1, "quieto": -1, "tranquilo": -1, "paz": -1,
    "calma": -1, "esperó": -1, "descanso": -1, "suave": -1,
    "lento": -1, "dormir": -1, "susurro": -1,
}


def analyze_emotional_timeline(chapters: list[dict]) -> dict:
    """Mide intensidad emocional por párrafo y detecta secciones planas o sobresaturadas."""
    results = {}

    for c in chapters:
        text = c["text"]
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()
                      and not p.startswith("#") and not p.startswith("---")]

        para_scores = []
        for pi, para in enumerate(paragraphs):
            words = para.split()
            if not words:
                continue
            score = 0
            for w in words:
                w_clean = re.sub(r"[^a-zA-Záéíóúñ]", "", w).lower()
                if w_clean in HIGH_INTENSITY:
                    score += HIGH_INTENSITY[w_clean]
                if w_clean in LOW_INTENSITY:
                    score += LOW_INTENSITY[w_clean]
            # Normalize by paragraph length
            score_per_word = score / len(words) * 100 if words else 0
            para_scores.append({
                "index": pi,
                "score": round(score_per_word, 2),
                "words": len(words),
                "preview": para[:80],
            })

        if not para_scores:
            continue

        # Detect flat sections (3+ consecutive paragraphs with score < 0.5)
        flat_count = 0
        max_flat_streak = 0
        current_flat = 0
        saturated = 0
        for ps in para_scores:
            if ps["score"] < 0.5:
                current_flat += 1
                max_flat_streak = max(max_flat_streak, current_flat)
                if ps["score"] == 0:
                    flat_count += 1
            else:
                current_flat = 0
            if ps["score"] > 5.0:
                saturated += 1

        # Peak tension point
        peak = max(para_scores, key=lambda x: x["score"]) if para_scores else None
        valley = min(para_scores, key=lambda x: x["score"]) if para_scores else None

        results[c["num"]] = {
            "paragraphs_analyzed": len(para_scores),
            "mean_intensity": round(sum(p["score"] for p in para_scores) / len(para_scores), 2),
            "peak": peak,
            "valley": valley,
            "flat_paragraphs": flat_count,
            "max_flat_streak": max_flat_streak,
            "saturated_paragraphs": saturated,
            "scores": para_scores,
        }

    return results


# ── Análisis de ganchos (hooks) ──────────────────────────────

def analyze_hooks(chapters: list[dict]) -> dict:
    """Evalúa apertura (primer párrafo) y cierre de cada capítulo como hooks."""
    results = {}

    for c in chapters:
        text = c["text"]
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()
                      and not p.startswith("#") and not p.startswith("---")]

        if not paragraphs:
            continue

        first = paragraphs[0]
        last = paragraphs[-1]

        # ── Opening analysis ──
        opening_type = "descripción"
        if first.startswith("—") or first.startswith("«"):
            opening_type = "diálogo"
        elif re.search(r"\b(corrió|caminó|saltó|entró|salió|golpeó|tembló|cayó|estalló|"
                       r"partió|abrió|gritó|despertó|volvió)\b", first[:100], re.IGNORECASE):
            opening_type = "acción"
        elif re.search(r"\b(pensó|recordó|supo|sintió|se preguntó)\b", first[:200], re.IGNORECASE):
            opening_type = "reflexión"

        # Words until first conflict hook
        conflict_markers = [
            r"\b(pero|sin embargo|no|nunca|jamás|muerte|peligro|abismo|miedo|oscuridad|"
            r"herida|dolor|perdió|quedó|atrapada)\b"
        ]
        first_conflict = None
        for marker in conflict_markers:
            m = re.search(marker, first, re.IGNORECASE)
            if m:
                pos = m.start()
                words_before = len(first[:pos].split())
                first_conflict = words_before
                break

        # ── Closing hook analysis ──
        closing_type = _classify_ending(last, text)["type"]

        # Is it a strong hook?
        hook_strength = "bajo"
        if closing_type == "sensorial":
            hook_strength = "alto"  # sensory endings usually work well
        elif closing_type == "dialogo":
            hook_strength = "medio" if "?" in last else "bajo"
        elif closing_type == "reflexion":
            hook_strength = "alto"

        # Check for explicit cliffhanger/anticipation markers
        anticipation = bool(re.search(
            r"\b(todavía|aún|esperaba|sin\s+saber|sin\s+responder|pronto|algún\s+día|"
            r"no\s+terminó|seguía|continuaba|quedaba|faltaba)\b",
            last, re.IGNORECASE,
        ))

        results[c["num"]] = {
            "opening": {
                "type": opening_type,
                "words_to_first_conflict": first_conflict,
                "preview": first[:120],
            },
            "closing": {
                "type": closing_type,
                "hook_strength": hook_strength,
                "anticipation": anticipation,
                "last_line": last[:120],
            },
        }

    return results


# ── Análisis de promesa → progreso → pago ────────────────────

def analyze_promise_payoff(chapters: list[dict]) -> dict:
    """Mide distancia entre siembras y pagos en foreshadowing, y busca puntos de contacto intermedios."""
    if not FORESHADOWING_FILE.exists():
        return {"error": "Foreshadowing.md no encontrado"}

    text = FORESHADOWING_FILE.read_text("utf-8")

    # Parse thread sections with plant/payoff info
    thread_pattern = re.compile(
        r"(?:##|###)\s+(\d+)\.\s+(.+?)\n(.*?)(?=\n(?:##|###)\s+\d+|\Z)",
        re.DOTALL,
    )

    threads = []
    for match in thread_pattern.finditer(text):
        num = int(match.group(1))
        name = match.group(2).strip()
        body = match.group(3)

        # Extract plant and payoff chapter numbers
        plants = [int(m) for m in re.findall(r"\*\*Plant\*\*.*?Cap\s+(\d+)", body, re.IGNORECASE)]
        payoffs = [int(m) for m in re.findall(r"\*\*Payoff\*\*.*?Cap\s+(\d+)", body, re.IGNORECASE)]

        if not plants and not payoffs:
            continue

        # Calculate distance (max payoff - min plant)
        all_chapters = plants + payoffs
        min_ch = min(all_chapters)
        max_ch = max(all_chapters)
        distance = max_ch - min_ch

        # Find intermediate mentions in the actual text
        thread_keywords = [w.lower() for w in re.sub(r"[^\w\s]", " ", name).split() if len(w) > 3]
        intermediate = 0
        total_mentions = 0
        for c in chapters:
            if min_ch < c["num"] < max_ch:
                text_lower = c["text"].lower()
                for kw in thread_keywords:
                    if kw in text_lower:
                        intermediate += 1
                        break
            if min_ch <= c["num"] <= max_ch:
                text_lower = c["text"].lower()
                for kw in thread_keywords:
                    if kw in text_lower:
                        total_mentions += 1
                        break

        thread_info = {
            "num": num,
            "name": name,
            "plant_chapters": plants,
            "payoff_chapters": payoffs,
            "chapter_distance": distance,
            "intermediate_touchpoints": intermediate,
            "total_mentions": total_mentions,
            "has_gap": distance > 5 and intermediate == 0,
        }
        threads.append(thread_info)

    cold_threads = [t for t in threads if t["has_gap"]]

    return {
        "threads": threads,
        "total_threads": len(threads),
        "cold_threads": cold_threads,
        "cold_count": len(cold_threads),
    }


# ── Análisis avanzado de atribución de diálogo ───────────────

def _build_attribution_patterns() -> dict[str, str]:
    """Genera patrones de atribución de diálogo desde CHARACTER_NAMES."""
    patterns = {}
    for name, name_regex in CHARACTER_NAMES.items():
        first_name = name.split()[0]
        verbs = r"(dijo|preguntó|respondió|susurró|gritó|alcanzó a decir)"
        patterns[name] = rf"{verbs}\s+({re.escape(first_name)}|{name})"
    return patterns


CHARACTER_DIALOGUE_ATTRIBUTION = _build_attribution_patterns()


def analyze_dialogue_attribution(chapters: list[dict]) -> dict:
    """Analiza consistencia de voz por personaje a lo largo del libro."""
    per_char = defaultdict(lambda: {
        "chapters": [],
        "total_lines": 0,
        "total_attributed": 0,
        "avg_words": [],
        "questions": 0,
        "imperatives": 0,
        "short_lines": 0,
    })

    char_names_list = list(CHARACTER_NAMES.keys())

    for c in chapters:
        text = c["text"]
        for char_name, attr_pattern in CHARACTER_DIALOGUE_ATTRIBUTION.items():
            matches = re.findall(attr_pattern, text, re.IGNORECASE)
            if matches:
                per_char[char_name]["chapters"].append(c["num"])
                per_char[char_name]["total_attributed"] += len(matches)

    # Build per-character voice profile across the whole book
    voice_profile = {}
    for char_name in char_names_list:
        info = per_char[char_name]
        voice_profile[char_name] = {
            "appears_in_chapters": sorted(info["chapters"]),
            "total_attributed_lines": info["total_attributed"],
        }

    return {
        "per_character": voice_profile,
    }


# ── Análisis de "show don't tell" ────────────────────────────

EMOTION_WORDS = {
    "triste": "tristeza", "tristeza": "tristeza", "deprimente": "tristeza",
    "enfadada": "ira", "enfadado": "ira", "furiosa": "ira", "furioso": "ira",
    "rabia": "ira", "ira": "ira",
    "asustada": "miedo", "asustado": "miedo", "aterrada": "miedo", "aterrado": "miedo",
    "miedo": "miedo", "temía": "miedo", "temió": "miedo",
    "feliz": "alegría", "alegre": "alegría",
    "contenta": "alegría", "contento": "alegría",
    "orgullosa": "orgullo", "orgulloso": "orgullo",
    "avergonzada": "vergüenza", "avergonzado": "vergüenza", "vergüenza": "vergüenza",
    "culpa": "culpa", "culpable": "culpa",
    "esperanza": "esperanza", "esperanzada": "esperanza",
    "cansada": "cansancio", "cansado": "cansancio",
    "sola": "soledad", "solo": "soledad", "soledad": "soledad",
    "confundida": "confusión", "confundido": "confusión", "confusión": "confusión",
}

PHYSICAL_ANCHORS = {
    "temblor": ["tembló", "temblor", "temblando", "temblar"],
    "llanto": ["lloró", "lágrimas", "llanto", "llorando"],
    "sonrisa": ["sonrió", "sonrisa", "sonriendo"],
    "tensión": ["apretó", "tensó", "puños", "mandíbula", "nudillos"],
    "respiración": ["respiró", "aliento", "respiración", "suspiro"],
    "mirada": ["miró", "ojos", "mirada", "parpadeó"],
    "voz": ["voz", "tartamudeó", "susurró", "gritó"],
    "gesto": ["cabeza", "hombros", "manos", "dedos", "brazos"],
}


def analyze_show_dont_tell(chapters: list[dict]) -> dict:
    """Detecta emociones nombradas sin anclaje físico cercano."""
    results = {}

    for c in chapters:
        text = c["text"]
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()
                      and not p.startswith("#") and not p.startswith("---")]

        tells = []
        for pi, para in enumerate(paragraphs):
            para_lower = para.lower()
            for emotion_word, category in EMOTION_WORDS.items():
                if emotion_word in para_lower and emotion_word not in ("miedo", "rabia", "ira", "culpa"):
                    # Check if emotion is in narrative (not dialogue)
                    if not para.startswith("—") and not para.startswith("»"):
                        # Check for physical anchor nearby
                        anchored = False
                        for anchor_cat, anchor_words in PHYSICAL_ANCHORS.items():
                            if any(aw in para_lower for aw in anchor_words):
                                anchored = True
                                break
                        if not anchored:
                            tells.append({
                                "paragraph": pi,
                                "emotion": emotion_word,
                                "category": category,
                                "context": para[:150],
                            })

        results[c["num"]] = {
            "total_tells": len(tells),
            "tells": tells,
        }

    total_tells = sum(r["total_tells"] for r in results.values())
    return {
        "per_chapter": results,
        "total_tells": total_tells,
    }


# ── Análisis de inmersión sensorial ──────────────────────────

SENSORY_KEYWORDS = {
    "vista": [
        r"\b(vio|miró|observó|veía|notó|visión|ojos|brillo|luz|color|oscuro|"
        r"claridad|niebla|sombra|resplandor)|[Pp]or un instante\b",
    ],
    "oído": [
        r"\b(oyó|escuchó|sonido|rumor|silencio|voz|melodía|canción|ruido|"
        r"murmullo|susurro|grito|eco|sonó|oír|oídos)\b",
    ],
    "tacto": [
        r"\b(sintió|tocó|tacto|piel|frío|calor|temblor|roce|"
        r"presión|peso|superficie|áspero|suave|húmedo|seco|dolor|ardor)\b",
    ],
    "olfato": [
        r"\b(olor|olía|hedor|aroma|perfume|fragancia|a\s+olía|apesta|"
        r"olía\s+a|huele)\b",
    ],
    "gusto": [
        r"\b(sabor|gusto|amargo|dulce|sabía\s+a|metal|sangre\s+en\s+la\s+boca|"
        r"Ácido|salado|ceniza\s+en\s+la\s+lengua)\b",
    ],
}


def analyze_sensory_immersion(chapters: list[dict]) -> dict:
    """Cuenta cuántos sentidos se usan por capítulo."""
    results = {}

    for c in chapters:
        text = c["text"]
        senses_found = set()
        sense_counts = {}

        for sense, patterns in SENSORY_KEYWORDS.items():
            total = 0
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                total += len(matches)
            if total > 0:
                senses_found.add(sense)
                sense_counts[sense] = total

        results[c["num"]] = {
            "senses_count": len(senses_found),
            "senses": list(senses_found),
            "sense_details": sense_counts,
            "immersion_score": round(len(senses_found) / 5 * 100, 0),
        }

    return results


# ── Plan de revisión faseado ─────────────────────────────────

REVISION_PHASES = [
    {
        "phase": 1,
        "name": "Cimientos estructurales",
        "weeks": "1-2",
        "focus": ["Argumento general", "Estructura de actos", "Tiempo del inciting incident",
                   "Midpoint", "Clímax", "Arcos de personaje principales"],
    },
    {
        "phase": 2,
        "name": "Personajes y diálogo",
        "weeks": "3-4",
        "focus": ["Consistencia de voz", "Profundidad de secundarios",
                   "Atribución de diálogo", "Motivación de antagonista", "Química entre personajes"],
    },
    {
        "phase": 3,
        "name": "Ritmo y prosa",
        "weeks": "5-6",
        "focus": ["Transiciones entre escenas", "Variedad de tensión",
                   "Show vs tell", "Inmersión sensorial", "Muletillas y patrones"],
    },
    {
        "phase": 4,
        "name": "Pulido final",
        "weeks": "7-8",
        "focus": ["Consistencia de objetos/tiempo/clima", "Ganchos de capítulo",
                   "Cierres", "Continuidad", "Foreshadowing pendiente"],
    },
]


def generate_revision_plan(priorities: list[dict]) -> str:
    """Genera un plan de revisión faseado a partir de las prioridades."""
    lines = []
    lines.append("# Plan de Revisión")
    lines.append("")

    for phase in REVISION_PHASES:
        lines.append(f"## Fase {phase['phase']}: {phase['name']} ({phase['weeks']} semanas)")
        lines.append("")
        lines.append("**Enfoque:** " + ", ".join(phase["focus"]))
        lines.append("")

        # Match priorities to this phase
        phase_priorities = _match_priorities_to_phase(priorities, phase["phase"])

        if phase_priorities:
            lines.append("**Tareas de esta fase:**")
            lines.append("")
            for p in phase_priorities:
                icon = {"alta": "🔴", "media": "🟡", "baja": "🟢", "info": "ℹ"}.get(p["severity"], "•")
                lines.append(f"- {icon} **{p['severity'].upper()}**: {p['issue']}")
                lines.append(f"  *{p['detail']}*")
                lines.append("")

        # Add default structural tasks for this phase
        phase_defaults = {
            1: [
                "Revisar que el inciting incident ocurra en el primer 25% del libro",
                "Verificar que el midpoint suba las apuestas significativamente",
                "Asegurar que cada acto tenga un peso proporcional (ideal: ~33% cada uno)",
                "Comprobar que el clímax resuelva la pregunta central de la historia",
            ],
            2: [
                "Leer el diálogo de cada personaje de corrido para verificar consistencia",
                "Identificar secundarios planos y darles motivación propia",
                "Asegurar que cada personaje suene distinto (longitud de frase, vocabulario, tics)",
            ],
            3: [
                "Revisar transiciones entre escenas — que no sean bruscas ni confusas",
                "Alternar tipos de escena (diálogo, acción, reflexión) para evitar monotonía",
                "Buscar emociones contadas y anclarlas con descripción física",
                "Ejecutar prose_scanner y reducir patrones sobre target",
            ],
            4: [
                "Ejecutar consistency_check para verificar objetos, tiempo, clima",
                "Leer en voz alta el primer y último párrafo de cada capítulo",
                "Verificar que todos los hilos de foreshadowing estén cerrados o intencionalmente abiertos",
                "Última pasada de continuidad: fechas, nombres, descripciones físicas",
            ],
        }

        lines.append("**Tareas adicionales recomendadas:**")
        lines.append("")
        for task in phase_defaults.get(phase["phase"], []):
            lines.append(f"- {task}")
        lines.append("")

    return "\n".join(lines)


def _match_priorities_to_phase(priorities: list[dict], phase: int) -> list[dict]:
    """Asigna prioridades a fases según su tipo."""
    phase_map = {
        1: ["alta"],  # estructura
        2: ["media"],  # personajes (priorities with issue containing character/dialogue keywords)
        3: ["media", "baja"],  # ritmo/prosa
        4: ["baja", "info"],  # pulido
    }

    if phase == 1:
        return [p for p in priorities if p["severity"] == "alta"]
    elif phase == 2:
        char_names_list = list(CHARACTER_NAMES.keys())
        char_keywords = ["voz", "personaje", "diálogo"] + char_names_list
        return [p for p in priorities if p["severity"] == "media"
                and any(kw in p["issue"].lower() for kw in char_keywords)]
    elif phase == 3:
        prose_keywords = ["cierre", "como si", "largo", "pregunta"]
        return [p for p in priorities if p["severity"] in ("media", "baja")
                and any(kw in p["issue"].lower() for kw in prose_keywords)]
    elif phase == 4:
        return [p for p in priorities if p["severity"] in ("baja", "info")]
    return []


# ── Comparación de versiones ─────────────────────────────────

def compare_versions(old_dir: str | None = None, new_dir: str | None = None) -> str:
    """Compara dos versiones del manuscrito y reporta cambios."""
    current_dir = CHAPTERS_DIR

    if not old_dir:
        return ("# Comparación de Versiones\n\n"
                "Usa --old_dir RUTA para comparar con una versión anterior.\n"
"Ejemplo: --old_dir /ruta/a/copia/seguridad/Capítulos\n"

                "         --new_dir /ruta/a/version/actual/Capítulos (opcional, defecto: actual)\n")
    old_path = Path(old_dir)
    if not old_path.exists():
        return f"Directorio antiguo no encontrado: {old_dir}"

    new_path = Path(new_dir) if new_dir else current_dir
    if not new_path.exists():
        return f"Directorio nuevo no encontrado: {new_dir}"

    # Read both versions
    old_files = sorted(old_path.glob("*.md"))
    new_files = sorted(new_path.glob("*.md"))

    old_chapters = {}
    for f in old_files:
        num = get_chapter_number(f)
        if num is not None and num <= 99:
            old_chapters[num] = f.read_text("utf-8")

    new_chapters = {}
    for f in new_files:
        num = get_chapter_number(f)
        if num is not None and num <= 99:
            new_chapters[num] = f.read_text("utf-8")

    common = set(old_chapters.keys()) & set(new_chapters.keys())
    added = set(new_chapters.keys()) - set(old_chapters.keys())
    removed = set(old_chapters.keys()) - set(new_chapters.keys())

    lines = []
    lines.append("# Comparación de Versiones")
    lines.append("")
    lines.append(f"- **Versión antigua**: {old_path}")
    lines.append(f"- **Versión nueva**: {new_path}")
    lines.append("")

    if added:
        lines.append(f"**Capítulos añadidos:** {', '.join(f'{n:02d}' for n in sorted(added))}")
    if removed:
        lines.append(f"**Capítulos eliminados:** {', '.join(f'{n:02d}' for n in sorted(removed))}")
    lines.append("")

    changes = []
    for num in sorted(common):
        old_text = strip_yaml(old_chapters[num])
        new_text = strip_yaml(new_chapters[num])
        old_words = len(old_text.split())
        new_words = len(new_text.split())

        if old_words != new_words:
            diff = new_words - old_words
            sign = "+" if diff > 0 else ""
            changes.append(f"- Capítulo {num:02d}: {old_words} → {new_words} palabras ({sign}{diff})")

    if changes:
        lines.append("### Cambios de palabras")
        lines.append("")
        for ch in changes:
            lines.append(ch)
        lines.append("")

    lines.append("### Resumen")
    lines.append("")
    lines.append(f"- Capítulos comunes: {len(common)}")
    lines.append(f"- Añadidos: {len(added)}")
    lines.append(f"- Eliminados: {len(removed)}")
    total_old = sum(len(strip_yaml(old_chapters[n]).split()) for n in common)
    total_new = sum(len(strip_yaml(new_chapters[n]).split()) for n in common)
    total_diff = total_new - total_old
    sign = "+" if total_diff > 0 else ""
    lines.append(f"- Total palabras (caps comunes): {total_old} → {total_new} ({sign}{total_diff})")
    lines.append("")

    return "\n".join(lines)


# ── Síntesis de lector beta ──────────────────────────────────

def generate_beta_synthesis(chapters: list[dict]) -> str:
    """Compila todos los análisis en una carta editorial profesional unificada."""
    struct = analyze_structure(chapters)
    prose = analyze_prose(chapters)
    voice = analyze_voice(chapters)
    foreshadowing_info = analyze_foreshadowing()
    pacing = analyze_pacing(chapters)
    scenes = analyze_scene_function(chapters)
    emotions = analyze_emotional_timeline(chapters)
    hooks = analyze_hooks(chapters)
    promise = analyze_promise_payoff(chapters)
    sensory = analyze_sensory_immersion(chapters)
    show_tell = analyze_show_dont_tell(chapters)
    dialogue_attr = analyze_dialogue_attribution(chapters)
    priorities = _generate_priorities(struct, prose, voice, foreshadowing_info, pacing, chapters)

    lines = []
    lines.append("# Informe Editorial Profesional")
    lines.append("")
    lines.append(f"**{_get_project_title()}** — {struct['total_words']} palabras, "
                 f"{struct['total_chapters']} capítulos")
    lines.append("")

    # ── Executive Summary ──
    lines.append("## Resumen Ejecutivo")
    lines.append("")
    lines.append(_generate_verdict(struct, prose, foreshadowing_info, priorities))
    lines.append("")
    lines.append(f"**Prioridades:** {sum(1 for p in priorities if p['severity']=='alta')} altas, "
                 f"{sum(1 for p in priorities if p['severity']=='media')} medias, "
                 f"{sum(1 for p in priorities if p['severity']=='baja')} bajas")
    lines.append("")

    # ── Strengths ──
    lines.append("## Fortalezas Detectadas")
    lines.append("")
    strengths = _detect_strengths(struct, prose, scenes, sensory, foreshadowing_info)
    for s in strengths:
        lines.append(f"- **{s['area']}**: {s['detail']}")
    lines.append("")

    # ── Scene Analysis ──
    lines.append("## Análisis de Escenas")
    lines.append("")
    lines.append(f"- **Total de escenas**: {scenes['total_scenes']}")
    lines.append(f"- **Escenas sin función clara**: {scenes['weak_count']}")
    if scenes["weak_scenes"]:
        lines.append("")
        lines.append("| Cap | Escena | Tipo | Palabras |")
        lines.append("|---|---|---|---|")
        for ws in scenes["weak_scenes"][:10]:
            lines.append(f"| {ws['chapter']:02d} | {ws['scene']} | {ws['type']} | {ws['words']} |")
    lines.append("")

    # ── Emotional Arc ──
    lines.append("## Arco Emocional")
    lines.append("")
    lines.append("| Cap | Intensidad media | Párrafos planos | Máx. plana seguida | Saturados |")
    lines.append("|---|---|---|---|---|")
    for cn in sorted(emotions):
        e = emotions[cn]
        lines.append(f"| {cn:02d} | {e['mean_intensity']} | {e['flat_paragraphs']} | "
                     f"{e['max_flat_streak']} | {e['saturated_paragraphs']} |")
    lines.append("")

    # ── Hooks ──
    lines.append("## Ganchos de Capítulo")
    lines.append("")
    lines.append("| Cap | Apertura | Palabras hasta conflicto | Cierre | Hook | Anticipación |")
    lines.append("|---|---|---|---|---|---|")
    for cn in sorted(hooks):
        h = hooks[cn]
        op = h["opening"]
        cl = h["closing"]
        wfc = str(op["words_to_first_conflict"]) if op["words_to_first_conflict"] else "—"
        ant = "✓" if cl["anticipation"] else "—"
        lines.append(f"| {cn:02d} | {op['type']} | {wfc} | {cl['type']} | {cl['hook_strength']} | {ant} |")
    lines.append("")

    # ── Promise/Payoff ──
    lines.append("## Promesa → Pago")
    lines.append("")
    if promise.get("cold_threads"):
        lines.append(f"**Hilos con posible enfriamiento** ({promise['cold_count']}):")
        lines.append("")
        for ct in promise["cold_threads"]:
            lines.append(f"- **{ct['name']}**: {ct['chapter_distance']} caps entre siembra y pago, "
                         f"sin puntos de contacto intermedios")
        lines.append("")

    # ── Show Don't Tell ──
    lines.append("## Show vs Tell")
    lines.append("")
    lines.append(f"- **Total emociones contadas sin anclaje físico**: {show_tell['total_tells']}")
    if show_tell["total_tells"] > 0:
        lines.append("")
        for cn in sorted(show_tell["per_chapter"]):
            st = show_tell["per_chapter"][cn]
            if st["total_tells"] > 0:
                for t in st["tells"][:3]:
                    lines.append(f"- Cap {cn:02d}: «{t['emotion']}» ({t['category']}) — "
                                 f"«{t['context'][:80]}…»")
                    lines.append("")
    lines.append("")

    # ── Immersion ──
    lines.append("## Inmersión Sensorial")
    lines.append("")
    lines.append("| Cap | Score | Sentidos | Vista | Oído | Tacto | Olfato | Gusto |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for cn in sorted(sensory):
        s = sensory[cn]
        sd = s["sense_details"]
        lines.append(f"| {cn:02d} | {s['immersion_score']:.0f}% | {s['senses_count']}/5 | "
                     f"{sd.get('vista', 0)} | {sd.get('oído', 0)} | {sd.get('tacto', 0)} | "
                     f"{sd.get('olfato', 0)} | {sd.get('gusto', 0)} |")
    lines.append("")

    # ── Priorities ──
    lines.append("## Prioridades")
    lines.append("")
    for p in sorted(priorities, key=lambda x: {"alta": 0, "media": 1, "baja": 2, "info": 3}[x["severity"]]):
        icon = {"alta": "🔴", "media": "🟡", "baja": "🟢", "info": "ℹ"}.get(p["severity"], "•")
        lines.append(f"- {icon} **{p['severity'].upper()}**: {p['issue']}")
        lines.append(f"  *{p['detail']}*")
        lines.append("")

    # ── Revision Plan ──
    lines.append("## Plan de Revisión")
    lines.append("")
    lines.append(generate_revision_plan(priorities))

    return "\n".join(lines)


def _detect_strengths(struct, prose, scenes, sensory, foreshadowing_info) -> list[dict]:
    """Detecta fortalezas del manuscrito basado en datos."""
    strengths = []

    # Structure
    strengths.append({
        "area": "Estructura",
        "detail": f"Tres actos equilibrados ({struct['acts'][1]['pct']}% / "
                  f"{struct['acts'][2]['pct']}% / {struct['acts'][3]['pct']}%) "
                  f"con midpoint claro en capítulo {struct['midpoint_chapter']:02d}",
    })

    # Foreshadowing
    if foreshadowing_info["pct_closed"] >= 80:
        strengths.append({
            "area": "Foreshadowing",
            "detail": f"{foreshadowing_info['closed']}/{foreshadowing_info['total']} hilos cerrados "
                      f"({foreshadowing_info['pct_closed']:.0f}%) — disciplina narrativa sólida",
        })

    # Sensory immersion
    avg_immersion = sum(s["immersion_score"] for s in sensory.values()) / len(sensory) if sensory else 0
    if avg_immersion >= 60:
        strengths.append({
            "area": "Inmersión sensorial",
            "detail": f"Media de {avg_immersion:.0f}% de inmersión sensorial — "
                      "el mundo se siente a través de múltiples sentidos",
        })

    # Scene function
    if scenes["weak_count"] <= 2:
        strengths.append({
            "area": "Función de escena",
            "detail": f"Solo {scenes['weak_count']} escenas sin función clara "
                      f"(de {scenes['total_scenes']}) — la mayoría avanzan trama, personaje o tensión",
        })

    return strengths


# ── Generación de carta ─────────────────────────────────────~

def generate_letter(chapters: list[dict], cap_filter: int | None = None) -> str:
    struct = analyze_structure(chapters)
    prose = analyze_prose(chapters)
    voice = analyze_voice(chapters)
    foreshadowing = analyze_foreshadowing()
    pacing = analyze_pacing(chapters)

    if cap_filter:
        chapters = [c for c in chapters if c["num"] == cap_filter]
        if not chapters:
            return f"Capítulo {cap_filter} no encontrado."
        return _letter_for_chapter(chapters[0], prose, voice)

    lines = []
    lines.append(f"# Carta Editorial — {_get_project_title()}")
    lines.append("")
    lines.append(f"> Generada automáticamente el {_today()}")
    lines.append("")

    # ── Resumen ──
    lines.append("## Resumen")
    lines.append("")
    lines.append(f"| Métrica | Valor |")
    lines.append(f"|---|---|")
    lines.append(f"| Palabras totales | {struct['total_words']} |")
    lines.append(f"| Capítulos | {struct['total_chapters']} |")
    lines.append(f"| Media por capítulo | {struct['mean_words']:.0f} (±{struct['std_dev_words']:.0f}) |")
    lines.append(f"| Capítulo más largo | cap{struct['max_chapter']['num']:02d} ({struct['max_chapter']['words']} palabras) |")
    lines.append(f"| Capítulo más corto | cap{struct['min_chapter']['num']:02d} ({struct['min_chapter']['words']} palabras) |")
    midpoint_num = struct['midpoint_chapter']
    lines.append(f"| Midpoint | Capítulo {midpoint_num:02d} ({struct['midpoint_words']} palabras) |")
    pov_parts = [f"{p} ({c} {'cap' if c == 1 else 'caps'})" for p, c in sorted(struct["pov"].items())]
    lines.append(f"| POV | {', '.join(pov_parts)} |")
    lines.append(f"| Hilos foreshadowing | {foreshadowing['closed']}/{foreshadowing['total']} cerrados |")
    lines.append("")

    # ── Estructura ──
    lines.append("## Estructura")
    lines.append("")
    lines.append("### Actos")
    lines.append("")
    lines.append(f"| Acto | Capítulos | Palabras | % |")
    lines.append(f"|---|---|---|---|")
    for act_num in sorted(struct["acts"]):
        a = struct["acts"][act_num]
        lines.append(f"| {a['label']} | {_fmt_range(a['chapters'])} | {a['words']} | {a['pct']}% |")
    lines.append("")

    # Word count table
    lines.append("### Palabras por capítulo")
    lines.append("")
    lines.append(f"| Cap | Título | POV | Palabras | vs media |")
    lines.append(f"|---|---|---|---|---|")
    for c in sorted(chapters, key=lambda x: x["num"]):
        pov = POV_MAP.get(c["num"], DEFAULT_POV)
        diff = c["words"] - struct["mean_words"]
        diff_str = f"+{diff:.0f}" if diff > 0 else f"{diff:.0f}"
        lines.append(f"| {c['num']:02d} | {c['title']} | {pov} | {c['words']} | {diff_str} |")
    lines.append("")

    # POV distribution
    lines.append("### Distribución POV")
    lines.append("")
    for pov, count in sorted(struct["pov"].items()):
        pct = round(count / struct["total_chapters"] * 100, 0)
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        lines.append(f"- **{pov}**: {count} caps ({pct:.0f}%) {bar}")
    lines.append("")

    # ── Prosa ──
    lines.append("## Prosa")
    lines.append("")
    pg = prose["global"]

    lines.append("### Patrones globales")
    lines.append("")
    lines.append(f"| Patrón | Total | Densidad | Target |")
    lines.append(f"|---|---|---|---|")
    lines.append(f"| como si | {pg['como_si']['total']} | {pg['como_si']['density']}/1k | 1.5/1k |")
    lines.append(f"| había + participio | {pg['habia_participio']['total']} | {pg['habia_participio']['density']}/1k | 1.5/1k |")
    lines.append(f"| Incisos con raya (narr.) | {pg['incisos_raya_narrativa']['total']} | {pg['incisos_raya_narrativa']['density']}/1k | — |")
    lines.append("")

    # "como si" by chapter
    lines.append("### «como si» por capítulo")
    lines.append("")
    lines.append(f"| Cap | Count | Densidad | Clusters |")
    lines.append(f"|---|---|---|---|")
    for cn in sorted(prose["per_chapter"]):
        p = prose["per_chapter"][cn]["como_si"]
        cluster_warn = " ⚠" if p["clusters"] > 0 else ""
        lines.append(f"| {cn:02d} | {p['count']} | {p['density']}/1k | {p['clusters']}{cluster_warn} |")
    lines.append("")

    # Chapter endings
    lines.append("### Tipos de cierre por capítulo")
    lines.append("")
    lines.append(f"| Cap | Tipo de cierre | Última línea |")
    lines.append(f"|---|---|---|")
    for cn in sorted(prose["per_chapter"]):
        e = prose["per_chapter"][cn]["ending"]
        last = e["last_line"].replace("|", "/")
        lines.append(f"| {cn:02d} | {e['type']} | {last} |")
    lines.append("")

    # ── Voces ──
    lines.append("## Voces")
    lines.append("")
    vp = voice.get("per_chapter", {})

    lines.append("### Diálogo — preguntas vs líneas cortas")
    lines.append("")
    lines.append(f"| Cap | Líneas | Preguntas | % | Imperativos | Cortas (≤5 pal) | % | Media pal |")
    lines.append(f"|---|---|---|---|---|---|---|---|")
    for cn in sorted(vp):
        v = vp[cn]
        lines.append(
            f"| {cn:02d} | {v['total_lines']} | {v['questions']} | {v['pct_questions']}% | "
            f"{v['imperatives']} | {v['short_lines']} | {v['pct_short']}% | {v['avg_words']} |"
        )
    lines.append("")

    # Character appearances
    lines.append("### Apariciones de personajes")
    lines.append("")
    for char_name in sorted(CHARACTER_NAMES.keys()):
        apps = voice.get("character_appearances", {}).get(char_name, [])
        caps_str = ", ".join(f"{n:02d}" for n in sorted(apps)) if apps else "—"
        lines.append(f"- **{char_name}**: caps {caps_str}")
    lines.append("")

    # ── Foreshadowing ──
    lines.append("## Foreshadowing")
    lines.append("")
    lines.append(f"- **Total hilos**: {foreshadowing['total']}")
    lines.append(f"- **Cerrados**: {foreshadowing['closed']} ({foreshadowing['pct_closed']:.0f}%)")
    if foreshadowing["open"]:
        lines.append(f"- **Abiertos**: {len(foreshadowing['open'])}")
        for t in foreshadowing["open"]:
            lines.append(f"  - **{t['num']}. {t['name']}** — 🔴")
    lines.append("")

    # ── Ritmo ──
    lines.append("## Ritmo")
    lines.append("")
    lines.append(f"- Media: {pacing['mean']:.0f} palabras (±{pacing['std_dev']:.0f})")
    for o in pacing["outliers"]:
        direction = "largo" if o["direction"] == "long" else "corto"
        lines.append(f"- Capítulo {o['chapter']:02d} ({o['words']} pal.) — **{direction}**")
    lines.append("")

    # Act balance
    lines.append("### Balance por acto")
    lines.append("")
    for act_num in sorted(pacing["act_words"]):
        a = pacing["act_words"][act_num]
        caps = struct["acts"][act_num]
        expected = round(100 / 3, 1)
        actual = round(a["total"] / struct["total_words"] * 100, 1)
        diff = round(actual - expected, 1)
        bar = "█" * int(actual / 2)
        lines.append(f"- **{a['label']}**: {a['total']} pal. ({actual}%) {bar} {'+' if diff > 0 else ''}{diff}% vs equilibrio")
    lines.append("")

    # ── Análisis de escenas ──
    scenes = analyze_scene_function(chapters)
    lines.append("## Función de Escenas")
    lines.append("")
    lines.append(f"**Total:** {scenes['total_scenes']} escenas en {len(chapters)} capítulos")
    if scenes["weak_scenes"]:
        lines.append(f"**Sin función clara:** {scenes['weak_count']}")
        for ws in scenes["weak_scenes"]:
            lines.append(f"- Cap {ws['chapter']:02d}, escena {ws['scene']}: "
                         f"({ws['type']}, {ws['words']} pal.) — {ws['preview'][:60]}…")
    else:
        lines.append("Todas las escenas cumplen al menos una función narrativa. ✓")
    lines.append("")

    # ── Arco emocional ──
    emotions = analyze_emotional_timeline(chapters)
    lines.append("## Arco Emocional")
    lines.append("")
    lines.append(f"| Cap | Intensidad media | Párrafos planos | Máx. seguida | Pico |")
    lines.append(f"|---|---|---|---|---|")
    for cn in sorted(emotions):
        e = emotions[cn]
        peak = f"{e['peak']['score']}" if e.get('peak') else "—"
        lines.append(f"| {cn:02d} | {e['mean_intensity']} | {e['flat_paragraphs']} | "
                     f"{e['max_flat_streak']} | {peak} |")
    lines.append("")

    # ── Inmersión sensorial ──
    sensory = analyze_sensory_immersion(chapters)
    lines.append("## Inmersión Sensorial")
    lines.append("")
    avg_imm = sum(s["immersion_score"] for s in sensory.values()) / len(sensory) if sensory else 0
    lines.append(f"**Media:** {avg_imm:.0f}% — "
                 f"{'Buena' if avg_imm >= 60 else 'Aceptable' if avg_imm >= 40 else 'Baja'} "
                 f"activación sensorial")
    lines.append("")
    lines.append(f"| Cap | Score | Vista | Oído | Tacto | Olfato | Gusto |")
    lines.append(f"|---|---|---|---|---|---|---|")
    for cn in sorted(sensory):
        s = sensory[cn]
        sd = s["sense_details"]
        lines.append(f"| {cn:02d} | {s['immersion_score']:.0f}% | {sd.get('vista', 0)} | "
                     f"{sd.get('oído', 0)} | {sd.get('tacto', 0)} | {sd.get('olfato', 0)} | "
                     f"{sd.get('gusto', 0)} |")
    lines.append("")

    # ── Ganchos ──
    hooks = analyze_hooks(chapters)
    lines.append("## Ganchos de Capítulo")
    lines.append("")
    weak_hooks = [str(cn) for cn in sorted(hooks) if hooks[cn]["closing"]["hook_strength"] == "bajo"]
    if weak_hooks:
        lines.append(f"**Cierres débiles:** caps {', '.join(weak_hooks)}")
    lines.append("")
    lines.append(f"| Cap | Apertura | 1er conflicto (pal) | Cierre | Hook |")
    lines.append(f"|---|---|---|---|---|")
    for cn in sorted(hooks):
        h = hooks[cn]
        wfc = str(h["opening"]["words_to_first_conflict"]) if h["opening"]["words_to_first_conflict"] else "—"
        lines.append(f"| {cn:02d} | {h['opening']['type']} | {wfc} | {h['closing']['type']} | "
                     f"{h['closing']['hook_strength']} |")
    lines.append("")

    # ── Promise/Payoff ──
    promise = analyze_promise_payoff(chapters)
    lines.append("## Promesa → Pago (Foreshadowing)")
    lines.append("")
    if promise.get("cold_threads"):
        lines.append(f"**Hilos con posible enfriamiento:** {promise['cold_count']}")
        for ct in promise["cold_threads"]:
            lines.append(f"- {ct['name']}: {ct['chapter_distance']} caps entre siembra y pago, "
                         f"sin contacto intermedio")
    else:
        lines.append("Sin hilos fríos detectados. ✓")
    lines.append("")

    # ── Show vs Tell ──
    show_tell = analyze_show_dont_tell(chapters)
    lines.append("## Show vs Tell")
    lines.append("")
    if show_tell["total_tells"] > 0:
        lines.append(f"**{show_tell['total_tells']} emociones contadas sin anclaje físico:**")
        for cn in sorted(show_tell["per_chapter"]):
            st = show_tell["per_chapter"][cn]
            if st["total_tells"] > 0:
                for t in st["tells"][:3]:
                    lines.append(f"- Cap {cn:02d}: «{t['emotion']}» → «{t['context'][:80]}…»")
    else:
        lines.append("Sin emociones sin anclaje detectadas. ✓")
    lines.append("")

    # ── Prioridades ──
    lines.append("## Prioridades detectadas")
    lines.append("")

    priorities = _generate_priorities(struct, prose, voice, foreshadowing, pacing, chapters)
    for p in priorities:
        icon = {"alta": "🔴", "media": "🟡", "baja": "🟢", "info": "ℹ"}.get(p["severity"], "•")
        lines.append(f"- **{icon} {p['severity'].upper()}**: {p['issue']}")
        lines.append(f"  *{p['detail']}*")
        lines.append("")

    # ── Veredicto ──
    lines.append("## Veredicto")
    lines.append("")
    lines.append(_generate_verdict(struct, prose, foreshadowing, priorities))
    lines.append("")

    return "\n".join(lines)


def _first_dialogue_chapter(chapters: list[dict], char_name: str) -> int | None:
    """Detecta el primer capítulo donde un personaje tiene diálogo o escena propia.
    Distingue menciones de aparición en persona."""
    for c in sorted(chapters, key=lambda x: x["num"]):
        text = c["text"]
        # Limpiar wikilinks para evitar falsos positivos con topónimos
        text_clean = re.sub(r"\[\[([^\]|]+)\]\]", r"\1", text)

        # Evitar confusiones con topónimos compuestos que contengan el nombre del personaje
        text_clean = re.sub(rf"\b{re.escape(char_name)}-\w+\b", "CIUDAD", text_clean,
                            flags=re.IGNORECASE)

        # Check 1: personaje como hablante en atribución de diálogo
        speaker_pattern = rf"dijo\s+{re.escape(char_name)}\b"
        if re.search(speaker_pattern, text_clean, re.IGNORECASE):
            return c["num"]

        # Check 2: personaje responde o pregunta
        response_pattern = rf"(respondió|preguntó|contestó|repitió|susurró|gritó|alcanzó a decir)\s+{re.escape(char_name)}\b"
        if re.search(response_pattern, text_clean, re.IGNORECASE):
            return c["num"]

        # Check 3: personaje como sujeto en párrafo narrativo (describe su presencia física)
        for para in text_clean.split("\n"):
            if para.startswith("—"):
                continue
            # Buscar "<char_name> <acción>" donde el personaje hace algo físicamente
            presence_pattern = rf"(?:^|\n)\s*{re.escape(char_name)}\s+(estaba|tenía|iba|miraba|"
            presence_pattern += rf"caminó|camina|entró|salió|se|alzó|levantó|apoyó|arrodilló|"
            presence_pattern += rf"cayó|saltó|lloró|sonrió|tragó)"
            if re.search(presence_pattern, para, re.IGNORECASE):
                return c["num"]
    return None


def _fmt_range(nums: list[int]) -> str:
    if not nums:
        return ""
    nums = sorted(nums)
    if len(nums) == 1:
        return f"{nums[0]:02d}"
    return f"{nums[0]:02d}–{nums[-1]:02d}"


def _today() -> str:
    from datetime import date
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    d = date.today()
    return f"{d.day} {months[d.month - 1]} {d.year}"


def _generate_priorities(
    struct: dict, prose: dict, voice: dict, foreshadowing: dict,
    pacing: dict, chapters: list[dict],
) -> list[dict]:
    priorities = []

    # Structure: check if any mentioned character appears in person too late
    char_list = list(CHARACTER_NAMES.keys())
    for char_name in char_list[:min(3, len(char_list))]:
        first_appearance = _first_dialogue_chapter(chapters, char_name)
        total_caps = len(chapters)
        if first_appearance and first_appearance >= total_caps * 0.6:
            priorities.append({
                "severity": "media",
                "issue": f"{char_name} primera escena con voz propia tarde "
                         f"(cap {first_appearance:02d})",
                "detail": f"{char_name} podría necesitar una escena temprana "
                          "para establecer el personaje antes del midpoint.",
            })

    # Prose: "como si" clusters
    for cn in sorted(prose["per_chapter"]):
        p = prose["per_chapter"][cn]["como_si"]
        if p["clusters"] > 0:
            priorities.append({
                "severity": "media",
                "issue": f"Capítulo {cn:02d}: cluster de «como si» ({p['clusters']})",
                "detail": f"{p['count']} ocurrencias de «como si» en {cn:02d}. "
                          "Cluster indica posible muletilla. Revisar si todos los símiles aportan.",
            })
        if p["density"] > 2.0:
            priorities.append({
                "severity": "baja",
                "issue": f"Capítulo {cn:02d}: alta densidad de «como si» ({p['density']}/1k)",
                "detail": "Target: 1.5/1k. Revisar si la descripción se apoya demasiado en símiles.",
            })

    # Chapter endings: dialogue vs sensory
    pg = prose["global"]
    dialogue_endings = pg["chapter_endings"].get("dialogo", 0)
    if dialogue_endings > 0:
        dialogue_caps = [
            cn for cn in sorted(prose["per_chapter"])
            if prose["per_chapter"][cn]["ending"]["type"] == "dialogo"
        ]
        for cn in dialogue_caps:
            priorities.append({
                "severity": "media",
                "issue": f"Capítulo {cn:02d}: cierre en diálogo",
                "detail": "Los cierres sensoriales/reflexivos suelen ser más potentes. "
                          f"Última línea: «{prose['per_chapter'][cn]['ending']['last_line']}»",
            })

    # Pacing outliers
    for o in pacing["outliers"]:
        if o["direction"] == "long":
            priorities.append({
                "severity": "baja",
                "issue": f"Capítulo {o['chapter']:02d}: significativamente más largo "
                         f"({o['words']} pal., media {pacing['mean']:.0f})",
                "detail": "Varios eventos pueden estar comprimidos. Considerar expandir o dividir.",
            })

    # Act balance issues
    for act_num in sorted(pacing["act_words"]):
        a = pacing["act_words"][act_num]
        expected = 33.3
        actual = round(a["total"] / struct["total_words"] * 100, 1)
        if abs(actual - expected) > 10:
            priorities.append({
                "severity": "media",
                "issue": f"Acto {act_num} ({a['label']}): {actual}% del total "
                         f"({'pesado' if actual > expected else 'ligero'})",
                "detail": f"Esperado ~{expected:.0f}%. Tiene {a['total']} palabras. "
                          "Revisar si la distribución de tensión funciona.",
            })

    # Foreshadowing
    if foreshadowing["open"]:
        for t in foreshadowing["open"]:
            priorities.append({
                "severity": "info",
                "issue": f"Hilo abierto: {t['name']} (#{t['num']})",
                "detail": "Hilo intencional para secuela, según Foreshadowing.md.",
            })

    # Voice: dialogue questions per chapter
    vp = voice.get("per_chapter", {})
    for cn in sorted(vp):
        v = vp[cn]
        if v["pct_questions"] > 60:
            chapter_title = next(
                (c["title"] for c in chapters if c["num"] == cn), ""
            )
            # Detectar personaje con perfil preguntativo desde las fichas
            voice_name = "personaje"
            for d in CHARACTERS_DIRS:
                if d.is_dir():
                    for f in d.glob("*.md"):
                        if f.stem.startswith("_") or f.stem.startswith("."):
                            continue
                        content = f.read_text("utf-8")
                        if "Voz" in content and any(w in content.lower() for w in ["pregunta", "duda", "cuestiona", "preguntativ"]):
                            voice_name = f.stem
                            break
            priorities.append({
                "severity": "baja",
                "issue": f"Capítulo {cn:02d}: {v['pct_questions']}% del diálogo son preguntas",
                "detail": f"Coherente con la voz de {voice_name} (preguntativa), pero "
                          "monitorizar que no fatigue al lector.",
            })

    return priorities


def _generate_verdict(
    struct: dict, prose: dict, foreshadowing: dict, priorities: list[dict],
) -> str:
    alta = sum(1 for p in priorities if p["severity"] == "alta")
    media = sum(1 for p in priorities if p["severity"] == "media")
    baja = sum(1 for p in priorities if p["severity"] == "baja")

    verdict = (
        f"Manuscrito de {struct['total_words']} palabras en {struct['total_chapters']} capítulos. "
        f"Estructura de tres actos sólida, midpoint en capítulo "
        f"{struct['midpoint_chapter']:02d}. "
        f"{foreshadowing['closed']}/{foreshadowing['total']} hilos de foreshadowing cerrados. "
    )

    if alta > 0:
        verdict += (
            f"Se detectaron {alta} prioridades altas que requieren atención "
            f"antes de considerar el manuscrito finalizado. "
        )
    if media > 0:
        verdict += f"{media} issues de prioridad media para revisión. "

    if alta == 0 and media <= 2:
        verdict += "El manuscrito está en buen estado general."
    else:
        verdict += "Se recomienda abordar los puntos señalados por orden de prioridad."

    return verdict


def _letter_for_chapter(chapter: dict, prose: dict, voice: dict) -> str:
    cn = chapter["num"]
    lines = []
    lines.append(f"# Carta Editorial — Capítulo {cn:02d}: {chapter['title']}")
    lines.append("")

    # Prose
    p = prose["per_chapter"].get(cn, {})
    lines.append(f"**Palabras:** {chapter['words']}")
    lines.append("")
    lines.append("### Prosa")
    lines.append("")
    if p:
        lines.append(f"- «como si»: {p['como_si']['count']} ({p['como_si']['density']}/1k)")
        lines.append(f"- «había» + participio: {p['habia_participio']['count']} ({p['habia_participio']['density']}/1k)")
        lines.append(f"- Incisos con raya (narr.): {p['incisos_raya_narrativa']['count']} ({p['incisos_raya_narrativa']['density']}/1k)")
        lines.append(f"- Cierre: **{p['ending']['type']}** — «{p['ending']['last_line']}»")
    lines.append("")

    # Voice
    v = voice.get("per_chapter", {}).get(cn, {})
    if v:
        lines.append("### Diálogo")
        lines.append("")
        lines.append(f"- Líneas totales: {v['total_lines']}")
        lines.append(f"- Preguntas: {v['questions']} ({v['pct_questions']}%)")
        lines.append(f"- Imperativos: {v['imperatives']}")
        lines.append(f"- Cortas (≤5 pal): {v['short_lines']} ({v['pct_short']}%)")
        lines.append(f"- Media palabras: {v['avg_words']}")
        lines.append("")

    return "\n".join(lines)


# ── JSON output ─────────────────────────────────────────────~

def generate_json(chapters: list[dict], cap_filter: int | None = None) -> str:
    struct = analyze_structure(chapters)
    prose = analyze_prose(chapters)
    voice = analyze_voice(chapters)
    foreshadowing = analyze_foreshadowing()
    pacing = analyze_pacing(chapters)
    scenes = analyze_scene_function(chapters)
    emotions = analyze_emotional_timeline(chapters)
    hooks = analyze_hooks(chapters)
    sensory = analyze_sensory_immersion(chapters)
    show_tell = analyze_show_dont_tell(chapters)

    output = {
        "title": _get_project_title(),
        "structure": struct,
        "prose": prose,
        "voice": voice,
        "foreshadowing": foreshadowing,
        "pacing": pacing,
        "scenes": scenes,
        "emotional_timeline": emotions,
        "hooks": hooks,
        "sensory_immersion": sensory,
        "show_dont_tell": show_tell,
    }

    if HAS_INSIGHTS and _insights_module is not None:
        try:
            advanced = analyze_advanced_all(chapters)
            arc = classify_story_arc(
                {k: {"mean_intensity": v.get("mean_intensity", 0)}
                 for k, v in emotions.items()}, None,
            )
            advanced["story_arc"] = arc
            output["insights"] = advanced
        except Exception:
            pass

    if cap_filter:
        output["chapter"] = cap_filter

    return json.dumps(output, ensure_ascii=False, indent=2)


# ── Resumen rápido ──────────────────────────────────────────~

def generate_summary(chapters: list[dict]) -> str:
    struct = analyze_structure(chapters)
    foreshadowing = analyze_foreshadowing()
    prose = analyze_prose(chapters)

    lines = []
    lines.append("# Prioridades Editoriales")
    lines.append("")
    lines.append(f"| Prioridad | Issue | Dónde |")
    lines.append(f"|---|---|---|")

    priorities = _generate_priorities(
        struct, prose, analyze_voice(chapters), foreshadowing,
        analyze_pacing(chapters), chapters,
    )

    for p in sorted(priorities, key=lambda x: {"alta": 0, "media": 1, "baja": 2, "info": 3}[x["severity"]]):
        icon = {"alta": "🔴", "media": "🟡", "baja": "🟢", "info": "ℹ"}.get(p["severity"], "•")
        lines.append(f"| {icon} {p['severity'].upper()} | {p['issue']} | {p['detail']} |")

    lines.append("")
    return "\n".join(lines)


# ── CLI ─────────────────────────────────────────────────────~

def main():
    parser = argparse.ArgumentParser(description="Generador de carta editorial")
    parser.add_argument("--json", action="store_true", help="Salida JSON")
    parser.add_argument("--cap", type=int, help="Capítulo específico (1-12)")
    parser.add_argument("--resumen", action="store_true", help="Solo tabla de prioridades")
    parser.add_argument("--beta", action="store_true", help="Informe profesional sintético completo")
    parser.add_argument("--plan", action="store_true", help="Generar plan de revisión faseado")
    parser.add_argument("--insights", action="store_true", help="Análisis avanzados: estilo, diálogo, Save the Cat, Chekhov, arco, etc.")
    parser.add_argument("--compare", type=str, nargs="*", metavar=("OLD_DIR", "NEW_DIR"),
                        help="Comparar dos versiones: --compare old_dir new_dir")
    args = parser.parse_args()

    files = get_chapter_files()
    if not files:
        print("No se encontraron capítulos.")
        sys.exit(1)

    chapters = [read_chapter(f) for f in files]
    struct = analyze_structure(chapters)

    if args.compare:
        old_dir = args.compare[0] if len(args.compare) > 0 else None
        new_dir = args.compare[1] if len(args.compare) > 1 else None
        print(compare_versions(old_dir, new_dir))
    elif args.insights:
        if not HAS_INSIGHTS or _insights_module is None:
            print("Error: módulo editorial_insights no disponible.")
            sys.exit(1)
        advanced = analyze_advanced_all(chapters)
        advanced["story_arc"] = classify_story_arc(None, chapters)
        print(_insights_module.format_markdown(advanced))
    elif args.plan:
        prose = analyze_prose(chapters)
        voice = analyze_voice(chapters)
        foreshadowing = analyze_foreshadowing()
        pacing = analyze_pacing(chapters)
        priorities = _generate_priorities(struct, prose, voice, foreshadowing, pacing, chapters)
        print(generate_revision_plan(priorities))
    elif args.beta:
        print(generate_beta_synthesis(chapters))
    elif args.json:
        print(generate_json(chapters, args.cap))
    elif args.resumen:
        print(generate_summary(chapters))
    elif args.cap:
        prose = analyze_prose(chapters)
        voice = analyze_voice(chapters)
        matching = [c for c in chapters if c["num"] == args.cap]
        if matching:
            print(_letter_for_chapter(matching[0], prose, voice))
        else:
            print(f"Capítulo {args.cap} no encontrado.")
            sys.exit(1)
    else:
        print(generate_letter(chapters))


if __name__ == "__main__":
    main()
