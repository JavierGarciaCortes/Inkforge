import data from "../data/vault.json";

export interface Character {
  name: string;
  slug: string;
  role: string;
  desc: string;
  properties: Record<string, string>;
  detail: Record<string, string>;
  relaciones: string;
}

export interface Entity {
  name: string;
  slug: string;
  cat: "lore" | "faccion";
  desc: string;
  conn: string;
  content: string;
}

export interface Place {
  name: string;
  slug: string;
  desc: string;
  type: string;
  content: string;
}

export interface TimelineEvent {
  year: string;
  title: string;
  desc: string;
  cls: string;
}

export interface ForeshadowingThread {
  hilo: string;
  estado: string;
}

export interface Config {
  title: string;
  subtitle: string;
  charCount: number;
  loreCount: number;
  placeCount: number;
}

export interface SearchResult {
  name: string;
  desc: string;
  url: string;
  cat: string;
}

export function getSearchIndex(): SearchResult[] {
  return [
    ...(data.chars as Character[]).map(c => ({ name: c.name, desc: c.desc, url: `/dashboard/personajes/${c.slug}`, cat: "Personaje" })),
    ...(data.entities as Entity[]).map(e => ({ name: e.name, desc: e.desc, url: `/dashboard/historia/${e.slug}`, cat: "Historia" })),
    ...(data.places as Place[]).map(p => ({ name: p.name, desc: p.desc, url: `/dashboard/lugares/${p.slug}`, cat: "Lugar" })),
    ...(data.lexico as LexicoEntry[]).map(l => ({ name: l.term, desc: l.def, url: "/dashboard/lexico", cat: "Léxico" })),
    ...(data.timeline as TimelineEvent[]).map(t => ({ name: t.title, desc: t.desc, url: "/dashboard/cronologia", cat: "Cronología" })),
  ];
}

export function getConfig(): Config {
  const cfg = data.config;
  return {
    title: cfg.title ?? "Fiction Vault",
    subtitle: cfg.subtitle ?? "",
    charCount: data.chars.length,
    loreCount: data.entities.length,
    placeCount: data.places.length,
  };
}

export function getCharacters(): Character[] {
  return data.chars as Character[];
}

export function getCharacterBySlug(slug: string): Character | undefined {
  return data.chars.find((c: Character) => c.slug === slug);
}

export function getEntities(): Entity[] {
  return data.entities as Entity[];
}

export function getEntityBySlug(slug: string): Entity | undefined {
  return data.entities.find((e: Entity) => e.slug === slug);
}

export function getPlaces(): Place[] {
  return data.places as Place[];
}

export function getPlaceBySlug(slug: string): Place | undefined {
  return data.places.find((p: Place) => p.slug === slug);
}

export function getTimeline(): TimelineEvent[] {
  return data.timeline as TimelineEvent[];
}

export function getForeshadowing(): ForeshadowingThread[] {
  return data.foreshadowing as ForeshadowingThread[];
}

export interface Trama {
  premisa: string;
  conflicto: string;
  temas: string[];
  conflictoReal: string;
  paradoja: string;
  content: string;
}

export interface LexicoEntry {
  term: string;
  def: string;
  ficha: string;
}

export interface Estado {
  updated: string;
  palabras: number;
  capitulos: number;
  chars: number;
  lugares: number;
  lore: number;
}

export function getTrama(): Trama {
  return data.trama as Trama;
}

export function getLexico(): LexicoEntry[] {
  return data.lexico as LexicoEntry[];
}

export function getEstado(): Estado {
  return data.estado as Estado;
}

export function getFundamentos(): string {
  return data.fundamentos as string;
}
