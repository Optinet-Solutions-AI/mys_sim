// Shared pieces for the committed-seed battles (the backend kit's logic) as the simulator plays them:
// a box from the builder becomes a frozen odds table, and a configuration is kept inside the admin's limits.
import type { BattleMode, BoxDef, CatalogItem, KitBattleSettings, KitBattlesConfig, MistyBox, MistyOutcome } from "@/engine/types";
import type { BattleRound, KitBattleMode } from "@/engine/labs/battleKit";
import { buildTable } from "@/engine/labs/misty";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { valueAt } from "@/engine/opener";

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export interface PreparedRound {
  round: BattleRound;
  pool: { item: CatalogItem; weight: number }[];
  /** what the box pays back per open on average, in cents, at the box's value layer */
  evCents: number;
  /** evCents / price */
  ret: number;
  box: BoxDef;
}

/** A builder box as a frozen odds table: percent per item from its weights, cumulative bands, a hash. The draw model is read as weighted. */
export function prepareRound(b: BoxDef, i: number): PreparedRound {
  const items = b.items.map((it) => ({ item: CATALOG_BY_ID.get(it.itemId), weight: it.weight })).filter((x): x is { item: CatalogItem; weight: number } => !!x.item && x.weight > 0);
  const total = items.reduce((a, x) => a + x.weight, 0) || 1;
  const outcomes: MistyOutcome[] = items.map(({ item, weight }) => ({ id: item.id, label: item.name, rarity: item.tier, kind: "item", mistees: 0, freeSpins: 0, valueUsd: valueAt(item, b.valueLayer), weight: (weight / total) * 100 }));
  const box: MistyBox = { slug: slugify(b.name) || `box-${i + 1}`, name: b.name, price: b.price, tagline: "", outcomes, bonus: [], fairness: "" };
  const table = buildTable(box);
  const priceCents = Math.round(b.price * 100);
  const evCents = outcomes.reduce((a, o) => a + ((o.valueUsd ?? 0) * 100 * o.weight) / 100, 0);
  return { round: { slug: box.slug, table, priceCents }, pool: items, evCents, ret: priceCents > 0 ? evCents / priceCents : 0, box: b };
}

/** Entry per seat in cents: the round prices plus the admin's fee on top (the fee is the house's, never part of the pot). */
export function entryOf(rounds: { priceCents: number }[], feePercent: number): { baseCents: number; feeCents: number; entryCents: number } {
  const baseCents = rounds.reduce((a, r) => a + r.priceCents, 0);
  const feeCents = Math.round((baseCents * Math.max(0, feePercent)) / 100);
  return { baseCents, feeCents, entryCents: baseCents + feeCents };
}

export const ALL_KIT_MODES: BattleMode[] = ["normal", "crazy", "terminal", "jackpot", "group", "break", "coinflip"];

/** Keep the player's choice inside the admin's limits after any change on either side. */
export function normaliseKitBattles(cfg: KitBattlesConfig): KitBattlesConfig {
  const s: KitBattleSettings = {
    ...cfg.settings,
    modesAllowed: ALL_KIT_MODES.filter((m) => cfg.settings.modesAllowed.includes(m)),
    seatsAllowed: [...new Set(cfg.settings.seatsAllowed.filter((n) => n >= 2 && n <= 8))].sort((a, b) => a - b),
    roundsMax: Math.max(1, Math.min(50, Math.floor(cfg.settings.roundsMax))),
    feePercent: Math.max(0, Math.min(20, cfg.settings.feePercent)),
    coinflipEdge: Math.max(0, Math.min(0.1, cfg.settings.coinflipEdge)),
    countdownSeconds: Math.max(0, Math.min(30, Math.floor(cfg.settings.countdownSeconds))),
    botNames: cfg.settings.botNames.map((n) => n.trim()).filter(Boolean),
  };
  const modes = s.modesAllowed.length ? s.modesAllowed : ["normal" as BattleMode];
  const seatsAllowed = s.seatsAllowed.length ? s.seatsAllowed : [2];
  const mode = modes.includes(cfg.play.mode) ? cfg.play.mode : modes[0];
  const coin = mode === "coinflip";
  const seats = coin ? 2 : seatsAllowed.includes(cfg.play.seats) ? cfg.play.seats : seatsAllowed[0];
  let rounds = cfg.play.rounds.filter((i) => i >= 0 && i < cfg.boxes.length).slice(0, s.roundsMax);
  if (!rounds.length && cfg.boxes.length) rounds = [0];
  if (coin) rounds = rounds.slice(0, 1);
  const humans = s.botsEnabled ? Math.max(1, Math.min(seats, Math.floor(cfg.play.humans))) : seats;
  return { settings: s, boxes: cfg.boxes, play: { mode, seats, rounds, humans } };
}

export const kitMode = (m: BattleMode): KitBattleMode => m as KitBattleMode;
