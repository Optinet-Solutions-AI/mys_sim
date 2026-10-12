// Odds tables: integer tickets, cumulative ranges, RTP solver, float-table lookup.
import type { BoxDef, BoxItem, BoxTier, CatalogItem, PriceLayer } from "./types";

export interface ResolvedItem {
  itemId: string;
  weight: number;
  from: number; // inclusive
  to: number; // exclusive
  item: CatalogItem;
}

export interface ResolvedTable {
  T: number;
  items: ResolvedItem[];
  /** cumulative float percentages as an operator would display them (rounded to 2 dp) */
  floatCumulative: number[];
  floatSumPercent: number;
}

export function priceOf(item: CatalogItem, layer: PriceLayer): number {
  return item[layer];
}

export function resolveTable(items: BoxItem[], T: number, catalog: Map<string, CatalogItem>): ResolvedTable {
  let cursor = 0;
  const resolved: ResolvedItem[] = [];
  for (const bi of items) {
    const item = catalog.get(bi.itemId);
    if (!item) throw new Error(`Unknown item ${bi.itemId}`);
    resolved.push({ itemId: bi.itemId, weight: bi.weight, from: cursor, to: cursor + bi.weight, item });
    cursor += bi.weight;
  }
  if (cursor !== T) throw new Error(`Weights sum to ${cursor}, expected ${T}`);
  // float table as displayed: percentages rounded to 2 decimals, cumulative in float arithmetic
  const pct = resolved.map((r) => Math.round((r.weight / T) * 10000) / 100);
  const cum: number[] = [];
  let acc = 0;
  for (const p of pct) {
    acc += p;
    cum.push(acc);
  }
  return { T, items: resolved, floatCumulative: cum, floatSumPercent: acc };
}

/** Binary search the integer ranges. */
export function lookupTicket(table: ResolvedTable, ticket: number): ResolvedItem {
  let lo = 0, hi = table.items.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ticket < table.items[mid].to) hi = mid;
    else lo = mid + 1;
  }
  return table.items[lo];
}

/** Lookup the way a float-percentage implementation does it: u*100 against rounded cumulative percents. */
export function lookupFloat(table: ResolvedTable, u: number): { item: ResolvedItem; fallthrough: boolean } {
  const x = u * 100;
  for (let i = 0; i < table.items.length; i++) {
    if (x < table.floatCumulative[i]) return { item: table.items[i], fallthrough: false };
  }
  // sum < 100: fell off the end; naive code usually awards the last item
  return { item: table.items[table.items.length - 1], fallthrough: true };
}

export function expectedValue(table: ResolvedTable, layer: PriceLayer): number {
  let ev = 0;
  for (const r of table.items) ev += (r.weight / table.T) * priceOf(r.item, layer);
  return ev;
}

export function statedProbability(table: ResolvedTable, itemId: string): number {
  const r = table.items.find((x) => x.itemId === itemId);
  return r ? r.weight / table.T : 0;
}

/**
 * RTP solver: given items and a target RTP at a price layer, produce integer weights summing to T.
 * Weights follow w_i ∝ v_i^(−beta); beta is found by bisection so that EV = rtp × price.
 * Shape "vendor" adds a filler floor so cheap items dominate, as real tables do.
 */
export function solveWeights(
  items: CatalogItem[],
  T: number,
  price: number,
  rtp: number,
  layer: PriceLayer,
  minWeight = 1,
): { weights: BoxItem[]; achievedRtp: number; beta: number; clamped: boolean } {
  const vals = items.map((it) => Math.max(0.01, priceOf(it, layer)));
  const target = rtp * price;
  const evFor = (beta: number) => {
    const raw = vals.map((v) => Math.pow(v, -beta));
    const s = raw.reduce((a, b) => a + b, 0);
    let ev = 0;
    for (let i = 0; i < vals.length; i++) ev += (raw[i] / s) * vals[i];
    return ev;
  };
  // EV decreases as beta increases. Bracket.
  let lo = -5, hi = 15;
  let clamped = false;
  if (evFor(lo) < target) {
    clamped = true;
    hi = lo;
  } else if (evFor(hi) > target) {
    clamped = true;
    lo = hi;
  }
  for (let k = 0; k < 80 && hi - lo > 1e-9; k++) {
    const mid = (lo + hi) / 2;
    if (evFor(mid) > target) lo = mid;
    else hi = mid;
  }
  const beta = (lo + hi) / 2;
  const raw = vals.map((v) => Math.pow(v, -beta));
  const s = raw.reduce((a, b) => a + b, 0);
  let weights = raw.map((r) => Math.max(minWeight, Math.round((r / s) * T)));
  // fix the sum to T by adjusting the largest weight
  let diff = T - weights.reduce((a, b) => a + b, 0);
  const maxIdx = weights.indexOf(Math.max(...weights));
  weights[maxIdx] += diff;
  if (weights[maxIdx] < minWeight) {
    // pathological; spread
    weights = weights.map(() => Math.floor(T / weights.length));
    diff = T - weights.reduce((a, b) => a + b, 0);
    weights[0] += diff;
  }
  let ev = 0;
  for (let i = 0; i < vals.length; i++) ev += (weights[i] / T) * vals[i];
  return {
    weights: items.map((it, i) => ({ itemId: it.id, weight: weights[i] })),
    achievedRtp: ev / price,
    beta,
    clamped,
  };
}

/** Re-solve a box at a different RTP (used by rigs). */
export function retargetBox(box: BoxDef, rtp: number, catalog: Map<string, CatalogItem>): BoxItem[] {
  const items = box.items.map((bi) => catalog.get(bi.itemId)!).filter(Boolean);
  return solveWeights(items, box.ticketTotal, box.price, rtp, box.valueLayer).weights;
}

/** Percent inputs (may not sum to 100) → integer weights summing to T, plus the raw percent sum. */
export function weightsFromPercents(percents: { itemId: string; percent: number }[], T: number): { items: BoxItem[]; sum: number } {
  const sum = percents.reduce((a, p) => a + p.percent, 0);
  const scale = sum > 0 ? 100 / sum : 0;
  const items = percents.map((p) => ({ itemId: p.itemId, weight: Math.max(1, Math.round((p.percent * scale * T) / 100)) }));
  const diff = T - items.reduce((a, b) => a + b.weight, 0);
  if (items.length) items[items.map((x) => x.weight).indexOf(Math.max(...items.map((x) => x.weight)))].weight += diff;
  return { items, sum };
}

/** Keep only the items that satisfy `keep`, renormalising their weights to sum to T. Returns null if nothing is left. */
export function subsetTable(table: ResolvedTable, keep: (r: ResolvedItem) => boolean, T: number, catalog: Map<string, CatalogItem>): ResolvedTable | null {
  const kept = table.items.filter(keep);
  if (!kept.length) return null;
  const sum = kept.reduce((a, r) => a + r.weight, 0);
  const items: BoxItem[] = kept.map((r) => ({ itemId: r.itemId, weight: Math.max(1, Math.round((r.weight / sum) * T)) }));
  const diff = T - items.reduce((a, b) => a + b.weight, 0);
  items[items.map((x) => x.weight).indexOf(Math.max(...items.map((x) => x.weight)))].weight += diff;
  return resolveTable(items, T, catalog);
}

/** A table from finite copies (pool model): T is the number of copies left; zero-copy items are dropped. */
export function tableFromCounts(ids: string[], counts: number[], catalog: Map<string, CatalogItem>): ResolvedTable {
  const items: BoxItem[] = [];
  for (let i = 0; i < ids.length; i++) if (counts[i] > 0) items.push({ itemId: ids[i], weight: counts[i] });
  const T = items.reduce((a, b) => a + b.weight, 0);
  return resolveTable(items, Math.max(1, T), catalog);
}

/** The tier-level table of a tiered box: one pseudo-item per tier, weights from the stated tier percentages. */
export function tierTable(tiers: BoxTier[], T: number, catalog: Map<string, CatalogItem>): ResolvedTable {
  const sum = tiers.reduce((a, t) => a + t.percent, 0) || 1;
  let cursor = 0;
  const items: ResolvedItem[] = [];
  const pct: number[] = [];
  tiers.forEach((t, k) => {
    let w = Math.max(1, Math.round((t.percent / sum) * T));
    if (k === tiers.length - 1) w = T - cursor;
    const vals = t.itemIds.map((id) => catalog.get(id)).filter(Boolean) as CatalogItem[];
    const avg = (layer: PriceLayer) => (vals.length ? vals.reduce((a, c) => a + c[layer], 0) / vals.length : 0);
    const pseudo: CatalogItem = { id: t.id, name: t.name, brand: "tier", category: "nothing", tier: "common", retail: avg("retail"), asking: avg("asking"), realized: avg("realized"), confidence: "low", icon: "ph:stack", color: "#6b7280" };
    items.push({ itemId: t.id, weight: w, from: cursor, to: cursor + w, item: pseudo });
    cursor += w;
    pct.push(Math.round((w / T) * 10000) / 100);
  });
  const cum: number[] = [];
  let acc = 0;
  for (const p of pct) {
    acc += p;
    cum.push(acc);
  }
  return { T, items, floatCumulative: cum, floatSumPercent: acc };
}

/** Item-level weights implied by a tiered box: each tier's tickets split equally among its items. */
export function weightsForTiers(tiers: BoxTier[], T: number): BoxItem[] {
  const sum = tiers.reduce((a, t) => a + t.percent, 0) || 1;
  const out: BoxItem[] = [];
  for (const t of tiers) {
    if (!t.itemIds.length) continue;
    const w = (t.percent / sum) * T;
    const each = Math.max(1, Math.floor(w / t.itemIds.length));
    for (const id of t.itemIds) out.push({ itemId: id, weight: each });
  }
  const diff = T - out.reduce((a, b) => a + b.weight, 0);
  if (out.length) out[out.map((x) => x.weight).indexOf(Math.max(...out.map((x) => x.weight)))].weight += diff;
  return out;
}

/** Weights from finite copies, scaled to T (the displayed odds of a pool box). */
export function weightsForPool(copies: Record<string, number>, T: number): BoxItem[] {
  const entries = Object.entries(copies).filter(([, c]) => c > 0);
  const total = entries.reduce((a, [, c]) => a + c, 0) || 1;
  const out: BoxItem[] = entries.map(([id, c]) => ({ itemId: id, weight: Math.max(1, Math.round((c / total) * T)) }));
  const diff = T - out.reduce((a, b) => a + b.weight, 0);
  if (out.length) out[out.map((x) => x.weight).indexOf(Math.max(...out.map((x) => x.weight)))].weight += diff;
  return out;
}

/** Insert an undisclosed item right after the most common one, taking `percent` of T from it, so other ranges do not move. */
export function insertSecret(table: ResolvedTable, secret: CatalogItem, percent: number, catalog: Map<string, CatalogItem>): ResolvedTable {
  const T = table.T;
  const w = Math.max(1, Math.min(T - table.items.length, Math.round((percent / 100) * T)));
  const big = table.items.reduce((b, r) => (r.weight > b.weight ? r : b), table.items[0]);
  const items: BoxItem[] = [];
  for (const r of table.items) {
    if (r.itemId === big.itemId) {
      items.push({ itemId: r.itemId, weight: Math.max(1, r.weight - w) });
      items.push({ itemId: secret.id, weight: w + Math.min(0, r.weight - w - 1) });
    } else items.push({ itemId: r.itemId, weight: r.weight });
  }
  const map = new Map(catalog);
  map.set(secret.id, secret);
  const diff = T - items.reduce((a, b) => a + b.weight, 0);
  items[items.map((x) => x.weight).indexOf(Math.max(...items.map((x) => x.weight)))].weight += diff;
  return resolveTable(items, T, map);
}

/** Jemlit-style guarantee: a share of opens comes from items at or above minValue (value layer). */
export function applyGuarantee(items: BoxItem[], T: number, share: number, minValue: number, layer: PriceLayer, catalog: Map<string, CatalogItem>): BoxItem[] {
  const good = items.filter((bi) => (catalog.get(bi.itemId)?.[layer] ?? 0) >= minValue);
  if (!good.length || share <= 0) return items;
  const goodSum = good.reduce((a, b) => a + b.weight, 0);
  const total = items.reduce((a, b) => a + b.weight, 0) || 1;
  const out = items.map((bi) => {
    const base = (1 - share) * (bi.weight / total);
    const extra = good.some((g) => g.itemId === bi.itemId) ? share * (bi.weight / goodSum) : 0;
    return { itemId: bi.itemId, weight: Math.max(1, Math.round((base + extra) * T)) };
  });
  const diff = T - out.reduce((a, b) => a + b.weight, 0);
  out[out.map((x) => x.weight).indexOf(Math.max(...out.map((x) => x.weight)))].weight += diff;
  return out;
}
