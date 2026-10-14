/**
 * Reference production flow for a Misty-style open. Kit v1.1 (14 October 2026).
 *
 * Pure functions come from ./misty (same code as the simulator). Storage is an interface you implement over
 * schema.sql. The server seed comes from a CSPRNG and is only ever returned in the spin response.
 *
 * 1.1: resolve and verify load the snapshots pinned on the open by hash (never "current"); bonusHash has a recipe;
 * verify reports one check per claim; credits are whole numbers; CONFIG holds the main site's three policies.
 *
 * This file is a guide, not a framework: wire it into your HTTP layer and your payments provider.
 */
import { randomBytes } from "node:crypto";
import { sha256Hex } from "./hash";
import { bonusHash as bonusHashOf, buildBonus, buildTable, lookup, lookupBonus, mistyDigest, rollOf, type MistyTable } from "./misty";
import type { MistyBonusEntry, MistyBox } from "./types";

/** The main site's policies (decided 14 October 2026). */
export const CONFIG = {
  defaultClientSeed: "grailnoir-default", // published; recorded as clientSeedSource = "server-default"
  openTtlMs: 15 * 60 * 1000,
  tradeInPercent: 90, // of listed value, in whole credits
  maxBonusDepth: 1,
};

export type OpenStatus = "created" | "paid" | "resolved" | "expired";

export interface OpenRow {
  id: string;
  playerId: string;
  boxSlug: string;
  priceCents: number;
  tableHash: string;
  bonusHash: string;
  /** store encrypted; decrypt only inside spin() */
  serverSeed: string;
  serverHash: string;
  clientSeed: string | null;
  clientSeedSource: "player" | "server-default" | null;
  status: OpenStatus;
  digest?: string;
  roll?: number;
  outcomeId?: string;
  bonusSpins?: { nonce: number; digest: string; roll: number; credits: number }[];
  creditsAwarded?: number;
  resolvedAt?: Date;
  revealedAt?: Date;
  expiresAt: Date;
}

/** A pinned snapshot: the table as it was hashed. `weights` is percent per outcome id in stored order. */
export interface TableSnapshot {
  tableHash: string;
  price: number; // dollars, the value hashed
  entries: { id: string; percent: number }[];
}
export interface BonusSnapshot {
  bonusHash: string;
  entries: { credits: number; percent: number }[];
}

/** The table actually current for this player: the segment override if any, else the box's current table. */
export interface TableResolver {
  tableFor(playerId: string, box: MistyBox): TableSnapshot;
  bonusFor(box: MistyBox): BonusSnapshot;
}

export interface Store {
  getBox(slug: string): Promise<MistyBox>;
  /** snapshots by hash; immutable; 404 when unknown */
  getTableSnapshot(tableHash: string): Promise<TableSnapshot>;
  getBonusSnapshot(bonusHash: string): Promise<BonusSnapshot>;
  insertOpen(row: OpenRow): Promise<void>;
  getOpen(id: string): Promise<OpenRow>;
  updateOpen(id: string, patch: Partial<OpenRow>, expectStatus: OpenStatus): Promise<void>;
  /** one transaction: open → resolved, item award (with the trade-in rate) or credit ledger rows, bonus spins */
  commitResult(row: OpenRow, award: { kind: "item"; valueCents: number; tradeInPercent: number; tradeInCredits: number } | { kind: "credit"; credits: number }): Promise<void>;
  /** charge the card or debit credit; must be idempotent on the key */
  takePayment(row: OpenRow, method: "card" | "credit", idempotencyKey: string, token?: string): Promise<void>;
}

/** Engine helpers over a pinned snapshot (the engine builds from a box; here the percents come from the snapshot). */
function tableFromSnapshot(box: MistyBox, snap: TableSnapshot): MistyTable {
  const weights: Record<string, number> = {};
  for (const e of snap.entries) weights[e.id] = e.percent;
  // keep the snapshot order: reorder the box outcomes to match
  const byId = new Map(box.outcomes.map((o) => [o.id, o]));
  const ordered = { ...box, price: snap.price, outcomes: snap.entries.map((e) => byId.get(e.id)!).filter(Boolean) };
  const t = buildTable(ordered, weights);
  if (t.hash !== snap.tableHash) throw new Error("snapshot does not reproduce its hash; the stored entries were altered");
  return t;
}
const bonusEntries = (snap: BonusSnapshot): MistyBonusEntry[] => snap.entries.map((b) => ({ mistees: b.credits, weight: b.percent }));

export const tradeInCredits = (valueCents: number, percent: number) => Math.round((valueCents * percent) / 100 / 100);

/** Step 1: create the open and commit. Nothing about the player's seed is known yet. */
export async function createOpen(store: Store, resolver: TableResolver, playerId: string, boxSlug: string): Promise<Pick<OpenRow, "id" | "serverHash" | "tableHash" | "bonusHash" | "priceCents" | "expiresAt">> {
  const box = await store.getBox(boxSlug);
  const table = resolver.tableFor(playerId, box);
  const bonus = resolver.bonusFor(box);
  const serverSeed = randomBytes(32).toString("hex"); // CSPRNG, 64 hex characters
  const row: OpenRow = {
    id: crypto.randomUUID(),
    playerId,
    boxSlug,
    priceCents: Math.round(table.price * 100),
    tableHash: table.tableHash,
    bonusHash: bonus.bonusHash,
    serverSeed,
    serverHash: sha256Hex(serverSeed),
    clientSeed: null,
    clientSeedSource: null,
    status: "created",
    expiresAt: new Date(Date.now() + CONFIG.openTtlMs),
  };
  await store.insertOpen(row);
  return { id: row.id, serverHash: row.serverHash, tableHash: row.tableHash, bonusHash: row.bonusHash, priceCents: row.priceCents, expiresAt: row.expiresAt };
}

/** Step 2 (optional): the player's seed, only before payment. */
export async function setClientSeed(store: Store, openId: string, clientSeed: string): Promise<void> {
  if (!clientSeed || clientSeed.length > 64) throw Object.assign(new Error("bad seed"), { code: "invalid_seed" });
  await store.updateOpen(openId, { clientSeed, clientSeedSource: "player" }, "created"); // 409 seed_locked when status moved on
}

/** Step 3: payment. Fills the default seed if the player set none, and records that it did. */
export async function pay(store: Store, openId: string, method: "card" | "credit", idempotencyKey: string, token?: string): Promise<void> {
  const row = await store.getOpen(openId);
  if (row.status !== "created") throw Object.assign(new Error("not payable"), { code: "open_not_payable" });
  if (row.expiresAt.getTime() < Date.now()) throw Object.assign(new Error("expired"), { code: "open_expired" });
  if (!row.clientSeed) await store.updateOpen(openId, { clientSeed: CONFIG.defaultClientSeed, clientSeedSource: "server-default" }, "created");
  await store.takePayment(row, method, idempotencyKey, token);
  await store.updateOpen(openId, { status: "paid" }, "created");
}

/** Step 4: resolve once from the pinned snapshots, reveal. A retry returns the stored row. */
export async function spin(store: Store, openId: string): Promise<OpenRow> {
  const row = await store.getOpen(openId);
  if (row.status === "resolved") return row; // idempotent
  if (row.status !== "paid") throw Object.assign(new Error("not paid"), { code: "open_not_paid" });
  const box = await store.getBox(row.boxSlug);
  const table = tableFromSnapshot(box, await store.getTableSnapshot(row.tableHash)); // never the current table
  const bonus = await store.getBonusSnapshot(row.bonusHash);
  const bt = buildBonus(bonusEntries(bonus));
  const clientSeed = row.clientSeed ?? CONFIG.defaultClientSeed;

  let nonce = 1;
  const digest = mistyDigest(box.slug, row.serverSeed, clientSeed, nonce);
  const roll = rollOf(digest);
  const outcome = lookup(table, roll).outcome;
  const bonusSpins: NonNullable<OpenRow["bonusSpins"]> = [];
  for (let i = 0; i < Math.min(outcome.freeSpins, 3 * CONFIG.maxBonusDepth); i++) {
    nonce++;
    const d = mistyDigest(box.slug, row.serverSeed, clientSeed, nonce);
    const r = rollOf(d);
    bonusSpins.push({ nonce, digest: d, roll: r, credits: lookupBonus(bt, r).mistees });
  }
  const credits = outcome.mistees + bonusSpins.reduce((s, b) => s + b.credits, 0);
  const now = new Date();
  const resolved: OpenRow = { ...row, status: "resolved", digest, roll, outcomeId: outcome.id, bonusSpins, creditsAwarded: credits, resolvedAt: now, revealedAt: now };
  if (outcome.kind === "item") {
    const valueCents = Math.round((outcome.valueUsd ?? 0) * 100);
    await store.commitResult(resolved, { kind: "item", valueCents, tradeInPercent: CONFIG.tradeInPercent, tradeInCredits: tradeInCredits(valueCents, CONFIG.tradeInPercent) });
  } else {
    await store.commitResult(resolved, { kind: "credit", credits });
  }
  return resolved; // the HTTP layer returns serverSeed only from here on
}

export interface VerifyQuery {
  slug: string;
  serverSeed: string;
  clientSeed: string;
  tableHash: string;
  bonusHash?: string;
  serverHash?: string;
  outcomeId?: string;
  /** credits of each free spin, in nonce order */
  bonusCredits?: number[];
}
export interface VerifyResult {
  ok: boolean;
  checks: { serverHash: boolean | null; tableHash: boolean; bonusHash: boolean | null; outcome: boolean | null; bonusSpins: boolean | null };
  serverHash: string;
  digest: string;
  roll: number;
  outcomeId: string;
  bonusSpins: { nonce: number; digest: string; roll: number; credits: number }[];
  reason: string | null;
}

/** Public verifier: stateless given the pinned snapshots. One boolean per claim; ok only when all are true. */
export function verify(box: MistyBox, table: TableSnapshot, bonus: BonusSnapshot | null, q: VerifyQuery): VerifyResult {
  const t = tableFromSnapshot(box, table);
  const checks: VerifyResult["checks"] = { serverHash: null, tableHash: t.hash === q.tableHash, bonusHash: null, outcome: null, bonusSpins: null };
  const serverHash = sha256Hex(q.serverSeed);
  if (q.serverHash) checks.serverHash = serverHash === q.serverHash;
  const digest = mistyDigest(box.slug, q.serverSeed, q.clientSeed, 1);
  const roll = rollOf(digest);
  const outcome = lookup(t, roll).outcome;
  if (q.outcomeId) checks.outcome = outcome.id === q.outcomeId;
  const spins: VerifyResult["bonusSpins"] = [];
  if (bonus) {
    if (q.bonusHash) checks.bonusHash = bonusHashOf(box.slug, bonus.entries) === q.bonusHash && bonus.bonusHash === q.bonusHash;
    const bt = buildBonus(bonusEntries(bonus));
    for (let i = 0; i < outcome.freeSpins; i++) {
      const nonce = i + 2;
      const d = mistyDigest(box.slug, q.serverSeed, q.clientSeed, nonce);
      const r = rollOf(d);
      spins.push({ nonce, digest: d, roll: r, credits: lookupBonus(bt, r).mistees });
    }
    if (q.bonusCredits) checks.bonusSpins = q.bonusCredits.length === spins.length && q.bonusCredits.every((c, i) => spins[i].credits === c);
  } else if (q.bonusHash || q.bonusCredits) {
    checks.bonusHash = false;
  }
  const failed = (Object.keys(checks) as (keyof typeof checks)[]).filter((k) => checks[k] === false);
  const reasons: Record<string, string> = {
    serverHash: "seed does not match the hash shown before payment",
    tableHash: "table hash differs",
    bonusHash: "bonus table hash differs",
    outcome: "roll lands on a different outcome",
    bonusSpins: "a free spin differs",
  };
  return { ok: failed.length === 0, checks, serverHash, digest, roll, outcomeId: outcome.id, bonusSpins: spins, reason: failed.length ? reasons[failed[0]] : null };
}
