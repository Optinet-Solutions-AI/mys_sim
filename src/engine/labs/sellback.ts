import type { CatalogItem, Progress, SellbackConfig, SellbackResult } from "../types";
import { Opener } from "../opener";
import { lognormal, sfc32 } from "../rng";
import { percentile } from "../metrics";
import { priceOf } from "../table";

export function runSellback(cfg: SellbackConfig, seed: number, catalog: Map<string, CatalogItem>, onProgress?: Progress): SellbackResult {
  const t0 = Date.now();
  const rng = sfc32(seed);
  const opener = new Opener(cfg.box, cfg.algo, cfg.rigs, catalog, rng);
  const P = cfg.population;
  const A = Math.max(1, Math.floor(P.agents));
  const S = Math.max(1, Math.floor(P.sessions));
  const price = cfg.box.price;
  const inflation = cfg.rigs.valuationInflation?.factor ?? 1;

  let deposits = 0, wagered = 0, credited = 0, shippedCount = 0, shippedValue = 0, withdrawnCash = 0, opens = 0, sold = 0;
  let ruined = 0, extraWagerForWithdrawal = 0;
  const sessionsToRuin: number[] = [];
  const finalBalances: number[] = [];
  const curveA = Math.min(A, 4000); // agents tracked for the bankroll curve
  const curve: Float64Array[] = Array.from({ length: S }, () => new Float64Array(curveA));
  let globalIdx = 0;
  const totalOpensEstimate = A * S * P.opensPerSession;
  const step = Math.max(1, Math.floor(totalOpensEstimate / 100));

  for (let a = 0; a < A; a++) {
    let balance = 0, myDeposits = 0, myCashOut = 0, myShipped = 0, lastDeposit = 0;
    let alive = true;
    let withdrawMode = false;
    let depositsMade = 0;
    for (let s = 0; s < S; s++) {
      if (alive) {
        if (balance < price) {
          if (depositsMade >= P.maxDeposits) {
            // out of budget with nothing left to play: busted
            alive = false;
            ruined++;
            sessionsToRuin.push(s);
          } else {
            lastDeposit = lognormal(rng, P.depositMean, P.depositSpread);
            balance += lastDeposit;
            myDeposits += lastDeposit;
            deposits += lastDeposit;
            depositsMade++;
          }
        }
      }
      if (alive) {
        const budget = Math.max(price, P.rebetFraction * balance);
        let spent = 0;
        let k = 0;
        while (balance >= price && spent < budget && k < P.opensPerSession) {
          balance -= price;
          wagered += price;
          spent += price;
          k++;
          opens++;
          const rec = opener.open(globalIdx++, "player", 0);
          const item = catalog.get(rec.itemId)!;
          const display = priceOf(item, cfg.box.displayLayer) * inflation;
          const realized = priceOf(item, "realized");
          if (withdrawMode) extraWagerForWithdrawal += price;
          if (display >= P.shipAboveMultiple * price) {
            // ship: item leaves the system at operator cost (realized)
            shippedCount++;
            shippedValue += realized;
            myShipped += realized;
            if (withdrawMode) withdrawMode = false;
          } else if (withdrawMode && cfg.withdrawal.mode === "through-items" && display >= cfg.withdrawal.minWithdraw) {
            // withdraw the item's monetary value to a wallet
            withdrawnCash += display;
            myCashOut += display;
            withdrawMode = false;
          } else {
            sold++;
            if (cfg.sellback.mode === "vendor") {
              const credit = display * (1 - cfg.sellback.haircut);
              balance += credit;
              credited += credit;
            } else {
              const cash = priceOf(item, cfg.sellback.layer) * (1 - cfg.sellback.haircut);
              withdrawnCash += cash;
              myCashOut += cash;
              credited += cash;
            }
          }
          if (globalIdx % step === 0 && onProgress) onProgress(Math.min(globalIdx, totalOpensEstimate), totalOpensEstimate);
        }
        // cash-out decision at session end
        if (balance >= P.cashOutTargetMultiple * Math.max(lastDeposit, price)) {
          if (cfg.withdrawal.mode === "cash") {
            withdrawnCash += balance;
            myCashOut += balance;
            balance = 0;
          } else {
            withdrawMode = true; // must convert balance into an item first
          }
        }
      }
      if (a < curveA) curve[s][a] = balance;
    }
    finalBalances.push(balance);
  }

  const sortedFinal = finalBalances.slice().sort((x, y) => x - y);
  const moneyLeftSystem = withdrawnCash + shippedValue;
  const bankrollCurve = curve.map((arr, s) => {
    const sorted = Array.from(arr).sort((x, y) => x - y);
    return { session: s + 1, p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
  });
  const ruinSorted = sessionsToRuin.sort((x, y) => x - y);

  return {
    kind: "sellback",
    agents: A,
    deposits,
    wagered,
    creditedValue: credited,
    shippedCount,
    shippedValue,
    withdrawnCash,
    ggr: wagered - credited - shippedValue,
    hold: deposits > 0 ? (deposits - moneyLeftSystem) / deposits : 0,
    sellbackRate: opens ? sold / opens : 0,
    shipRate: opens ? shippedCount / opens : 0,
    ruined,
    ruinFraction: ruined / A,
    medianSessionsToRuin: ruinSorted.length ? percentile(ruinSorted, 0.5) : null,
    balancePercentiles: {
      p10: percentile(sortedFinal, 0.1),
      p50: percentile(sortedFinal, 0.5),
      p90: percentile(sortedFinal, 0.9),
    },
    moneyLeftSystem,
    extraWagerForWithdrawal,
    bankrollCurve,
    elapsedMs: Date.now() - t0,
  };
}
