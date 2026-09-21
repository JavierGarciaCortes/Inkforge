/**
 * Genera src/data/vault.json a partir de los archivos de la bóveda.
 * Se ejecuta como prebuild y predev.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../");
const OUT = path.join(ROOT, "web/src/data/vault.json");

function slug(s) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripMd(t) {
  return t
    .replace(/\[\[([^|\]]+)(\|[^\]]+)?\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^>\s*/gm, "")
    .trim();
}

const ESC = "\x00";

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf-8");
}

function splitTable(line) {
  return line.replace(/\\\|/g, ESC).split("|").slice(1, -1).map(c => c.trim().replace(new RegExp(ESC, "g"), "|"));
}

function parseSections(text) {
  const sections = { __desc: [] };
  let cur = "__desc";
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      cur = slug(line.slice(3).trim());
      sections[cur] ??= [];
    } else {
      sections[cur] ??= [];
      if (line.trim()) sections[cur].push(line.trim());
    }
  }
  return sections;
}

// ── Characters ──
function getCharacters() {
  const dir = path.join(ROOT, "vault/Mundo/Personajes");
  if (!fs.existsSync(dir)) return [];
  const chars = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".md")) continue;
    const text = read(`vault/Mundo/Personajes/${f}`);
    const m = text.match(/^#\s+(.+)/m);
    if (!m) continue;
    const name = m[1].trim();
    const sections = parseSections(text);

    // Parse metadata: > **Key:** Value
    const properties = {};
    for (const line of text.split("\n")) {
      if (line.startsWith("> **")) {
        const idx = line.indexOf(":** ");
        if (idx > 0) {
          const key = line.slice(4, idx).trim();
          const val = line.slice(idx + 4).trim();
          properties[key] = val;
        }
      }
    }

    let desc = properties["Resumen"] || "";
    if (!desc) {
      const raw = (sections.__desc ?? [])
        .filter(l => !l.startsWith("> **"))
        .join("\n")
        .replace(/\*\*Tambi[ée]n[^*]*\*\*/g, "").trim();
      const lines = raw.split("\n").filter(Boolean);
      desc = lines[1] ?? lines[0] ?? "";
    }

    const detail = {};
    for (const [key, lines] of Object.entries(sections)) {
      if (key === "__desc") continue;
      detail[key] = lines.join("\n").trim();
    }

    let role = properties["Rol"] || "—";

    const relSection = sections[slug("Relaciones")] ?? [];
    let relaciones = relSection.join(" ").replace(/\*\*/g, "").trim();
    if (!relaciones) {
      const links = [...text.matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)]
        .map((m) => m[1])
        .filter((l) => !l.includes("/") && slug(l) !== slug(name));
      relaciones = links.slice(0, 5).join(" · ");
    }

    chars.push({ name, slug: slug(name), role, desc, properties, detail, relaciones });
  }
  return chars;
}

// ── Entities ──
function getEntities() {
  const dir = path.join(ROOT, "vault/Mundo/Historia");
  if (!fs.existsSync(dir)) return [];
  const entities = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".md")) continue;
    const text = read(`vault/Mundo/Historia/${f}`);
    const m = text.match(/^#\s+(.+)/m);
    if (!m) continue;
    const name = m[1].trim();
    const tipoM = text.match(/>\s*\*\*Tipo:\*\*\s*(.+)/);
    let cat = "lore";
    const catM = text.match(/>\s*\*\*Categoría:\*\*\s*(.+)/i);
    if (catM && /facci[oó]n|corpor/i.test(catM[1])) cat = "faccion";
    else if (!catM) {
      const tipoM = text.match(/>\s*\*\*Tipo:\*\*\s*(.+)/i);
      if (tipoM && /facci[oó]n|corpor/i.test(tipoM[1])) cat = "faccion";
    }
    let desc = "";
    for (const p of text.split(/\n\s*\n/)) {
      const pp = p.trim();
      if (pp && !pp.startsWith("#") && !pp.startsWith(">") && !pp.startsWith("---") && !pp.startsWith("**Tipo")) {
        desc = pp; break;
      }
    }
    const links = [...text.matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)]
      .map((m) => m[1])
      .filter((l) => !l.includes("/") && slug(l) !== slug(name))
      .slice(0, 6);
    const conn = links.length ? links.join(" · ") : "—";
    const content = text.replace(/^#\s+.+\n/, "").trim();
    entities.push({ name, slug: slug(name), cat, desc: desc.slice(0, 300).trim(), conn, content });
  }
  return entities;
}

// ── Places ──
function getPlaces() {
  const dir = path.join(ROOT, "vault/Mundo/Lugares");
  if (!fs.existsSync(dir)) return [];
  const places = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".md")) continue;
    const text = read(`vault/Mundo/Lugares/${f}`);
    const m = text.match(/^#\s+(.+)/m);
    if (!m) continue;
    const name = m[1].trim();

    // Metadata: > **Tipo:** for type
    const tipoM = text.match(/>\s*\*\*Tipo:\*\*\s*(.+)/);
    let type = "Región";
    if (tipoM) {
      type = tipoM[1].trim().split(":")[0].trim();
    } else {
      type = "(sin definir)";
    }

    let desc = "";
    for (const p of text.split(/\n\s*\n/)) {
      const pp = p.trim();
      if (pp && !pp.startsWith("#") && !pp.startsWith(">") && !pp.startsWith("**Tamb") && pp !== "---") {
        desc = pp; break;
      }
    }
    places.push({ name, slug: slug(name), desc: desc.slice(0, 300).trim(), type, content: text.replace(/^#\s+.+\n/, "").trim() });
  }
  return places;
}

// ── Timeline ──
function getTimeline() {
  const fp = path.join(ROOT, "vault/Referencias/Cronología.md");
  if (!fs.existsSync(fp)) return [];
  const text = fs.readFileSync(fp, "utf-8");
  const events = [];
  for (const line of text.split("\n")) {
    const cells = splitTable(line);
    if (cells.length >= 3 && cells[0] && !cells[0].startsWith("Año") && !cells[0].startsWith("---")) {
      let cls = "";
      const title = cells[1].toLowerCase();
      if (title.includes("colapso") || title.includes("descubrimiento") || title.includes("crisis") || title.includes("fundación") || title.includes("guerra"))
        cls = "key";
      events.push({ year: cells[0], title: cells[1], desc: cells[2] || "", cls });
    }
  }
  return events;
}

// ── Foreshadowing ──
function getForeshadowing() {
  const fp = path.join(ROOT, "vault/Referencias/Foreshadowing.md");
  if (!fs.existsSync(fp)) return [];
  const text = fs.readFileSync(fp, "utf-8");
  const threads = [];
  for (const line of text.split("\n")) {
    const cells = splitTable(line);
    if (cells.length >= 5 && cells[0] && !cells[0].startsWith("Hilo") && !cells[0].startsWith("---")) {
      const raw = cells[cells.length - 1];
      let estado = "🔴 Abierta";
      if (raw.includes("🟢")) estado = "🟢 Cerrada";
      else if (raw.includes("🟡")) estado = "🟡 Parcial";
      threads.push({ hilo: stripMd(cells[0]), estado });
    }
  }
  return threads;
}

// ── Trama ──
function getTrama() {
  const fp = path.join(ROOT, "vault/Referencias/Trama.md");
  if (!fs.existsSync(fp)) return { premisa: "", conflicto: "", temas: [], conflictoReal: "", paradoja: "", content: "" };
  const text = fs.readFileSync(fp, "utf-8");
  const sections = {};
  let cur = "";
  for (const line of text.split("\n")) {
    const h = line.match(/^## (.+)/);
    if (h) { cur = h[1].toLowerCase().trim(); sections[cur] = []; }
    else if (cur) { const l = line.trim(); if (l && !l.startsWith(">")) sections[cur].push(l); }
  }
  const premisa = (sections["premisa"] ?? []).join("\n").trim();
  const conflicto = (sections["conflicto central (aparente)"] ?? sections["conflicto central"] ?? []).join("\n").trim();
  const realParrafos = sections["conflicto real"] ?? [];
  const conflictoReal = realParrafos[0] ?? "";
  const paradoja = realParrafos[1] ?? "";
  const temas = (sections["temas"] ?? []).filter(l => l.startsWith("- ")).map(l => l.slice(2).trim());
  const content = text.replace(/^#\s+.+\n/, "").trim();
  return { premisa, conflicto, temas, conflictoReal, paradoja, content };
}

// ── Léxico ──
function getLexico() {
  const fp = path.join(ROOT, "vault/Referencias/Léxico.md");
  if (!fs.existsSync(fp)) return [];
  const text = fs.readFileSync(fp, "utf-8");
  const entries = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("|") && !line.includes("---") && !line.includes("Término") && !line.includes("-------")) {
      const cells = splitTable(line);
      if (cells.length >= 2 && cells[0]) {
        entries.push({
          term: cells[0].replace(/\[\[|\]\]/g, "").trim(),
          def: cells[1] || "",
          ficha: cells[2] || "—",
        });
      }
    }
  }
  return entries;
}

// ── Estado ──
function getEstado() {
  const fp = path.join(ROOT, "vault/Referencias/Estado.md");
  if (!fs.existsSync(fp)) return { updated: "", palabras: 0, capitulos: 0, chars: 0, lugares: 0, lore: 0 };
  const text = fs.readFileSync(fp, "utf-8");
  const um = text.match(/\*\*Última actualización\*\*:\s*(.+)/);
  let palabras = 0, capitulos = 0, chars = 0, lugares = 0, lore = 0, inT = false;
  for (const line of text.split("\n")) {
    if (line.includes("Métrica") && line.includes("Valor")) { inT = true; continue; }
    if (!inT) continue;
    if (!line.startsWith("|")) { inT = false; continue; }
    const c = splitTable(line);
    if (c[0]?.includes("Palabras")) palabras = parseInt(c[1]) || 0;
    if (c[0]?.includes("Capítulos")) capitulos = parseInt(c[1]) || 0;
    if (c[0]?.includes("Personajes")) chars = parseInt(c[1]) || 0;
    if (c[0]?.includes("Lugares")) lugares = parseInt(c[1]) || 0;
    if (c[0]?.includes("Lore")) lore = parseInt(c[1]) || 0;
  }
  return { updated: um ? um[1].trim() : "", palabras, capitulos, chars, lugares, lore };
}

// ── Config ──
function getConfig() {
  const fp = path.join(ROOT, ".fiction/config.json");
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return { title: "Fiction Vault", subtitle: "" };
  }
}

// ── Fundamentos ──
function getFundamentos() {
  const fp = path.join(ROOT, "vault/Referencias/Fundamentos.md");
  if (!fs.existsSync(fp)) return "";
  const text = fs.readFileSync(fp, "utf-8");
  return text.replace(/^#\s+.+\n/, "").trim();
}

// ── Main ──
const config = getConfig();
const chars = getCharacters();
const entities = getEntities();
const places = getPlaces();
const timeline = getTimeline();
const foreshadowing = getForeshadowing();
const trama = getTrama();
const lexico = getLexico();
const estado = getEstado();
const fundamentos = getFundamentos();
const openCount = foreshadowing.filter((f) => f.estado.includes("🔴")).length;

const data = {
  config,
  stats: {
    charCount: chars.length,
    loreCount: entities.length,
    placeCount: places.length,
    openCount,
  },
  chars,
  entities,
  places,
  timeline,
  foreshadowing,
  trama,
  lexico,
  estado,
  fundamentos,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2), "utf-8");
console.log(`✅ vault data generated: ${chars.length} chars, ${entities.length} entities, ${places.length} places, ${timeline.length} events`);
