// The Opener performs one box opening under a scheme, a mapping, a draw model and the active rigs, and can verify a record.
import type { AlgoConfig, BoxDef, BoxModel, CatalogItem, MappingId, OpenRecord, PriceLayer, RigConfig } from "./types";
import { SCHEMES, makeBeacon } from "./schemes";
import { mapTicket } from "./mapping";
import { insertSecret, lookupFloat, lookupTicket, priceOf, resolveTable, retargetBox, subsetTable, tableFromCounts, tierTable, weightsForPool, weightsForTiers, type ResolvedItem, type ResolvedTable } from "./table";
import { makeRng, type Rng } from "./rng";
import { canonicalJson, sha256Hex } from "./hash";

export interface OpenerCounters {
  rotations: number;
  rerolls: number;
  grinds: number;
  fallthroughs: number;
  drops: number;
  retirements: number;
  retirementAwards: { itemId: string; payout: number }[];
  lastOneAwards: number;
  pityApplied: number;
  secretDraws: number;
}

export class Opener {
  readonly displayed: ResolvedTable;
  readonly model: BoxModel;
  readonly mappingId: MappingId;
  readonly manifestHash: string;
  readonly counters: OpenerCounters = { rotations: 0, rerolls: 0, grinds: 0, fallthroughs: 0, drops: 0, retirements: 0, retirementAwards: [], lastOneAwards: 0, pityApplied: 0, secretDraws: 0 };
  /** tiered model: a tier ran out of inventory (StockX delists the box) */
  exhausted = false;
  exhaustedReason = "";
  private hidden?: ResolvedTable; // tableSwap / bypass
  private perAccount?: ResolvedTable;
  private cheapest?: ResolvedTable;
  private midRun?: ResolvedTable;
  private ladder?: ResolvedTable[];
  private pityTable?: ResolvedTable;
  private secretTable?: ResolvedTable;
  private secretId?: string;
  private pityStreak = new Map<string, number>();
  // pool model
  private poolIds: string[] = [];
  private poolInitial: number[] = [];
  private poolRemaining: number[] = [];
  private poolTotal = 0;
  private poolInitialTotal = 0;
  private poolSold = 0;
  // tiered model
  private tiers?: ResolvedTable;
  private tierInventory = new Map<string, Map<string, number>>();
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
    this.model = box.model ?? "weighted";
    if (this.model === "pool" && box.pool) {
      this.poolIds = Object.keys(box.pool.copies).filter((id) => box.pool!.copies[id] > 0 && catalog.has(id));
      this.poolInitial = this.poolIds.map((id) => Math.max(0, Math.floor(box.pool!.copies[id])));
      this.poolInitialTotal = this.poolInitial.reduce((a, b) => a + b, 0);
      if (!this.poolInitialTotal) throw new Error("The pool has no copies");
      this.resetPool();
      this.displayed = resolveTable(weightsForPool(box.pool.copies, box.ticketTotal), box.ticketTotal, catalog);
    } else if (this.model === "tiered" && box.tiers?.length) {
      this.tiers = tierTable(box.tiers, box.ticketTotal, catalog);
      for (const t of box.tiers) {
        const m = new Map<string, number>();
        for (const id of t.itemIds) m.set(id, t.inventory === undefined ? Number.POSITIVE_INFINITY : Math.floor(t.inventory));
        this.tierInventory.set(t.id, m);
      }
      this.displayed = resolveTable(weightsForTiers(box.tiers, box.ticketTotal), box.ticketTotal, catalog);
    } else {
      this.model = "weighted";
      this.displayed = resolveTable(box.items, box.ticketTotal, catalog);
    }
    this.scheme = SCHEMES[algo.scheme];
    this.mappingId = algo.mapping === "native" ? this.scheme.nativeMapping : algo.mapping;
    this.beacon = makeBeacon(rng);
    // the randomness source under test when there is no commitment
    this.sourceRng = algo.scheme === "none" ? makeRng(algo.rng, "source:" + rng.hex(8)) : rng;
    if (this.model === "weighted") {
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
      if (box.pity) {
        const min = box.pity.minValueMultiple * box.price;
        this.pityTable = subsetTable(this.displayed, (r) => priceOf(r.item, box.valueLayer) >= min, box.ticketTotal, catalog) ?? undefined;
      }
      if (rigs.secretItem) {
        const secret = catalog.get(rigs.secretItem.itemId);
        if (secret && !this.displayed.items.some((r) => r.itemId === secret.id)) {
          this.secretTable = insertSecret(this.displayed, secret, rigs.secretItem.percent, catalog);
          this.secretId = secret.id;
        }
      }
    }
    this.manifestHash = sha256Hex(
      canonicalJson({
        name: box.name,
        price: Math.round(box.price * 100),
        ticketTotal: box.ticketTotal,
        valueLayer: box.valueLayer,
        model: this.model,
        pool: box.pool?.copies,
        tiers: box.tiers?.map((t) => ({ id: t.id, percent: t.percent, items: t.itemIds })),
        items: this.displayed.items.map((r) => ({ id: r.itemId, weight: r.weight, realized: Math.round(r.item.realized * 100), asking: Math.round(r.item.asking * 100), retail: Math.round(r.item.retail * 100) })),
      }),
    );
    this.rotate();
  }

  /** The commitment currently published for the next open (empty when there is no scheme). */
  get commitment(): string {
    return this.algo.scheme === "none" ? "" : this.serverHash;
  }

  /** Pool model: copies left, total and sold in the current drop. */
  get poolStatus(): { left: number; total: number; sold: number } | null {
    return this.model === "pool" ? { left: this.poolTotal, total: this.poolInitialTotal, sold: this.poolSold } : null;
  }

  private resetPool() {
    this.poolRemaining = this.poolInitial.slice();
    this.poolTotal = this.poolInitialTotal;
    this.poolSold = 0;
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

  /** The tempting value of an item at the box's value layer. */
  private value(item: CatalogItem): number {
    return priceOf(item, this.box.valueLayer);
  }

  /** Perform one opening. progress in [0,1) is the position within the run (for drift rigs). */
  open(idx: number, tag: string, progress: number, tableOverride?: ResolvedTable): OpenRecord {
    // rotation policy
    if (this.algo.rotation === "per-open" && idx > 0) this.rotate();
    else if (this.algo.rotation === "every-n" && idx > 0 && idx % Math.max(1, this.algo.rotateEvery) === 0) this.rotate();
    this.nonce++;
    this.opening++;
    const beacon = this.scheme.usesBeacon ? this.beacon.next() : undefined;
    const price = this.box.price;

    // which table this open is drawn from
    let table: ResolvedTable;
    let pityApplied = false;
    let poolT: number | undefined;
    let poolCounts: number[] | undefined;
    if (this.model === "pool") {
      poolT = this.poolTotal;
      poolCounts = this.poolRemaining.slice();
      table = tableFromCounts(this.poolIds, this.poolRemaining, this.catalog);
    } else if (this.model === "tiered" && this.tiers) {
      table = this.tiers;
    } else {
      table = tableOverride ?? this.tableFor(tag, progress);
      if (!tableOverride && this.pityTable && this.box.pity && (this.pityStreak.get(tag) ?? 0) >= this.box.pity.afterLosses) {
        table = this.pityTable;
        pityApplied = true;
      } else if (!tableOverride && this.secretTable && table === this.displayed) {
        table = this.secretTable;
      }
    }

    let clientSeed = this.newClientSeed();
    let serverSeed = this.serverSeed;
    let serverHash = this.serverHash;
    let d = this.drawWith(table, serverSeed, clientSeed, this.nonce, this.opening, beacon);
    const valueOf = (it: ResolvedItem) => (this.model === "tiered" ? it.item.realized : this.value(it.item));

    // grinding rigs (verification still passes because the chosen seeds are what gets published)
    if (this.rigs.serverChosenClientSeed && this.scheme.usesClientSeed && this.algo.clientSeedMode === "site-default") {
      const { attempts, thresholdMultiple } = this.rigs.serverChosenClientSeed;
      let tries = 0;
      while (valueOf(d.item) >= thresholdMultiple * price && tries < Math.max(0, attempts - 1)) {
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
      while (valueOf(d.item) >= thresholdMultiple * price && tries < Math.max(0, attempts - 1)) {
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
      while (valueOf(d.item) >= thresholdMultiple * price && n < maxRerolls) {
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
    let payout: number;
    let tierId: string | undefined;
    let bonusItemId: string | undefined;
    let bonusPayout: number | undefined;

    if (this.model === "tiered" && this.tiers) {
      // the proof resolves to a tier; the item inside the tier comes from inventory, as at StockX
      tierId = d.item.itemId;
      const tier = this.box.tiers!.find((t) => t.id === tierId)!;
      const inv = this.tierInventory.get(tierId)!;
      const available = tier.itemIds.filter((id) => (inv.get(id) ?? 0) > 0 && this.catalog.has(id));
      if (!available.length) {
        this.exhausted = true;
        this.exhaustedReason = `tier "${tier.name}" ran out of inventory`;
        itemId = tier.itemIds.find((id) => this.catalog.has(id)) ?? this.displayed.items[0].itemId;
      } else {
        itemId = available[this.rng.int(available.length)];
        const left = inv.get(itemId)!;
        if (Number.isFinite(left)) inv.set(itemId, left - 1);
      }
      payout = this.value(this.catalog.get(itemId)!);
    } else {
      payout = this.value(d.item.item);
      if (this.model === "pool") {
        const k = this.poolIds.indexOf(itemId);
        if (k >= 0) {
          this.poolRemaining[k]--;
          this.poolTotal--;
          this.poolSold++;
        }
        if (this.poolTotal <= 0) {
          if (this.box.pool?.lastOneItemId && this.catalog.has(this.box.pool.lastOneItemId)) {
            bonusItemId = this.box.pool.lastOneItemId;
            bonusPayout = this.value(this.catalog.get(bonusItemId)!);
            this.counters.lastOneAwards++;
          }
          this.resetPool();
          this.counters.drops++;
        } else if (this.rigs.earlyRetire && this.box.pool && this.box.pool.retire !== "when-empty" && this.poolSold / this.poolInitialTotal >= this.rigs.earlyRetire.atFraction) {
          const threshold = this.rigs.earlyRetire.grailMultiple * price;
          const remainingTop: { itemId: string; payout: number }[] = [];
          this.poolIds.forEach((id, i) => {
            const it = this.catalog.get(id)!;
            if (this.poolRemaining[i] > 0 && this.value(it) >= threshold) for (let c = 0; c < this.poolRemaining[i]; c++) remainingTop.push({ itemId: id, payout: this.value(it) });
          });
          if (remainingTop.length) {
            if (this.box.pool.retire === "must-distribute") this.counters.retirementAwards.push(...remainingTop);
            this.resetPool();
            this.counters.retirements++;
            this.counters.drops++;
          }
        }
      }
      if (this.secretId && itemId === this.secretId) this.counters.secretDraws++;
      if (pityApplied) this.counters.pityApplied++;
      if (this.box.pity) this.pityStreak.set(tag, payout < price ? (this.pityStreak.get(tag) ?? 0) + 1 : 0);
    }
    if (this.rigs.bypass && this.hidden) {
      // the awarded item comes from the hidden table; the proof fields stay honest-looking
      const forced = lookupTicket(this.hidden, this.rng.int(this.hidden.T));
      itemId = forced.itemId;
      payout = this.value(forced.item);
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
      poolT,
      poolCounts,
      tierId,
      pityApplied: pityApplied || undefined,
      bonusItemId,
      bonusPayout,
    };
  }
}

/** Honest recomputation of a record against the displayed table (or the pool state, tier table or pity table it declares). */
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
  const mappingId = algo.mapping === "native" ? scheme.nativeMapping : algo.mapping;
  const model = box.model ?? "weighted";
  if (model === "tiered" && box.tiers?.length) {
    const tt = tierTable(box.tiers, box.ticketTotal, catalog);
    const m = mapTicket(mappingId, digest, tt.T);
    const tier = mappingId === "float-cumulative" ? lookupFloat(tt, m.u ?? 0).item : lookupTicket(tt, m.ticket);
    if (tier.itemId !== rec.tierId) return { ok: false, reason: "tier mismatch" };
    return { ok: true, reason: "ok (tier only: the item inside the tier is the operator's choice)" };
  }
  let table: ResolvedTable;
  if (model === "pool" && box.pool && rec.poolCounts) {
    const ids = Object.keys(box.pool.copies).filter((id) => box.pool!.copies[id] > 0 && catalog.has(id));
    table = tableFromCounts(ids, rec.poolCounts, catalog);
  } else {
    table = resolveTable(box.items, box.ticketTotal, catalog);
    if (rec.pityApplied && box.pity) {
      const min = box.pity.minValueMultiple * box.price;
      table = subsetTable(table, (r) => priceOf(r.item, box.valueLayer) >= min, box.ticketTotal, catalog) ?? table;
    }
  }
  const m = mapTicket(mappingId, digest, table.T);
  const item = mappingId === "float-cumulative" ? lookupFloat(table, m.u ?? 0).item : lookupTicket(table, m.ticket);
  if (item.itemId !== rec.itemId) return { ok: false, reason: "item mismatch (awarded item is not what the proof produces)" };
  return { ok: true, reason: "ok" };
}

export function valueAt(item: CatalogItem, layer: PriceLayer, inflation = 1): number {
  return priceOf(item, layer) * inflation;
}
