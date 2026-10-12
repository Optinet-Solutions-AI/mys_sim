// Upgrader (Jemlit, Cases.gg) and the vendor's Deals: a two-outcome box built from the target item and "nothing",
// so every scheme, mapping, rig and the verifier apply unchanged.
import type { BoxDef, CatalogItem, OpenRecord, Progress, UpgraderConfig, UpgraderResult } from "../types";
import { Opener, verifyRecord } from "../opener";
import { sfc32 } from "../rng";
import { percentile } from "../metrics";

const T = 100_000_000;

/** The chance and price of one attempt under the configured mode and edge. */
export function upgraderTerms(cfg: UpgraderConfig, targetValue: number): { chance: number; price: number } {
  const edge = Math.min(0.95, Math.max(0, cfg.edge));
  if (cfg.mode === "upgrader") {
    const price = Math.max(0.01, cfg.stake);
    return { chance: Math.min(cfg.maxChance, Math.max(1e-6, (price / Math.max(0.01, targetValue)) * (1 - edge))), price };
  }
  const chance = Math.min(cfg.maxChance, Math.max(1e-6, cfg.chance));
  return { chance, price: Math.max(0.01, (chance * targetValue) / (1 - edge)) };
}

export function upgraderBox(cfg: UpgraderConfig, catalog: Map<string, CatalogItem>): { box: BoxDef; chance: number; price: number; targetValue: number } {
  const target = catalog.get(cfg.targetItemId);
  if (!target) throw new Error(`Unknown target item ${cfg.targetItemId}`);
  const targetValue = target[cfg.valueLayer];
  const { chance, price } = upgraderTerms(cfg, targetValue);
  const wWin = Math.max(1, Math.min(T - 1, Math.round(chance * T)));
  const box: BoxDef = {
    name: `${cfg.mode === "upgrader" ? "Upgrader" : "Deal"}: ${target.brand} ${target.name}`,
    price,
    ticketTotal: T,
    items: [
      { itemId: target.id, weight: wWin },
      { itemId: "f-nothing", weight: T - wWin },
    ],
    valueLayer: cfg.valueLayer,
    displayLayer: cfg.valueLayer,
  };
  return { box, chance, price, targetValue };
}

export function runUpgrader(cfg: UpgraderConfig, seed: number, catalog: Map<string, CatalogItem>, onProgress?: Progress): UpgraderResult {
  const t0 = Date.now();
  const rng = sfc32(seed);
  const { box, chance, price, targetValue } = upgraderBox(cfg, catalog);
  const opener = new Opener(box, cfg.algo, cfg.rigs, catalog, rng, "upgrader");
  const P = cfg.population;
  const A = Math.max(1, Math.floor(P.agents));
  const maxAttempts = Math.max(1, Math.floor(P.attempts));
  const verifyN = 200;
  const verifier = { sampled: 0, passed: 0, failed: 0, reasons: {} as Record<string, number> };
  const sample: OpenRecord[] = [];
  let attempts = 0, wins = 0, wagered = 0, paid = 0, ruined = 0, reached = 0;
  const toRuin: number[] = [];
  let idx = 0;
  const step = Math.max(1, Math.floor((A * maxAttempts) / 100));

  for (let a = 0; a < A; a++) {
    let bank = P.bankroll;
    let won = false;
    let k = 0;
    const limit = P.policy === "single" ? 1 : maxAttempts;
    while (k < limit && bank >= price && !won) {
      bank -= price;
      wagered += price;
      attempts++;
      k++;
      const rec = opener.open(idx++, "player", a / A);
      const win = rec.itemId === cfg.targetItemId;
      if (win) {
        wins++;
        paid += targetValue;
        won = true;
        reached++;
      }
      if (verifier.sampled < verifyN) {
        const v = verifyRecord(rec, box, cfg.algo, catalog, "upgrader");
        rec.verified = v.ok;
        rec.verifyReason = v.reason;
        verifier.sampled++;
        if (v.ok) verifier.passed++;
        else {
          verifier.failed++;
          verifier.reasons[v.reason] = (verifier.reasons[v.reason] ?? 0) + 1;
        }
      }
      if (sample.length < 40) sample.push(rec);
      if (onProgress && idx % step === 0) onProgress(idx, A * maxAttempts);
    }
    if (!won && bank < price) {
      ruined++;
      toRuin.push(k);
    }
  }
  const sortedRuin = toRuin.sort((x, y) => x - y);
  return {
    kind: "upgrader",
    mode: cfg.mode,
    attempts,
    wins,
    winRate: attempts ? wins / attempts : 0,
    statedChance: chance,
    pricePerAttempt: price,
    targetValue,
    wagered,
    paid,
    realizedEdge: wagered ? 1 - paid / wagered : 0,
    statedEdge: cfg.edge,
    agents: A,
    ruined,
    ruinFraction: ruined / A,
    medianAttemptsToRuin: sortedRuin.length ? percentile(sortedRuin, 0.5) : null,
    reachedTarget: reached,
    verifier,
    sample,
    elapsedMs: Date.now() - t0,
  };
}
