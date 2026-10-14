/**
 * IcyBox lab: a reconstruction of the iOS app's mystery box from public sources, captured 14 October 2026.
 *
 * What is known for sure (terms, App Store listing, icybox.io, press releases): five box tiers from Bronze to Icy
 * priced $50 to $1,000; six rarity bands from Common to Grail with a chance and a value range shown per band before
 * buying; no seed, hash or verifier of any kind; a buyback offer "determined solely by IcyBox" and undisclosed; a
 * buyback period after which the item is sold back automatically; shipping 15 to 20 business days at the player's
 * cost; a $6 minimum withdrawal with fees by method; limited-edition boxes "once they're gone, they're gone"; and
 * terms that allow a box to be removed before all its items, including the grail, are distributed.
 *
 * What is reported (reviews, partner write-ups): buyback about 90% of the listed value; grail odds roughly 0.4% to
 * 3% by box; the grail band is wide ("a $140 Seiko or a $7,000 Cartier"); typical pulls near the box price; about
 * one pull in three worth more than it cost; shipping about $30 to $32 with tax; listed values above resale.
 *
 * What is reconstructed here (assumptions, all editable): the items inside each band (named from the site's ticker
 * and from reviews; the website carousel values are the showcase end of the grail band), a weight per item inside a
 * band (the cheap end of a wide band is common, the showcase end rare), the band chances (a hand-set shape fitted so
 * each box returns 85% of its price at listed values: between the 80% a case site pays and the near-price pulls the
 * reviews describe), the length of the buyback window, and the keep/sell behaviour.
 */
import { chiSquare } from "../metrics";
import { makeRng } from "../rng";
import type { CatalogItem, ChiSquare, IcyboxBand, IcyboxBandId, IcyboxBox, IcyboxConfig, IcyboxItem, IcyboxResult, IcyboxSpin, Progress, Verifier } from "../types";

export const ICYBOX_CAPTURED = "2026-10-14";
export const ICYBOX_TARGET_RETURN = 0.85;
export const BAND_ORDER: IcyboxBandId[] = ["common", "uncommon", "rare", "epic", "legendary", "grail"];
export const BAND_LABEL: Record<IcyboxBandId, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", grail: "Grail" };

/** [label, value, weight?, "bag"?] */
type Row = [string, number] | [string, number, number] | [string, number, number, "bag"];
const W = (rows: Row[]): Omit<IcyboxItem, "id">[] => rows.map(([label, value, weight, cat]) => ({ label, brand: label.split(" ")[0], value, weight: weight ?? 1, category: cat ?? "watch" }));
/** the hand-set shape every box starts from; the fit rescales every band but Common */
const SHAPE: Record<IcyboxBandId, number> = { common: 0.66, uncommon: 0.16, rare: 0.08, epic: 0.045, legendary: 0.03, grail: 0.025 };
function box(slug: string, name: string, tier: IcyboxBox["tier"], price: number, showcase: number[], note: string, bands: [IcyboxBandId, Row[]][]): IcyboxBox {
  return {
    slug,
    name,
    tier,
    price,
    showcase,
    note,
    bands: bands.map(([id, rows]) => ({ id, label: BAND_LABEL[id], chance: SHAPE[id], items: W(rows).map((it, i) => ({ ...it, id: `${slug}-${id}-${i + 1}` })) })),
  };
}

/** The five boxes. Prices from icybox.io ("Boxes from $50 to $1,000") and reviews; showcase values from the site's box carousel. */
export const ICYBOX_BOXES: IcyboxBox[] = [
  box("bronze", "Bronze Box", "bronze", 50, [1175, 1150, 1150, 1150, 1125, 1100], "Entry box. Reviews: a $55 win sold back for $49; commons around $22; a $140 Seiko counts as a grail; shipping about $32 with tax.", [
    ["common", [["Casio F-91W", 22], ["Casio A168 Vintage", 35], ["Timex Weekender", 40], ["Swatch Gent Originals", 45]]],
    ["uncommon", [["Swatch Big Bold", 55], ["Timex Expedition", 60], ["Casio G-Shock DW-5600", 65], ["Citizen Quartz Dress", 75]]],
    ["rare", [["Casio G-Shock Solar", 85], ["Timex Q Reissue", 95], ["Swatch Irony", 100]]],
    ["epic", [["Casio G-Shock Metal", 130], ["Seiko 5 Sports", 140], ["Timex Marlin Hand-Wound", 150]]],
    ["legendary", [["Orient Bambino", 200], ["Citizen Promaster Dive", 250], ["Tissot PRX Quartz", 375]]],
    ["grail", [["Seiko 5 Sports (grail band)", 140, 30], ["Citizen Promaster Dive", 250, 18], ["Bulova Lunar Pilot", 400, 12], ["Seiko Presage Cocktail Time", 450, 9], ["Tissot PRX Powermatic 80", 1100], ["Hamilton Khaki Field Auto", 1125], ["Longines Conquest Quartz", 1150], ["Tissot Gentleman Powermatic 80", 1150], ["Hamilton Jazzmaster Auto", 1150], ["Longines HydroConquest Quartz", 1175]]],
  ]),
  box("silver", "Silver Box", "silver", 100, [4000, 3995, 3900, 3900, 3800, 3750], "Reviews call it the best value tier. One reviewer pulled a Tissot listed at $575 here; another a $2,800 grail after $250 spent.", [
    ["common", [["Swatch Big Bold", 55], ["Timex Expedition", 60], ["Casio G-Shock DW-5600", 65], ["Citizen Quartz Dress", 75], ["Swatch Irony", 90]]],
    ["uncommon", [["Timex Q Reissue", 110], ["Casio Edifice", 130], ["Seiko 5 Sports", 140], ["Timex Marlin Hand-Wound", 150]]],
    ["rare", [["Orient Bambino", 200], ["Citizen Promaster Dive", 250]]],
    ["epic", [["Tissot PRX Quartz", 375], ["Bulova Lunar Pilot", 400], ["Seiko Presage Cocktail Time", 450]]],
    ["legendary", [["Tissot PRX Powermatic 80", 575], ["Hamilton Khaki Field Auto", 650], ["Tissot Gentleman Powermatic 80", 1150]]],
    ["grail", [["Citizen Promaster Dive (grail band)", 250, 24], ["Tissot PRX Quartz", 375, 18], ["Tissot PRX Powermatic 80", 575, 12], ["Longines HydroConquest Auto", 1500, 6], ["Oris Aquis Date", 2000], ["Tudor Black Bay 58", 3750], ["TAG Heuer Carrera", 3800], ["Omega Seamaster Aqua Terra Quartz", 3900], ["Longines Spirit Zulu Time", 3900], ["Tudor Black Bay 41", 3995], ["Omega Seamaster Diver 300M", 4000]]],
  ]),
  box("ruby", "Ruby Box", "ruby", 250, [15000, 14500, 14400, 12600, 12200, 10825], "A reviewer cites a 3% grail chance on this box and says most grails are $500 watches while the app shows $10,000 to $15,000 pieces.", [
    ["common", [["Swatch Gent Originals", 120], ["Casio G-Shock Metal", 130], ["Seiko 5 Sports", 140], ["Citizen Eco-Drive", 150], ["Orient Bambino", 200]]],
    ["uncommon", [["Citizen Promaster Dive", 250], ["Tissot PRX Quartz", 375]]],
    ["rare", [["Bulova Lunar Pilot", 400], ["Seiko Presage Cocktail Time", 450], ["Seiko Presage Sharp Edged", 500]]],
    ["epic", [["Tissot PRX Powermatic 80", 575], ["Hamilton Khaki Field Auto", 650]]],
    ["legendary", [["Tissot Gentleman Powermatic 80", 1150], ["Longines HydroConquest Auto", 1500], ["Oris Aquis Date", 2000]]],
    ["grail", [["Seiko Presage Sharp Edged (grail band)", 500, 24], ["Tissot PRX Powermatic 80", 575, 18], ["Hamilton Khaki Field Auto", 650, 15], ["Longines HydroConquest Auto", 1500, 6], ["Tudor Black Bay 58", 3750], ["Omega Seamaster Diver 300M", 5500], ["Cartier Tank Must", 7000], ["Rolex Explorer 36", 10825], ["Rolex Oyster Perpetual 41", 12200], ["Rolex Datejust 41", 12600], ["Rolex Submariner Date", 14400], ["Cartier Santos Large", 14500], ["Rolex Submariner Date (2024)", 15000]]],
  ]),
  box("gold", "Gold Box", "gold", 500, [38400, 37500, 35000, 30000, 27500, 23500], "Watches and bags. Grail-band names are the site's own ticker items where the values match; the carousel values are the showcase end.", [
    ["common", [["Citizen Promaster Dive", 250], ["Tissot PRX Quartz", 375], ["Bulova Lunar Pilot", 400], ["Seiko Presage Cocktail Time", 450]]],
    ["uncommon", [["Seiko Presage Sharp Edged", 500], ["Tissot PRX Powermatic 80", 575], ["Hamilton Khaki Field Auto", 650]]],
    ["rare", [["Hamilton Jazzmaster Auto", 1150], ["Tissot Gentleman Powermatic 80", 1150]]],
    ["epic", [["Longines HydroConquest Auto", 1500], ["Oris Aquis Date", 2000]]],
    ["legendary", [["Tudor Black Bay 58", 3750], ["Omega Seamaster Diver 300M", 5500], ["Cartier Tank Must", 7000]]],
    ["grail", [["Longines HydroConquest Auto (grail band)", 1500, 18], ["Oris Aquis Date", 2000, 15], ["Tudor Black Bay 58", 3750, 12], ["Omega Seamaster Diver 300M", 5500, 6], ["Cartier Tank Must", 7000, 6], ["Chanel Flap Bag with Top Handle (Black)", 7700, 1, "bag"], ["Rolex Explorer 36", 10825], ["Chanel Small Classic Handbag", 11300, 1, "bag"], ["Louis Vuitton Murakami Capucines Mini", 12000, 1, "bag"], ["Rolex Submariner Date", 14400], ["Hublot Big Bang Integral Titanium Ceramic", 23500], ["Hermès Togo Birkin Retourne 35 (Black)", 27500, 1, "bag"], ["Dior Himalayan Crocodile Mini Lady Dior", 30000, 1, "bag"], ["Rolex GMT-Master II (Pepsi)", 35000], ["Hermès Kelly 28 Sellier", 37500, 1, "bag"], ["Rolex Daytona", 38400]]],
  ]),
  box("icy", "Icy Box", "icy", 1000, [250000, 121500, 80000, 70000, 67000, 65500], "The flagship. The $250,000 Royal Oak is the first item in the site's ticker.", [
    ["common", [["Seiko Presage Sharp Edged", 500], ["Tissot PRX Powermatic 80", 575], ["Hamilton Khaki Field Auto", 650], ["Seiko Prospex Diver", 850]]],
    ["uncommon", [["Hamilton Jazzmaster Auto", 1150], ["Tissot Gentleman Powermatic 80", 1150], ["Longines HydroConquest Auto", 1500]]],
    ["rare", [["Oris Aquis Date", 2000], ["Longines Spirit Zulu Time", 2200]]],
    ["epic", [["TAG Heuer Formula 1", 2100], ["Tudor Black Bay 36", 2800]]],
    ["legendary", [["Tudor Black Bay 58", 3750], ["Omega Seamaster Diver 300M", 5500], ["Cartier Tank Must", 7000], ["Chanel Flap Bag with Top Handle (Black)", 7700, 1, "bag"]]],
    ["grail", [["Tudor Black Bay 58 (grail band)", 3750, 18], ["Omega Seamaster Diver 300M", 5500, 15], ["Cartier Tank Must", 7000, 12], ["Chanel Flap Bag with Top Handle (Black)", 7700, 9, "bag"], ["Rolex Explorer 36", 10825, 6], ["Chanel Small Classic Handbag", 11300, 6, "bag"], ["Louis Vuitton Murakami Capucines Mini", 12000, 6, "bag"], ["Rolex Submariner Date", 14400, 6], ["Rolex Submariner Date (Bluesy)", 19800], ["Franck Muller Vanguard", 20200], ["Rolex Submariner Date (Hulk)", 20500], ["Hublot Classic Fusion Orlinski", 24100], ["Hermès Birkin 30 Rouge Casaque", 29000, 1, "bag"], ["Rolex GMT-Master II (Pepsi)", 35000], ["Audemars Piguet Royal Oak", 65500], ["Rolex Daytona Platinum (reconstructed)", 67000], ["Rolex GMT-Master II (Pepsi Meteorite)", 70000], ["Patek Philippe Aquanaut", 80000], ["Patek Philippe Nautilus (reconstructed)", 121500], ["Audemars Piguet Royal Oak \"Spider-Man\"", 250000]]],
  ]),
];
export const ICYBOX_BY_SLUG: Record<string, IcyboxBox> = Object.fromEntries(ICYBOX_BOXES.map((b) => [b.slug, b]));
export const icyboxBox = (slug: string): IcyboxBox => ICYBOX_BY_SLUG[slug] ?? ICYBOX_BOXES[0];

export const bandWeight = (b: IcyboxBand) => b.items.reduce((s, i) => s + Math.max(0, i.weight), 0);
/** weighted mean of the band's listed values */
export const bandMean = (b: IcyboxBand) => {
  const w = bandWeight(b);
  return w > 0 ? b.items.reduce((s, i) => s + i.value * Math.max(0, i.weight), 0) / w : 0;
};
export const bandMin = (b: IcyboxBand) => Math.min(...b.items.map((i) => i.value));
export const bandMax = (b: IcyboxBand) => Math.max(...b.items.map((i) => i.value));
/** share of the band's draws that land on this item */
export const itemShare = (b: IcyboxBand, it: IcyboxItem) => {
  const w = bandWeight(b);
  return w > 0 ? Math.max(0, it.weight) / w : 0;
};

/* ---------- table and maths ---------- */

export interface IcyboxTable {
  entries: { band: IcyboxBand; chance: number; from: number; to: number }[];
  total: number;
}
export function buildTable(box: IcyboxBox, chances?: Record<string, number>): IcyboxTable {
  let acc = 0;
  const entries = box.bands.map((band) => {
    const chance = Math.max(0, chances?.[band.id] ?? band.chance);
    const from = acc;
    acc += chance;
    return { band, chance, from, to: acc };
  });
  return { entries, total: acc };
}
/** u in [0,1): position = u × total; the first band whose upper edge is above it. */
export function lookupBand(t: IcyboxTable, u: number) {
  const pos = u * t.total;
  for (const e of t.entries) if (e.chance > 0 && pos < e.to) return e;
  for (let i = t.entries.length - 1; i >= 0; i--) if (t.entries[i].chance > 0) return t.entries[i];
  return t.entries[t.entries.length - 1];
}
/** u in [0,1): the item inside the band, by weight */
export function pickItem(band: IcyboxBand, u: number): IcyboxItem {
  const w = bandWeight(band);
  const pos = u * w;
  let acc = 0;
  for (const it of band.items) {
    if (it.weight <= 0) continue;
    acc += it.weight;
    if (pos < acc) return it;
  }
  return band.items[band.items.length - 1];
}

export interface IcyboxValues {
  buybackPercent: number;
  keepRate: number;
  shippingFee: number;
  taxRate: number;
  itemRealized: number;
}
export interface IcyboxMath {
  total: number;
  perBand: { id: IcyboxBandId; label: string; chance: number; share: number; meanValue: number; minValue: number; maxValue: number; costPerOpen: number; items: number; big: boolean }[];
  evListed: number;
  evBuyback: number;
  evReal: number;
  returnListed: number;
  returnBuyback: number;
  returnReal: number;
  pGrail: number;
  pAtOrAbovePrice: number;
}
/** Per-open sums: value × chance per band, at listed values, at the buyback rate, and really (kept items at resale minus fees, the rest sold back). */
export function icyboxMath(box: IcyboxBox, chances: Record<string, number> | undefined, v: IcyboxValues): IcyboxMath {
  const t = buildTable(box, chances);
  const perBand = t.entries.map((e) => {
    const share = t.total > 0 ? e.chance / t.total : 0;
    const mean = bandMean(e.band);
    return { id: e.band.id, label: e.band.label, chance: e.chance, share, meanValue: mean, minValue: bandMin(e.band), maxValue: bandMax(e.band), costPerOpen: share * mean, items: e.band.items.length, big: mean >= box.price };
  });
  const evListed = perBand.reduce((s, b) => s + b.costPerOpen, 0);
  const evBuyback = evListed * v.buybackPercent;
  let evReal = 0;
  let pBig = 0;
  for (const e of t.entries) {
    const share = t.total > 0 ? e.chance / t.total : 0;
    for (const it of e.band.items) {
      const p = share * itemShare(e.band, it);
      const keep = it.value >= box.price ? v.keepRate : 0;
      if (it.value >= box.price) pBig += p;
      evReal += p * (keep * (it.value * v.itemRealized - v.shippingFee - v.taxRate * it.value) + (1 - keep) * it.value * v.buybackPercent);
    }
  }
  const pGrail = perBand.find((b) => b.id === "grail")?.share ?? 0;
  return { total: t.total, perBand, evListed, evBuyback, evReal, returnListed: box.price > 0 ? evListed / box.price : 0, returnBuyback: box.price > 0 ? evBuyback / box.price : 0, returnReal: box.price > 0 ? evReal / box.price : 0, pGrail, pAtOrAbovePrice: pBig };
}

export function normaliseChances(box: IcyboxBox, chances: Record<string, number>): Record<string, number> {
  const t = buildTable(box, chances);
  const out: Record<string, number> = {};
  for (const e of t.entries) out[e.band.id] = t.total > 0 ? e.chance / t.total : 1 / t.entries.length;
  return out;
}
/** Multiply the chance of every band but Common by k; Common absorbs the difference. */
export function scaleBigOdds(box: IcyboxBox, base: Record<string, number>, k: number): Record<string, number> {
  const out = { ...base };
  let moved = 0;
  for (const b of box.bands) {
    if (b.id === "common") continue;
    const c = base[b.id] ?? b.chance;
    out[b.id] = c * k;
    moved += c * k - c;
  }
  out.common = Math.max(0, (base.common ?? box.bands[0].chance) - moved);
  return normaliseChances(box, out);
}
export function bigOddsRatio(box: IcyboxBox, base: Record<string, number>, chances?: Record<string, number>): number {
  if (!chances) return 1;
  const sum = (c: Record<string, number>) => box.bands.filter((b) => b.id !== "common").reduce((s, b) => s + (c[b.id] ?? b.chance), 0);
  const a = sum(base);
  return a > 0 ? sum(chances) / a : 1;
}
/** Binary search on the factor so the box returns `target` of its price at listed values. */
export function fitReturn(box: IcyboxBox, base: Record<string, number>, target: number, v: IcyboxValues): Record<string, number> {
  let lo = 0;
  let hi = 1;
  const ret = (k: number) => icyboxMath(box, scaleBigOdds(box, base, k), v).returnListed;
  while (ret(hi) < target && hi < 1e6) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ret(mid) < target) lo = mid;
    else hi = mid;
  }
  return scaleBigOdds(box, base, hi);
}
const DEFAULT_VALUES: IcyboxValues = { buybackPercent: 0.9, keepRate: 0.3, shippingFee: 30, taxRate: 0.08, itemRealized: 0.6 };
const fittedCache = new Map<string, Record<string, number>>();
/** The reconstructed chances: the hand-set shape, fitted so the box returns ICYBOX_TARGET_RETURN at listed values. */
export function liveChances(box: IcyboxBox): Record<string, number> {
  const hit = fittedCache.get(box.slug);
  if (hit) return { ...hit };
  const base: Record<string, number> = {};
  for (const b of box.bands) base[b.id] = b.chance;
  const fitted = fitReturn(box, base, ICYBOX_TARGET_RETURN, DEFAULT_VALUES);
  fittedCache.set(box.slug, fitted);
  return { ...fitted };
}

/* ---------- finite drop ---------- */

/** A limited run: a fixed stock of copies per item, drawn without replacement; the operator may retire it early. */
export class DropPool {
  readonly initial: number;
  readonly copies = new Map<string, number>();
  readonly itemsById = new Map<string, { item: IcyboxItem; band: IcyboxBand }>();
  left: number;
  sold = 0;
  retired = false;
  constructor(readonly box: IcyboxBox, chances: Record<string, number>, totalCopies: number, readonly retireAt: number) {
    // copies follow the odds: expected count per item, floors first, the remainder by largest fraction;
    // the showcase grail (the most valuable item) always gets at least one copy, so every drop holds a grail
    const t = buildTable(box, chances);
    const exp: { id: string; e: number; item: IcyboxItem; band: IcyboxBand }[] = [];
    for (const e of t.entries) {
      const share = t.total > 0 ? e.chance / t.total : 0;
      for (const it of e.band.items) exp.push({ id: it.id, e: totalCopies * share * itemShare(e.band, it), item: it, band: e.band });
    }
    let n = 0;
    for (const x of exp) {
      const c = Math.floor(x.e);
      this.copies.set(x.id, c);
      this.itemsById.set(x.id, { item: x.item, band: x.band });
      n += c;
    }
    const rest = [...exp].sort((a, b) => b.e - Math.floor(b.e) - (a.e - Math.floor(a.e)));
    for (let i = 0; i < rest.length && n < Math.round(totalCopies); i++) {
      this.copies.set(rest[i].id, (this.copies.get(rest[i].id) ?? 0) + 1);
      n++;
    }
    const top = [...exp].sort((a, b) => b.item.value - a.item.value)[0];
    if (top && (this.copies.get(top.id) ?? 0) === 0) {
      const donor = [...exp].sort((a, b) => (this.copies.get(b.id) ?? 0) - (this.copies.get(a.id) ?? 0))[0];
      this.copies.set(donor.id, (this.copies.get(donor.id) ?? 1) - 1);
      this.copies.set(top.id, 1);
    }
    this.initial = n;
    this.left = n;
  }
  bandLeft(id: IcyboxBandId): number {
    let s = 0;
    for (const [k, c] of this.copies) if (this.itemsById.get(k)!.band.id === id) s += c;
    return s;
  }
  /** chance of each band right now: copies left in the band over copies left in all */
  chances(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const b of this.box.bands) out[b.id] = this.left > 0 ? this.bandLeft(b.id) / this.left : 0;
    return out;
  }
  draw(u: number): { item: IcyboxItem; band: IcyboxBand; from: number; to: number } | null {
    if (this.retired || this.left <= 0) return null;
    const pos = u * this.left;
    let acc = 0;
    let picked: { item: IcyboxItem; band: IcyboxBand } | null = null;
    let from = 0;
    for (const [k, c] of this.copies) {
      if (c <= 0) continue;
      if (pos < acc + c) {
        picked = this.itemsById.get(k)!;
        from = acc;
        this.copies.set(k, c - 1);
        break;
      }
      acc += c;
    }
    if (!picked) return null;
    this.left--;
    this.sold++;
    if (this.retireAt > 0 && this.sold >= this.retireAt * this.initial) this.retired = true;
    if (this.left === 0) this.retired = true;
    return { item: picked.item, band: picked.band, from: from / (this.left + 1), to: (from + 1) / (this.left + 1) };
  }
}

/* ---------- opener (live play) ---------- */

export class IcyboxOpener {
  readonly box: IcyboxBox;
  private table: IcyboxTable;
  private idx = 0;
  pool: DropPool | null;
  constructor(readonly cfg: IcyboxConfig, readonly label: string) {
    this.box = icyboxBox(cfg.boxSlug);
    this.table = buildTable(this.box, cfg.chances);
    this.pool = cfg.drop.enabled && cfg.drop.copies > 0 ? new DropPool(this.box, cfg.chances, cfg.drop.copies, cfg.drop.retireAt) : null;
  }
  get retired(): boolean {
    return !!this.pool?.retired;
  }
  newDrop(): void {
    if (this.cfg.drop.enabled && this.cfg.drop.copies > 0) this.pool = new DropPool(this.box, this.cfg.chances, this.cfg.drop.copies, this.cfg.drop.retireAt);
  }
  spin(): IcyboxSpin | null {
    const i = ++this.idx;
    const rng = makeRng("sfc32", `icybox:${this.label}:${this.box.slug}:${i}`);
    const u = rng.next();
    const u2 = rng.next();
    let bandId: IcyboxBandId;
    let item: IcyboxItem;
    let from: number;
    let to: number;
    if (this.pool) {
      const d = this.pool.draw(u);
      if (!d) return null;
      bandId = d.band.id;
      item = d.item;
      from = d.from;
      to = d.to;
    } else {
      const e = lookupBand(this.table, u);
      bandId = e.band.id;
      item = pickItem(e.band, u2);
      from = e.from / (this.table.total || 1);
      to = e.to / (this.table.total || 1);
    }
    return { idx: i, boxSlug: this.box.slug, price: this.box.price, roll: u, bandId, bandFrom: from, bandTo: to, item, buyback: Math.round(item.value * this.cfg.buybackPercent * 100) / 100, keepCost: Math.round((this.cfg.shippingFee + this.cfg.taxRate * item.value) * 100) / 100, copiesLeft: this.pool?.left, retired: this.pool?.retired };
  }
}

/* ---------- catalogue tile ---------- */

const BAND_HEX: Record<IcyboxBandId, string> = { common: "#5b6472", uncommon: "#2f7d4f", rare: "#1e5aa8", epic: "#0f6b6b", legendary: "#5b2a86", grail: "#8a6d1f" };
const BAND_TIER: Record<IcyboxBandId, CatalogItem["tier"]> = { common: "common", uncommon: "common", rare: "rare", epic: "epic", legendary: "legendary", grail: "grail" };
export function icyboxAsCatalogItem(it: IcyboxItem, bandId: IcyboxBandId): CatalogItem {
  const icon = it.category === "bag" ? "fluent:handbag" : "fluent:watch";
  return { id: it.id, name: it.label, brand: it.brand, category: it.category, tier: BAND_TIER[bandId], retail: it.value, asking: it.value, realized: Math.round(it.value * 0.6), confidence: "low", icon, color: BAND_HEX[bandId], source: "captured", operator: "IcyBox" };
}

/* ---------- batch run ---------- */

export function runIcybox(cfg: IcyboxConfig, seed: number, onProgress?: Progress): IcyboxResult {
  const bx = icyboxBox(cfg.boxSlug);
  const N = Math.max(1, Math.floor(cfg.run.opens));
  const m = icyboxMath(bx, cfg.chances, cfg);
  const rng = makeRng("sfc32", `icybox-run:${seed}`);
  const opener = new IcyboxOpener(cfg, `run:${seed}`);
  const counts: Record<string, number> = {};
  for (const b of bx.bands) counts[b.id] = 0;
  let spent = 0;
  let listedValue = 0;
  let buybackPaid = 0;
  let soldBack = 0;
  let autoSold = 0;
  let itemsKept = 0;
  let keptValue = 0;
  let keptReal = 0;
  let feesPaid = 0;
  let grails = 0;
  let bigWins = 0;
  let dry = 0;
  let longestDry = 0;
  let drops = 1;
  let retired = 0;
  let grailsShipped = 0;
  let grailsLeftBehind = 0;
  let opensInDrops = 0;
  const curveStep = Math.max(1, Math.floor(N / 200));
  const curve: IcyboxResult["curve"] = [];
  const sample: IcyboxSpin[] = [];
  let cumReal = 0;
  for (let i = 0; i < N; i++) {
    if (opener.pool && opener.pool.retired) {
      retired += opener.pool.left > 0 ? 1 : 0;
      grailsLeftBehind += opener.pool.bandLeft("grail");
      opener.newDrop();
      drops++;
    }
    const s = opener.spin();
    if (!s) break;
    if (opener.pool) opensInDrops++;
    spent += bx.price;
    counts[s.bandId]++;
    listedValue += s.item.value;
    const big = s.item.value >= bx.price;
    if (big) bigWins++;
    if (s.bandId === "grail") grails++;
    if (big) dry = 0;
    else if (++dry > longestDry) longestDry = dry;
    const keep = big && rng.next() < cfg.keepRate;
    if (keep) {
      itemsKept++;
      keptValue += s.item.value;
      keptReal += s.item.value * cfg.itemRealized;
      feesPaid += s.keepCost;
      cumReal += s.item.value * cfg.itemRealized - s.keepCost;
      if (s.bandId === "grail") grailsShipped++;
    } else {
      soldBack++;
      buybackPaid += s.buyback;
      cumReal += s.buyback;
      if (rng.next() < cfg.missWindowRate) autoSold++;
    }
    if (sample.length < 12) sample.push(s);
    if ((i + 1) % curveStep === 0 || i === N - 1) curve.push({ n: i + 1, listed: listedValue / (spent || 1), buyback: (listedValue * cfg.buybackPercent) / (spent || 1) });
    if (onProgress && (i & 1023) === 0) onProgress(i, N);
  }
  const opens = Math.round(spent / bx.price);
  const byBand = m.perBand.map((b) => ({ id: b.id, label: b.label, chance: b.share, expected: b.share * opens, actual: counts[b.id] ?? 0, meanValue: b.meanValue, costPerOpen: b.costPerOpen }));
  const chi: ChiSquare = cfg.drop.enabled && cfg.drop.copies > 0 ? { statistic: 0, df: 0, pValue: 1, merged: 0 } : chiSquare(byBand.map((b) => b.actual), byBand.map((b) => b.expected));
  const verifier: Verifier = { sampled: 0, passed: 0, failed: 0, reasons: { "no commitment: IcyBox publishes nothing to check": opens } };
  onProgress?.(N, N);
  return {
    kind: "icybox",
    boxSlug: bx.slug,
    boxName: bx.name,
    price: bx.price,
    opens,
    spent,
    listedValue,
    buybackPaid,
    soldBack,
    autoSold,
    itemsKept,
    keptValue,
    keptReal,
    feesPaid,
    grails,
    pGrail: m.pGrail,
    bigWins,
    pBig: m.pAtOrAbovePrice,
    returnListed: spent > 0 ? listedValue / spent : 0,
    returnBuyback: spent > 0 ? (listedValue * cfg.buybackPercent) / spent : 0,
    returnReal: spent > 0 ? cumReal / spent : 0,
    expectedListed: m.returnListed,
    expectedBuyback: m.returnBuyback,
    expectedReal: m.returnReal,
    byBand,
    chi,
    curve,
    longestDry,
    drop: cfg.drop.enabled && cfg.drop.copies > 0 ? { enabled: true, copies: opener.pool?.initial ?? cfg.drop.copies, retireAt: cfg.drop.retireAt, drops, retired, grailsShipped, grailsLeftBehind, opensPerDrop: drops > 0 ? opensInDrops / drops : 0 } : null,
    verifier,
    sample,
  };
}
