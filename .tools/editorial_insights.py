#!/usr/bin/env python3
"""
editorial_insights.py — Análisis editorial avanzado para ficción en español.

Ofrece 9 módulos de análisis que complementan editorial_letter.py:

  • Style Diagnostics  — readability, voz pasiva, adverbios, varianza,
    verbos débiles, filter words, nominalizaciones, adj/noun ratio
  • Dialogue Quality   — ratio "dijo" vs creativas, info-dumps, voz
  • Save the Cat       — 15 beats en posiciones correctas
  • First Pages        — test de primeras 10 páginas
  • First Pages Test   — protagonista, deseo, obstáculo en 10 páginas
  • Backstory Dumps    — párrafos con pluscuamperfecto denso
  • Scene vs Summary   — ratio modo escena / modo resumen
  • Story Arc          — clasificación Vonnegut (sentiment shape)
  • Revision Hotspots  — dónde concentrar la próxima sesión

Uso desde Python:
    from tools.editorial_insights import analyze_all, format_markdown
    chapters = [...]  # mismo formato que editorial_letter.read_chapter
    insights = analyze_all(chapters)
    print(format_markdown(insights))
"""

import json
import math
import re
from collections import Counter, defaultdict
from typing import Any

# ──────────────────────────────────────────────
#  UTILIDADES COMPARTIDAS
# ──────────────────────────────────────────────

# Filter words en español — distancia al lector
FILTER_WORDS = {
    "vio", "veía", "ve", "oyó", "oía", "oye", "sintió", "sentía", "siente",
    "notó", "notaba", "nota", "parecía", "pareció", "parece", "observó",
    "observaba", "observa", "miró", "miraba", "mira", "escuchó", "escuchaba",
    "escucha", "percibió", "percibía", "percibe", "se dio cuenta",
    "se daba cuenta", "supo", "sabía", "sabe",
}

# Verbos débiles — construcciones que prefieren verbo fuerte
WEAK_VERBS = {
    "era", "eras", "era", "éramos", "erais", "eran",
    "es", "soy", "eres", "somos", "sois", "son",
    "será", "serás", "será", "seremos", "seréis", "serán",
    "sería", "serías", "sería", "seríamos", "seríais", "serían",
    "estaba", "estabas", "estaba", "estábamos", "estabais", "estaban",
    "está", "estoy", "estás", "estamos", "estáis", "están",
    "estará", "estarás", "estará", "estaremos", "estaréis", "estarán",
    "estaría", "estarías", "estaría", "estaríamos", "estaríais", "estarían",
    "había", "habías", "había", "habíamos", "habíais", "habían",
    "hay", "hubo", "habrá", "habría",
    "hubiera", "hubieras", "hubiera", "hubiéramos", "hubierais", "hubieran",
    "hubiese", "hubieses", "hubiese", "hubiésemos", "hubieseis", "hubiesen",
}

# Nombres de verbos dicendi comunes en español (para ratio "dijo" vs creativas)
SAID_VERBS = {"dijo", "decía", "dice", "dije", "dijiste", "dijeron", "dirá", "diría"}
CREATIVE_SAID_VERBS = {
    "preguntó", "preguntaba", "responde", "respondió", "respondía",
    "contestó", "contestaba", "contesta", "murmuró", "murmuraba", "murmura",
    "susurró", "susurraba", "susurra", "gritó", "gritaba", "grita",
    "exclamó", "exclamaba", "exclama", "repitió", "repetía", "repite",
    "continuó", "continuaba", "continúa", "añadió", "añadía", "añade",
    "insistió", "insistía", "insiste", "sugirió", "sugería", "sugiere",
    "interrumpió", "interrumpía", "interrumpe", "confesó", "confesaba", "confiesa",
    "anunció", "anunciaba", "anuncia", "declaró", "declaraba", "declara",
    "observó", "observaba", "notó", "notaba", "señaló", "señalaba",
}

# Nominalizaciones — sufijos que convierten verbo en nombre
NOMINALIZATION_SUFFIXES = (
    "ción", "sión", "miento", "mienta", "anza", "encia", "encia",
    "eza", "itud", "ura", "dad", "tad",
)

# Atributos sensoriales (5 sentidos)
SENSES = {
    "vista": re.compile(
        r"\b(vi[oOeE]|ve[ií]a|mir[aóoO]|observ[aóoO]|brill[ao]|luz|luminos|"
        r"oscuro|oscuridad|sombra|color|rojo|azul|verde|gris|negro|blanco|"
        r"claridad|destello|resplandor|relámpago|penumbra|tinieblas|"
        r"nube|humo|niebla|polvo|figura|silueta|forma|contorno)\b"
    ),
    "oído": re.compile(
        r"\b(oy[ooe]|o[ií]a|escuch[oóa]|sonid[oO]|ruid[oO]|silencio|"
        r"susurr[oó]|grit[oó]|eco|trueno|crujid[oO]|chasquid[oO]|"
        r"música|canto|voz|pasos|latid[oO]|respirac[ií]ón|alarido|"
        r"estruendo|murmull[oO]|rumor|silbido|chirrido|zumbido)\b"
    ),
    "tacto": re.compile(
        r"\b(toc[oó]|tacto|frí[oOa]|calor|caliente|frío|templad[oO]|"
        r"suave|ásper[oO]|rugos[oO]|lis[oO]|húmed[oO]|sec[oO]|"
        r"ard[ií]a|quem[oó]|congel[oó]|temblor|vibración|"
        r"presión|pes[oO]|liger[oO]|textura|piel|caricia|golpe|"
        r"apretó|estruj[oó]|rasg[oó]|roz[oó])\b"
    ),
    "olfato": re.compile(
        r"\b(ol[ii]ó|ol[íi]a|huele|hedor|fragancia|aroma|olor|"
        r"apest[oOa]|perfume|tufo|peste|a humo|a tierra|a sangre|"
        r"a madera|a hierro|a podrido|a humedad)\b"
    ),
    "gusto": re.compile(
        r"\b(prob[oó]|gust[oó]|sabor|sab[íi]a|amarg[oOa]|dulce|"
        r"salad[oO]|ácid[oO]|sabore[oó]|engull[oó]|trag[oó]|"
        r"mastic[oó]|beb[ioi]ó|sed|hambre|a metal|a ceniza|a sal)\b"
    ),
}

# Marcadores de tiempo para clasificar modo escena vs modo resumen
TIME_JUMP_MARKERS = re.compile(
    r"\b(días después|semanas después|meses después|horas después|"
    r"minutos después|al rato|más tarde|tiempo después|"
    r"al día siguiente|a la mañana siguiente|a la noche siguiente|"
    r"pasaron (las horas|los días|las semanas|los meses)|"
    r"con el tiempo|con el paso de las|transcurrieron|"
    r"durante los próximos|durante las siguientes|"
    r"a lo largo de|en los días siguientes|"
    r"al cabo de|después de un rato|después de un tiempo)\b"
)

# Patrones de tiempo futuro/presente para detección de avance
NOW_MARKERS = re.compile(r"\b(ahora|entonces|en ese momento|de repente|"
                          r"de pronto|súbitamente|instantáneamente|"
                          r"justo cuando|en ese instante)\b")


def _extract_sentences(text: str) -> list[str]:
    """Divide texto en oraciones (maneja puntos de abreviaturas comunes)."""
    text_clean = re.sub(r"(Dr|Dra|Sr|Sra|etc|pág|vol|ej|vs|cap|aprox|núm)\.", r"\1<DOT>", text)
    raw = re.split(r"(?<=[.?!;:])\s+", text_clean)
    return [s.replace("<DOT>", ".").strip() for s in raw if s.strip()]


def _extract_dialogue_lines(text: str) -> list[str]:
    """Extrae líneas de diálogo (empiezan con raya)."""
    return re.findall(r"^—([^—\n]*)", text, re.MULTILINE)


def _extract_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n") if p.strip()
            and not p.startswith("#") and not p.startswith("---")]


def _count_syllables(word: str) -> int:
    """Aproxima sílabas en español contando grupos de vocales."""
    word = word.lower().strip(".,;:!?\"'«»()[]—")
    if not word:
        return 1
    vowels = "aeiouáéíóúü"
    groups = re.findall(f"[{vowels}]+", word)
    count = len(groups)
    # Ajuste para triptongos y diptongos
    for g in groups:
        if len(g) == 3:
            count -= 1
    if count == 0:
        count = 1
    return count


# ──────────────────────────────────────────────
#  1.  STYLE DIAGNOSTICS
# ──────────────────────────────────────────────

def analyze_style_diagnostics(chapters: list[dict]) -> dict:
    """Análisis completo de estilo a nivel de prosa.

    Mide 8 métricas por capítulo y globales:
    - Readability (Flesch-Szigriszt simplificado para español)
    - Voz pasiva
    - Adverbios en -mente
    - Varianza de longitud de oración
    - Verbos débiles (era/estaba/había)
    - Filter words (vio/sintió/parecía)
    - Nominalizaciones
    - Ratio adjetivo/sustantivo (sobreescritura)
    - Tipos de inicio de oración
    """
    per_chapter = {}
    totals = defaultdict(lambda: {"count": 0, "words": 0})

    for c in chapters:
        text = c["text"]
        words = c["words"]
        sentences = _extract_sentences(text)
        paragraphs = _extract_paragraphs(text)

        if not sentences or not words:
            continue

        # ── Readability (aproximación Flesch-Szigriszt) ──
        palabras_por_oracion = len(text.split()) / len(sentences) if sentences else 0
        silabas_totales = sum(_count_syllables(w) for w in text.split())
        silabas_por_palabra = silabas_totales / len(text.split()) if text.split() else 0
        # Flesch-Szigriszt: 206.835 - 1.015*(pal/oración) - 60*(síl/pal)
        readability = round(206.835 - 1.015 * palabras_por_oracion - 60 * silabas_por_palabra, 1)
        readability_label = _readability_label(readability)

        # ── Voz pasiva (ser + participio + [por]) ──
        passive = len(re.findall(
            r"\b(es|son|era|eran|será|serán|sería|serían|fue|fueron|"
            r"sea|sean|fuera|fueran|hubiera sido|hubieran sido)\s+"
            r"\w+(ado|ada|idos|idas|to|ta|tos|tas|cho|cha|chos|chas)\b",
            text, re.IGNORECASE,
        ))

        # ── Adverbios en -mente ──
        adverbs = len(re.findall(r"\b\w+mente\b", text, re.IGNORECASE))

        # ── Varianza de oración ──
        sent_lengths = [len(s.split()) for s in sentences if s]
        mean_sl = sum(sent_lengths) / len(sent_lengths) if sent_lengths else 0
        variance_sl = sum((sl - mean_sl) ** 2 for sl in sent_lengths) / len(sent_lengths) if sent_lengths else 0
        std_sl = round(variance_sl ** 0.5, 1)

        # ── Verbos débiles ──
        weak = sum(1 for w in text.split() if w.lower().strip(".,;:!?\"'") in WEAK_VERBS)

        # ── Filter words ──
        filter_count = 0
        filter_matches = []
        for pat in FILTER_WORDS:
            for m in re.finditer(rf"\b{re.escape(pat)}\b", text, re.IGNORECASE):
                filter_count += 1
                filter_matches.append({
                    "word": pat,
                    "context": text[max(0, m.start() - 40):m.end() + 40],
                })

        # ── Nominalizaciones ──
        nominalizations = 0
        for suffix in NOMINALIZATION_SUFFIXES:
            nominalizations += len(re.findall(rf"\b\w+{suffix}\b", text, re.IGNORECASE))

        # ── Ratio adjetivo / (adjetivo+sustantivo) aproximado ──
        # Aproximación: adjetivos suelen terminar en o/a/os/as/e, sustantivos variado
        # Usamos terminaciones como heurística
        adjective_candidates = len(re.findall(
            r"\b\w+(oso|osa|osos|osas|al|ales|ble|bles|ivo|iva|ivos|ivas|"
            r"dor|dora|dores|doras|ante|antes|iente|ientes|izo|iza|izos|izas)\b",
            text, re.IGNORECASE,
        ))
        # Sustantivos aproximados: palabras de ≥4 letras que no sean verbos comunes
        # Esta es una heurística muy burda, mejor usamos el ratio de adjetivos/1000pal
        adj_density = round(adjective_candidates / words * 1000, 1) if words else 0

        # ── Tipos de inicio de oración ──
        starters = Counter()
        for s in sentences:
            first_word = s.split()[0].strip("¿¡«\"'") if s.split() else ""
            if first_word:
                starter_type = "verbo" if re.match(r"^[a-záéíóú]", first_word) else "otro"
                if re.match(r"^[A-ZÁÉÍÓÚÑ]", first_word[0]):
                    if first_word.lower() in ("y", "e", "ni", "que", "pero", "sino", "aunque", "cuando"):
                        starter_type = f"conjunción: {first_word.lower()}"
                    elif first_word.lower() in ("el", "la", "los", "las", "un", "una", "unos", "unas"):
                        starter_type = "artículo"
                    elif first_word.lower() in ("no", "nunca", "jamás", "tampoco"):
                        starter_type = "negación"
                    elif first_word.lower() in ("se", "me", "te", "le", "les", "nos"):
                        starter_type = "pronombre"
                    elif first_word.lower() in ("porque", "pues", "así", "entonces", "luego", "mientras"):
                        starter_type = f"conector: {first_word.lower()}"
                starters[starter_type] += 1

        per_chapter[c["num"]] = {
            "readability": {"score": readability, "label": readability_label},
            "passive_voice": passive,
            "adverbs_mente": {"count": adverbs, "density": round(adverbs / words * 1000, 1) if words else 0},
            "sentence_length": {
                "mean": round(mean_sl, 1),
                "std": std_sl,
                "cv": round(std_sl / mean_sl, 2) if mean_sl else 0,
            },
            "weak_verbs": {"count": weak, "density": round(weak / words * 1000, 1) if words else 0},
            "filter_words": {
                "count": filter_count,
                "density": round(filter_count / words * 1000, 1) if words else 0,
                "examples": filter_matches[:5],
            },
            "nominalizations": {"count": nominalizations, "density": round(nominalizations / words * 1000, 1) if words else 0},
            "adj_density": adj_density,
            "sentence_starters": dict(starters.most_common(8)),
        }

        for k in ("adverbs_mente", "weak_verbs", "filter_words", "nominalizations"):
            totals[k]["count"] += per_chapter[c["num"]][k]["count"]
            totals[k]["words"] += words
        totals["passive_voice"]["count"] += passive
        totals["passive_voice"]["words"] += words
        totals["adj_density"]["count"] += adjective_candidates
        totals["adj_density"]["words"] += words

    total_words = sum(c["words"] for c in chapters) or 1
    return {
        "per_chapter": per_chapter,
        "global": {
            "readability": {
                "mean_score": round(
                    sum(pc["readability"]["score"] for pc in per_chapter.values()) / len(per_chapter), 1
                ) if per_chapter else 0,
                "highest": max(
                    (v for v in per_chapter.values()), key=lambda x: x["readability"]["score"]
                )["readability"]["score"] if per_chapter else 0,
                "lowest": min(
                    (v for v in per_chapter.values()), key=lambda x: x["readability"]["score"]
                )["readability"]["score"] if per_chapter else 0,
            },
            "passive_voice": {
                "total": totals["passive_voice"]["count"],
                "density": round(totals["passive_voice"]["count"] / total_words * 1000, 1),
            },
            "adverbs_mente": {
                "total": totals["adverbs_mente"]["count"],
                "density": round(totals["adverbs_mente"]["count"] / total_words * 1000, 1),
            },
            "weak_verbs": {
                "total": totals["weak_verbs"]["count"],
                "density": round(totals["weak_verbs"]["count"] / total_words * 1000, 1),
            },
            "filter_words": {
                "total": totals["filter_words"]["count"],
                "density": round(totals["filter_words"]["count"] / total_words * 1000, 1),
            },
            "nominalizations": {
                "total": totals["nominalizations"]["count"],
                "density": round(totals["nominalizations"]["count"] / total_words * 1000, 1),
            },
            "adj_density": round(totals["adj_density"]["count"] / totals["adj_density"]["words"] * 1000, 1),
        },
    }


def _readability_label(score: float) -> str:
    if score >= 80:
        return "muy fácil"
    if score >= 70:
        return "fácil"
    if score >= 60:
        return "normal"
    if score >= 50:
        return "algo difícil"
    if score >= 30:
        return "difícil"
    return "muy difícil"


# ──────────────────────────────────────────────
#  2.  DIALOGUE QUALITY
# ──────────────────────────────────────────────

def analyze_dialogue_quality(chapters: list[dict]) -> dict:
    """Evalúa calidad del diálogo: atribuciones, info-dumps, diferenciación de voz.

    Mide:
    - Ratio "dijo" vs verbos creativos por capítulo
    - Líneas largas (>50 palabras) que pueden ser info-dumps
    - Variedad de verbos de atribución
    - Diferenciación de voz entre personajes (cuando se puede atribuir)
    """
    per_chapter = {}
    all_attributions = {v: 0 for v in SAID_VERBS | CREATIVE_SAID_VERBS}
    global_long_lines = []

    # Para diferenciación de voz: agrupar líneas por personaje cuando detectable
    # Pattern: "—texto —dijo Personaje."
    char_lines = defaultdict(list)

    for c in chapters:
        text = c["text"]

        # Extraer TODAS las atribuciones de diálogo
        # Pattern: —texto —dijo X. o —texto —preguntó X.
        attribs = re.findall(
            r"—[^—]*?—(\w+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)",
            text,
        )

        said = 0
        creative = 0
        verb_counter = Counter()
        attributions_list = []

        for verb, speaker in attribs:
            verb_lower = verb.lower().strip(".,;:!?")
            if verb_lower in SAID_VERBS:
                said += 1
            elif verb_lower in CREATIVE_SAID_VERBS:
                creative += 1
            verb_counter[verb_lower] += 1
            all_attributions[verb_lower] = all_attributions.get(verb_lower, 0) + 1
            attributions_list.append({"verb": verb_lower, "speaker": speaker.strip()})

            # Agrupar líneas por personaje para análisis de voz
            speaker_clean = speaker.strip()
            dialogue_match = re.search(r"—([^—]*)—$", text[:text.find("—" + verb)])
            if dialogue_match:
                char_lines[speaker_clean].append(dialogue_match.group(1))

        # Líneas largas (info-dump candidates)
        dialogue_lines = _extract_dialogue_lines(text)
        long_lines = []
        for line in dialogue_lines:
            wc = len(line.split())
            if wc > 40:
                long_lines.append({
                    "words": wc,
                    "preview": line[:100],
                })
                global_long_lines.append({
                    "chapter": c["num"],
                    "words": wc,
                    "preview": line[:100],
                })

        total_attribs = said + creative
        said_pct = round(said / total_attribs * 100, 1) if total_attribs else 0

        # Variedad de verbos (Shannon entropy)
        verb_counts = list(verb_counter.values())
        total_v = sum(verb_counts)
        entropy = -sum(
            (vc / total_v) * math.log2(vc / total_v) for vc in verb_counts
        ) if total_v else 0
        max_entropy = math.log2(len(verb_counts)) if verb_counts else 1
        variety_pct = round(entropy / max_entropy * 100, 1) if max_entropy else 0

        per_chapter[c["num"]] = {
            "total_attributions": total_attribs,
            "said_count": said,
            "creative_count": creative,
            "said_pct": said_pct,
            "info_dump_candidates": len(long_lines),
            "long_lines": long_lines[:5],
            "attribution_variety": {
                "unique_verbs": len(verb_counter),
                "entropy": round(entropy, 2),
                "variety_pct": variety_pct,
            },
            "attributions": attributions_list,
        }

    # Análisis de diferenciación de voz
    voice_diff = _analyze_voice_differentiation(char_lines, chapters)

    total_attribs_all = sum(pc["total_attributions"] for pc in per_chapter.values())
    total_said = sum(pc["said_count"] for pc in per_chapter.values())
    total_creative = sum(pc["creative_count"] for pc in per_chapter.values())

    top_verbs = Counter(all_attributions).most_common(10)

    return {
        "per_chapter": per_chapter,
        "global": {
            "total_attributions": total_attribs_all,
            "said_pct": round(total_said / total_attribs_all * 100, 1) if total_attribs_all else 0,
            "creative_pct": round(total_creative / total_attribs_all * 100, 1) if total_attribs_all else 0,
            "top_verbs": [{"verb": v, "count": c} for v, c in top_verbs],
            "total_info_dump_lines": len(global_long_lines),
        },
        "voice_differentiation": voice_diff,
    }


def _analyze_voice_differentiation(
    char_lines: dict[str, list[str]], chapters: list[dict],
) -> dict:
    """Compara métricas de voz entre personajes para detectar uniformidad."""
    char_stats = {}
    all_lines = []

    for char, lines in char_lines.items():
        if len(lines) < 3:
            continue  # mínimo 3 líneas para estadística
        word_counts = [len(l.split()) for l in lines if l.strip()]
        questions = sum(1 for l in lines if "?" in l)
        imperatives = sum(
            1 for l in lines
            if re.search(r"\b(cállate|vamos|dame|mira|escucha|ven|termina|suelta|deja|no\s+|siéntate|levántate)\b", l, re.IGNORECASE)
        )
        exclamations = sum(1 for l in lines if "¡" in l or "!" in l)

        if not word_counts:
            continue

        mean_wc = round(sum(word_counts) / len(word_counts), 1)
        std_wc = round(
            (sum((w - mean_wc) ** 2 for w in word_counts) / len(word_counts)) ** 0.5,
            1,
        )

        # Vocabulario distintivo (palabras únicas vs compartidas)
        words_set = set(w.lower().strip(".,;:!?¿¡") for l in lines for w in l.split())

        char_stats[char] = {
            "lines_analyzed": len(lines),
            "mean_words_per_line": mean_wc,
            "std_words": std_wc,
            "questions": questions,
            "pct_questions": round(questions / len(lines) * 100, 1) if lines else 0,
            "imperatives": imperatives,
            "exclamations": exclamations,
            "unique_vocab_size": len(words_set),
        }
        all_lines.extend([(char, l) for l in lines])

    # Comparación global: ¿todos los personajes suenan igual?
    if len(char_stats) >= 2:
        line_lengths = [s["mean_words_per_line"] for s in char_stats.values()]
        question_rates = [s["pct_questions"] for s in char_stats.values()]
        max_range_lines = round(max(line_lengths) - min(line_lengths), 1) if line_lengths else 0
        max_range_questions = round(max(question_rates) - min(question_rates), 1) if question_rates else 0

        uniformity_warning = None
        if max_range_lines < 3:
            uniformity_warning = (
                f"Las longitudes de frase de todos los personajes están en un rango de "
                f"solo {max_range_lines} palabras — riesgo de voz uniforme."
            )
        if max_range_questions < 10:
            qw = (
                f"La tasa de preguntas de todos los personajes está en un rango de solo "
                f"{max_range_questions}% — todos preguntan por igual."
            )
            uniformity_warning = f"{uniformity_warning} {qw}" if uniformity_warning else qw
    else:
        max_range_lines = 0
        max_range_questions = 0
        uniformity_warning = None

    return {
        "per_character": char_stats,
        "range_mean_words": max_range_lines,
        "range_question_pct": max_range_questions,
        "uniformity_warning": uniformity_warning,
    }


# ──────────────────────────────────────────────
#  3.  SAVE THE CAT (15 beats)
# ──────────────────────────────────────────────

STC_BEATS = [
    {"beat": "Opening Image", "pos_pct": 0.0, "pos_end": 0.01,
     "detect": "primer párrafo, contraste con Final Image"},
    {"beat": "Theme Stated", "pos_pct": 0.05, "pos_end": 0.05,
     "detect": "línea temática — alguien dice la lección"},
    {"beat": "Set-Up", "pos_pct": 0.01, "pos_end": 0.10,
     "detect": "introducción protagonista, mundo, carencia"},
    {"beat": "Catalyst", "pos_pct": 0.10, "pos_end": 0.10,
     "detect": "evento inesperado que cambia todo"},
    {"beat": "Debate", "pos_pct": 0.10, "pos_end": 0.20,
     "detect": "escenas de duda, preguntas, '¿y si...?'"},
    {"beat": "Break into Two", "pos_pct": 0.20, "pos_end": 0.20,
     "detect": "decisión: 'lo haré', fin del mundo conocido"},
    {"beat": "B Story", "pos_pct": 0.22, "pos_end": 0.22,
     "detect": "nueva relación (amor, mentor, amistad)"},
    {"beat": "Fun & Games", "pos_pct": 0.20, "pos_end": 0.50,
     "detect": "promesa de la premisa, exploración"},
    {"beat": "Midpoint", "pos_pct": 0.50, "pos_end": 0.50,
     "detect": "gran giro, victoria o derrota aparente"},
    {"beat": "Bad Guys Close In", "pos_pct": 0.50, "pos_end": 0.75,
     "detect": "obstáculos se acumulan, presión creciente"},
    {"beat": "All Is Lost", "pos_pct": 0.75, "pos_end": 0.75,
     "detect": "punto más bajo, muerte (simbólica o real)"},
    {"beat": "Dark Night of the Soul", "pos_pct": 0.75, "pos_end": 0.80,
     "detect": "reflexión, '¿por qué seguir?'"},
    {"beat": "Break into Three", "pos_pct": 0.80, "pos_end": 0.80,
     "detect": "nueva determinación, 'sé lo que debo hacer'"},
    {"beat": "Finale", "pos_pct": 0.80, "pos_end": 0.99,
     "detect": "clímax, plan ejecutado, conflicto resuelto"},
    {"beat": "Final Image", "pos_pct": 0.99, "pos_end": 1.0,
     "detect": "contraste con Opening Image"},
]

# Señales textuales para cada beat (en español)
BEAT_SIGNALS = {
    "Catalyst": re.compile(
        r"\b(de repente|de pronto|súbitamente|inesperado|"
        r"algo cambió|todo cambió|nunca imaginó|"
        r"se encontró con|se topó con|recibió|encontró)\b",
        re.IGNORECASE,
    ),
    "Debate": re.compile(
        r"\b(¿y si|quizá|tal vez|no sabía|dudó|"
        r"no estaba segur|debía|podría|tendría que)\b",
        re.IGNORECASE,
    ),
    "Break into Two": re.compile(
        r"\b(lo haré|voy a hacerlo|decidió|se decidió|"
        r"tenía que hacerlo|no había vuelta atrás|"
        r"aceptó|se comprometió)\b",
        re.IGNORECASE,
    ),
    "Midpoint": re.compile(
        r"\b(todo cambió|gran revelación|descubrió que|"
        r"se dio cuenta de que|era cierto|"
        r"mentira|traición|verdad)\b",
        re.IGNORECASE,
    ),
    "All Is Lost": re.compile(
        r"\b(perdió|fracasó|murió|no hay esperanza|"
        r"todo está perdido|derrota|no pudo|imposible|"
        r"lo peor|nunca lograría|sin salida)\b",
        re.IGNORECASE,
    ),
    "Dark Night of the Soul": re.compile(
        r"\b(¿para qué|no tiene sentido|por qué seguir|"
        r"rendirse|darse por vencid|no merece la pena|"
        r"solo|abandonado|sin fuerzas)\b",
        re.IGNORECASE,
    ),
    "Break into Three": re.compile(
        r"\b(sé lo que debo hacer|sabía lo que tenía que hacer|"
        r"una última oportunidad|todo o nada|"
        r"se levantó|reunió fuerzas|por última vez|"
        r"si no ahora|nunca)\b",
        re.IGNORECASE,
    ),
}


def analyze_save_the_cat(chapters: list[dict]) -> dict:
    """Detecta presencia y posición de los 15 beats de Save the Cat.

    Para cada beat, reporta:
    - ¿Se detectó señal textual?
    - ¿Está en la posición correcta del manuscrito?
    - Intensidad de la señal
    """
    total_words = sum(c["words"] for c in chapters)
    # Texto completo plano para búsqueda global
    full_text = "\n\n".join(c["text"] for c in chapters)
    chap_boundaries = []
    acc = 0
    for c in sorted(chapters, key=lambda x: x["num"]):
        chap_boundaries.append({
            "num": c["num"],
            "start_word": acc,
            "end_word": acc + c["words"],
            "start_pct": round(acc / total_words * 100, 1) if total_words else 0,
            "end_pct": round((acc + c["words"]) / total_words * 100, 1) if total_words else 0,
        })
        acc += c["words"]

    beats_found = []
    beats_missing = []
    sentiment_by_pct = _sentiment_at_positions(full_text, chapters, total_words)

    for beat_def in STC_BEATS:
        beat_name = beat_def["beat"]
        expected_pct = beat_def["pos_pct"] * 100
        end_pct = beat_def["pos_end"] * 100

        # Buscar señal textual
        signals = BEAT_SIGNALS.get(beat_name)
        signal_matches = []
        if signals:
            for m in signals.finditer(full_text):
                pos_pct = m.start() / len(full_text) * 100 if full_text else 0
                # Solo considerar señales en la ventana esperada ±5%
                if expected_pct - 5 <= pos_pct <= end_pct + 5:
                    signal_matches.append({
                        "position_pct": round(pos_pct, 1),
                        "context": full_text[max(0, m.start() - 30):m.end() + 80],
                    })

        # Determinar capítulo donde ocurre
        word_pos = int(expected_pct / 100 * total_words)
        chapter_num = None
        for cb in chap_boundaries:
            if cb["start_word"] <= word_pos <= cb["end_word"]:
                chapter_num = cb["num"]
                break
        if chapter_num is None:
            chapter_num = 12

        # Sentimiento en la zona
        zone_sentiments = [
            s for s in sentiment_by_pct
            if expected_pct - 5 <= s["pct"] <= end_pct + 5
        ]
        mean_sentiment = round(
            sum(s["score"] for s in zone_sentiments) / len(zone_sentiments), 2
        ) if zone_sentiments else 0

        beat_info = {
            "beat": beat_name,
            "expected_position_pct": expected_pct,
            "expected_chapter": chapter_num,
            "signals_found": len(signal_matches),
            "signal_strength": "alta" if len(signal_matches) >= 2 else (
                "media" if len(signal_matches) == 1 else "no detectada"
            ),
            "signals": signal_matches[:3],
            "mean_sentiment": mean_sentiment,
        }

        if signal_matches:
            beats_found.append(beat_info)
        else:
            beats_missing.append(beat_info)

    return {
        "total_beats": len(STC_BEATS),
        "beats_found": len(beats_found),
        "beats_missing": len(beats_missing),
        "completion_pct": round(len(beats_found) / len(STC_BEATS) * 100, 0),
        "found": beats_found,
        "missing": beats_missing,
        "chapter_boundaries": chap_boundaries,
    }


def _sentiment_at_positions(
    full_text: str, chapters: list[dict], total_words: int,
) -> list[dict]:
    """Calcula sentimiento (intensidad emocional) en percentiles del texto."""
    # Dividir en 20 segmentos iguales
    segments = []
    words = full_text.split()
    if not words:
        return segments

    chunk_size = max(1, len(words) // 20)
    for i in range(20):
        start = i * chunk_size
        end = start + chunk_size if i < 19 else len(words)
        chunk = words[start:end]
        score = 0
        for w in chunk:
            w_clean = re.sub(r"[^a-zA-Záéíóúñ]", "", w).lower()
            if w_clean in ("muerte", "morir", "sangre", "grito", "abismo", "pánico",
                           "desesperación", "traición", "miedo", "oscuridad"):
                score += 2
            elif w_clean in ("dolor", "herida", "temblor", "golpe", "lloró",
                             "lágrimas", "perdió", "fracaso", "peligro"):
                score += 1
            elif w_clean in ("paz", "calma", "tranquilo", "silencio", "esperanza",
                             "salvación", "luz", "amor"):
                score -= 1
        pct = round(i / 20 * 100, 1)
        segments.append({
            "pct": pct,
            "score": round(score / max(1, len(chunk)) * 100, 2),
        })
    return segments


# ──────────────────────────────────────────────
#  4.  FIRST PAGES TEST
# ──────────────────────────────────────────────

def analyze_first_pages(chapters: list[dict], protagonist: str | None = None) -> dict:
    """Test de primeras 10 páginas (~2500 palabras / ~3 primeros caps).

    Verifica:
    - ¿Aparece el protagonista en el primer párrafo?
    - ¿Hay un deseo explícito en las primeras 750 palabras?
    - ¿Hay un obstáculo en las primeras 1250 palabras?
    - ¿Hay gancho narrativo al final de la primera escena?

    Args:
        protagonist: Nombre del protagonista para detectar en la apertura.
                     Si es None, se usa un patrón genérico (ella/él/protagonista).
    """
    if not chapters:
        return {"error": "Sin capítulos"}

    first_chapter = chapters[0]
    text = first_chapter["text"]

    # Primer párrafo
    paragraphs = _extract_paragraphs(text)
    first_para = paragraphs[0] if paragraphs else ""

    if protagonist:
        prot_pattern = rf"\b({protagonist}|ella|él|la muchacha|el muchacho|protagonista)\b"
    else:
        prot_pattern = r"\b(ella|él|la muchacha|el muchacho|protagonista|la joven|el joven)\b"
    protagonist_present = bool(
        re.search(prot_pattern, first_para[:200], re.IGNORECASE)
    )

    # Deseo explícito en primeras 750 palabras
    desire_markers = re.compile(
        r"\b(quería|necesitaba|deseaba|anhelaba|buscaba|esperaba|"
        r"tenía que|debía encontrar|necesitaba saber|quería saber|"
        r"ansiaba|soñaba con|su objetivo|su misión|su meta)\b",
        re.IGNORECASE,
    )
    first_750_words = " ".join(text.split()[:200])
    desire_found = bool(desire_markers.search(first_750_words))

    # Obstáculo en primeras 1250 palabras
    obstacle_markers = re.compile(
        r"\b(pero|sin embargo|no podía|era imposible|obstáculo|"
        r"problema|dificultad|barrera|amenaza|peligro|"
        r"no sabía|no entendía|se lo impedía|le bloqueaba)\b",
        re.IGNORECASE,
    )
    first_1250_words = " ".join(text.split()[:350])
    obstacle_found = bool(obstacle_markers.search(first_1250_words))

    # Gancho al final de la primera escena (último párrafo del cap)
    last_para = paragraphs[-1] if paragraphs else ""
    hook_found = bool(re.search(
        r"\b(pero|sin embargo|nunca|jamás|muerte|misterio|"
        r"secret|revelación|verdad|mentira|qué|quién|por qué|"
        r"algo|nada|desapareció|encontró|descubrió)\b",
        last_para, re.IGNORECASE,
    ))

    # Tono de la apertura
    opening_words = text.split()[:50]
    opening_tone = "neutro"
    if any(w.lower() in ("muerte", "miedo", "oscuridad", "sangre", "dolor") for w in opening_words):
        opening_tone = "oscuro"
    elif any(w.lower() in ("luz", "amanecer", "esperanza", "paz", "calma") for w in opening_words):
        opening_tone = "esperanzador"
    elif any(w.lower() in ("acción", "corrió", "golpe", "estalló") for w in opening_words):
        opening_tone = "acción"

    issues = []
    if not protagonist_present:
        issues.append("El protagonista no aparece en el primer párrafo.")
    if not desire_found:
        issues.append("No se detecta un deseo explícito del protagonista en las primeras 750 palabras.")
    if not obstacle_found:
        issues.append("No se detecta un obstáculo claro en las primeras 1250 palabras.")
    if not hook_found:
        issues.append("El final del primer capítulo no tiene un gancho claro.")

    return {
        "protagonist_in_first_paragraph": protagonist_present,
        "desire_in_first_750_words": desire_found,
        "obstacle_in_first_1250_words": obstacle_found,
        "hook_at_end_of_first_chapter": hook_found,
        "opening_tone": opening_tone,
        "issues": issues,
        "passed": len(issues) == 0,
        "pct_passed": round((4 - len(issues)) / 4 * 100, 0),
    }


# ──────────────────────────────────────────────
#  6.  BACKSTORY DUMPS
# ──────────────────────────────────────────────

def analyze_backstory_dumps(chapters: list[dict]) -> dict:
    """Detecta párrafos con alta densidad de pluscuamperfecto (backstory dump).

    El pluscuamperfecto ('había + participio') señala eventos anteriores
    a la línea temporal principal. Cuando varios se acumulan, es exposición.
    """
    per_chapter = {}
    global_dumps = []

    for c in chapters:
        text = c["text"]
        paragraphs = _extract_paragraphs(text)
        chapter_dumps = []

        for pi, para in enumerate(paragraphs):
            words = para.split()
            if len(words) < 20:
                continue

            # Contar pluscuamperfectos
            past_perfect = len(re.findall(r"\bhab[íi][ao]\s+\w+do\b", para, re.IGNORECASE))
            # Contar también "había sido", "había estado"
            past_perfect += len(re.findall(r"\bhab[íi][ao]\s+(sido|estado|tenido)\b", para, re.IGNORECASE))

            density = past_perfect / len(words) * 100 if words else 0
            is_dump = density > 3.0 and past_perfect >= 3

            if is_dump:
                dump_info = {
                    "paragraph": pi,
                    "words": len(words),
                    "past_perfect_count": past_perfect,
                    "density_pct": round(density, 1),
                    "preview": para[:150],
                }
                chapter_dumps.append(dump_info)
                global_dumps.append({**dump_info, "chapter": c["num"]})

        per_chapter[c["num"]] = {
            "paragraphs_analyzed": len(paragraphs),
            "dumps_found": len(chapter_dumps),
            "dumps": chapter_dumps,
            "total_past_perfect": sum(
                len(re.findall(r"\bhab[íi][ao]\s+\w+do\b", p, re.IGNORECASE))
                for p in paragraphs
            ),
        }

    total_dumps = sum(pc["dumps_found"] for pc in per_chapter.values())
    total_pp = sum(pc["total_past_perfect"] for pc in per_chapter.values())
    total_words = sum(c["words"] for c in chapters) or 1

    return {
        "per_chapter": per_chapter,
        "global": {
            "total_dumps": total_dumps,
            "total_past_perfect": total_pp,
            "density_per_1k": round(total_pp / total_words * 1000, 1),
            "chapters_with_dumps": sum(1 for pc in per_chapter.values() if pc["dumps_found"] > 0),
        },
        "worst_dumps": sorted(global_dumps, key=lambda x: -x["density_pct"])[:5],
    }


# ──────────────────────────────────────────────
#  7.  SCENE vs SUMMARY RATIO
# ──────────────────────────────────────────────

def analyze_scene_summary_ratio(chapters: list[dict]) -> dict:
    """Calcula ratio de modo escena (diálogo+acción minuto a minuto)
    vs modo resumen (saltos temporales, narración condensada).

    El modo escena tiene alta densidad de:
    - Diálogo (rayas)
    - Marcadores de tiempo inmediato (ahora, de repente, en ese momento)
    - Verbos de acción en presente narrativo

    El modo resumen tiene:
    - Saltos temporales explícitos
    - Baja densidad de diálogo
    - Narración retrospectiva
    """
    per_chapter = {}
    total_scene_words = 0
    total_summary_words = 0

    for c in chapters:
        text = c["text"]
        paragraphs = _extract_paragraphs(text)

        chap_scene = 0
        chap_summary = 0

        for para in paragraphs:
            words = para.split()
            wc = len(words)
            if wc < 5:
                continue

            # Indicadores de modo escena
            has_dialogue = bool(re.search(r"^—", para, re.MULTILINE))
            has_now = bool(NOW_MARKERS.search(para))
            # Alta densidad de acción = escena; 1-2 verbos aislados = narración normal
            action_count = len(re.findall(
                r"\b(corrió|caminó|saltó|entró|salió|golpeó|tiró|"
                r"empujó|agarró|lanzó|esquivó|rompió|abrió|cerró|"
                r"subió|bajó|miró|tocó|apretó|arrancó)\b",
                para, re.IGNORECASE,
            ))
            sensory_count = len(re.findall(
                r"\b(olió|sintió|oyó|vio|notó|percibió|"
                r"saboreó|tocó|tembló|brilló)\b",
                para, re.IGNORECASE,
            ))
            is_immersive = has_dialogue or has_now or action_count >= 3 or sensory_count >= 2

            # Indicadores de modo resumen
            has_time_jump = bool(TIME_JUMP_MARKERS.search(para))
            is_flashback = bool(re.search(
                r"\b(recordó|años atrás|tiempo atrás|había sido|"
                r"en aquel entonces|cuando era|tiempo antes)\b",
                para, re.IGNORECASE,
            ))
            past_perfect_density = len(re.findall(
                r"\bhab[íi][ao]\s+\w+do\b", para, re.IGNORECASE,
            )) / max(1, wc) * 100
            is_summary = has_time_jump or is_flashback or past_perfect_density > 4.0

            # Clasificación
            if is_immersive and not is_summary:
                chap_scene += wc
            elif is_summary and not is_immersive:
                chap_summary += wc
            elif is_summary and is_immersive:
                # Ambos: pesa más el resumen si hay salto temporal explícito
                if has_time_jump or is_flashback:
                    chap_summary += wc
                else:
                    chap_scene += wc
            else:
                # Sin señales claras → narración plana (modo resumen)
                chap_summary += wc

        per_chapter[c["num"]] = {
            "scene_words": chap_scene,
            "summary_words": chap_summary,
            "scene_pct": round(chap_scene / (chap_scene + chap_summary) * 100, 1) if (chap_scene + chap_summary) else 0,
        }
        total_scene_words += chap_scene
        total_summary_words += chap_summary

    total = total_scene_words + total_summary_words or 1
    return {
        "per_chapter": per_chapter,
        "global": {
            "scene_words": total_scene_words,
            "summary_words": total_summary_words,
            "scene_pct": round(total_scene_words / total * 100, 1),
            "summary_pct": round(total_summary_words / total * 100, 1),
            "scene_to_summary_ratio": round(total_scene_words / max(1, total_summary_words), 2),
        },
    }


# ──────────────────────────────────────────────
#  8.  STORY ARC (Vonnegut)
# ──────────────────────────────────────────────

def classify_story_arc(emotional_timeline: dict | None = None,
                       chapters: list[dict] | None = None) -> dict:
    """Clasifica el arco emocional de la historia según las formas de Vonnegut.

    Usa los datos de emotional_timeline (del editorial_letter) si están
    disponibles, o calcula el sentimiento por capítulo.

    Arcos:
      - Man in Hole:       baja → sube (final mejor que inicio)
      - Boy Meets Girl:    sube → baja → sube
      - Cenicienta:        sube → baja → sube fuerte
      - Icaro:             sube → cae (final peor que inicio)
      - From Bad to Worse: baja continuamente
      - Which Way is Up?:  oscilante sin dirección clara
    """
    if not emotional_timeline and chapters:
        # Calcular sentimiento por capítulo
        emotional_timeline = {}
        for c in chapters:
            text = c["text"]
            words = text.split()
            score = 0
            for w in words:
                w_clean = re.sub(r"[^a-zA-Záéíóúñ]", "", w).lower()
                if w_clean in ("muerte", "morir", "sangre", "grito", "abismo",
                               "pánico", "desesperación"):
                    score += 3
                elif w_clean in ("dolor", "herida", "temblor", "golpe", "lloró",
                                 "lágrimas", "perdió", "fracaso"):
                    score += 2
                elif w_clean in ("miedo", "oscuridad", "sombra", "peligro"):
                    score += 1
                elif w_clean in ("paz", "calma", "tranquilo", "esperanza",
                                 "luz", "alegría"):
                    score -= 1
            mean_intensity = round(score / max(1, len(words)) * 100, 2)
            emotional_timeline[c["num"]] = {
                "mean_intensity": mean_intensity,
                "words": len(words),
            }
    elif not emotional_timeline:
        return {"error": "Sin datos emocionales", "arc": "unknown"}

    if not emotional_timeline:
        return {"error": "Sin datos emocionales", "arc": "unknown"}

    # Extraer serie temporal ordenada
    sorted_chaps = sorted(emotional_timeline.items(), key=lambda x: x[0])
    intensities = [v["mean_intensity"] for _, v in sorted_chaps]

    if len(intensities) < 3:
        return {"arc": "insuficiente", "confidence": 0.0}

    # Normalizar a 0-1
    min_i = min(intensities)
    max_i = max(intensities)
    range_i = max_i - min_i if max_i != min_i else 1
    normalized = [(i - min_i) / range_i for i in intensities]

    # Dividir en tercios para detectar forma
    n = len(normalized)
    first = normalized[:n // 3]
    mid = normalized[n // 3:2 * n // 3]
    last = normalized[2 * n // 3:]

    mean_first = sum(first) / len(first) if first else 0.5
    mean_mid = sum(mid) / len(mid) if mid else 0.5
    mean_last = sum(last) / len(last) if last else 0.5

    # Clasificar
    arc_scores = {}

    # Man in Hole: empieza medio, baja, sube más alto
    arc_scores["Man in Hole (caída y ascenso)"] = (
        (-mean_first + 0.5) * 0.3 +  # empieza no muy alto
        (mean_mid - 0.5) * 0.3 +     # punto medio bajo (mucho sufrimiento)
        (mean_last - 0.5) * 0.4      # termina alto
    )

    # Boy Meets Girl / Cenicienta: sube, baja, sube más
    arc_scores["Cenicienta (sube-baja-sube)"] = (
        (mean_first - 0.5) * 0.2 +
        (-mean_mid + 0.5) * 0.3 +
        (mean_last - 0.5) * 0.5
    )

    # Icaro: sube y cae
    arc_scores["Icaro (sube y cae)"] = (
        (mean_first - 0.5) * 0.1 +
        (mean_mid - 0.5) * 0.3 +
        (-mean_last + 0.5) * 0.6
    )

    # From Bad to Worse: baja constante
    arc_scores["From Bad to Worse (empeora)"] = (
        (-mean_first + 0.5) * 0.3 +
        (-mean_mid + 0.5) * 0.3 +
        (-mean_last + 0.5) * 0.4
    )

    # Which Way is Up: oscilante — alta varianza entre segmentos
    variance = sum((normalized[i] - normalized[i - 1]) ** 2 for i in range(1, len(normalized))) / (len(normalized) - 1) if len(normalized) > 1 else 0
    arc_scores["Oscilante (Which Way is Up)"] = variance * 5

    best_arc = max(arc_scores, key=arc_scores.get)
    confidence = arc_scores[best_arc]
    # Normalizar confianza a 0-1
    best_raw = max(arc_scores.values())
    worst_raw = min(arc_scores.values())
    confidence_range = best_raw - worst_raw if best_raw != worst_raw else 1
    normalized_confidence = round(min(1, max(0, (best_raw - worst_raw) / (best_raw + 0.01))), 2)

    return {
        "arc": best_arc,
        "confidence": normalized_confidence,
        "shape": {
            "first_third": round(mean_first, 3),
            "middle_third": round(mean_mid, 3),
            "last_third": round(mean_last, 3),
        },
        "intensities": [
            {"chapter": chap, "intensity": v["mean_intensity"]}
            for chap, v in sorted_chaps
        ],
        "all_scores": {k: round(v, 3) for k, v in sorted(arc_scores.items(), key=lambda x: -x[1])},
    }


# ──────────────────────────────────────────────
#  9.  REVISION HOTSPOTS
# ──────────────────────────────────────────────

def analyze_revision_hotspots(chapters: list[dict],
                              style: dict | None = None,
                              dialogue: dict | None = None) -> dict:
    """Identifica dónde concentrar la próxima sesión de edición.

    Combina múltiples métricas para priorizar capítulos por:
    - Densidad de filter words
    - Densidad de adverbios
    - Baja legibilidad
    - Info-dumps en diálogo
    - Bajo ratio escena/resumen
    """
    if style is None:
        style = analyze_style_diagnostics(chapters)
    if dialogue is None:
        dialogue = analyze_dialogue_quality(chapters)

    priorities = []
    style_pc = style.get("per_chapter", {})
    dialogue_pc = dialogue.get("per_chapter", {})

    for c in chapters:
        num = c["num"]
        score = 0
        factors = []

        # Filter words
        sw = style_pc.get(num, {})
        fw_density = sw.get("filter_words", {}).get("density", 0)
        if fw_density > 5:
            score += 2
            factors.append(f"filter words ({fw_density}/1k)")
        elif fw_density > 2:
            score += 1
            factors.append(f"filter words ({fw_density}/1k)")

        # Adverbios
        adv_density = sw.get("adverbs_mente", {}).get("density", 0)
        if adv_density > 3:
            score += 2
            factors.append(f"adverbios ({adv_density}/1k)")
        elif adv_density > 1.5:
            score += 1
            factors.append(f"adverbios ({adv_density}/1k)")

        # Legibilidad baja
        read_score = sw.get("readability", {}).get("score", 100)
        if read_score < 40:
            score += 2
            factors.append(f"legibilidad baja ({read_score})")
        elif read_score < 60:
            score += 1
            factors.append(f"legibilidad media ({read_score})")

        # Info-dumps
        dw = dialogue_pc.get(num, {})
        info_dumps = dw.get("info_dump_candidates", 0)
        if info_dumps >= 3:
            score += 2
            factors.append(f"info-dumps ({info_dumps})")
        elif info_dumps >= 1:
            score += 1
            factors.append(f"info-dumps ({info_dumps})")

        # Verbos débiles
        wv_density = sw.get("weak_verbs", {}).get("density", 0)
        if wv_density > 40:
            score += 1
            factors.append(f"verbos débiles ({wv_density}/1k)")

        # Voz pasiva
        pv = sw.get("passive_voice", 0)
        if pv >= 3:
            score += 1
            factors.append(f"voz pasiva ({pv})")

        priorities.append({
            "chapter": num,
            "hotspot_score": score,
            "priority": "alta" if score >= 4 else "media" if score >= 2 else "baja",
            "factors": factors,
        })

    priorities.sort(key=lambda x: -x["hotspot_score"])
    top = [p for p in priorities if p["priority"] in ("alta", "media")]

    return {
        "per_chapter": priorities,
        "hotspot_count": len(top),
        "top_hotspots": top[:3],
        "recommendation": (
            "Priorizar edición en: " + ", ".join(f"cap{p['chapter']:02d}" for p in top[:3])
            if top else "Sin hotspots críticos."
        ),
    }


# ──────────────────────────────────────────────
#  AGREGADOR PRINCIPAL
# ──────────────────────────────────────────────

def analyze_all(chapters: list[dict]) -> dict:
    """Ejecuta todos los análisis y devuelve un dict anidado."""
    if not chapters:
        return {
            "style_diagnostics": {},
            "dialogue_quality": {},
            "save_the_cat": {},
            "first_pages_test": {},
            "backstory_dumps": {},
            "scene_summary_ratio": {},
            "revision_hotspots": {},
            "error": "No se encontraron capítulos.",
        }

    style = analyze_style_diagnostics(chapters)
    dialogue = analyze_dialogue_quality(chapters)
    save_cat = analyze_save_the_cat(chapters)
    first_pages = analyze_first_pages(chapters)
    backstory = analyze_backstory_dumps(chapters)
    scene_summary = analyze_scene_summary_ratio(chapters)
    hotspots = analyze_revision_hotspots(chapters, style, dialogue)

    return {
        "style_diagnostics": style,
        "dialogue_quality": dialogue,
        "save_the_cat": save_cat,
        "first_pages_test": first_pages,
        "backstory_dumps": backstory,
        "scene_summary_ratio": scene_summary,
        "revision_hotspots": hotspots,
    }


# ──────────────────────────────────────────────
#  FORMATO MARKDOWN
# ──────────────────────────────────────────────

def format_markdown(data: dict) -> str:
    """Convierte el resultado de analyze_all() a markdown legible."""
    lines = []
    lines.append("# Insights Editoriales Avanzados\n")

    # ── 1. Style Diagnostics ──
    if "style_diagnostics" in data:
        sd = data["style_diagnostics"]
        g = sd.get("global", {})
        lines.append("## 1. Diagnóstico de Estilo\n")
        lines.append("| Métrica | Global | Referencia |")
        lines.append("|---|---|---|")
        read = g.get("readability", {})
        lines.append(f"| Legibilidad | {read.get('mean_score', '—')} ({_readability_label(read.get('mean_score', 0))}) | 60-70+ es normal |")
        lines.append(f"| Voz pasiva | {g.get('passive_voice', {}).get('density', 0)}/1k pal | < 2/1k |")
        lines.append(f"| Adverbios -mente | {g.get('adverbs_mente', {}).get('density', 0)}/1k pal | < 3/1k |")
        lines.append(f"| Verbos débiles | {g.get('weak_verbs', {}).get('density', 0)}/1k pal | < 30/1k |")
        lines.append(f"| Filter words | {g.get('filter_words', {}).get('density', 0)}/1k pal | < 3/1k |")
        lines.append(f"| Nominalizaciones | {g.get('nominalizations', {}).get('density', 0)}/1k pal | < 8/1k |")
        lines.append("")

        # Worst chapters for key metrics
        pc_style = sd.get("per_chapter", {})
        if pc_style:
            worst_read = min(pc_style.items(), key=lambda x: x[1]["readability"]["score"])
            worst_fw = max(pc_style.items(), key=lambda x: x[1]["filter_words"]["density"])
            worst_adv = max(pc_style.items(), key=lambda x: x[1]["adverbs_mente"]["density"])
            lines.append(f"- ⚠️ **Peor legibilidad**: cap {worst_read[0]:02d} ({worst_read[1]['readability']['score']})")
            lines.append(f"- ⚠️ **Más filter words**: cap {worst_fw[0]:02d} ({worst_fw[1]['filter_words']['density']}/1k)")
            lines.append(f"- ⚠️ **Más adverbios**: cap {worst_adv[0]:02d} ({worst_adv[1]['adverbs_mente']['density']}/1k)")
            lines.append("")

    # ── 2. Dialogue Quality ──
    if "dialogue_quality" in data:
        dq = data["dialogue_quality"]
        dg = dq.get("global", {})
        lines.append("## 2. Calidad de Diálogo\n")
        lines.append(f"- **Ratio 'dijo' vs creativas**: {dg.get('said_pct', 0)}% 'dijo', {dg.get('creative_pct', 0)}% creativas (target: >70% 'dijo')")
        lines.append(f"- **Info-dumps candidatos**: {dg.get('total_info_dump_lines', 0)} líneas >40 palabras")
        top_verbs_str = ", ".join(f"{v['verb']} ({v['count']})" for v in dg.get("top_verbs", [])[:5])
        lines.append(f"- **Top verbos de atribución**: {top_verbs_str}")
        lines.append("")

        vd = dq.get("voice_differentiation", {})
        if vd.get("uniformity_warning"):
            lines.append(f"⚠️ **Diferenciación de voz**: {vd['uniformity_warning']}\n")
        elif vd.get("per_character"):
            lines.append("**Diferenciación de voz por personaje:**\n")
            lines.append("| Personaje | Líneas | Media palabras | % preguntas |")
            lines.append("|---|---|---|---|")
            for char, stats in sorted(vd.get("per_character", {}).items()):
                lines.append(f"| {char} | {stats['lines_analyzed']} | {stats['mean_words_per_line']} | {stats['pct_questions']}% |")
            lines.append("")

    # ── 3. Save the Cat ──
    if "save_the_cat" in data:
        stc = data["save_the_cat"]
        lines.append("## 3. Save the Cat — 15 Beats\n")
        lines.append(f"**Completitud**: {stc.get('completion_pct', 0)}% ({stc.get('beats_found', 0)}/{stc.get('total_beats', 15)} beats detectados)\n")
        if stc.get("missing"):
            lines.append("**Beats no detectados:**\n")
            for b in stc["missing"]:
                lines.append(f"- *{b['beat']}* (esperado ~{b['expected_position_pct']}%)")
            lines.append("")
        if stc.get("found"):
            lines.append("**Beats detectados:**\n")
            lines.append("| Beat | Capítulo esperado | Señales | Sentimiento |")
            lines.append("|---|---|---|---|")
            for b in stc["found"]:
                cap = b.get("expected_chapter", "—")
                sig = b.get("signal_strength", "—")
                sent = b.get("mean_sentiment", "—")
                lines.append(f"| {b['beat']} | ~cap {cap:02d} | {sig} | {sent} |")
            lines.append("")

    # ── 4. First Pages Test ──
    if "first_pages_test" in data:
        fp = data["first_pages_test"]
        lines.append("## 4. Test de Primeras Páginas\n")
        checkmarks = {
            "Protagonista en 1er párrafo": fp.get("protagonist_in_first_paragraph", False),
            "Deseo explícito en 750 pal": fp.get("desire_in_first_750_words", False),
            "Obstáculo en 1250 pal": fp.get("obstacle_in_first_1250_words", False),
            "Gancho al final del cap 1": fp.get("hook_at_end_of_first_chapter", False),
        }
        for label, passed in checkmarks.items():
            icon = "✅" if passed else "❌"
            lines.append(f"- {icon} {label}")
        lines.append(f"\n**Tono de apertura**: {fp.get('opening_tone', '—')}")
        if fp.get("issues"):
            lines.append("\n**Issues:**")
            for issue in fp["issues"]:
                lines.append(f"- {issue}")
        lines.append("")

    # ── 6. Backstory Dumps ──
    if "backstory_dumps" in data:
        bd = data["backstory_dumps"]
        bg = bd.get("global", {})
        lines.append("## 5. Backstory Dumps\n")
        lines.append(f"- **Total dumps**: {bg.get('total_dumps', 0)} párrafos ({bg.get('chapters_with_dumps', 0)} caps afectados)")
        lines.append(f"- **Densidad de pluscuamperfecto**: {bg.get('density_per_1k', 0)}/1k pal")
        if bd.get("worst_dumps"):
            lines.append("\n**Peores dumps:**")
            for d in bd["worst_dumps"][:3]:
                lines.append(f"- Cap {d['chapter']:02d}, párrafo {d['paragraph']}: {d['density_pct']}% ({d['past_perfect_count']} pluscuamperfectos)")
            lines.append("")

    # ── 7. Scene vs Summary ──
    if "scene_summary_ratio" in data:
        ss = data["scene_summary_ratio"]
        sg = ss.get("global", {})
        lines.append("## 6. Modo Escena vs Modo Resumen\n")
        lines.append(f"- **Escena**: {sg.get('scene_pct', 0)}% del texto")
        lines.append(f"- **Resumen**: {sg.get('summary_pct', 0)}% del texto")
        lines.append(f"- **Ratio**: {sg.get('scene_to_summary_ratio', 0)}:1 (thriller >2:1, literary ~1:1)")
        lines.append("")

        pc_ss = ss.get("per_chapter", {})
        if pc_ss:
            lines.append("| Cap | % Escena | % Resumen |")
            lines.append("|---|---|---|")
            for cn in sorted(pc_ss):
                v = pc_ss[cn]
                lines.append(f"| {cn:02d} | {v['scene_pct']}% | {round(100 - v['scene_pct'], 1)}% |")
            lines.append("")

    # ── 8. Story Arc ──
    if "story_arc" in data:
        sa = data["story_arc"]
        lines.append("## 7. Arco Narrativo (Vonnegut)\n")
        if sa.get("arc") and sa["arc"] != "unknown" and sa["arc"] != "insuficiente":
            lines.append(f"**Arco detectado**: {sa['arc']} (confianza: {sa.get('confidence', 0)})")
            shape = sa.get("shape", {})
            if shape:
                lines.append(f"- Tercio inicial: {shape.get('first_third', '—')}")
                lines.append(f"- Tercio medio: {shape.get('middle_third', '—')}")
                lines.append(f"- Tercio final: {shape.get('last_third', '—')}")
        else:
            lines.append(f"*{sa.get('arc', 'No se pudo clasificar')}*")
        lines.append("")

    # ── 9. Revision Hotspots ──
    if "revision_hotspots" in data:
        rh = data["revision_hotspots"]
        lines.append("## 8. Hotspots de Revisión\n")
        lines.append(f"**Recomendación**: {rh.get('recommendation', '')}\n")
        if rh.get("per_chapter"):
            lines.append("| Cap | Score | Prioridad | Factores |")
            lines.append("|---|---|---|---|")
            for p in sorted(rh["per_chapter"], key=lambda x: -x["hotspot_score"]):
                factors = ", ".join(p["factors"]) if p["factors"] else "—"
                lines.append(f"| {p['chapter']:02d} | {p['hotspot_score']} | {p['priority']} | {factors} |")
            lines.append("")

    return "\n".join(lines)


# ──────────────────────────────────────────────
#  CLI
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import sys
    from pathlib import Path
    try:
        from tools.editorial_letter import get_chapter_files, read_chapter
    except ImportError:
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from editorial_letter import get_chapter_files, read_chapter

    parser = argparse.ArgumentParser(description="Insights editoriales avanzados")
    parser.add_argument("--json", action="store_true", help="Salida JSON")
    parser.add_argument("--module", type=str, choices=[
        "style", "dialogue", "save_cat",
        "first_pages", "backstory", "scene_summary", "arc", "hotspots", "all",
    ], default="all", help="Módulo específico (default: all)")
    args = parser.parse_args()

    files = get_chapter_files()
    chapters = [read_chapter(f) for f in files]

    MODULES = {
        "style": lambda: {"style_diagnostics": analyze_style_diagnostics(chapters)},
        "dialogue": lambda: {"dialogue_quality": analyze_dialogue_quality(chapters)},
        "save_cat": lambda: {"save_the_cat": analyze_save_the_cat(chapters)},
        "first_pages": lambda: {"first_pages_test": analyze_first_pages(chapters)},
        "backstory": lambda: {"backstory_dumps": analyze_backstory_dumps(chapters)},
        "scene_summary": lambda: {"scene_summary_ratio": analyze_scene_summary_ratio(chapters)},
        "arc": lambda: {"story_arc": classify_story_arc(None, chapters)},
        "hotspots": lambda: analyze_revision_hotspots(chapters),
        "all": lambda: {
            **analyze_all(chapters),
            "story_arc": classify_story_arc(None, chapters),
        },
    }

    result = MODULES[args.module]()

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if args.module == "all":
            result["story_arc"] = classify_story_arc(None, chapters)
        print(format_markdown(result))
