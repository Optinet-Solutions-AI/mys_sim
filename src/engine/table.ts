// Odds tables: integer tickets, cumulative ranges, RTP solver, float-table lookup.
import type { BoxDef, BoxItem, CatalogItem, PriceLayer } from "./types";

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
