/**
 * Reference server flow for battles. Kit v1.2 (19 October 2026).
 *
 * Pure resolution comes from ./battleKit (same code as the simulator). Storage is an interface you implement over
 * schema-battles.sql. Every transition is guarded by status and version; resolution is deterministic, so a crash
 * between in_progress and finished is resumed by re-running it, never by re-rolling.
 *
 * A guide, not a framework: wire it into your HTTP layer, your job runner and your event stream.
 */
import { randomBytes } from "node:crypto";
import { battleCommit, canTransition, resolveBattle, type BattleResolution, type BattleRound, type BattleSeatSeed, type BattleStatus, type KitBattleMode } from "./battleKit";
import { buildTable } from "./misty";
import type { MistyBox } from "./types";

export interface BattleSettings {
  enabled: boolean;
  modesAllowed: KitBattleMode[];
  seatsAllowed: number[];
  roundsMax: number;
  eligibleBoxSlugs: string[];
  feePercent: number;
  coinflipEdge: number;
  openExpiryMinutes: number;
  countdownSeconds: number;
  privateAllowed: boolean;
  botsEnabled: boolean;
  botLabel: string;
  maxConcurrentPerPlayer: number;
  creditFaceCents: number;
  defaultClientSeed: string;
}

export interface PinnedRound {
  slug: string;
  tableHash: string;
  bonusHash: string;
  priceCents: number;
}
export interface BattleRow {
  id: string;
  status: BattleStatus;
  version: number;
  mode: KitBattleMode;
  seats: number;
  rounds: PinnedRound[];
  entryCents: number;
  feePercent: number;
  coinflipEdge: number;
  creditFaceCents: number;
  isPrivate: boolean;
  inviteCode: string | null;
  sponsored: boolean; // the house pays every entry (one battle-sponsor ledger entry)
  sponsor: string | null;
  createdBy: string;
  serverSeed: string; // encrypted at rest; decrypt only in resolve()
  serverHash: string;
  expiresAt: Date;
  startsAt: Date | null;
  result?: BattleResolution;
}
export interface SeatRow {
  battleId: string;
  seat: number;
  playerId: string | null;
  isBot: boolean;
  botId: number | null;
  clientSeed: string;
  clientSeedSource: "player" | "server-default" | "bot";
  holdLedgerId: number | null;
}

export interface BattleStore {
  getSettings(): Promise<BattleSettings>;
  getBox(slug: string): Promise<MistyBox>;
  /** the frozen table for a pinned hash; 404 when unknown */
  getTableSnapshot(tableHash: string): Promise<{ tableHash: string; price: number; entries: { id: string; percent: number }[] }>;
  /** one transaction: battle row, seat 0, the hold for seat 0 (0 when sponsored) and, when sponsored, the battle-sponsor house entry */
  insertBattle(row: BattleRow, creatorSeat: SeatRow, holdCents: number): Promise<void>;
  /** enabled bots, at most n, in random order; each is a name and a picture, nothing else */
  pickBots(n: number): Promise<{ id: number; name: string }[]>;
  /** a bot seat: server-made client seed, no hold */
  takeBotSeat(battleId: string, seat: SeatRow): Promise<void>;
  getBattle(id: string, forUpdate?: boolean): Promise<BattleRow>;
  getSeats(battleId: string): Promise<SeatRow[]>;
  countOpenBattlesOf(playerId: string): Promise<number>;
  /** UPDATE ... WHERE id AND status = from AND version = v; returns false when another writer moved first */
  transition(id: string, from: BattleStatus, version: number, to: BattleStatus, patch: Partial<BattleRow>, event: { actor: string; event: string; data?: unknown }): Promise<boolean>;
  /** one transaction: ledger hold (reason battle-entry, negative) + seat row; throws insufficient_credit */
  takeSeat(battleId: string, seat: SeatRow, holdCents: number, idempotencyKey: string): Promise<SeatRow>;
  /** one transaction: release the hold (battle-refund) + mark the seat left */
  releaseSeat(battleId: string, seat: number, actor: string): Promise<void>;
  /** one transaction: write every pull */
  writePulls(battleId: string, pulls: BattleResolution["pulls"]): Promise<void>;
  /** one transaction: awards for item pulls to the winning players, ledger battle-win for their credits, battle-fee to the house, result columns. A bot winner gets nothing: its share stays with the house, no award, no ledger row. */
  settle(battle: BattleRow, seats: SeatRow[], res: BattleResolution): Promise<void>;
  /** refund every held seat (battle-refund) */
  refundAll(battleId: string, actor: string, reason: string): Promise<void>;
  appendEvent(battleId: string, actor: string, event: string, data?: unknown): Promise<void>;
}

const err = (code: string, message = code) => Object.assign(new Error(message), { code });

async function pinRounds(store: BattleStore, settings: BattleSettings, slugs: string[]): Promise<PinnedRound[]> {
  if (slugs.length < 1 || slugs.length > settings.roundsMax) throw err("validation_failed", "rounds out of range");
  const out: PinnedRound[] = [];
  for (const slug of slugs) {
    if (!settings.eligibleBoxSlugs.includes(slug)) throw err("validation_failed", `box ${slug} is not eligible for battles`);
    const box = await store.getBox(slug);
    const table = buildTable(box, undefined);
    out.push({ slug, tableHash: table.hash, bonusHash: "", priceCents: Math.round(box.price * 100) });
  }
  return out;
}

/** Step 1: create. The creator takes seat 0 and pays the hold. The commitment is in the response. */
export async function createBattle(store: BattleStore, playerId: string, input: { mode: KitBattleMode; seats: number; boxSlugs: string[]; isPrivate: boolean; clientSeed?: string; idempotencyKey: string; sponsor?: string }): Promise<BattleRow> {
  // input.sponsor is accepted only from the admin route (or a player the admin flagged as a sponsor); the HTTP layer checks that
  const s = await store.getSettings();
  if (!s.enabled) throw err("battles_disabled");
  if (!s.modesAllowed.includes(input.mode)) throw err("validation_failed", "mode not allowed");
  if (!s.seatsAllowed.includes(input.seats)) throw err("validation_failed", "seat count not allowed");
  if (input.isPrivate && !s.privateAllowed) throw err("validation_failed", "private battles are off");
  if ((await store.countOpenBattlesOf(playerId)) >= s.maxConcurrentPerPlayer) throw err("rate_limited", "too many open battles");
  const rounds = input.mode === "coinflip" ? await pinRounds(store, s, input.boxSlugs.slice(0, 1)) : await pinRounds(store, s, input.boxSlugs);
  const entryCents = rounds.reduce((a, r) => a + r.priceCents, 0);
  const serverSeed = randomBytes(32).toString("hex");
  const row: BattleRow = {
    id: crypto.randomUUID(),
    status: "open",
    version: 0,
    mode: input.mode,
    seats: input.seats,
    rounds,
    entryCents,
    feePercent: s.feePercent,
    coinflipEdge: s.coinflipEdge,
    creditFaceCents: s.creditFaceCents,
    isPrivate: input.isPrivate,
    inviteCode: input.isPrivate ? randomBytes(8).toString("base64url") : null,
    sponsored: !!input.sponsor,
    sponsor: input.sponsor ?? null,
    createdBy: playerId,
    serverSeed,
    serverHash: battleCommit(serverSeed),
    expiresAt: new Date(Date.now() + s.openExpiryMinutes * 60_000),
    startsAt: null,
  };
  const seed = input.clientSeed && input.clientSeed.length <= 64 ? input.clientSeed : s.defaultClientSeed;
  const creatorSeat: SeatRow = { battleId: row.id, seat: 0, playerId, isBot: false, botId: null, clientSeed: seed, clientSeedSource: input.clientSeed ? "player" : "server-default", holdLedgerId: null };
  await store.insertBattle(row, creatorSeat, row.sponsored ? 0 : entryCents); // the insert takes the hold for seat 0 in the same transaction
  return row; // the HTTP layer strips serverSeed
}

/** Step 2: join. One seat per player, hold taken with the seat, idempotent on the key. Moves to full when the last seat is taken. */
export async function joinBattle(store: BattleStore, battleId: string, playerId: string, clientSeed: string | undefined, idempotencyKey: string, inviteCode?: string): Promise<SeatRow> {
  const s = await store.getSettings();
  const b = await store.getBattle(battleId, true);
  if (b.status !== "open") throw err("battle_not_open");
  if (b.isPrivate && b.inviteCode !== inviteCode) throw err("forbidden", "invite code required");
  const seats = await store.getSeats(battleId);
  if (seats.some((x) => x.playerId === playerId)) throw err("already_seated");
  const free = Array.from({ length: b.seats }, (_, i) => i).find((i) => !seats.some((x) => x.seat === i));
  if (free === undefined) throw err("battle_full");
  const seed = clientSeed && clientSeed.length <= 64 ? clientSeed : s.defaultClientSeed;
  const row = await store.takeSeat(battleId, { battleId, seat: free, playerId, isBot: false, botId: null, clientSeed: seed, clientSeedSource: clientSeed ? "player" : "server-default", holdLedgerId: null }, b.sponsored ? 0 : b.entryCents, idempotencyKey);
  if (seats.length + 1 === b.seats) {
    const startsAt = new Date(Date.now() + s.countdownSeconds * 1000);
    await store.transition(battleId, "open", b.version, "full", { startsAt }, { actor: playerId, event: "full", data: { startsAt } });
  }
  return row;
}

/** The creator asks for bots when nobody joins: every free seat gets a bot (a name and a picture; same odds, same seed, no hold). */
export async function callBots(store: BattleStore, battleId: string, playerId: string): Promise<void> {
  const s = await store.getSettings();
  if (!s.botsEnabled) throw err("bots_disabled");
  const b = await store.getBattle(battleId, true);
  if (b.status !== "open") throw err("battle_not_open");
  if (b.createdBy !== playerId) throw err("not_creator");
  const seats = await store.getSeats(battleId);
  const free = Array.from({ length: b.seats }, (_, i) => i).filter((i) => !seats.some((x) => x.seat === i));
  if (free.length === 0) throw err("battle_full");
  const bots = await store.pickBots(free.length);
  if (bots.length < free.length) throw err("bots_disabled", "not enough bots configured");
  for (let k = 0; k < free.length; k++) {
    await store.takeBotSeat(battleId, { battleId, seat: free[k], playerId: null, isBot: true, botId: bots[k].id, clientSeed: randomBytes(16).toString("hex"), clientSeedSource: "bot", holdLedgerId: null });
  }
  const startsAt = new Date(Date.now() + s.countdownSeconds * 1000);
  const ok = await store.transition(battleId, "open", b.version, "full", { startsAt }, { actor: playerId, event: "full", data: { startsAt, bots: bots.map((x) => x.name) } });
  if (!ok) throw err("conflict", "battle changed; retry");
}

/** Leave before the start: releases the hold; a full battle goes back to open. */
export async function leaveBattle(store: BattleStore, battleId: string, playerId: string): Promise<void> {
  const b = await store.getBattle(battleId, true);
  if (b.status !== "open" && b.status !== "full") throw err("battle_started");
  const seats = await store.getSeats(battleId);
  const mine = seats.find((x) => x.playerId === playerId);
  if (!mine) throw err("not_seated");
  if (mine.seat === 0) throw err("creator_must_cancel");
  await store.releaseSeat(battleId, mine.seat, playerId);
  if (b.status === "full") await store.transition(battleId, "full", b.version, "open", { startsAt: null }, { actor: playerId, event: "left" });
}

/** Cancel before the start: by the creator while alone, or by an admin; every hold is refunded. */
export async function cancelBattle(store: BattleStore, battleId: string, actor: string, isAdmin: boolean, reason: string): Promise<void> {
  const b = await store.getBattle(battleId, true);
  if (!canTransition(b.status, "cancelled")) throw err("battle_started");
  const seats = await store.getSeats(battleId);
  if (!isAdmin && (b.createdBy !== actor || seats.length > 1)) throw err("forbidden", "only the creator while alone, or an admin");
  const ok = await store.transition(battleId, b.status, b.version, "cancelled", {}, { actor, event: "cancelled", data: { reason } });
  if (!ok) throw err("conflict", "battle changed; retry");
  await store.refundAll(battleId, actor, reason);
}

/** Timer job: expire open battles past their window; start full battles whose countdown has ended. */
export async function tick(store: BattleStore, now: Date, dueOpen: BattleRow[], dueFull: BattleRow[]): Promise<void> {
  for (const b of dueOpen) {
    if (b.status === "open" && b.expiresAt <= now) {
      const ok = await store.transition(b.id, "open", b.version, "expired", {}, { actor: "server", event: "expired" });
      if (ok) await store.refundAll(b.id, "server", "expired");
    }
  }
  for (const b of dueFull) {
    if (b.status === "full" && b.startsAt && b.startsAt <= now) await startAndResolve(store, b.id);
  }
}

/** Steps 3 to 5: start, resolve deterministically, settle, reveal. Safe to call again after a crash. */
export async function startAndResolve(store: BattleStore, battleId: string): Promise<BattleResolution> {
  let b = await store.getBattle(battleId, true);
  if (b.status === "finished" && b.result) return b.result;
  if (b.status === "full") {
    const ok = await store.transition(battleId, "full", b.version, "in_progress", { startsAt: b.startsAt }, { actor: "server", event: "started" });
    if (!ok) return startAndResolve(store, battleId); // someone else started it; fall through to resume
    b = await store.getBattle(battleId, true);
  }
  if (b.status !== "in_progress" && b.status !== "settling") throw err("battle_not_startable");

  const seats = await store.getSeats(battleId);
  if (seats.filter((x) => !x.playerId && !x.isBot).length > 0 || seats.length !== b.seats) throw err("battle_incomplete");
  const seatSeeds: BattleSeatSeed[] = seats.map((x) => ({ seat: x.seat, clientSeed: x.clientSeed }));
  const rounds: BattleRound[] = [];
  for (const r of b.rounds) {
    const snap = await store.getTableSnapshot(r.tableHash); // the pinned table, never the current one
    const box = await store.getBox(r.slug);
    const byId = new Map(box.outcomes.map((o) => [o.id, o]));
    const weights: Record<string, number> = {};
    for (const e of snap.entries) weights[e.id] = e.percent;
    const ordered = { ...box, price: snap.price, outcomes: snap.entries.map((e) => byId.get(e.id)!).filter(Boolean) };
    const table = buildTable(ordered, weights);
    if (table.hash !== r.tableHash) throw err("internal", "pinned table does not reproduce its hash");
    rounds.push({ slug: r.slug, table, priceCents: r.priceCents });
  }
  const res = resolveBattle(b.mode, rounds, seatSeeds, b.serverSeed, { creditFaceCents: b.creditFaceCents, coinflipEdge: b.coinflipEdge });

  if (b.status === "in_progress") {
    await store.writePulls(battleId, res.pulls); // idempotent on (battle, round, seat)
    const ok = await store.transition(battleId, "in_progress", b.version, "settling", {}, { actor: "server", event: "round", data: { rounds: res.rounds } });
    if (!ok) return startAndResolve(store, battleId);
    b = await store.getBattle(battleId, true);
  }
  await store.settle(b, seats, res); // awards + ledger + result columns, idempotent on the battle id
  const ok = await store.transition(battleId, "settling", b.version, "finished", { result: res }, { actor: "server", event: "finished", data: { winners: res.winners, potCents: res.potCents } });
  if (!ok) return startAndResolve(store, battleId);
  await store.appendEvent(battleId, "server", "revealed", { serverSeed: b.serverSeed }); // the seed is public from here
  return res;
}
