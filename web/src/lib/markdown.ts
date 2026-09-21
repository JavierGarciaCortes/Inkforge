import { marked } from "marked";
import {
  getCharacters,
  getEntities,
  getPlaces,
} from "./vault";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSlugMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of getCharacters()) {
    map[c.slug] = `/dashboard/personajes/${c.slug}`;
    map[`personajes/${c.slug}`] = `/dashboard/personajes/${c.slug}`;
    const alt = slugify(c.name.split("/")[0]);
    if (alt !== c.slug) map[alt] = `/dashboard/personajes/${c.slug}`;
  }
  for (const e of getEntities()) {
    map[e.slug] = `/dashboard/historia/${e.slug}`;
    map[`historia/${e.slug}`] = `/dashboard/historia/${e.slug}`;
    const alt = slugify(e.name.split("/")[0]);
    if (alt !== e.slug) map[alt] = `/dashboard/historia/${e.slug}`;
  }
  for (const p of getPlaces()) {
    map[p.slug] = `/dashboard/lugares/${p.slug}`;
    map[`lugares/${p.slug}`] = `/dashboard/lugares/${p.slug}`;
    const alt = slugify(p.name.split("/")[0]);
    if (alt !== p.slug) map[alt] = `/dashboard/lugares/${p.slug}`;
  }
  return map;
}

export function renderMd(
  text: string,
  slugMap?: Record<string, string>
): string {
  const unescaped = text.replace(/\\\|/g, "|");
  const withLinks = unescaped.replace(
    /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
    (_match: string, target: string, display?: string) => {
      const clean = target.split("/").pop() ?? target;
      const cat = target.match(/Mundo\/(Personajes|Historia|Lugares)\//);
      let slug = slugify(clean);
      let href: string | undefined;
      if (cat) {
        const catKey: Record<string, string> = { Personajes: "personajes", Historia: "historia", Lugares: "lugares" };
        href = slugMap?.[`${catKey[cat[1]]}/${slug}`];
      }
      if (!href) href = slugMap?.[slug];
      return `<a href="${href ?? "#"}">${display ?? clean}</a>`;
    }
  );
  return marked.parse(withLinks, { async: false }) as string;
}
