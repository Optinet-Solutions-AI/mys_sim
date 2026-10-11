import type { ItemStat, MysteryBoxConfig, MysteryBoxResult, MysteryBoxSizes, OpenRecord, PriceLayer, Progress } from "../types";
import { Opener, verifyRecord } from "../opener";
import { chiSquare, logHistogram, Welford } from "../metrics";
import { expectedValue, priceOf } from "../table";
import { sfc32 } from "../rng";
import type { CatalogItem } from "../types";

const LAYERS: PriceLayer[] = ["retail", "asking", "realized"];

export function runMysteryBox(
  cfg: MysteryBoxConfig,
  sizes: MysteryBoxSizes,
  seed: number,
  catalog: Map<string, CatalogItem>,
  onProgress?: Progress,
): MysteryBoxResult {
  const t0 = Date.now();
  const rng = sfc32(seed);
  const opener = new Opener(cfg.box, cfg.algo, cfg.rigs, catalog, rng);
  const table = opener.displayed;
  const n = Math.max(1, Math.floor(sizes.opens));
  const idxOf = new Map(table.items.map((r, i) => [r.itemId, i]));
  const counts = new Array(table.items.length).fill(0);
  const paidByLayer: Record<PriceLayer, number> = { retail: 0, asking: 0, realized: 0 };
  const bins = 50;
  const regions = new Array(bins).fill(0);
  const byTag: Record<string, { opens: number; paid: number; rtp: number }> = {};
  const tags = cfg.accounts.tags.length ? cfg.accounts.tags : [{ tag: "player", share: 1 }];
  const shareSum = tags.reduce((a, t) => a + t.share, 0) || 1;
  const pickTag = () => {
    let u = rng.next() * shareSum;
    for (const t of tags) {
      u -= t.share;
      if (u <= 0) return t.tag;
    }
    return tags[tags.length - 1].tag;
  };
  const sample: OpenRecord[] = [];
  const verifyN = Math.min(n, Math.max(0, Math.floor(sizes.verifySample)));
  const verifier = { sampled: 0, passed: 0, failed: 0, reasons: {} as Record<string, number> };
  const inflation = cfg.rigs.valuationInflation?.factor ?? 1;
  const step = Math.max(1, Math.floor(n / 100));
  let pAtLeast = 0;
  const payoutStats = new Welford();

  for (let i = 0; i < n; i++) {
    const tag = pickTag();
    const rec = opener.open(i, tag, i / n);
    const item = catalog.get(rec.itemId)!;
    const k = idxOf.get(rec.itemId);
    if (k !== undefined) counts[k]++;
    for (const L of LAYERS) paidByLayer[L] += priceOf(item, L);
    if (rec.payout >= cfg.box.price) pAtLeast++;
    payoutStats.add(rec.payout);
    regions[Math.min(bins - 1, Math.floor((rec.ticket / table.T) * bins))]++;
    const bt = (byTag[tag] ??= { opens: 0, paid: 0, rtp: 0 });
    bt.opens++;
    bt.paid += rec.payout;
    if (i < verifyN) {
      const v = verifyRecord(rec, cfg.box, cfg.algo, catalog);
      rec.verified = v.ok;
      rec.verifyReason = v.reason;
      verifier.sampled++;
      if (v.ok) verifier.passed++;
      else {
        verifier.failed++;
        verifier.reasons[v.reason] = (verifier.reasons[v.reason] ?? 0) + 1;
      }
    }
    if (sample.length < 60) sample.push(rec);
    if (onProgress && i % step === 0) onProgress(i, n);
  }
  for (const t of Object.values(byTag)) t.rtp = t.opens ? t.paid / (t.opens * cfg.box.price) : 0;

  const items: ItemStat[] = table.items.map((r, i) => ({
    itemId: r.itemId,
    stated: r.weight / table.T,
    observed: counts[i],
    expected: (r.weight / table.T) * n,
    payoutValue: priceOf(r.item, cfg.box.valueLayer),
    displayValue: priceOf(r.item, cfg.box.displayLayer) * inflation,
  }));
  const chi = chiSquare(
    items.map((x) => x.observed),
    items.map((x) => x.expected),
  );
  const statedRtp = { retail: 0, asking: 0, realized: 0 } as Record<PriceLayer, number>;
  const ev = { retail: 0, asking: 0, realized: 0 } as Record<PriceLayer, number>;
  for (const L of LAYERS) {
    ev[L] = expectedValue(table, L);
    statedRtp[L] = ev[L] / cfg.box.price;
  }
  const realizedRtp = { retail: 0, asking: 0, realized: 0 } as Record<PriceLayer, number>;
  for (const L of LAYERS) realizedRtp[L] = paidByLayer[L] / (n * cfg.box.price);
  const displayedRtp = (expectedValue(table, cfg.box.displayLayer) * inflation) / cfg.box.price;

  // payout histogram from item counts
  const values: number[] = [];
  const hist = logHistogram([], "payout at value layer", 14, 1, 100000);
  for (let i = 0; i < items.length; i++) {
    const v = items[i].payoutValue;
    const k = v < 1 ? 0 : Math.min(13, Math.floor(((Math.log10(v) - 0) / 5) * 14));
    hist.counts[k] += items[i].observed;
  }
  void values;

  return {
    kind: "mystery-box",
    opens: n,
    items,
    chi,
    statedRtp,
    realizedRtp,
    rtpSe: payoutStats.sd / Math.sqrt(n) / cfg.box.price,
    displayedRtp,
    ev,
    pAtLeastPrice: pAtLeast / n,
    payoutHistogram: hist,
    ticketRegions: { bins, counts: regions },
    byTag,
    rotations: opener.counters.rotations,
    rerolls: opener.counters.rerolls,
    grinds: opener.counters.grinds,
    fallthroughs: opener.counters.fallthroughs,
    verifier,
    sample,
    elapsedMs: Date.now() - t0,
  };
}
