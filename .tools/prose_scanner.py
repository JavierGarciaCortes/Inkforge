"""
prose_scanner.py — Escáner de patrones de prosa.

Lee los capítulos (desde manifiesto.json), los patrones de Estilo/patrones.json,
y genera un informe de densidad, severidad y clusters por capítulo.

Uso:
    python tools/prose_scanner.py                         # resumen global
    python tools/prose_scanner.py --cap 05                # detalle de un capítulo
    python tools/prose_scanner.py --cap 05 --context full # párrafos completos
    python tools/prose_scanner.py --json                  # salida JSON
    python tools/prose_scanner.py --review                # modo interactivo
"""

import re
import json
import argparse
from pathlib import Path
from collections import defaultdict

from vault import VAULT, CHAPTERS_DIR as ESCRITURA, STYLE_DIR, get_chapter_files, get_chapter_number

PATRONES = STYLE_DIR / "patrones.json"


def cargar_patrones(ruta):
    with open(ruta, encoding="utf-8") as f:
        data = json.load(f)
    return data["patterns"], data["scanner"]


def listar_capitulos():
    return get_chapter_files()


def contar_palabras(texto):
    return len(texto.split())


def extraer_parrafo(texto, pos):
    """Devuelve el párrafo completo (separado por salto de línea) que contiene `pos`."""
    antes = texto[:pos]
    despues = texto[pos:]

    inicio = antes.rfind("\n")
    if inicio == -1:
        inicio = 0
    else:
        inicio += 1

    fin = despues.find("\n")
    if fin == -1:
        fin = len(texto)
    else:
        fin = pos + fin

    return texto[inicio:fin].strip()


# ── Análisis ─────────────────────────────────────────────


def analizar(texto, patrones, cfg, context_mode="short"):
    palabras = contar_palabras(texto)
    resultados = {}

    for p in patrones:
        nombre = p["name"]
        regex = re.compile(p["regex"], re.IGNORECASE)
        target = p["target_density"]
        weight = p["weight"]

        matches = list(regex.finditer(texto))
        count = len(matches)
        densidad = (count / palabras) * 1000 if palabras else 0
        sobre_target = max(0, densidad - target)
        contribucion = sobre_target * weight

        lineas = []
        for m in matches:
            start = m.start()
            line_no = texto[:start].count("\n") + 1

            if context_mode == "full":
                ctx = extraer_parrafo(texto, start)
            else:
                ctx_start = max(0, start - 30)
                ctx_end = min(len(texto), m.end() + 30)
                ctx = texto[ctx_start:ctx_end].replace("\n", " ").strip()

            lineas.append((line_no, ctx))

        window = cfg["cluster_window"]
        min_count = cfg["cluster_min"]
        clusters = detectar_clusters(matches, texto, window, min_count)

        resultados[nombre] = {
            "count": count,
            "densidad": round(densidad, 2),
            "target": target,
            "weight": weight,
            "sobre_target": round(sobre_target, 2),
            "contribucion": round(contribucion, 2),
            "clusters": clusters,
            "lineas": lineas,
        }

    return palabras, resultados


def detectar_clusters(matches, texto, window, min_count):
    if len(matches) < min_count:
        return []

    word_starts = []
    for m in matches:
        pos = texto[: m.start()]
        word_pos = len(pos.split())
        word_starts.append(word_pos)

    clusters = []
    i = 0
    while i < len(word_starts):
        end = word_starts[i] + window
        group = [j for j in range(i, len(word_starts)) if word_starts[j] <= end]
        if len(group) >= min_count:
            clusters.append((word_starts[i], word_starts[group[-1]], len(group)))
            i = group[-1] + 1
        else:
            i += 1
    return clusters


# ── Severidad ─────────────────────────────────────────────


def calcular_severidad(resultados, cfg):
    total = sum(r["contribucion"] for r in resultados.values())
    for r in resultados.values():
        total += len(r["clusters"]) * cfg["cluster_penalty"]

    if total >= cfg["severity"]["critical"]:
        return "CRÍTICO", round(total, 1)
    elif total >= cfg["severity"]["high"]:
        return "ALTO", round(total, 1)
    elif total >= cfg["severity"]["medium"]:
        return "MEDIO", round(total, 1)
    else:
        return "BAJO", round(total, 1)


# ── Estadísticas de estructura ─────────────────────────────


def analizar_estructura(texto):
    """Analiza variación de párrafos: longitud media, desviación, párrafos largos/cortos."""
    parrafos = [p.strip() for p in texto.split("\n") if p.strip()]
    # Filtrar frontmatter y títulos
    parrafos = [p for p in parrafos if not p.startswith("---") and not p.startswith("#")]

    longitudes = [len(p.split()) for p in parrafos]
    if not longitudes:
        return None

    media = sum(longitudes) / len(longitudes)
    var = sum((l - media) ** 2 for l in longitudes) / len(longitudes)
    desv = var ** 0.5
    largos = sum(1 for l in longitudes if l > media + desv * 1.5)
    cortos = sum(1 for l in longitudes if l < media * 0.3)

    return {
        "total_parrafos": len(parrafos),
        "media": round(media, 1),
        "desviacion": round(desv, 1),
        "parrafos_largos": largos,
        "parrafos_cortos": cortos,
    }


# ── Modo interactivo --review ─────────────────────────────


def modo_review(archivo, texto, palabras, resultados, cfg):
    """Muestra cada match sobre target con párrafo completo y pide acción."""
    print(f"\n📖 Revisando: {archivo.name} ({palabras} palabras)\n")

    patrones_sobre_target = sorted(
        [(r["contribucion"], n) for n, r in resultados.items() if r["sobre_target"] > 0],
        reverse=True,
    )

    if not patrones_sobre_target:
        print("  Sin patrones sobre target. ¡Bien!\n")
        return

    marcados = []

    for contrib, name in patrones_sobre_target:
        r = resultados[name]
        print(f"{'─' * 60}")
        print(f"  📌 {name} ({r['count']} ocurrencias, {r['densidad']}/{r['target']}/1k)")
        print(f"{'─' * 60}")

        respuesta = ""
        for i, (line_no, _) in enumerate(r["lineas"], 1):
            # Extraer párrafo completo de la posición del match real
            # Buscar la posición de la línea en el texto
            lines_texto = texto.split("\n")
            if line_no - 1 < len(lines_texto):
                # Encontrar la posición de inicio de esta línea en el texto
                pos = 0
                for _ in range(line_no - 1):
                    pos = texto.index("\n", pos) + 1
                ctx = extraer_parrafo(texto, pos)
            else:
                ctx = ""

            print(f"\n  ── #{i} — L{line_no} ──\n")
            print(f"{ctx}\n")
            try:
                respuesta = input("  ¿Marcar para editar? [y/n/q]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                respuesta = "q"
                print()
            if respuesta == "q":
                print()
                break
            elif respuesta == "y":
                marcados.append((name, line_no, ctx[:80]))
        if respuesta == "q":
            break

    if marcados:
        print(f"\n  📋 Líneas marcadas ({len(marcados)}):")
        for name, ln, ctx in marcados:
            print(f"    L{ln:>4}  [{name}]  {ctx}…")
    else:
        print("\n  (nada marcado)")

    print()


# ── Reportes ─────────────────────────────────────────────


def reporte_global(caps_data, cfg):
    print("=" * 70)
    print("  Prose Scanner — Resumen Global")
    print("=" * 70)
    print()

    total_palabras = sum(d["palabras"] for d in caps_data)
    total_patrones = defaultdict(int)
    for d in caps_data:
        for name, r in d["resultados"].items():
            total_patrones[name] += r["count"]

    patrones, _ = cargar_patrones(PATRONES)

    # ── Patrones ──
    print(f"  Total: {total_palabras} palabras en {len(caps_data)} capítulos\n")
    print(f"  {'Patrón':<22} {'Total':>6} {'Densidad':>9} {'Target':>7}  Estado")
    print("  " + "-" * 60)
    for p in patrones:
        name = p["name"]
        total = total_patrones[name]
        densidad = (total / total_palabras) * 1000 if total_palabras else 0
        target = p["target_density"]
        estado = "**" if densidad > target else "✓"
        barra = " " + "█" * min(int(densidad * 4), 20) if densidad > 0 else ""
        print(f"  {name:<22} {total:>6} {densidad:>8.2f}/1k {target:>5.1f}/1k  {estado}{barra}")
    print()

    # ── Estructura (media global) ──
    todas_estructuras = [d.get("estructura") for d in caps_data if d.get("estructura")]
    if todas_estructuras:
        media_parrafos = sum(e["media"] for e in todas_estructuras) / len(todas_estructuras)
        print(f"  📊 Estructura — Media párrafos: {media_parrafos:.0f} palabras")
        print()

    # ── Tabla de capítulos ──
    print(f"  {'Cap':<6} {'Archivo':<28} {'Palabras':>8} {'Score':>6} {'Tier':<10}  {'Párr.':>6}  Problemas principales")
    print("  " + "-" * 100)
    for d in caps_data:
        cap = d["cap"]
        archivo = d["archivo"]
        palabras = d["palabras"]
        tier, score = d["severidad"]

        problemas = sorted(
            [(r["contribucion"], n) for n, r in d["resultados"].items() if r["sobre_target"] > 0],
            reverse=True,
        )[:3]
        prob_parts = []
        for s, n in problemas:
            r = d["resultados"][n]
            prob_parts.append(f"{n}={r['densidad']:.1f}/1k")
        prob_str = ", ".join(prob_parts) if prob_parts else "—"

        estructura = d.get("estructura")
        parr_str = f"{estructura['media']:.0f}" if estructura else "—"

        print(f"  {cap:<6} {archivo:<28} {palabras:>8} {score:>5.1f}  {tier:<10} {parr_str:>6}  {prob_str}")
    print()


def reporte_capitulo(archivo, palabras, resultados, severidad, estructura=None, context_mode="short"):
    cap = archivo.stem
    tier, score = severidad

    print("=" * 70)
    print(f"  Capítulo: {cap}")
    print(f"  Palabras: {palabras}  |  Score: {score}  |  Tier: {tier}")
    if estructura:
        print(f"  Párrafos: {estructura['total_parrafos']}  |  Media: {estructura['media']} palabras  |  Desv: ±{estructura['desviacion']}")
    print("=" * 70)
    print()

    patrones_sobre_target = sorted(
        [(r["contribucion"], n) for n, r in resultados.items() if r["sobre_target"] > 0],
        reverse=True,
    )

    if not patrones_sobre_target:
        print("  Sin patrones sobre target.\n")
        return

    for contrib, name in patrones_sobre_target:
        r = resultados[name]
        print(f"  {name}: {r['count']} ocurrencias ({r['densidad']}/{r['target']}/1k) "
              f"{'**' if r['sobre_target'] > 0 else ''}")
        if r["clusters"]:
            for c in r["clusters"]:
                print(f"    ⚠  Cluster: {c[2]}x entre palabras {c[0]}-{c[1]}")
        for line_no, ctx in r["lineas"]:
            if context_mode == "full":
                for l in ctx.split("\n"):
                    print(f"    L{line_no:>4}: {l}")
            else:
                print(f"    L{line_no:>4}: …{ctx[:120]}…")
        print()

    cluster_penalty = sum(len(r["clusters"]) for r in resultados.values()) * 1.5
    print(f"  Cluster penalty: {cluster_penalty}")
    print()


def reporte_json(caps_data):
    output = []
    for d in caps_data:
        cap_out = {
            "capitulo": d["cap"],
            "archivo": d["archivo"],
            "palabras": d["palabras"],
            "severidad": {"tier": d["severidad"][0], "score": d["severidad"][1]},
            "patrones": {},
        }
        if d.get("estructura"):
            cap_out["estructura"] = d["estructura"]
        for name, r in d["resultados"].items():
            cap_out["patrones"][name] = {
                "count": r["count"],
                "densidad": r["densidad"],
                "target": r["target"],
                "sobre_target": r["sobre_target"],
                "contribucion": r["contribucion"],
                "clusters": len(r["clusters"]),
                "lineas": [{"linea": ln, "contexto": ctx} for ln, ctx in r["lineas"]],
            }
        output.append(cap_out)
    print(json.dumps(output, ensure_ascii=False, indent=2))


# ── API pública para importar ──────────────────────────────


def scan_chapter(num: str, context_mode: str = "short") -> dict | None:
    """Escanea un capítulo y devuelve dict con resultados listos para JSON."""
    target = str(int(num)) if num.isdigit() else num
    patrones, cfg = cargar_patrones(PATRONES)
    caps = listar_capitulos()
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        cap_str = str(n) if n is not None else ""
        if not (cap_str.isdigit() and target.isdigit() and int(cap_str) == int(target)):
            continue
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
            palabras, resultados = analizar(texto, patrones, cfg, context_mode)
            severidad = calcular_severidad(resultados, cfg)
            return {
                "cap": num,
                "archivo": archivo.name,
                "palabras": palabras,
                "resultados": {n: {k: v for k, v in r.items() if k != "lineas"}
                               for n, r in resultados.items()},
                "severidad": {"tier": severidad[0], "score": severidad[1]},
                "estructura": analizar_estructura(texto),
            }
    return None


def scan_all(context_mode: str = "short") -> list[dict]:
    """Escanea todos los capítulos y devuelve lista de dicts."""
    patrones, cfg = cargar_patrones(PATRONES)
    caps = listar_capitulos()
    results = []
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        if n is None:
            continue
        num = str(n)
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        palabras, resultados = analizar(texto, patrones, cfg, context_mode)
        severidad = calcular_severidad(resultados, cfg)
        results.append({
            "cap": num,
            "archivo": archivo.name,
            "palabras": palabras,
            "resultados": {n: {k: v for k, v in r.items() if k != "lineas"}
                           for n, r in resultados.items()},
            "severidad": {"tier": severidad[0], "score": severidad[1]},
            "estructura": analizar_estructura(texto),
        })
    return results


# ── Ritmo (variación de longitud de frase) ────────────


SENTENCE_SPLIT = re.compile(r"[.!?…]+[\s\"\'\)\]]*")


def analizar_ritmo(texto: str) -> dict:
    """Mide variación de longitud de frases para detectar ritmo plano."""
    # Limpiar metadata YAML
    texto_limpio = re.sub(r"^---.*?---", "", texto, count=1, flags=re.DOTALL)
    # Quitar raya de diálogo (—) al inicio de línea
    texto_limpio = re.sub(r"^—", "", texto_limpio, flags=re.MULTILINE)

    frases = [s.strip() for s in SENTENCE_SPLIT.split(texto_limpio) if len(s.strip()) > 3]
    if not frases:
        return {"total_frases": 0, "media": 0, "desviacion": 0, "planos": 0, "aviso": "Sin frases"}

    longitudes = [len(f.split()) for f in frases]
    media = sum(longitudes) / len(longitudes)
    var = sum((l - media) ** 2 for l in longitudes) / len(longitudes)
    desviacion = var ** 0.5

    # Frases "planas" = longitudes dentro de ±2 de la media cuando la desviación es baja
    planos = sum(1 for l in longitudes if abs(l - media) <= 2)

    return {
        "total_frases": len(frases),
        "media": round(media, 1),
        "desviacion": round(desviacion, 1),
        "planos": planos,
        "porcentaje_planos": round(planos / len(longitudes) * 100, 1),
    }


def export_ritmo(num: str) -> dict | None:
    """Escanea ritmo de un capítulo para MCP."""
    target = str(int(num)) if num.isdigit() else num
    caps = listar_capitulos()
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        cap_str = str(n) if n is not None else ""
        if not (cap_str.isdigit() and target.isdigit() and int(cap_str) == int(target)):
            continue
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        return analizar_ritmo(texto)
    return None


def export_ritmo_all() -> dict:
    """Ritmo de todos los capítulos."""
    caps = listar_capitulos()
    results = {}
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        if n is None:
            continue
        num = str(n)
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        results[num] = analizar_ritmo(texto)
    return results


# ── Validación de patrones (overlap detection) ────────


def validar_patrones(ruta) -> list[dict]:
    """Detecta overlaps entre patrones de prosa."""
    patrones, _ = cargar_patrones(ruta)
    warnings = []

    for i, p1 in enumerate(patrones):
        r1 = re.compile(p1["regex"], re.IGNORECASE)
        for j, p2 in enumerate(patrones):
            if j <= i:
                continue
            r2 = re.compile(p2["regex"], re.IGNORECASE)
            # Test con textos sintéticos que matchean cada patrón
            for nombre, regex in [(p1["name"], r1), (p2["name"], r2)]:
                # Generar texto de prueba buscando qué coincide con la regex
                test = f"Esto es un texto de prueba con {p1['name']} y {p2['name']}."
                test += f" También podría contener patrones solapados habilidad y sentimiento."
                m1 = set(m.span() for m in r1.finditer(test))
                m2 = set(m.span() for m in r2.finditer(test))
                if m1 and m2:
                    overlap = False
                    for s1, e1 in m1:
                        for s2, e2 in m2:
                            if s1 < e2 and s2 < e1:
                                overlap = True
                                break
                    if overlap and not any(
                        w["p1"] == p1["name"] and w["p2"] == p2["name"]
                        for w in warnings
                    ):
                        warnings.append({
                            "p1": p1["name"],
                            "p2": p2["name"],
                            "r1": p1["regex"],
                            "r2": p2["regex"],
                        })

    return warnings


# ── Actualizar Estado.md ──────────────────────────────


def actualizar_estado(ruta_estado: str | None = None) -> str:
    """Actualiza la tabla de scores en Estado.md con los últimos datos del scanner."""
    if ruta_estado is None:
        ruta_estado = str(VAULT / "Referencias" / "Estado.md")
    estado_path = Path(ruta_estado)
    if not estado_path.exists():
        return f"No se encuentra Estado.md en: {ruta_estado}"

    original = estado_path.read_text("utf-8")
    all_data = scan_all()

    # Buscar la tabla | Cap | Palabras | Scanner | Notas |
    lines = original.split("\n")
    new_lines = []
    in_table = False
    updated = 0

    for line in lines:
        stripped = line.strip()
        # Detectar inicio de tabla de scores
        if stripped.startswith("| Cap |") and "Palabras" in stripped and "Scanner" in stripped:
            in_table = True
            new_lines.append(line)
            continue
        if in_table and stripped.startswith("|---"):
            new_lines.append(line)
            continue
        if in_table and stripped.startswith("| "):
            parts = [p.strip() for p in stripped.split("|")]
            if len(parts) >= 5:
                cap_str = parts[1]
                try:
                    cap_num = int(cap_str)
                    for d in all_data:
                        if int(d["cap"]) == cap_num:
                            sev = d["severidad"]
                            tier_label = {"CRITICO": "CRÍTICO", "ALTO": "ALTO", "MEDIO": "MEDIO", "BAJO": "BAJO"}
                            parts[3] = f"{sev['score']} {tier_label.get(sev['tier'], sev['tier'])}"
                            new_lines.append("| " + " | ".join(parts[1:]))
                            updated += 1
                            break
                    else:
                        new_lines.append(line)
                except ValueError:
                    new_lines.append(line)
                continue
            new_lines.append(line)
        else:
            if in_table and stripped == "":
                in_table = False
            new_lines.append(line)

    nuevo = "\n".join(new_lines)
    # Solo escribir si hubo cambios
    if nuevo != original:
        estado_path.write_text(nuevo, encoding="utf-8")
    return f"✅ Estado.md actualizado: {updated} capítulos"

def _reporte_ritmo(caps_data: list):
    """Imprime tabla de ritmo (variación de longitud de frases)."""
    headers = ["Cap", "Frases", "Media", "Desv", "% Planas", "Diagnóstico"]
    print(f"\n{' | '.join(headers)}")
    print(f"{' | '.join('---' for _ in headers)}")
    for d in caps_data:
        texto = open(ESCRITURA / d["archivo"], encoding="utf-8").read()
        r = analizar_ritmo(texto)
        if r["total_frases"] == 0:
            continue
        if r["desviacion"] < 3:
            diag = "⚠ Ritmo plano"
        elif r["porcentaje_planos"] > 60:
            diag = "⚠ Muchas frases similares"
        else:
            diag = "✓ Variado"
        print(f"| {d['cap']} | {r['total_frases']} | {r['media']} | {r['desviacion']} | {r['porcentaje_planos']}% | {diag} |")


# ── Análisis Stephen King ────────────────────────────

KING_PATTERNS = {"adverbio_dialogo", "voz_pasiva_ser", "explicación_adictiva",
                 "filter_sintió", "filter_parecía", "filter_notó", "filter_vio",
                 "filter_oyó", "hedging", "empezó_a", "de_repente", "era_como_si"}


def analisis_king(texto: str, resultados: dict, cfg: dict) -> dict:
    """Análisis específico Stephen King: adverbios, pasiva, filter words, etc."""
    king_results = {}
    king_contrib = 0
    for name, r in resultados.items():
        if name in KING_PATTERNS and r["sobre_target"] > 0:
            king_results[name] = r
            king_contrib += r["contribucion"]

    palabras = len(texto.split())
    palabras_sobrantes = int(palabras * 0.10)
    reducidas_por_scanner = sum(r["count"] for r in resultados.values() if r["sobre_target"] > 0)

    return {
        "king_score": round(king_contrib, 1),
        "king_patterns": {n: {"count": r["count"], "densidad": r["densidad"],
                              "target": r["target"], "contribucion": r["contribucion"]}
                          for n, r in king_results.items()},
        "kill_darlings_estimate": {
            "total_palabras": palabras,
            "target_reduccion_10pct": palabras_sobrantes,
            "ocurrencias_sobre_target": reducidas_por_scanner,
        },
        "adverbios_dialogo": resultados.get("adverbio_dialogo", {}).get("count", 0),
        "voz_pasiva": resultados.get("voz_pasiva_ser", {}).get("count", 0),
    }


def reporte_king(caps_data: list):
    """Imprime reporte Stephen King con diagnóstico y recomendaciones."""
    print("=" * 70)
    print("  🔴 Informe Stephen King — On Writing")
    print("=" * 70)
    print()
    print("  «El camino al infierno está empedrado de adverbios.»")
    print("  «El segundo borrador = primer borrador − 10%.»")
    print()

    total_palabras = sum(d["palabras"] for d in caps_data)
    total_king_score = 0
    total_adverbios = 0
    total_pasiva = 0
    total_reducibles = 0

    print(f"  {'Cap':<6} {'King Score':>10} {'Adv.Diál.':>9} {'Voz Pas.':>8} {'Kill(10%)':>9}  Patrones problemáticos")
    print("  " + "-" * 80)
    for d in caps_data:
        k = analisis_king(
            open(ESCRITURA / d["archivo"], encoding="utf-8").read(),
            d["resultados"],
            cargar_patrones(PATRONES)[1],
        )
        king_score = k["king_score"]
        adverbios = k["adverbios_dialogo"]
        pasiva = k["voz_pasiva"]
        reducibles = k["kill_darlings_estimate"]["ocurrencias_sobre_target"]
        total_king_score += king_score
        total_adverbios += adverbios
        total_pasiva += pasiva
        total_reducibles += reducibles

        prob_names = [n for n in k["king_patterns"]]
        prob_str = ", ".join(prob_names[:3]) if prob_names else "—"

        print(f"  {d['cap']:<6} {king_score:>10.1f} {adverbios:>9} {pasiva:>8} {reducibles:>9}  {prob_str}")
    print()

    print("=" * 70)
    print("  🔴 Diagnóstico global")
    print("=" * 70)
    print(f"  King Score total: {total_king_score:.1f}  |  "
          f"Adverbios en diálogo: {total_adverbios}  |  "
          f"Voz pasiva: {total_pasiva}")
    print(f"  Total palabras: {total_palabras}")
    print(f"  Target de poda (10%): {int(total_palabras * 0.10)} palabras")
    print(f"  Ocurrencias sobre target: {total_reducibles}")
    print()

    if total_king_score > 20:
        print("  ⚠  King Score alto. La prosa tiene señales King-negativas.")
        print("     Prioriza eliminar adverbios en diálogo y voz pasiva.")
    elif total_king_score > 10:
        print("  ⚡ King Score moderado. Buen momento para una pasada de poda.")
    else:
        print("  ✓  King Score bajo. La prosa sigue bien las reglas de King.")
    print()

    if total_adverbios > 3:
        print("  🚩 «El adverbio no es tu amigo.»")
        print(f"     {total_adverbios} adverbios en atribuciones de diálogo.")
        print("     → Usa contexto y acción para comunicar el tono.")
        print()
    if total_pasiva > 5:
        print("  🚩 Voz pasiva detectada.")
        print(f"     {total_pasiva} construcciones con 'ser + participio'.")
        print("     → La voz activa es más directa y audaz.")
        print()

    print("  Recomendación de modo de escritura:")
    print(f"     {'🔴 PUERTA CERRADA — Sigue escribiendo. No edites aún.' if total_king_score > 15 else '🟢 PUERTA ABIERTA — Buen momento para una pasada de edición.'}")
    print()


# ── Export para MCP ──────────────────────────────────


def export_king(num: str) -> dict | None:
    """Exporta análisis King de un capítulo para MCP."""
    patrones, cfg = cargar_patrones(PATRONES)
    caps = listar_capitulos()
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        cap_str = str(n) if n is not None else ""
        if not (cap_str.isdigit() and num.isdigit() and int(cap_str) == int(num)):
            continue
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        palabras, resultados = analizar(texto, patrones, cfg)
        k = analisis_king(texto, resultados, cfg)
        return {
            "cap": num,
            "archivo": archivo.name,
            "palabras": palabras,
            "king_score": k["king_score"],
            "adverbios_dialogo": k["adverbios_dialogo"],
            "voz_pasiva": k["voz_pasiva"],
            "kill_darlings": k["kill_darlings_estimate"],
            "patrones_king": k["king_patterns"],
        }
    return None


def export_king_all() -> dict:
    """Exporta análisis King de todos los capítulos."""
    patrones, cfg = cargar_patrones(PATRONES)
    caps = listar_capitulos()
    results = {}
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        if n is None:
            continue
        num = str(n)
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        palabras, resultados = analizar(texto, patrones, cfg)
        k = analisis_king(texto, resultados, cfg)
        results[num] = {
            "king_score": k["king_score"],
            "adverbios_dialogo": k["adverbios_dialogo"],
            "voz_pasiva": k["voz_pasiva"],
            "kill_darlings": k["kill_darlings_estimate"],
            "patrones_king": list(k["king_patterns"].keys()),
        }
    return results


# ── Puerta cerrada / abierta ─────────────────────────


# ── Export para MCP: Sanderson ─────────────────────

MAGIC_TERMS = re.compile(
    r"\b(magia|mágico|hechizo|conjuro|poder|poderes|encantamiento|"
    r"maldición|profecía|ritual|invocación|portal|dimensión)\b",
    re.IGNORECASE,
)
COST_TERMS = re.compile(
    r"\b(cansancio|duele|dolor|pierde|perder|pérdida|cuesta|coste|costo|límite|limitación|"
    r"debilidad|sacrificio|sangre|vida|muere|muerte|olvid[ao]|recuerd[ao]|"
    r"memoria|nunca más|ya no|se desvanece|se apaga|se rompe|se quiebra|"
    r"pesa|gravedad|lastre|agot[ao]|vací[ao]|consum[ei])\b",
    re.IGNORECASE,
)
ACTIVE_VERBS = re.compile(
    r"\b(decidió|eligió|avanzó|cruzó|entró|giró|levantó|empujó|"
    r"caminó|corrió|saltó|tomó|agarró|golpeó|lanzó|abrió|cerró|"
    r"encendió|apagó|trepó|bajó|subió|arrancó|rompió|cortó|"
    r"empuñó|desenvainó|sacó|metió|puso|alzó|blandió)\b",
    re.IGNORECASE,
)
PASSIVE_VERBS = re.compile(
    r"\b(esperó|observó|sintió|notó|dejó|permitió|soportó|"
    r"aguantó|calló|retrocedió|huyó|escapó|se escondió|"
    r"se encogió|tembló|dudó|vaciló|se detuvo|se quedó)\b",
    re.IGNORECASE,
)
ESCALATION_YES_BUT = re.compile(
    r"\b(pero|sin embargo|aunque|no obstante|con todo|"
    r"a pesar de|empeoró|se complicó|algo más)\b",
    re.IGNORECASE,
)


def _analisis_sanderson(texto: str) -> dict:
    """Analiza un capítulo según principios de Sanderson (uso interno MCP)."""
    palabras = len(texto.split())

    magic_matches = list(MAGIC_TERMS.finditer(texto))
    total_magic = len(magic_matches)
    sin_cost = 0
    for m in magic_matches:
        start = max(0, m.start() - 100)
        end = min(len(texto), m.end() + 100)
        window = texto[start:end]
        if not COST_TERMS.search(window):
            sin_cost += 1

    activos = ACTIVE_VERBS.findall(texto)
    pasivos = PASSIVE_VERBS.findall(texto)
    total_activos = len(activos)
    total_pasivos = len(pasivos)
    ratio_proactividad = round(total_activos / (total_pasivos + 1), 2)

    escalacion = len(ESCALATION_YES_BUT.findall(texto))

    pct_con_cost = round(
        ((total_magic - sin_cost) / total_magic * 100) if total_magic else 0, 1
    )

    return {
        "magic_terms": total_magic,
        "magic_without_cost": sin_cost,
        "pct_with_cost": pct_con_cost,
        "active_verbs": total_activos,
        "passive_verbs": total_pasivos,
        "proactivity_ratio": ratio_proactividad,
        "escalation_markers": escalacion,
    }


def export_sanderson(num: str) -> dict | None:
    """Exporta análisis Sanderson de un capítulo para MCP."""
    caps = listar_capitulos()
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        cap_str = str(n) if n is not None else ""
        if not (cap_str.isdigit() and num.isdigit() and int(cap_str) == int(num)):
            continue
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        s = _analisis_sanderson(texto)
        return {
            "cap": num,
            "archivo": archivo.name,
            "palabras": len(texto.split()),
            **s,
        }
    return None


def export_sanderson_all() -> dict:
    """Exporta análisis Sanderson de todos los capítulos."""
    caps = listar_capitulos()
    results = {}
    for archivo in caps:
        n = get_chapter_number(archivo.name)
        if n is None:
            continue
        num = str(n)
        with open(archivo, encoding="utf-8") as f:
            texto = f.read()
        results[num] = {
            "palabras": len(texto.split()),
            **_analisis_sanderson(texto),
        }
    return results





def filtrar_por_puerta(entry: dict, door_mode: str) -> dict:
    """Filtra resultados según modo puerta: closed = solo severidad CRÍTICO/ALTO."""
    if door_mode == "open":
        return entry  # Mostrar todo

    # Puerta cerrada: solo mostrar patrones con weight >= 2.0 y contribution alta
    filtered = entry.copy()
    resultados_filtrados = {}
    for name, r in entry["resultados"].items():
        if r["weight"] >= 2.0 and r["contribucion"] > 1.0:
            resultados_filtrados[name] = r
    filtered["resultados"] = resultados_filtrados
    return filtered


# ── Main ──────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Escáner de patrones de prosa")
    parser.add_argument("--cap", help="Analizar solo un capítulo (ej: 05)")
    parser.add_argument("--json", action="store_true", help="Salida JSON")
    parser.add_argument("--context", choices=["short", "full"], default="short",
                        help="Contexto: short (30 chars) o full (párrafo completo)")
    parser.add_argument("--review", action="store_true",
                        help="Modo interactivo: muestra cada match y permite marcarlo")
    parser.add_argument("--estilo", action="store_true",
                        help="Incluye estadísticas de estructura (párrafos)")
    parser.add_argument("--validate", action="store_true",
                        help="Validar overlaps entre patrones de prosa")
    parser.add_argument("--ritmo", action="store_true",
                        help="Mostrar estadísticas de ritmo (longitud de frases)")
    parser.add_argument("--king", action="store_true",
                        help="Análisis Stephen King: adverbios en diálogo, voz pasiva, kill your darlings")
    parser.add_argument("--door", choices=["closed", "open"], default="open",
                        help="Modo puerta cerrada (solo crítico, primer borrador) o abierta (full, revisión)")
    parser.add_argument("--update-estado", action="store_true",
                        help="Actualizar scores en Referencias/Estado.md")
    args = parser.parse_args()

    if args.validate:
        warnings = validar_patrones(PATRONES)
        if not warnings:
            print("✅ No se detectaron overlaps entre patrones.")
        else:
            print(f"⚠ Se detectaron {len(warnings)} overlaps:")
            for w in warnings:
                print(f"\n  {w['p1']} ↔ {w['p2']}")
                print(f"    {w['r1']}")
                print(f"    {w['r2']}")
        return

    if args.update_estado:
        print(actualizar_estado())
        return

    patrones, cfg = cargar_patrones(PATRONES)
    caps = listar_capitulos()

    caps_data = []

    for archivo in caps:
        n = get_chapter_number(archivo.name)
        if n is None:
            continue
        num_cap = str(n)
        if args.cap and not (num_cap.isdigit() and args.cap.isdigit() and int(num_cap) == int(args.cap)):
            continue

        with open(archivo, encoding="utf-8") as f:
            texto = f.read()

        palabras, resultados = analizar(texto, patrones, cfg, context_mode=args.context)
        severidad = calcular_severidad(resultados, cfg)

        entry = {
            "cap": num_cap,
            "archivo": archivo.name,
            "palabras": palabras,
            "resultados": resultados,
            "severidad": severidad,
        }

        if args.door == "closed":
            entry = filtrar_por_puerta(entry, "closed")

        if args.estilo or not (args.json or args.cap or args.review):
            entry["estructura"] = analizar_estructura(texto)

        caps_data.append(entry)

    if not caps_data:
        print(f"No se encontraron capítulos. Buscando en: {ESCRITURA}")
        return

    if args.king:
        reporte_king(caps_data)
        return

    if args.ritmo:
        _reporte_ritmo(caps_data)
        return

    if args.review:
        for d in caps_data:
            modo_review(
                Path(d["archivo"]),
                open(ESCRITURA / d["archivo"], encoding="utf-8").read(),
                d["palabras"],
                d["resultados"],
                cfg,
            )
    elif args.json:
        reporte_json(caps_data)
    elif args.cap:
        d = caps_data[0]
        reporte_capitulo(Path(d["archivo"]), d["palabras"], d["resultados"],
                         d["severidad"], d.get("estructura"), args.context)
    else:
        reporte_global(caps_data, cfg)


if __name__ == "__main__":
    main()
