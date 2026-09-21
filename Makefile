PYTHON = python3
TOOLS = .tools

.PHONY: scan publish check session letter lint ritual ready help

# ── Scanner ────────────────────────────────────────────────────────────────

scan:  ## Escanear prosa (global). ARGS=--cap 07 --context full
	$(PYTHON) $(TOOLS)/prose_scanner.py $(ARGS)

scan-full:  ## Escanear con contexto completo
	$(PYTHON) $(TOOLS)/prose_scanner.py --context full $(ARGS)

scan-review:  ## Modo interactivo (pregunta por cada hallazgo)
	$(PYTHON) $(TOOLS)/prose_scanner.py --review $(ARGS)

# ── Consistencia ────────────────────────────────────────────────────────────

check:  ## Verificar consistencia global. ARGS=--cap 5-8
	$(PYTHON) $(TOOLS)/consistency_check.py $(ARGS)

check-transitions:  ## Verificar transiciones entre capítulos
	$(PYTHON) $(TOOLS)/consistency_check.py --cap all

# ── Publicación ─────────────────────────────────────────────────────────────

publish:  ## Generar EPUB. FORMAT=html|pdf|all  TITLE=... AUTHOR=...
	$(PYTHON) $(TOOLS)/publish.py --format $(or $(FORMAT),epub) \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(AUTHOR),--author "$(AUTHOR)")

publish-all:  ## EPUB + HTML + PDF
	$(PYTHON) $(TOOLS)/publish.py --format all \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(AUTHOR),--author "$(AUTHOR)")

publish-beta:  ## HTML con números de línea para beta readers
	$(PYTHON) $(TOOLS)/publish.py --beta \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(AUTHOR),--author "$(AUTHOR)")

# ── Sesión ──────────────────────────────────────────────────────────────────

session:  ## Resumen de cambios desde última sesión
	$(PYTHON) $(TOOLS)/session_check.py

session-full:  ## Resumen + Estado.md + checklist del ritual
	$(PYTHON) $(TOOLS)/session_check.py --full

session-quick:  ## Solo diff + scores
	$(PYTHON) $(TOOLS)/session_check.py --quick

# ── Carta editorial ─────────────────────────────────────────────────────────

letter:  ## Carta editorial completa
	$(PYTHON) $(TOOLS)/editorial_letter.py

letter-beta:  ## Informe profesional sintético
	$(PYTHON) $(TOOLS)/editorial_letter.py --beta

letter-plan:  ## Plan de revisión faseado
	$(PYTHON) $(TOOLS)/editorial_letter.py --plan

letter-cap:  ## Carta de un capítulo. ARGS=--cap 07
	$(PYTHON) $(TOOLS)/editorial_letter.py $(ARGS)

letter-insights:  ## Análisis avanzado (estilo, diálogo, Save the Cat, ...)
	$(PYTHON) $(TOOLS)/editorial_letter.py --insights

# ── Diagnóstico ─────────────────────────────────────────────────────────────

diagnose:  ## Todos los diagnósticos de un capítulo. ARGS=07
	$(PYTHON) $(TOOLS)/editorial_insights.py --module style ARGS=$(ARGS)
	$(PYTHON) $(TOOLS)/editorial_insights.py --module dialogue ARGS=$(ARGS)
	$(PYTHON) $(TOOLS)/editorial_insights.py --module scene_summary ARGS=$(ARGS)

style:  ## Diagnóstico de estilo. ARGS=--cap 07
	$(PYTHON) $(TOOLS)/editorial_insights.py --module style $(ARGS)

dialogue:  ## Diagnóstico de diálogo. ARGS=--cap 07
	$(PYTHON) $(TOOLS)/editorial_insights.py --module dialogue $(ARGS)

# ── Mantenimiento ───────────────────────────────────────────────────────────

sync:  ## Sincronizar YAML de capítulos desde el manifiesto
	$(PYTHON) $(TOOLS)/sync_manifiesto.py

sync-dry:  ## Simular sincronización
	$(PYTHON) $(TOOLS)/sync_manifiesto.py --dry

sort-lexico:  ## Ordenar alfabéticamente el léxico
	$(PYTHON) $(TOOLS)/sort_lexico.py

lint:  ## Lint de las tools Python
	@which ruff >/dev/null 2>&1 && ruff check $(TOOLS)/*.py || echo "ruff no instalado. Omite."

# ── Ritual completo de inicio ──────────────────────────────────────────────

ritual:  ## Ritual de inicio de sesión: session + letter + foreshadowing + session_log
	$(PYTHON) $(TOOLS)/session_check.py --full
	@echo ""
	@echo "═══════════════════════════════════════════════"
	@echo "  Siguiente: cat .fiction/session_log.json"
	@echo "═══════════════════════════════════════════════"
	@echo ""
	@echo "═══════════════════════════════════════════════"
	@echo "  Siguiente: editorial_letter(beta=true)"
	@echo "═══════════════════════════════════════════════"
	@echo ""
	$(PYTHON) $(TOOLS)/editorial_letter.py --beta
	@echo ""
	@echo "═══════════════════════════════════════════════"
	@echo "  Siguiente: get_foreshadowing()"
	@echo "  → Consultar vault/Referencias/Foreshadowing.md"
	@echo "═══════════════════════════════════════════════"

ready:  ## Resumen ejecutivo rápido antes de escribir
	@echo "═══════════════════════════════════════════════"
	@echo "  READY — Resumen rápido"
	@echo "═══════════════════════════════════════════════"
	$(PYTHON) $(TOOLS)/session_check.py --quick
	@echo ""
	@echo "--- .fiction/session_log.json ---"
	@cat .fiction/session_log.json 2>/dev/null || echo "(vacío)"
	@echo ""
	@echo "--- vault/Referencias/Pendientes.md (top 3) ---"
	@grep -A 5 "^## Alta" vault/Referencias/Pendientes.md | head -8
	@echo ""
	@echo "--- Próximo paso recomendado ---"
	@echo "  make ritual  — chequeo completo"
	@echo "  make scan    — escanear prosa global"
	@echo "═══════════════════════════════════════════════"

# ── Ayuda ──────────────────────────────────────────────────────────────────

help:  ## Muestra esta ayuda
	@echo "Uso: make <objetivo> [ARGS=...]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables:"
	@echo "  ARGS=...     Argumentos extra (ej. ARGS=\"--cap 07\")"
	@echo "  FORMAT=...   Formato de publicación (html|pdf|all)"
	@echo "  TITLE=...    Título del libro para publicación"
	@echo "  AUTHOR=...   Autor del libro para publicación"
	@echo "  MODEL=...    Modelo LLM (ej. deepseek-v4-flash)"
	@echo "  AGENT=...    Nombre del agente (ej. writer)"
