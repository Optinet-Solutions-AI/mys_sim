// Live, one-at-a-time use of the engine on the main thread: the "play" side of each lab.
// Same Opener, same rigs, same verifier as the statistics runs; only the pace differs.
import { Opener, verifyRecord } from "@/engine/opener";
import { sfc32 } from "@/engine/rng";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { priceOf } from "@/engine/table";
import { SCHEMES } from "@/engine/schemes";
import { RIGS } from "@/engine/rigs";
import { MAPPING_DOCS } from "@/engine/registry";
import type { AlgoConfig, BoxDef, CatalogItem, OpenRecord, RigConfig } from "@/engine/types";

export interface LiveOpen {
  n: number; // 1-based count within the session
  rec: OpenRecord;
  item: CatalogItem;
  payout: number; // at the box's value layer
  display: number; // what the player is shown (display layer × any inflation rig)
  verified: boolean | null; // null = nothing to verify (no commitment)
  reason: string;
}

export class LiveOpener {
  readonly opener: Opener;
  n = 0;
  constructor(
    readonly box: BoxDef,
    readonly algo: AlgoConfig,
    readonly rigs: RigConfig,
    seed: string | number,
    readonly slug = "box",
  ) {
    this.opener = new Opener(box, algo, rigs, CATALOG_BY_ID, sfc32(seed), slug);
  }
  open(tag = "player"): LiveOpen {
    const rec = this.opener.open(this.n++, tag, 0);
    const item = CATALOG_BY_ID.get(rec.itemId)!;
    const inflation = this.rigs.valuationInflation?.factor ?? 1;
    const display = priceOf(item, this.box.displayLayer) * inflation;
    let verified: boolean | null = null;
    let reason = "no commitment published, nothing to verify";
    if (this.algo.scheme !== "none") {
      const v = verifyRecord(rec, this.box, this.algo, CATALOG_BY_ID, this.slug);
      verified = v.ok;
      reason = v.reason;
    }
    return { n: this.n, rec, item, payout: rec.payout, display, verified, reason };
  }
}

export function algoLabel(algo: AlgoConfig): string {
  const s = SCHEMES[algo.scheme];
  if (algo.scheme === "none") return `No commitment · ${algo.rng}`;
  const rot = algo.rotation === "per-open" ? "fresh seed per open" : algo.rotation === "every-n" ? `rotate every ${algo.rotateEvery.toLocaleString()}` : "one seed per run";
  const map = algo.mapping === "native" ? "" : ` · ${MAPPING_DOCS.find((d) => d.id === algo.mapping)?.name ?? algo.mapping}`;
  return `${s.name} · ${rot}${map}`;
}

export function activeRigNames(rigs: RigConfig): string[] {
  return Object.entries(rigs)
    .filter(([, v]) => v)
    .map(([k]) => RIGS.find((r) => r.id === k)?.name ?? k);
}

export function seatName(p: number, humans: number): string {
  if (p < humans) return p === 0 ? "You" : `Player ${p + 1}`;
  return `Bot ${p - humans + 1}`;
}
