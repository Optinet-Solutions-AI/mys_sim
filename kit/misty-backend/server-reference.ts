/**
 * Reference production flow for a Misty-style open. Kit v1.0 (13 October 2026).
 *
 * Pure functions come from ./misty (same code as the simulator). Storage is an interface you implement over
 * schema.sql. The server seed comes from a CSPRNG and is only ever returned in the spin response.
 *
 * This file is a guide, not a framework: wire it into your HTTP layer and your payments provider.
 */
import { randomBytes } from "node:crypto";
import { sha256Hex } from "./hash";
import { buildBonus, buildTable, lookup, lookupBonus, mistyDigest, rollOf, type MistyTable } from "./misty";
import type { MistyBonusEntry, MistyBox } from "./types";

export type OpenStatus = "created" | "paid" | "resolved" | "expired";

export interface OpenRow {
  id: string;
  playerId: string;
  boxSlug: string;
  priceCents: number;
  tableHash: string;
  bonusHash: string;
  /** store encrypted; decrypt only inside resolve() */
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

/** The table actually used for this player: the segment override if any, else the box's current table. */
export interface TableResolver {
  tableFor(playerId: string, box: MistyBox): { table: MistyTable; weights: Record<string, number> };
  bonusFor(box: MistyBox): { entries: MistyBonusEntry[]; hash: string };
}

export interface Store {
  getBox(slug: string): Promise<MistyBox>;
  insertOpen(row: OpenRow): Promise<void>;
  getOpen(id: string): Promise<OpenRow>;
  updateOpen(id: string, patch: Partial<OpenRow>, expectStatus: OpenStatus): Promise<void>;
  /** one transaction: open → resolved, item award or credit ledger rows, bonus spins */
  commitResult(row: OpenRow, award: { kind: "item"; valueCents: number } | { kind: "credit"; credits: number }): Promise<void>;
  /** charge the card or debit credit; must be idempotent on the key */
  takePayment(row: OpenRow, method: "card" | "credit", idempotencyKey: string, token?: string): Promise<void>;
}

const OPEN_TTL_MS = 15 * 60 * 1000;
const DEFAULT_CLIENT_SEED = "misty-default"; // publish this value in the terms if you keep a default

/** Step 1: create the open and commit. Nothing about the player's seed is known yet. */
export async function createOpen(store: Store, resolver: TableResolver, playerId: string, boxSlug: string): Promise<Pick<OpenRow, "id" | "serverHash" | "tableHash" | "bonusHash" | "priceCents" | "expiresAt">> {
  const box = await store.getBox(boxSlug);
  const { table } = resolver.tableFor(playerId, box);
  const bonus = resolver.bonusFor(box);
  const serverSeed = randomBytes(32).toString("hex"); // CSPRNG, 64 hex characters
  const row: OpenRow = {
    id: crypto.randomUUID(),
    playerId,
    boxSlug,
    priceCents: Math.round(box.price * 100),
    tableHash: table.hash,
    bonusHash: bonus.hash,
    serverSeed,
    serverHash: sha256Hex(serverSeed),
    clientSeed: null,
    clientSeedSource: null,
    status: "created",
    expiresAt: new Date(Date.now() + OPEN_TTL_MS),
  };
  await store.insertOpen(row);
  return { id: row.id, serverHash: row.serverHash, tableHash: row.tableHash, bonusHash: row.bonusHash, priceCents: row.priceCents, expiresAt: row.expiresAt };
}

/** Step 2 (optional): the player's seed, only before payment. */
export async function setClientSeed(store: Store, openId: string, clientSeed: string): Promise<void> {
  if (!clientSeed || clientSeed.length > 64) throw new Error("bad seed");
  await store.updateOpen(openId, { clientSeed, clientSeedSource: "player" }, "created");
}

/** Step 3: payment. Fills the default seed if the player set none, and records that it did. */
export async function pay(store: Store, openId: string, method: "card" | "credit", idempotencyKey: string, token?: string): Promise<void> {
  const row = await store.getOpen(openId);
  if (row.status !== "created") throw new Error("not payable");
  if (row.expiresAt.getTime() < Date.now()) throw new Error("expired");
  if (!row.clientSeed) await store.updateOpen(openId, { clientSeed: DEFAULT_CLIENT_SEED, clientSeedSource: "server-default" }, "created");
  await store.takePayment(row, method, idempotencyKey, token);
  await store.updateOpen(openId, { status: "paid" }, "created");
}

/** Step 4: resolve once, reveal. A retry returns the stored row. */
export async function spin(store: Store, resolver: TableResolver, openId: string): Promise<OpenRow> {
  const row = await store.getOpen(openId);
  if (row.status === "resolved") return row; // idempotent
  if (row.status !== "paid") throw new Error("not paid");
  const box = await store.getBox(row.boxSlug);
  const { table } = resolver.tableFor(row.playerId, box);
  if (table.hash !== row.tableHash) throw new Error("table changed since commit; resolve with the pinned snapshot instead"); // load the snapshot by hash in production
  const bonus = resolver.bonusFor(box);
  const clientSeed = row.clientSeed ?? DEFAULT_CLIENT_SEED;

  let nonce = 1;
  const digest = mistyDigest(box.slug, row.serverSeed, clientSeed, nonce);
  const roll = rollOf(digest);
  const outcome = lookup(table, roll).outcome;
  const bt = buildBonus(bonus.entries);
  const bonusSpins: NonNullable<OpenRow["bonusSpins"]> = [];
  for (let i = 0; i < Math.min(outcome.freeSpins, 3); i++) {
    nonce++;
    const d = mistyDigest(box.slug, row.serverSeed, clientSeed, nonce);
    const r = rollOf(d);
    bonusSpins.push({ nonce, digest: d, roll: r, credits: lookupBonus(bt, r).mistees });
  }
  const credits = outcome.mistees + bonusSpins.reduce((s, b) => s + b.credits, 0);
  const now = new Date();
  const resolved: OpenRow = { ...row, status: "resolved", digest, roll, outcomeId: outcome.id, bonusSpins, creditsAwarded: credits, resolvedAt: now, revealedAt: now };
  await store.commitResult(resolved, outcome.kind === "item" ? { kind: "item", valueCents: Math.round((outcome.valueUsd ?? 0) * 100) } : { kind: "credit", credits });
  return resolved; // the HTTP layer returns serverSeed only from here on
}

/** Public verifier: stateless given the frozen table. */
export function verify(box: MistyBox, weights: Record<string, number> | undefined, bonus: MistyBonusEntry[], q: { serverSeed: string; serverHash?: string; clientSeed: string; tableHash: string; outcomeId?: string; bonusSpins?: { nonce: number; credits: number }[] }) {
  const table = buildTable(box, weights);
  if (table.hash !== q.tableHash) return { ok: false, reason: "table hash differs" };
  const serverHash = sha256Hex(q.serverSeed);
  if (q.serverHash && serverHash !== q.serverHash) return { ok: false, reason: "seed does not match the hash shown before payment" };
  const digest = mistyDigest(box.slug, q.serverSeed, q.clientSeed, 1);
  const roll = rollOf(digest);
  const outcome = lookup(table, roll).outcome;
  if (q.outcomeId && outcome.id !== q.outcomeId) return { ok: false, reason: "roll lands on a different outcome" };
  const bt = buildBonus(bonus);
  const spins: { nonce: number; digest: string; roll: number; credits: number }[] = [];
  for (let i = 0; i < outcome.freeSpins; i++) {
    const nonce = i + 2;
    const d = mistyDigest(box.slug, q.serverSeed, q.clientSeed, nonce);
    const r = rollOf(d);
    spins.push({ nonce, digest: d, roll: r, credits: lookupBonus(bt, r).mistees });
  }
  if (q.bonusSpins && q.bonusSpins.some((b, i) => spins[i]?.credits !== b.credits)) return { ok: false, reason: "free spin differs" };
  return { ok: true, serverHash, digest, roll, outcomeId: outcome.id, bonusSpins: spins };
}
