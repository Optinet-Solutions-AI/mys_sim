import type { CatalogItem, Progress, RetentionConfig, RetentionResult } from "../types";
import { Opener } from "../opener";
import { sfc32 } from "../rng";
import { priceOf } from "../table";

interface AgentState {
  active: boolean;
  level: number;
  wagerWindow: number;
  balance: number;
  deposits: number;
  lastDaily: number; // day index of last claim, -1 none
  bankedBoxes: number; // stacked daily boxes
  referred: boolean;
  lastDayNet: number;
  inRaceTop: boolean;
  sumWager: number;
}

function simulate(cfg: RetentionConfig, seed: number, catalog: Map<string, CatalogItem>, incentives: boolean, onProgress?: Progress) {
  const rng = sfc32(seed);
  const opener = new Opener(cfg.box, cfg.algo, cfg.rigs, catalog, rng);
  const A = Math.max(1, Math.floor(cfg.agents));
  const D = Math.max(1, Math.floor(cfg.days));
  const V = cfg.visitor;
  const price = cfg.box.price;
  const agents: AgentState[] = Array.from({ length: A }, () => ({
    active: true,
    level: 0,
    wagerWindow: 0,
    balance: 0,
    deposits: 0,
    lastDaily: -1,
    bankedBoxes: 0,
    referred: incentives && cfg.affiliate.enabled ? rng.next() < cfg.affiliate.referredShare : false,
    lastDayNet: 0,
    inRaceTop: false,
    sumWager: 0,
  }));
  const dau: number[] = [];
  let deposits = 0, wagered = 0, awarded = 0, bonusCost = 0, shippedCost = 0;
  let idx = 0;
  const tierValue = (level: number) => cfg.dailyBox.tierValues[Math.min(cfg.dailyBox.tierValues.length - 1, level)] ?? 0;
  const openOnce = () => {
    const rec = opener.open(idx++, "player", 0);
    const item = catalog.get(rec.itemId)!;
    return { display: priceOf(item, cfg.box.displayLayer), realized: priceOf(item, "realized") };
  };
  // affiliate free boxes on day 0
  if (incentives && cfg.affiliate.enabled) {
    for (const ag of agents) {
      if (!ag.referred) continue;
      for (let k = 0; k < cfg.affiliate.freeBoxes; k++) {
        const o = openOnce();
        ag.balance += o.display;
        bonusCost += o.display;
      }
    }
  }
  for (let d = 0; d < D; d++) {
    let active = 0;
    for (const ag of agents) {
      if (!ag.active) continue;
      const boxAvailable = incentives && cfg.dailyBox.enabled && (cfg.dailyBox.expiry === "stack" ? true : ag.lastDaily < d);
      let p = V.baseVisit + (boxAvailable ? V.incentiveLift : 0) + (ag.inRaceTop ? V.raceLift : 0);
      if (rng.next() >= p) {
        if (cfg.dailyBox.expiry === "stack" && incentives && cfg.dailyBox.enabled) ag.bankedBoxes++;
        continue;
      }
      active++;
      const before = ag.balance;
      // daily box(es)
      if (incentives && cfg.dailyBox.enabled) {
        const claims = cfg.dailyBox.expiry === "stack" ? ag.bankedBoxes + 1 : 1;
        for (let k = 0; k < claims; k++) {
          const v = tierValue(ag.level) * (0.4 + rng.next() * 1.2); // drop value varies around the tier value
          ag.balance += v;
          bonusCost += v;
        }
        ag.bankedBoxes = 0;
        ag.lastDaily = d;
      }
      // deposit and play
      ag.balance += V.depositPerVisit;
      ag.deposits += V.depositPerVisit;
      deposits += V.depositPerVisit;
      if (ag.referred && incentives && cfg.affiliate.enabled) bonusCost += V.depositPerVisit * cfg.affiliate.commission;
      let k = 0;
      while (ag.balance >= price && k < V.opensPerVisit) {
        ag.balance -= price;
        wagered += price;
        ag.wagerWindow += price;
        ag.sumWager += price;
        k++;
        const o = openOnce();
        awarded += o.display;
        if (o.display >= 10 * price) shippedCost += o.realized; // big wins leave as goods
        else ag.balance += o.display;
      }
      ag.level = Math.min(cfg.dailyBox.tierValues.length - 1, Math.floor(ag.sumWager / (50 * price)));
      ag.lastDayNet = ag.balance - before - V.depositPerVisit;
      if (ag.lastDayNet < 0 && rng.next() < V.churnHazard) ag.active = false;
    }
    dau.push(active);
    // race settlement
    if (incentives && cfg.race.enabled && cfg.race.cadenceDays > 0 && (d + 1) % cfg.race.cadenceDays === 0) {
      const ranked = agents
        .map((ag, i) => ({ i, w: ag.wagerWindow }))
        .filter((x) => x.w > 0)
        .sort((a, b) => b.w - a.w);
      cfg.race.prizes.forEach((prize, k) => {
        if (ranked[k]) {
          agents[ranked[k].i].balance += prize;
          bonusCost += prize;
        }
      });
      const topBand = new Set(ranked.slice(0, Math.max(cfg.race.prizes.length * 3, 10)).map((x) => x.i));
      agents.forEach((ag, i) => {
        ag.inRaceTop = topBand.has(i);
        ag.wagerWindow = 0;
      });
    }
    if (onProgress) onProgress(d, D);
  }
  const wagers = agents.map((a) => a.sumWager).sort((a, b) => b - a);
  const totalW = wagers.reduce((a, b) => a + b, 0) || 1;
  const top10 = wagers.slice(0, Math.max(1, Math.floor(A * 0.1))).reduce((a, b) => a + b, 0) / totalW;
  const ret = (day: number) => (day < dau.length ? dau[day] / A : dau[dau.length - 1] / A);
  return { dau, retention: { d1: ret(1), d7: ret(7), d30: ret(30) }, deposits, wagered, awarded, bonusCost, shippedCost, top10 };
}

export function runRetention(cfg: RetentionConfig, seed: number, catalog: Map<string, CatalogItem>, onProgress?: Progress): RetentionResult {
  const t0 = Date.now();
  const main = simulate(cfg, seed, catalog, true, onProgress);
  const control = simulate(cfg, seed, catalog, false);
  const ggr = main.wagered - main.awarded;
  const net = main.deposits - main.bonusCost - main.shippedCost;
  const incremental = main.wagered - control.wagered;
  return {
    kind: "retention",
    agents: cfg.agents,
    days: cfg.days,
    dau: main.dau,
    retention: main.retention,
    controlRetention: control.retention,
    deposits: main.deposits,
    wagered: main.wagered,
    ggr,
    bonusCost: main.bonusCost,
    ngr: ggr - main.bonusCost,
    ltv: net / Math.max(1, cfg.agents),
    holdAfterBonuses: main.deposits ? net / main.deposits : 0,
    incrementalWager: incremental,
    incrementalWagerPerBonusDollar: main.bonusCost ? incremental / main.bonusCost : 0,
    raceWagerConcentrationTop10: main.top10,
    elapsedMs: Date.now() - t0,
  };
}
