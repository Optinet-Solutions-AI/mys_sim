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
  const D = cfg.decision;
  const F = cfg.keepFees;
  const E = cfg.estimate;
  const X = cfg.creditExpiry;
  const G = cfg.guaranteeFloor ?? 0;
  const V = cfg.vault?.enabled ? cfg.vault : undefined;
  const CC = Math.max(0, cfg.creatorCut ?? 0);

  let deposits = 0, wagered = 0, credited = 0, shippedCount = 0, shippedValue = 0, withdrawnCash = 0, opens = 0, sold = 0;
  let ruined = 0, extraWagerForWithdrawal = 0;
  let autoActions = 0, keepFeesPaid = 0, expiredCredit = 0, floorTopUps = 0, vaultLocked = 0, creatorPaid = 0;
  const sessionsToRuin: number[] = [];
  const finalBalances: number[] = [];
  const curveA = Math.min(A, 4000); // agents tracked for the bankroll curve
  const curve: Float64Array[] = Array.from({ length: S }, () => new Float64Array(curveA));
  let globalIdx = 0;
  const totalOpensEstimate = A * S * P.opensPerSession;
  const step = Math.max(1, Math.floor(totalOpensEstimate / 100));

  /** What the operator offers for an item: the rule, an undisclosed estimate, or a guaranteed floor. */
  const buyback = (item: CatalogItem, display: number): { value: number; cash: boolean } => {
    let value: number;
    let cash: boolean;
    if (E) {
      value = item.realized * E.factor;
      cash = cfg.sellback.mode === "cash";
    } else if (cfg.sellback.mode === "vendor") {
      value = display * (1 - cfg.sellback.haircut);
      cash = false;
    } else {
      value = priceOf(item, cfg.sellback.layer) * (1 - cfg.sellback.haircut);
      cash = true;
    }
    if (G > 0 && value < G) {
      floorTopUps += G - value;
      value = G;
    }
    return { value, cash };
  };

  for (let a = 0; a < A; a++) {
    let balance = 0, myDeposits = 0, myCashOut = 0, myShipped = 0, lastDeposit = 0, vaultBal = 0;
    let alive = true;
    let withdrawMode = false;
    let depositsMade = 0;
    let lastActive = 0;
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
            let toBalance = lastDeposit;
            if (V) {
              const lock = lastDeposit * V.lockFraction;
              vaultBal += lock;
              vaultLocked += lock;
              toBalance -= lock;
            }
            balance += toBalance;
            myDeposits += lastDeposit;
            deposits += lastDeposit;
            depositsMade++;
            lastActive = s;
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
          creatorPaid += price * CC;
          spent += price;
          k++;
          opens++;
          lastActive = s;
          const rec = opener.open(globalIdx++, "player", 0);
          const item = catalog.get(rec.itemId)!;
          const display = priceOf(item, cfg.box.displayLayer) * inflation;
          const realized = priceOf(item, "realized");
          if (withdrawMode) extraWagerForWithdrawal += price;
          const offer = buyback(item, display);
          const fees = F ? display * F.taxRate + F.shipping + display * F.insuranceRate : 0;
          let wantShip = display >= P.shipAboveMultiple * price && display - fees >= price;
          // decision window: inattentive agents get the automatic action
          if (D && rng.next() < D.inattention) {
            autoActions++;
            wantShip = D.autoAction === "ship";
          }
          if (wantShip) {
            // ship: item leaves the system at operator cost (realized); the player pays the keep fees
            shippedCount++;
            shippedValue += realized;
            myShipped += realized;
            keepFeesPaid += fees;
            if (withdrawMode) withdrawMode = false;
          } else if (withdrawMode && cfg.withdrawal.mode === "through-items" && display >= cfg.withdrawal.minWithdraw) {
            // withdraw the item's monetary value to a wallet
            withdrawnCash += display;
            myCashOut += display;
            withdrawMode = false;
          } else {
            sold++;
            credited += offer.value;
            if (offer.cash) {
              withdrawnCash += offer.value;
              myCashOut += offer.value;
            } else balance += offer.value;
          }
          if (globalIdx % step === 0 && onProgress) onProgress(Math.min(globalIdx, totalOpensEstimate), totalOpensEstimate);
        }
        // cash-out decision at session end
        if (balance >= P.cashOutTargetMultiple * Math.max(lastDeposit, price)) {
          if (cfg.withdrawal.mode === "cash") {
            withdrawnCash += balance + vaultBal;
            myCashOut += balance + vaultBal;
            balance = 0;
            vaultBal = 0;
          } else {
            withdrawMode = true; // must convert balance into an item first
          }
        }
      }
      // site credit that sits unused expires (StockX: one year)
      if (X && balance > 0 && s - lastActive >= X.sessions) {
        expiredCredit += balance;
        balance = 0;
      }
      if (a < curveA) curve[s][a] = balance + vaultBal;
    }
    finalBalances.push(balance + vaultBal);
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
    ggr: wagered - credited - shippedValue - creatorPaid,
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
    autoActions: D ? autoActions : undefined,
    keepFeesPaid: F ? keepFeesPaid : undefined,
    expiredCredit: X ? expiredCredit : undefined,
    floorTopUps: G > 0 ? floorTopUps : undefined,
    vaultLocked: V ? vaultLocked : undefined,
    creatorPaid: CC > 0 ? creatorPaid : undefined,
    elapsedMs: Date.now() - t0,
  };
}
