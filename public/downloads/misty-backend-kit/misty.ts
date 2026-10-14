/**
 * Misty's mystery box, copied from the live site (captured 12 October 2026).
 *
 * One open: a server seed is committed (its hash is shown) before the player pays; the player may set a client seed;
 * the spin number (nonce) starts at 1 for the box and counts on for free spins. digest = HMAC-SHA256 keyed by
 * "DRAW-<slug>-<serverSeed>-<clientSeed>-<nonce>" over an empty message (Misty's published verifier convention); the
 * first 13 hex characters become a roll in [0, 1); the roll is read against the odds table, whose hash is frozen onto
 * the open. Free spins resolve from the box's small bonus table with the same seed and the next nonces. After the open
 * the seed is revealed and a fresh seed is committed for the next open.
 *
 * The back office can edit every outcome's percent, and give a player (or player segment) their own table. The
 * commitment proves that the roll matched the table used; it does not prove every player got the same table.
 */
import { canonicalJson, hmacSha256Hex, sha256Hex } from "./hash";
import { chiSquare } from "./metrics";
import { makeRng, type Rng } from "./rng";
import { MISTY_LIVE_BOXES } from "./mistyLive.generated";
import type {
  MistyBonusEntry,
  MistyBonusSpin,
  MistyBox,
  MistyConfig,
  MistyOutcome,
  MistyOutcomeStat,
  MistyPlayer,
  MistyPlayerStat,
  MistyResult,
  MistySpin,
  Progress,
  Verifier,
} from "./types";

export const MISTY_BOXES: MistyBox[] = MISTY_LIVE_BOXES;
export const MISTY_BOX_BY_SLUG = new Map(MISTY_LIVE_BOXES.map((b) => [b.slug, b] as const));

export function mistyBox(slug: string): MistyBox {
  const b = MISTY_BOX_BY_SLUG.get(slug);
  if (!b) throw new Error(`Unknown Misty box: ${slug}`);
  return b;
}

/** The box a config refers to: a builder box carried in the config, or one of the live boxes. */
export function boxOf(cfg: Pick<MistyConfig, "boxSlug" | "customBox">): MistyBox {
  return cfg.customBox && cfg.customBox.slug === cfg.boxSlug ? cfg.customBox : mistyBox(cfg.boxSlug);
}

/** The page's own odds, percent per outcome id. */
export function liveWeights(box: MistyBox): Record<string, number> {
  return Object.fromEntries(box.outcomes.map((o) => [o.id, o.weight]));
}

export interface MistyTableEntry {
  outcome: MistyOutcome;
  percent: number;
  from: number;
  to: number;
}
export interface MistyTable {
  entries: MistyTableEntry[];
  total: number;
  hash: string;
}

/** The odds table as it stands for one open: percent per outcome, cumulative bands, and the hash frozen onto the open. */
export function buildTable(box: MistyBox, weights?: Record<string, number>): MistyTable {
  let acc = 0;
  const entries = box.outcomes.map((o) => {
    const percent = Math.max(0, weights?.[o.id] ?? o.weight);
    const from = acc;
    acc += percent;
    return { outcome: o, percent, from, to: acc };
  });
  const hash = sha256Hex(canonicalJson({ slug: box.slug, price: box.price, table: entries.map((e) => ({ id: e.outcome.id, percent: e.percent })) }));
  return { entries, total: acc, hash };
}

/** Walk the bands. The roll (0..1) is scaled to the table total, so a table edited to sum to 99 or 101 still resolves. */
export function lookup(table: MistyTable, u: number): MistyTableEntry {
  const pos = u * table.total;
  for (const e of table.entries) if (e.percent > 0 && pos < e.to) return e;
  for (let i = table.entries.length - 1; i >= 0; i--) if (table.entries[i].percent > 0) return table.entries[i];
  return table.entries[table.entries.length - 1];
}

export interface BonusTable {
  entries: { mistees: number; percent: number; from: number; to: number }[];
  total: number;
}
/** Kit 1.1: the hash frozen onto an open for its free-spin table. Rows in stored order, API vocabulary. */
export function bonusHash(slug: string, bonus: { credits: number; percent: number }[]): string {
  return sha256Hex(canonicalJson({ slug, bonus: bonus.map((b) => ({ credits: b.credits, percent: b.percent })) }));
}
export const bonusHashOfBox = (box: MistyBox) => bonusHash(box.slug, box.bonus.map((b) => ({ credits: b.mistees, percent: b.weight })));

export function buildBonus(bonus: MistyBonusEntry[]): BonusTable {
  let acc = 0;
  const entries = bonus.map((b) => {
    const percent = Math.max(0, b.weight);
    const from = acc;
    acc += percent;
    return { mistees: b.mistees, percent, from, to: acc };
  });
  return { entries, total: acc };
}
export function lookupBonus(t: BonusTable, u: number): BonusTable["entries"][number] {
  if (!t.entries.length || t.total <= 0) return { mistees: 0, percent: 0, from: 0, to: 0 };
  const pos = u * t.total;
  for (const e of t.entries) if (e.percent > 0 && pos < e.to) return e;
  return t.entries[t.entries.length - 1];
}

/** Average Mistees one free spin pays. */
export function bonusEv(bonus: MistyBonusEntry[]): number {
  const t = bonus.reduce((s, b) => s + Math.max(0, b.weight), 0);
  return t > 0 ? bonus.reduce((s, b) => s + b.mistees * Math.max(0, b.weight), 0) / t : 0;
}

export interface MistyValues {
  misteeFace: number;
  misteeReal: number;
  itemRealized: number;
}
export interface MistyOutcomeMath {
  id: string;
  label: string;
  kind: MistyOutcome["kind"];
  percent: number;
  share: number;
  oneIn: number;
  /** Mistees this outcome pays on average, free spins included */
  mistees: number;
  valueFace: number;
  valueReal: number;
  costFace: number;
  costReal: number;
}
export interface MistyMath {
  total: number;
  pItem: number;
  evItems: number;
  evItemsReal: number;
  bonusEv: number;
  evMistees: number;
  payFace: number;
  payReal: number;
  returnFace: number;
  returnReal: number;
  perOutcome: MistyOutcomeMath[];
}

/** What a table pays per open on average, at face (Mistees at misteeFace, items at listed) and real (misteeReal, itemRealized). */
export function mistyMath(box: MistyBox, weights: Record<string, number> | undefined, bonus: MistyBonusEntry[], v: MistyValues): MistyMath {
  const table = buildTable(box, weights);
  const be = bonusEv(bonus);
  let pItem = 0;
  let evItems = 0;
  let evMistees = 0;
  const perOutcome = table.entries.map((e) => {
    const share = table.total > 0 ? e.percent / table.total : 0;
    const o = e.outcome;
    const mist = o.kind === "item" ? 0 : o.mistees + o.freeSpins * be;
    const valueFace = o.kind === "item" ? (o.valueUsd ?? 0) : mist * v.misteeFace;
    const valueReal = o.kind === "item" ? (o.valueUsd ?? 0) * v.itemRealized : mist * v.misteeReal;
    if (o.kind === "item") {
      pItem += share;
      evItems += share * (o.valueUsd ?? 0);
    } else evMistees += share * mist;
    return { id: o.id, label: o.label, kind: o.kind, percent: e.percent, share, oneIn: share > 0 ? 1 / share : Infinity, mistees: mist, valueFace, valueReal, costFace: share * valueFace, costReal: share * valueReal };
  });
  const evItemsReal = evItems * v.itemRealized;
  const payFace = evItems + evMistees * v.misteeFace;
  const payReal = evItemsReal + evMistees * v.misteeReal;
  return { total: table.total, pItem, evItems, evItemsReal, bonusEv: be, evMistees, payFace, payReal, returnFace: box.price > 0 ? payFace / box.price : 0, returnReal: box.price > 0 ? payReal / box.price : 0, perOutcome };
}

/** Scale every outcome so the table sums to 100. */
export function normaliseWeights(box: MistyBox, weights: Record<string, number>): Record<string, number> {
  const total = box.outcomes.reduce((s, o) => s + Math.max(0, weights[o.id] ?? o.weight), 0);
  if (total <= 0) return liveWeights(box);
  return Object.fromEntries(box.outcomes.map((o) => [o.id, (Math.max(0, weights[o.id] ?? o.weight) * 100) / total]));
}

/** Multiply the odds of every physical item by m and take the difference out of the credit outcomes, keeping the total. */
export function scaleItemOdds(box: MistyBox, base: Record<string, number>, m: number): Record<string, number> {
  const w = (o: MistyOutcome) => Math.max(0, base[o.id] ?? o.weight);
  const items = box.outcomes.filter((o) => o.kind === "item");
  const rest = box.outcomes.filter((o) => o.kind !== "item");
  const total = box.outcomes.reduce((s, o) => s + w(o), 0);
  const itemSum = items.reduce((s, o) => s + w(o), 0);
  const restSum = rest.reduce((s, o) => s + w(o), 0);
  const newItemSum = Math.min(itemSum * Math.max(0, m), total * 0.99);
  const mi = itemSum > 0 ? newItemSum / itemSum : 0;
  const mr = restSum > 0 ? (total - newItemSum) / restSum : 0;
  const out: Record<string, number> = {};
  for (const o of items) out[o.id] = w(o) * mi;
  for (const o of rest) out[o.id] = w(o) * mr;
  return out;
}

/** Scale the piece odds until the box pays back the target share of its price on screen (binary search on the multiplier). */
export function fitItemOdds(box: MistyBox, base: Record<string, number>, targetReturn: number, v: MistyValues): Record<string, number> {
  const ret = (m: number) => mistyMath(box, scaleItemOdds(box, base, m), box.bonus, v).returnFace;
  const increasing = ret(2) >= ret(0.5);
  let lo = 0;
  let hi = 1;
  const below = (m: number) => (increasing ? ret(m) < targetReturn : ret(m) > targetReturn);
  let guard = 0;
  while (below(hi) && hi < 1e6 && guard++ < 40) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (below(mid)) lo = mid;
    else hi = mid;
  }
  return scaleItemOdds(box, base, hi);
}

/** Ratio of a player's item odds to the box's item odds (1 = same). */
export function itemOddsRatio(box: MistyBox, base: Record<string, number>, player?: Record<string, number>): number {
  if (!player) return 1;
  const items = box.outcomes.filter((o) => o.kind === "item");
  const a = items.reduce((s, o) => s + Math.max(0, base[o.id] ?? o.weight), 0);
  const b = items.reduce((s, o) => s + Math.max(0, player[o.id] ?? base[o.id] ?? o.weight), 0);
  return a > 0 ? b / a : 1;
}

const TWO52 = 2 ** 52;
/** Misty's digest: HMAC-SHA256 keyed by DRAW-slug-serverSeed-clientSeed-nonce over an empty message. */
export const mistyDigest = (slug: string, serverSeed: string, clientSeed: string, nonce: number): string =>
  hmacSha256Hex(["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), "");
/** The first 13 hex characters (52 bits) as a number in [0, 1). */
export const rollOf = (digest: string): number => parseInt(digest.slice(0, 13), 16) / TWO52;

export function playerWeights(cfg: MistyConfig, playerId: string): { player: MistyPlayer | undefined; weights: Record<string, number> } {
  const player = cfg.players.find((p) => p.id === playerId);
  return { player, weights: player?.weights ? { ...cfg.weights, ...player.weights } : cfg.weights };
}

/** One Misty box, opened the way the live site describes: commit, pay, resolve, free spins, reveal, rotate. */
export class MistyOpener {
  readonly box: MistyBox;
  private rng: Rng;
  private nextSeed: string;
  private count = 0;
  private tables = new Map<string, MistyTable>();
  private bonus: BonusTable;

  constructor(
    readonly cfg: MistyConfig,
    seedLabel: string | number,
  ) {
    this.box = boxOf(cfg);
    this.rng = makeRng("sfc32", `misty:${cfg.boxSlug}:${seedLabel}`);
    this.nextSeed = this.rng.hex(32);
    this.bonus = buildBonus(cfg.bonus);
  }

  /** Shown before the player pays: the fingerprint of the secret that will decide the next open. */
  get commitment(): string {
    return this.cfg.provablyFair ? sha256Hex(this.nextSeed) : "";
  }
  get opens(): number {
    return this.count;
  }
  tableFor(playerId: string): MistyTable {
    let t = this.tables.get(playerId);
    if (!t) {
      t = buildTable(this.box, playerWeights(this.cfg, playerId).weights);
      this.tables.set(playerId, t);
    }
    return t;
  }

  spin(playerId: string = this.cfg.activePlayerId): MistySpin {
    const table = this.tableFor(playerId);
    const pf = this.cfg.provablyFair;
    const serverSeed = this.nextSeed;
    const serverHash = pf ? sha256Hex(serverSeed) : "";
    const clientSeed = pf ? this.cfg.clientSeed || "player-seed" : "";
    let nonce = 1;
    const digest = pf ? mistyDigest(this.box.slug, serverSeed, clientSeed, nonce) : "";
    const roll = pf ? rollOf(digest) : this.rng.next();
    const o = lookup(table, roll).outcome;
    const bonus: MistyBonusSpin[] = [];
    for (let i = 0; i < o.freeSpins; i++) {
      nonce++;
      const d = pf ? mistyDigest(this.box.slug, serverSeed, clientSeed, nonce) : "";
      const r = pf ? rollOf(d) : this.rng.next();
      bonus.push({ nonce, digest: d, roll: r, mistees: lookupBonus(this.bonus, r).mistees });
    }
    const totalMistees = o.mistees + bonus.reduce((s, b) => s + b.mistees, 0);
    this.count++;
    this.nextSeed = this.rng.hex(32); // Misty commits a fresh seed for the next open
    return {
      idx: this.count,
      playerId,
      boxSlug: this.box.slug,
      price: this.box.price,
      serverSeed: pf ? serverSeed : "",
      serverHash,
      clientSeed,
      nonce: 1,
      digest,
      roll,
      tableHash: table.hash,
      outcomeId: o.id,
      label: o.label,
      kind: o.kind,
      rarity: o.rarity,
      mistees: o.mistees,
      freeSpins: o.freeSpins,
      bonus,
      totalMistees,
      itemValue: o.kind === "item" ? (o.valueUsd ?? 0) : 0,
    };
  }
}

/** Recompute an open from what the player was shown: seed against its hash, digest, roll, band, free spins. */
export function verifyMistySpin(spin: MistySpin, cfg: MistyConfig): { ok: boolean; reason?: string } {
  if (!cfg.provablyFair || !spin.serverHash) return { ok: false, reason: "no commitment: nothing to check" };
  const box = cfg.customBox && cfg.customBox.slug === spin.boxSlug ? cfg.customBox : mistyBox(spin.boxSlug);
  if (sha256Hex(spin.serverSeed) !== spin.serverHash) return { ok: false, reason: "seed does not match the hash shown before payment" };
  const table = buildTable(box, playerWeights(cfg, spin.playerId).weights);
  if (table.hash !== spin.tableHash) return { ok: false, reason: "odds table differs from the one frozen onto the open" };
  const digest = mistyDigest(box.slug, spin.serverSeed, spin.clientSeed, 1);
  if (digest !== spin.digest) return { ok: false, reason: "digest differs" };
  if (lookup(table, rollOf(digest)).outcome.id !== spin.outcomeId) return { ok: false, reason: "roll lands on a different outcome" };
  const bt = buildBonus(cfg.bonus);
  for (const b of spin.bonus) {
    const d = mistyDigest(box.slug, spin.serverSeed, spin.clientSeed, b.nonce);
    if (d !== b.digest || lookupBonus(bt, rollOf(d)).mistees !== b.mistees) return { ok: false, reason: "free spin differs" };
  }
  return { ok: true };
}

export function runMisty(cfg: MistyConfig, seed: number, onProgress?: Progress): MistyResult {
  const t0 = Date.now();
  const box = boxOf(cfg);
  const opener = new MistyOpener(cfg, seed);
  const pick = makeRng("sfc32", `misty-players:${seed}`);
  const players: MistyPlayer[] = cfg.players.length ? cfg.players : [{ id: "guest", name: "Guest", share: 1 }];
  const shareTotal = players.reduce((s, p) => s + Math.max(0, p.share), 0) || 1;
  const N = Math.max(1, Math.floor(cfg.run.opens));
  const counts = new Map<string, number>(box.outcomes.map((o) => [o.id, 0]));
  const maths = new Map<string, MistyMath>();
  const per = new Map<string, MistyPlayerStat>();
  for (const p of players) {
    const m = mistyMath(box, playerWeights(cfg, p.id).weights, cfg.bonus, cfg);
    maths.set(p.id, m);
    per.set(p.id, { id: p.id, name: p.name, opens: 0, spent: 0, items: 0, itemValue: 0, mistees: 0, returnFace: 0, expectedFace: m.returnFace, itemChance: m.pItem });
  }
  const sample: MistySpin[] = [];
  let items = 0;
  let itemValue = 0;
  let mistees = 0;
  let freeSpins = 0;
  let cumFace = 0;
  let cumReal = 0;
  let dry = 0;
  let longestDry = 0;
  const curveStep = Math.max(1, Math.floor(N / 200));
  const curve: { n: number; face: number; real: number }[] = [];
  for (let i = 0; i < N; i++) {
    let r = pick.next() * shareTotal;
    let p = players[players.length - 1];
    for (const c of players) {
      r -= Math.max(0, c.share);
      if (r < 0) {
        p = c;
        break;
      }
    }
    const s = opener.spin(p.id);
    counts.set(s.outcomeId, (counts.get(s.outcomeId) ?? 0) + 1);
    const ps = per.get(p.id)!;
    ps.opens++;
    ps.spent += box.price;
    if (s.kind === "item") {
      items++;
      itemValue += s.itemValue;
      ps.items++;
      ps.itemValue += s.itemValue;
    }
    mistees += s.totalMistees;
    ps.mistees += s.totalMistees;
    freeSpins += s.freeSpins;
    if (sample.length < cfg.run.verifySample) sample.push(s);
    cumFace += s.itemValue + s.totalMistees * cfg.misteeFace;
    cumReal += s.itemValue * cfg.itemRealized + s.totalMistees * cfg.misteeReal;
    if (s.kind === "item") dry = 0;
    else if (++dry > longestDry) longestDry = dry;
    if ((i + 1) % curveStep === 0 || i === N - 1) curve.push({ n: i + 1, face: cumFace / ((i + 1) * box.price || 1), real: cumReal / ((i + 1) * box.price || 1) });
    if (onProgress && (i & 1023) === 0) onProgress(i, N);
  }
  const base = mistyMath(box, cfg.weights, cfg.bonus, cfg);
  const byOutcome: MistyOutcomeStat[] = box.outcomes.map((o) => {
    let expected = 0;
    for (const p of players) {
      const po = maths.get(p.id)!.perOutcome.find((x) => x.id === o.id)!;
      expected += po.share * per.get(p.id)!.opens;
    }
    const b = base.perOutcome.find((x) => x.id === o.id)!;
    return { id: o.id, label: o.label, kind: o.kind, percent: b.percent, expected, actual: counts.get(o.id) ?? 0, costPerOpen: b.costFace };
  });
  const chi = chiSquare(
    byOutcome.map((b) => b.actual),
    byOutcome.map((b) => b.expected),
  );
  const spent = N * box.price;
  const face = itemValue + mistees * cfg.misteeFace;
  const real = itemValue * cfg.itemRealized + mistees * cfg.misteeReal;
  const verifier: Verifier = { sampled: 0, passed: 0, failed: 0, reasons: {} };
  for (const s of sample) {
    verifier.sampled++;
    const v = verifyMistySpin(s, cfg);
    s.verified = v.ok;
    if (v.ok) verifier.passed++;
    else {
      verifier.failed++;
      const k = v.reason ?? "unknown";
      verifier.reasons[k] = (verifier.reasons[k] ?? 0) + 1;
    }
  }
  const perPlayer = [...per.values()].map((p) => ({ ...p, returnFace: p.spent > 0 ? (p.itemValue + p.mistees * cfg.misteeFace) / p.spent : 0 }));
  onProgress?.(N, N);
  return {
    kind: "misty",
    boxSlug: box.slug,
    boxName: box.name,
    price: box.price,
    opens: N,
    spent,
    items,
    itemValue,
    itemValueReal: itemValue * cfg.itemRealized,
    mistees,
    freeSpins,
    returnFace: spent > 0 ? face / spent : 0,
    returnReal: spent > 0 ? real / spent : 0,
    expectedFace: base.returnFace,
    expectedReal: base.returnReal,
    pItem: base.pItem,
    expectedMistees: base.evMistees,
    byOutcome,
    chi,
    perPlayer,
    verifier,
    sample,
    curve,
    longestDry,
    elapsedMs: Date.now() - t0,
  };
}
