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
	$(PYTHON) $(TOOLS)/consistency_check.py --cap all $(ARGS)

# ── Publicación ─────────────────────────────────────────────────────────────

publish:  ## Generar EPUB. FORMAT=html|pdf|all  TITLE=... AUTHOR=...
	$(PYTHON) $(TOOLS)/publish.py --format $(or $(FORMAT),epub) \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(AUTHOR),--author "$(AUTHOR)") $(ARGS)

publish-all:  ## EPUB + HTML + PDF
	$(PYTHON) $(TOOLS)/publish.py --format all \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(AUTHOR),--author "$(AUTHOR)") $(ARGS)

publish-beta:  ## HTML con números de línea para beta readers
	$(PYTHON) $(TOOLS)/publish.py --beta \
		$(if $(TITLE),--title "$(TITLE)") \
		$(if $(AUTHOR),--author "$(AUTHOR)") $(ARGS)

# ── Sesión ──────────────────────────────────────────────────────────────────

session:  ## Estado actual derivado de los Markdown
	$(PYTHON) $(TOOLS)/session_check.py $(ARGS)

session-full:  ## Estado actual y textos de planificación
	$(PYTHON) $(TOOLS)/session_check.py --full $(ARGS)

session-quick:  ## Resumen actual de capítulos
	$(PYTHON) $(TOOLS)/session_check.py --quick $(ARGS)

# ── Carta editorial ─────────────────────────────────────────────────────────

letter:  ## Carta editorial completa
	$(PYTHON) $(TOOLS)/editorial_letter.py $(ARGS)

letter-beta:  ## Informe profesional sintético
	$(PYTHON) $(TOOLS)/editorial_letter.py --beta $(ARGS)

letter-plan:  ## Plan de revisión faseado
	$(PYTHON) $(TOOLS)/editorial_letter.py --plan $(ARGS)

letter-cap:  ## Carta de un capítulo. ARGS=--cap 07
	$(PYTHON) $(TOOLS)/editorial_letter.py $(ARGS)

letter-insights:  ## Análisis avanzado general
	$(PYTHON) $(TOOLS)/editorial_letter.py --insights $(ARGS)

# ── Diagnóstico ─────────────────────────────────────────────────────────────

diagnose:  ## Diagnósticos del libro seleccionado
	$(PYTHON) $(TOOLS)/editorial_insights.py --module style $(ARGS)
	$(PYTHON) $(TOOLS)/editorial_insights.py --module dialogue $(ARGS)
	$(PYTHON) $(TOOLS)/editorial_insights.py --module scene_summary $(ARGS)

style:  ## Diagnóstico de estilo. ARGS=--cap 07
	$(PYTHON) $(TOOLS)/editorial_insights.py --module style $(ARGS)

dialogue:  ## Diagnóstico de diálogo. ARGS=--cap 07
	$(PYTHON) $(TOOLS)/editorial_insights.py --module dialogue $(ARGS)

# ── Mantenimiento ───────────────────────────────────────────────────────────

sort-lexico:  ## Ordenar alfabéticamente el léxico
	$(PYTHON) $(TOOLS)/sort_lexico.py $(ARGS)

lint:  ## Lint de las tools Python
	@which ruff >/dev/null 2>&1 && ruff check $(TOOLS)/*.py || echo "ruff no instalado. Omite."

# ── Ritual completo de inicio ──────────────────────────────────────────────

ritual:  ## Consultar el estado actual del libro
	$(PYTHON) $(TOOLS)/session_check.py --full $(ARGS)

ready:  ## Resumen breve del libro
	$(PYTHON) $(TOOLS)/session_check.py --quick $(ARGS)

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
	@echo "  VAULT_PATH=...   Raíz física de la obra Inkforge"
	@echo "  Para saga: ARGS=\"--book-scope Libros/<id> ...\""
	@echo "  FORMAT=...   Formato de publicación (html|pdf|all)"
	@echo "  TITLE=...    Título del libro para publicación"
	@echo "  AUTHOR=...   Autor del libro para publicación"
