// The Opener performs one box opening under a scheme, a mapping and the active rigs, and can verify a record.
import type { AlgoConfig, BoxDef, CatalogItem, MappingId, OpenRecord, PriceLayer, RigConfig } from "./types";
import { SCHEMES, makeBeacon } from "./schemes";
import { mapTicket } from "./mapping";
import { lookupFloat, lookupTicket, priceOf, resolveTable, retargetBox, type ResolvedItem, type ResolvedTable } from "./table";
import { makeRng, type Rng } from "./rng";
import { canonicalJson, sha256Hex } from "./hash";

export interface OpenerCounters {
  rotations: number;
  rerolls: number;
  grinds: number;
  fallthroughs: number;
}

export class Opener {
  readonly displayed: ResolvedTable;
  readonly mappingId: MappingId;
  readonly manifestHash: string;
  readonly counters: OpenerCounters = { rotations: 0, rerolls: 0, grinds: 0, fallthroughs: 0 };
  private hidden?: ResolvedTable; // tableSwap / bypass
  private perAccount?: ResolvedTable;
  private cheapest?: ResolvedTable;
  private midRun?: ResolvedTable;
  private ladder?: ResolvedTable[];
  private serverSeed = "";
  private serverHash = "";
  private nonce = 0;
  private opening = 0;
  private beacon;
  private scheme;
  private sourceRng: Rng;

  constructor(
    readonly box: BoxDef,
    readonly algo: AlgoConfig,
    readonly rigs: RigConfig,
    readonly catalog: Map<string, CatalogItem>,
    readonly rng: Rng, // simulation rng (seeds, client seeds, beacon, agents)
    readonly slug = "box",
  ) {
    this.displayed = resolveTable(box.items, box.ticketTotal, catalog);
    this.scheme = SCHEMES[algo.scheme];
    this.mappingId = algo.mapping === "native" ? this.scheme.nativeMapping : algo.mapping;
    this.beacon = makeBeacon(rng);
    // the randomness source under test when there is no commitment
    this.sourceRng = algo.scheme === "none" ? makeRng(algo.rng, "source:" + rng.hex(8)) : rng;
    const retarget = (rtp: number) => resolveTable(retargetBox(box, rtp, catalog), box.ticketTotal, catalog);
    if (rigs.bypass) this.hidden = retarget(rigs.bypass.hiddenRtp);
    if (rigs.tableSwap) this.hidden = retarget(rigs.tableSwap.hiddenRtp);
    if (rigs.perAccount) this.perAccount = retarget(rigs.perAccount.rtp);
    if (rigs.midRunRtpChange) this.midRun = retarget(rigs.midRunRtpChange.newRtp);
    if (rigs.dynamicOdds) {
      const steps = 20;
      this.ladder = [];
      for (let i = 0; i <= steps; i++) {
        const rtp = rigs.dynamicOdds.rtpStart + ((rigs.dynamicOdds.rtpEnd - rigs.dynamicOdds.rtpStart) * i) / steps;
        this.ladder.push(retarget(rtp));
      }
    }
    if (rigs.cheapestTwo) {
      const sorted = [...this.displayed.items].sort((a, b) => priceOf(a.item, box.valueLayer) - priceOf(b.item, box.valueLayer));
      const two = sorted.slice(0, 2);
      const wsum = two.reduce((a, r) => a + r.weight, 0);
      const w0 = Math.round((two[0].weight / wsum) * box.ticketTotal);
      this.cheapest = resolveTable(
        [
          { itemId: two[0].itemId, weight: w0 },
          { itemId: two[1]?.itemId ?? two[0].itemId, weight: box.ticketTotal - w0 },
        ],
        box.ticketTotal,
        catalog,
      );
    }
    this.manifestHash = sha256Hex(
      canonicalJson({
        name: box.name,
        price: Math.round(box.price * 100),
        ticketTotal: box.ticketTotal,
        valueLayer: box.valueLayer,
        items: box.items.map((bi) => {
          const it = catalog.get(bi.itemId)!;
          return { id: bi.itemId, weight: bi.weight, realized: Math.round(it.realized * 100), asking: Math.round(it.asking * 100), retail: Math.round(it.retail * 100) };
        }),
      }),
    );
    this.rotate();
  }

  private rotate() {
    this.serverSeed = this.scheme.newServerSeed(this.rng);
    this.serverHash = this.scheme.commit(this.serverSeed);
    this.nonce = 0;
    this.counters.rotations++;
  }

  private tableFor(tag: string, progress: number): ResolvedTable {
    if (this.rigs.perAccount && this.perAccount && tag === this.rigs.perAccount.tag) return this.perAccount;
    if (this.cheapest) return this.cheapest;
    if (this.rigs.tableSwap && this.hidden) return this.hidden;
    if (this.rigs.midRunRtpChange && this.midRun && progress >= this.rigs.midRunRtpChange.atFraction) return this.midRun;
    if (this.ladder) return this.ladder[Math.min(this.ladder.length - 1, Math.floor(progress * this.ladder.length))];
    return this.displayed;
  }

  private newClientSeed(): string {
    return this.rng.hex(16);
  }

  /** Honest draw with a given set of inputs, on a given table. */
  private drawWith(table: ResolvedTable, serverSeed: string, clientSeed: string, nonce: number, opening: number, beacon?: { round: number; value: string }) {
    let digest: string;
    if (this.algo.scheme === "none") {
      digest = this.sourceRng.hex(32);
    } else {
      digest = this.scheme.digest({ serverSeed, clientSeed, nonce, opening, beaconRound: beacon?.round, beaconValue: beacon?.value, slug: this.slug });
    }
    const m = mapTicket(this.mappingId, digest, table.T);
    let item: ResolvedItem;
    if (this.mappingId === "float-cumulative") {
      const r = lookupFloat(table, m.u ?? 0);
      item = r.item;
      if (r.fallthrough) this.counters.fallthroughs++;
    } else {
      item = lookupTicket(table, m.ticket);
    }
    return { digest, ticket: m.ticket, item };
  }

  /** Perform one opening. progress in [0,1) is the position within the run (for drift rigs). */
  open(idx: number, tag: string, progress: number, tableOverride?: ResolvedTable): OpenRecord {
    const table = tableOverride ?? this.tableFor(tag, progress);
    // rotation policy
    if (this.algo.rotation === "per-open" && idx > 0) this.rotate();
    else if (this.algo.rotation === "every-n" && idx > 0 && idx % Math.max(1, this.algo.rotateEvery) === 0) this.rotate();
    this.nonce++;
    this.opening++;
    const beacon = this.scheme.usesBeacon ? this.beacon.next() : undefined;
    const layer = this.box.valueLayer;
    const value = (it: ResolvedItem) => priceOf(it.item, layer);

    let clientSeed = this.newClientSeed();
    let serverSeed = this.serverSeed;
    let serverHash = this.serverHash;
    let d = this.drawWith(table, serverSeed, clientSeed, this.nonce, this.opening, beacon);

    // grinding rigs (verification still passes because the chosen seeds are what gets published)
    const price = this.box.price;
    if (this.rigs.serverChosenClientSeed && this.scheme.usesClientSeed && this.algo.clientSeedMode === "site-default") {
      const { attempts, thresholdMultiple } = this.rigs.serverChosenClientSeed;
      let tries = 0;
      while (value(d.item) >= thresholdMultiple * price && tries < Math.max(0, attempts - 1)) {
        const cs = this.newClientSeed();
        d = this.drawWith(table, serverSeed, cs, this.nonce, this.opening, beacon);
        clientSeed = cs;
        tries++;
      }
      this.counters.grinds += tries;
    }
    if (this.rigs.commitAfterClient && this.algo.scheme !== "none") {
      const { attempts, thresholdMultiple } = this.rigs.commitAfterClient;
      let tries = 0;
      while (value(d.item) >= thresholdMultiple * price && tries < Math.max(0, attempts - 1)) {
        const ss = this.scheme.newServerSeed(this.rng);
        d = this.drawWith(table, ss, clientSeed, this.nonce, this.opening, beacon);
        serverSeed = ss;
        tries++;
      }
      if (tries) {
        serverHash = this.scheme.commit(serverSeed);
        this.serverSeed = serverSeed;
        this.serverHash = serverHash;
      }
      this.counters.grinds += tries;
    }
    if (this.rigs.rotationOnWins) {
      const { thresholdMultiple, maxRerolls } = this.rigs.rotationOnWins;
      let n = 0;
      while (value(d.item) >= thresholdMultiple * this.box.price && n < maxRerolls) {
        this.rotate();
        this.nonce = 1;
        serverSeed = this.serverSeed;
        serverHash = this.serverHash;
        d = this.drawWith(table, serverSeed, clientSeed, this.nonce, this.opening, beacon);
        n++;
      }
      this.counters.rerolls += n;
    }

    let itemId = d.item.itemId;
    let payout = value(d.item);
    if (this.rigs.bypass && this.hidden) {
      // the awarded item comes from the hidden table; the proof fields stay honest-looking
      const forced = lookupTicket(this.hidden, this.rng.int(this.hidden.T));
      itemId = forced.itemId;
      payout = value(forced);
    }

    return {
      idx,
      tag,
      serverSeed,
      serverHash,
      clientSeed,
      nonce: this.nonce,
      opening: this.opening,
      beaconRound: beacon?.round,
      beaconValue: beacon?.value,
      manifestHash: this.algo.scheme === "glassbox" ? this.manifestHash : undefined,
      digest: d.digest,
      ticket: d.ticket,
      itemId,
      payout,
    };
  }
}

/** Honest recomputation of a record against the displayed table. */
export function verifyRecord(
  rec: OpenRecord,
  box: BoxDef,
  algo: AlgoConfig,
  catalog: Map<string, CatalogItem>,
  slug = "box",
): { ok: boolean; reason: string } {
  if (algo.scheme === "none") return { ok: false, reason: "no commitment to verify" };
  const scheme = SCHEMES[algo.scheme];
  if (scheme.commit(rec.serverSeed) !== rec.serverHash) return { ok: false, reason: "server hash mismatch" };
  const digest = scheme.digest({
    serverSeed: rec.serverSeed,
    clientSeed: rec.clientSeed,
    nonce: rec.nonce,
    opening: rec.opening,
    beaconRound: rec.beaconRound,
    beaconValue: rec.beaconValue,
    slug,
  });
  if (digest !== rec.digest) return { ok: false, reason: "digest mismatch" };
  const table = resolveTable(box.items, box.ticketTotal, catalog);
  const mappingId = algo.mapping === "native" ? scheme.nativeMapping : algo.mapping;
  const m = mapTicket(mappingId, digest, table.T);
  const item = mappingId === "float-cumulative" ? lookupFloat(table, m.u ?? 0).item : lookupTicket(table, m.ticket);
  if (item.itemId !== rec.itemId) return { ok: false, reason: "item mismatch (awarded item is not what the proof produces)" };
  return { ok: true, reason: "ok" };
}

export function valueAt(item: CatalogItem, layer: PriceLayer, inflation = 1): number {
  return priceOf(item, layer) * inflation;
}
