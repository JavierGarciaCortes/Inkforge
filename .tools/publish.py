#!/usr/bin/env python3
"""
publish.py — Compila capítulos Markdown a EPUB y HTML.

Sin dependencias externas. Usa solo stdlib (zipfile, xml).

Uso:
    python tools/publish.py                       # genera EPUB
    python tools/publish.py --format html         # genera HTML único
    python tools/publish.py --format all          # EPUB + HTML
    python tools/publish.py --output ../mi-libro  # ruta de salida
"""

import re
import sys
import json
import datetime
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape as xml_escape

from vault import VAULT, CHAPTERS_DIR, get_chapter_number, get_chapter_title, get_chapter_files, chapter_summary, strip_yaml, strip_comments

# ---------------------------------------------------------------------------
# Markdown → XHTML
# ---------------------------------------------------------------------------

WIKI_LINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def md_to_xhtml(text: str) -> str:
    """Convierte markdown básico a XHTML."""
    lines = text.split("\n")
    out: list[str] = []
    in_paragraph = False
    in_blockquote = False
    in_code_block = False

    def close_para():
        nonlocal in_paragraph
        if in_paragraph:
            out.append("</p>")
            in_paragraph = False

    def close_blockquote():
        nonlocal in_blockquote
        if in_blockquote:
            out.append("</blockquote>")
            in_blockquote = False

    for raw_line in lines:
        # Metadata YAML
        if raw_line.strip() in ("---", "..."):
            continue

        # Saltar líneas de metadata (clave: valor)
        if re.match(r"^\w[\w_]*\s*:\s*.+", raw_line) and not in_code_block:
            continue

        # Code blocks
        if raw_line.strip().startswith("```"):
            close_para()
            if in_code_block:
                out.append("</code></pre>")
                in_code_block = False
            else:
                out.append("<pre><code>")
                in_code_block = True
            continue

        if in_code_block:
            out.append(xml_escape(raw_line))
            continue

        stripped = raw_line.strip()

        # Saltar comentarios HTML
        if stripped.startswith("<!--") and stripped.endswith("-->"):
            continue
        if stripped.startswith("<!--"):
            continue
        if stripped == "":
            close_para()
            close_blockquote()
            continue

        # Encabezados
        hm = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if hm:
            close_para()
            close_blockquote()
            level = len(hm.group(1))
            content = _inline(hm.group(2))
            out.append(f"<h{level}>{content}</h{level}>")
            continue

        # Cita
        if stripped.startswith(">"):
            close_para()
            if not in_blockquote:
                out.append("<blockquote>")
                in_blockquote = True
            out.append(f"<p>{_inline(stripped[1:].strip())}</p>")
            continue

        # Separador de escena (invisible en publicación)
        # Va antes de listas para evitar que - - - se interprete como item
        if stripped in ("⁓ ⁓ ⁓", "- - -", "* * *"):
            close_para()
            close_blockquote()
            out.append("""<div class="scene-break"></div>""")
            continue

        # Línea horizontal
        if re.match(r"^---+$", stripped) or re.match(r"^\*\*\*+$", stripped):
            close_para()
            close_blockquote()
            out.append("<hr/>")
            continue

        # Listas
        lm = re.match(r"^[\*\-]\s+(.+)$", stripped)
        if lm:
            close_para()
            out.append(f"<li>{_inline(lm.group(1))}</li>")
            continue

        # Párrafo normal — cada línea es su propio <p> con indent
        if not in_paragraph:
            out.append("<p>")
            in_paragraph = True
        else:
            out.append("</p><p>")
        out.append(_inline(raw_line))

    close_para()
    close_blockquote()
    if in_code_block:
        out.append("</code></pre>")

    return "\n".join(out)


def _inline(text: str) -> str:
    """Convierte markdown inline a XHTML."""
    # Wiki links
    def replace_wiki(m):
        label = m.group(2) if m.group(2) else m.group(1)
        return xml_escape(label)

    text = WIKI_LINK_RE.sub(replace_wiki, text)

    # **bold**
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # *italic*
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)

    return xml_escape(text).replace("&lt;strong&gt;", "<strong>").replace("&lt;/strong&gt;", "</strong>").replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")


def _strip_first_h1(html: str) -> str:
    """Elimina el primer <h1> del HTML (el título del capítulo)."""
    return re.sub(r"<h1[^>]*>.*?</h1>", "", html, count=1)


# ---------------------------------------------------------------------------
# EPUB Generation
# ---------------------------------------------------------------------------

EPUB_VERSION = "3.0"
UUID = "urn:uuid:a1b2c3d4-e5f6-7890-abcd-ef1234567890"
LANGUAGE = "es"


def generate_epub(chapters: list[dict], output_path: Path, title: str, author: str):
    """Genera un archivo EPUB desde los capítulos."""

    # ── Preparar contenido ──
    xhtml_chapters: list[dict] = []
    for ch in chapters:
        chapter_num = ch["num"]
        is_prologue = (chapter_num == 0)
        chapter_label = "" if is_prologue else str(chapter_num)
        display_id = "prologo" if is_prologue else f"chapter-{chapter_num}"
        display_file = "prologo.xhtml" if is_prologue else f"chapter-{chapter_num}.xhtml"
        body = _strip_first_h1(ch["content"])
        xhtml = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{LANGUAGE}">
<head>
  <meta charset="utf-8"/>
  <title>{xml_escape(ch['title'])}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="chapter">
    <div class="chapter-header">
      <p class="chapter-num">{chapter_label}</p>
      <h1 class="chapter-title">{xml_escape(ch['title'])}</h1>
      <div class="divider">⁓ ⁓ ⁓</div>
    </div>
    {body}
  </div>
</body>
</html>"""
        xhtml_chapters.append({
            "id": display_id,
            "file": display_file,
            "title": ch["title"],
            "content": xhtml,
        })

    # ── CSS ──
    css = """@namespace epub "http://www.idpf.org/2007/ops";
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.5;
  margin: 0;
  padding: 0 0.6em;
  font-size: 1em;
  color: #1a1a1a;
}
h2 { font-size: 1.3em; margin: 1.5em 0 0.8em; font-weight: normal; }
h3 { font-size: 1.1em; margin: 1.2em 0 0.6em; font-weight: bold; }
.chapter p { margin: 0; text-indent: 1.5em; }
blockquote {
  margin: 1em 1.5em;
  font-style: italic;
  color: #444;
}
hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
.chapter-header { text-align: center; margin-bottom: 2em; }
.chapter .chapter-num { font-size: 1.1em; color: #1a1a1a; margin-bottom: 0.8em; text-align: center; text-indent: 0; line-height: 1; }
.chapter-title { font-size: 1.5em; text-align: center; font-weight: normal; margin: 0; line-height: 1; }
.divider { margin: 0.8em 0 1.5em; color: #999; font-size: 1.1em; letter-spacing: 0.3em; }
.scene-break { margin: 3em 0; }"""

    # ── Armar EPUB ──
    epub_path = output_path
    if epub_path.suffix != ".epub":
        epub_path = epub_path.with_suffix(".epub")

    from zipfile import ZIP_STORED

    with ZipFile(epub_path, "w", ZIP_DEFLATED) as zf:
        # mimetype debe ir primero y sin compresión
        zf.writestr("mimetype", "application/epub+zip", compress_type=ZIP_STORED)

        # container.xml
        zf.writestr("META-INF/container.xml", """<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>""")

        # content.opf
        manifest = "\n".join(
            f'    <item id="{ch["id"]}" href="{ch["file"]}" media-type="application/xhtml+xml"/>'
            for ch in xhtml_chapters
        )
        spine = "\n".join(
            f'    <itemref idref="{ch["id"]}"/>'
            for ch in xhtml_chapters
        )
        zf.writestr("OEBPS/content.opf", f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">{UUID}</dc:identifier>
    <dc:title>{xml_escape(title)}</dc:title>
    <dc:creator>{xml_escape(author)}</dc:creator>
    <dc:language>{LANGUAGE}</dc:language>
    <meta property="dcterms:modified">{datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}</meta>
  </metadata>
  <manifest>
    <item id="styles" href="styles.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
{manifest}
  </manifest>
  <spine>
{spine}
  </spine>
</package>""")

        # nav.xhtml (EPUB3 navigation)
        nav_items = "\n".join(
            f'          <li><a href="{ch["file"]}">{xml_escape(ch["title"])}</a></li>'
            for ch in xhtml_chapters
        )
        zf.writestr("OEBPS/nav.xhtml", f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{LANGUAGE}">
<head><title>{xml_escape(title)}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>{xml_escape(title)}</h1>
    <ol>
{nav_items}
    </ol>
  </nav>
</body>
</html>""")

        # styles.css
        zf.writestr("OEBPS/styles.css", css)

        # Capítulos
        for ch in xhtml_chapters:
            zf.writestr(f'OEBPS/{ch["file"]}', ch["content"])


_HTML_CSS = """body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.5;
  color: #1a1a1a;
  max-width: 40em;
  margin: 0 auto;
  padding: 1.2em 0.9em;
  font-size: 1.05em;
}
.title-page { text-align: center; margin-top: 30vh; margin-bottom: 30vh; }
.title-page h1 { font-size: 2.2em; font-weight: normal; margin-bottom: 0.3em; }
.title-page p { font-size: 1.1em; color: #555; }
.chapter { page-break-before: always; margin-top: 3em; }
.chapter-header { text-align: center; margin-bottom: 2em; }
.chapter .chapter-num { font-size: 1.1em; color: #1a1a1a; margin-bottom: 0.8em; text-align: center; text-indent: 0; line-height: 1; }
.chapter-title { font-size: 1.5em; font-weight: normal; margin: 0; line-height: 1; }
.divider { margin: 0.8em 0 1.5em; color: #999; font-size: 1.1em; letter-spacing: 0.3em; }
.scene-break { margin: 3em 0; }
.chapter p { margin: 0; text-indent: 1.5em; }
blockquote { margin: 1em 1.5em; font-style: italic; color: #444; }
hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
pre { background: #f5f5f5; padding: 1em; overflow-x: auto; font-size: 0.85em; }
em { font-style: italic; }
strong { font-weight: bold; }
@media print {
  body { font-size: 12pt; text-align: justify; hyphens: auto; }
  .chapter { page-break-before: always; }
  .blank-page { page: blank; page-break-before: always; break-after: always; height: 0; }
}
@page :first {
  @bottom-center { content: none; }
  counter-increment: page 0;
}
@page blank {
  @bottom-center { content: none; }
  counter-increment: page 0;
}
@page {
  margin: 4em 1.5em 5.5em 1.5em;
  @bottom-center {
    content: "— " counter(page) " —";
    font-size: 10pt;
    color: #666;
    font-family: Georgia, serif;
  }
}"""


def _render_html(chapters: list[dict], title: str, author: str) -> str:
    """Renderiza todos los capítulos a un string HTML completo."""
    body_parts = []
    for ch in chapters:
        chapter_num = ch["num"]
        chapter_label = "" if chapter_num == 0 else str(chapter_num)
        content = _strip_first_h1(ch["content"])
        body_parts.append(f"""<section class="chapter">
  <div class="chapter-header">
    <p class="chapter-num">{chapter_label}</p>
    <h1 class="chapter-title">{xml_escape(ch['title'])}</h1>
    <div class="divider">⁓ ⁓ ⁓</div>
  </div>
  {content}
</section>""")

    return f"""<!DOCTYPE html>
<html lang="{LANGUAGE}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{xml_escape(title)}</title>
  <style>{_HTML_CSS}</style>
</head>
<body>
  <div class="title-page">
    <h1>{xml_escape(title)}</h1>
    <p>{xml_escape(author)}</p>
  </div>
  <div class="blank-page"></div>
  {''.join(body_parts)}
</body>
</html>"""


def generate_html(chapters: list[dict], output_path: Path, title: str, author: str):
    """Genera un único HTML autónomo con todos los capítulos."""
    html = _render_html(chapters, title, author)
    output_path.write_text(html, encoding="utf-8")
    return output_path


# ---------------------------------------------------------------------------
# PDF Generation (via weasyprint — opcional)
# ---------------------------------------------------------------------------

try:
    from weasyprint import HTML as _WeasyHTML
    HAS_WEASYPRINT = True
except ImportError:
    HAS_WEASYPRINT = False


def generate_pdf(chapters: list[dict], output_path: Path, title: str, author: str,
                 keep_html: bool = False):
    """Genera PDF desde HTML usando weasyprint."""
    if not HAS_WEASYPRINT:
        print("  ⚠ weasyprint no instalado. Para PDF:")
        print("     python3 -m venv .venv && .venv/bin/pip install weasyprint")
        print("     .venv/bin/python tools/publish.py --format pdf")
        return None

    # HTML temporal para alimentar weasyprint
    html_str = _render_html(chapters, title, author)
    _WeasyHTML(string=html_str).write_pdf(output_path)
    return output_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def load_chapters_for_beta() -> list[dict]:
    """Carga capítulos con números de línea, sin metadata ni notas internas."""
    if not CHAPTERS_DIR.exists():
        return []

    files = get_chapter_files()
    chapters = []
    for f in files:
        num = get_chapter_number(f.name)
        if num is None or num > 99:
            continue
        text = f.read_text("utf-8")
        title = get_chapter_title(text)
        text = strip_comments(text)
        text = strip_yaml(text)
        text = re.sub(r"^\d+\. ", "", text, flags=re.MULTILINE)

        # Quitar el primer # heading (ya está en el chapter-header)
        text = re.sub(r"^# .+", "", text, count=1, flags=re.MULTILINE)
        text = text.strip()

        # Añadir números de línea
        lines = text.split("\n")
        numbered = []
        for i, line in enumerate(lines, 1):
            numbered.append(f'<span class="ln" id="L{i}">{i:03d}</span> {xml_escape(line)}')
        content = "\n".join(numbered)
        content = md_to_xhtml_beta(content)

        chapters.append({
            "num": num,
            "title": title,
            "content": content,
        })

    chapters.sort(key=lambda c: c["num"])
    return chapters


def md_to_xhtml_beta(text: str) -> str:
    """Versión simplificada para beta: preserva lineas pero marca saltos de escena."""
    lines = text.split("\n")
    out = []
    in_para = False

    def close():
        nonlocal in_para
        if in_para:
            out.append("</p>")
            in_para = False

    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped == "":
            close()
            out.append(raw_line if not raw_line.startswith("&lt;") else raw_line)
            continue
        if stripped in ("- - -", "* * *", "⁓ ⁓ ⁓"):
            close()
            out.append(raw_line.replace("<span", '<span class="scene-break"').replace("</span>", "") + " ")
            continue
        if stripped.startswith("#"):
            close()
            level = stripped.count("#", 0, 4)
            content = stripped.lstrip("# ")
            out.append(f'<h{level}>{content}</h{level}>')
            continue
        if not in_para:
            out.append("<p>")
            in_para = True
        else:
            out.append("</p><p>")
        out.append(raw_line)

    close()
    return "\n".join(out)


_BETA_CSS = """body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  max-width: 42em;
  margin: 0 auto;
  padding: 1.5em;
  color: #1a1a1a;
}
.title-page { text-align: center; margin-top: 20vh; margin-bottom: 10vh; }
.title-page h1 { font-size: 2em; font-weight: normal; }
.title-page p { color: #555; }
.chapter { margin-top: 2em; }
.chapter-header { text-align: center; margin-bottom: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 0.8em; }
.chapter-title { font-size: 1.4em; font-weight: normal; margin: 0; }
.chapter p { margin: 0; text-indent: 0; padding-left: 3ch; }
.ln { color: #999; font-size: 0.8em; font-family: "Fira Code", "Cascadia Code", monospace; user-select: none; margin-right: 0.5em; }
.ln:hover { color: #333; }
h2 { font-size: 1.2em; margin: 1.2em 0 0.5em; }
h3 { font-size: 1.1em; margin: 1em 0 0.4em; }
@media print {
  body { font-size: 11pt; }
  .ln { display: none; }
  .chapter { page-break-before: always; }
}
"""


def generate_beta(chapters: list[dict], output_path: Path, title: str, author: str):
    """Genera HTML para beta readers con números de línea."""
    body_parts = []
    for ch in chapters:
        body_parts.append(f"""<section class="chapter">
  <div class="chapter-header">
    <h1 class="chapter-title">{xml_escape(ch['title'])}</h1>
  </div>
  {ch['content']}
</section>""")

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{xml_escape(title)} — Beta</title>
  <style>{_BETA_CSS}</style>
</head>
<body>
  <div class="title-page">
    <h1>{xml_escape(title)}</h1>
    <p>{xml_escape(author)} — Borrador para beta readers</p>
    <p style="color:#999;font-size:0.85em;margin-top:2em;">Generado el {datetime.date.today().isoformat()}</p>
  </div>
  {''.join(body_parts)}
</body>
</html>"""
    output_path.write_text(html, encoding="utf-8")
    return output_path


def load_chapters() -> list[dict]:
    """Carga y parsea todos los capítulos del vault."""
    files = get_chapter_files()
    if not files:
        print(f"⚠ No se encontraron capítulos en: {CHAPTERS_DIR}")
        return []

    chapters = []
    for f in files:
        num = get_chapter_number(f.name)
        if num is None or num > 99:
            continue
        text = f.read_text("utf-8")
        title = get_chapter_title(text)
        text = strip_comments(text)
        text = strip_yaml(text)
        content = md_to_xhtml(text)
        chapters.append({
            "num": num,
            "title": title,
            "file": f.name,
            "content": content,
        })

    chapters.sort(key=lambda c: c["num"])
    return chapters


def main():
    import argparse

    ap = argparse.ArgumentParser(description="Compila capítulos a EPUB/HTML.")
    ap.add_argument("--format", choices=["epub", "html", "pdf", "all"], default="epub",
                    help="Formato de salida (default: epub)")
    ap.add_argument("--output", "-o", default=None,
                    help="Ruta del archivo de salida (sin extensión)")
    ap.add_argument("--title", default=None,
                    help="Título del libro (default: project.json → nombre del directorio)")
    ap.add_argument("--author", default=None,
                    help="Autor del libro (default: project.json → 'Autor')")
    ap.add_argument("--beta", action="store_true",
                    help="Exportar para beta readers: HTML con números de línea, sin metadatos internos")
    args = ap.parse_args()

    # Cargar metadatos primero (necesario tanto para beta como para formatos normales)
    project_config = {}
    config_file = VAULT / ".fiction" / "config.json"
    if config_file.exists():
        try:
            project_config = json.loads(config_file.read_text("utf-8"))
        except json.JSONDecodeError:
            pass

    if args.beta:
        chapters = load_chapters_for_beta()
        if not chapters:
            print("✗ No se encontraron capítulos.")
            sys.exit(1)
        title = args.title or project_config.get("title") or VAULT.name
        author = args.author or project_config.get("author") or "Autor"
        output_base = args.output or str(VAULT / "output" / title.lower().replace(" ", "-") + "-beta")
        output_path = Path(output_base).with_suffix(".html")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result = generate_beta(chapters, output_path, title, author)
        kb = result.stat().st_size / 1024
        print(f"  ✅ Beta HTML: {output_path} ({kb:.0f} KB)")
        print(f"     Comparte este archivo con tus beta readers.")
        return

    chapters = load_chapters()
    if not chapters:
        print("✗ No se encontraron capítulos.")
        sys.exit(1)

    title = args.title or project_config.get("title") or VAULT.name
    author = args.author or project_config.get("author") or "Autor"
    output_base = args.output

    if output_base:
        output_path = Path(output_base)
    else:
        output_dir = VAULT / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / title.lower().replace(" ", "-")

    print(f"📖 {title} — {author}")
    print(f"   {len(chapters)} capítulos cargados")
    print()

    if args.format in ("epub", "all"):
        epub_path = output_path.with_suffix(".epub") if output_path.suffix else output_path.parent / f"{output_path.name}.epub"
        generate_epub(chapters, epub_path, title, author)
        kb = epub_path.stat().st_size / 1024
        print(f"  ✅ EPUB: {epub_path} ({kb:.0f} KB)")

    if args.format in ("html", "all"):
        html_path = output_path.with_suffix(".html") if output_path.suffix else output_path.parent / f"{output_path.name}.html"
        generate_html(chapters, html_path, title, author)
        kb = html_path.stat().st_size / 1024
        print(f"  ✅ HTML: {html_path} ({kb:.0f} KB)")

    if args.format in ("pdf", "all"):
        pdf_path = output_path.with_suffix(".pdf") if output_path.suffix else output_path.parent / f"{output_path.name}.pdf"
        result = generate_pdf(chapters, pdf_path, title, author)
        if result:
            kb = pdf_path.stat().st_size / 1024
            print(f"  ✅ PDF: {pdf_path} ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
