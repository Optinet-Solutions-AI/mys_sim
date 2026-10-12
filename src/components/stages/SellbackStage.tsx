"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SellbackConfig } from "@/engine/types";
import { priceOf } from "@/engine/table";
import { LiveOpener, type LiveOpen } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile, TierBadge } from "../ItemTile";
import { Badge, Card, Stat } from "../ui";

interface Wallet {
  balance: number;
  deposited: number;
  wagered: number;
  credited: number;
  cashOut: number;
  shippedValue: number;
  shippedCount: number;
  opens: number;
  sold: number;
  withdrawMode: boolean;
  log: { n: number; text: string; tone?: "good" | "bad" | "warn" }[];
}
const EMPTY: Wallet = { balance: 0, deposited: 0, wagered: 0, credited: 0, cashOut: 0, shippedValue: 0, shippedCount: 0, opens: 0, sold: 0, withdrawMode: false, log: [] };

export function SellbackStage({ cfg, seed, onSettings }: { cfg: SellbackConfig; seed: number; onSettings: (section?: string) => void }) {
  const key = useMemo(() => JSON.stringify([cfg.box, cfg.algo, cfg.rigs, seed]), [cfg.box, cfg.algo, cfg.rigs, seed]);
  const liveRef = useRef<{ key: string; live: LiveOpener | null; error: string | null } | null>(null);
  if (!liveRef.current || liveRef.current.key !== key) {
    try {
      liveRef.current = { key, live: new LiveOpener(cfg.box, cfg.algo, cfg.rigs, `wallet:${seed}`), error: null };
    } catch (e) {
      liveRef.current = { key, live: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const live = liveRef.current.live;
  const P = cfg.population;
  const price = cfg.box.price;
  const [w, setW] = useState<Wallet>(EMPTY);
  const [pending, setPending] = useState<LiveOpen | null>(null);
  const [deposit, setDeposit] = useState(P.depositMean);
  const logN = useRef(0);
  useEffect(() => {
    setW(EMPTY);
    setPending(null);
  }, [key]);

  const log = (text: string, tone?: "good" | "bad" | "warn") => ({ n: ++logN.current, text, tone });
  const push = (wallet: Wallet, entry: Wallet["log"][number]): Wallet => ({ ...wallet, log: [entry, ...wallet.log].slice(0, 30) });

  const sellValue = (o: LiveOpen) => (cfg.sellback.mode === "vendor" ? o.display * (1 - cfg.sellback.haircut) : priceOf(o.item, cfg.sellback.layer) * (1 - cfg.sellback.haircut));

  const doDeposit = () => {
    const amt = Math.max(1, deposit);
    setW((s) => push({ ...s, balance: s.balance + amt, deposited: s.deposited + amt }, log(`Deposited ${money(amt)}.`)));
  };
  const doOpen = () => {
    if (!live || pending || w.balance < price) return;
    const o = live.open("player");
    setPending(o);
    setW((s) => push({ ...s, balance: s.balance - price, wagered: s.wagered + price, opens: s.opens + 1 }, log(`Opened the box for ${money(price)}: ${o.item.name} (shown as ${money(o.display)}).`)));
  };
  const doSell = () => {
    if (!pending) return;
    const v = sellValue(pending);
    if (cfg.sellback.mode === "vendor") {
      setW((s) => push({ ...s, balance: s.balance + v, credited: s.credited + v, sold: s.sold + 1 }, log(`Sold back for ${money(v)} of site balance.`, "warn")));
    } else {
      setW((s) => push({ ...s, cashOut: s.cashOut + v, credited: s.credited + v, sold: s.sold + 1 }, log(`Sold for ${money(v)} cash (left the system).`, "good")));
    }
    setPending(null);
  };
  const doShip = () => {
    if (!pending) return;
    const cost = pending.item.realized;
    setW((s) => push({ ...s, shippedValue: s.shippedValue + cost, shippedCount: s.shippedCount + 1, withdrawMode: false }, log(`Shipped ${pending.item.name}. Operator cost ${money(cost)} at realized value.`, "good")));
    setPending(null);
  };
  const doWithdrawItem = () => {
    if (!pending) return;
    const v = pending.display;
    setW((s) => push({ ...s, cashOut: s.cashOut + v, withdrawMode: false }, log(`Withdrew ${money(v)} through the item.`, "good")));
    setPending(null);
  };
  const doWithdraw = () => {
    if (cfg.withdrawal.mode === "cash") {
      setW((s) => push({ ...s, cashOut: s.cashOut + s.balance, balance: 0 }, log(`Withdrew ${money(s.balance)} in cash.`, "good")));
    } else {
      setW((s) => push({ ...s, withdrawMode: true }, log(`Withdrawal requested. This operator pays out only through items: keep opening until an item worth at least ${money(cfg.withdrawal.minWithdraw)} drops, then withdraw its value.`, "warn")));
    }
  };
  const autoSession = () => {
    if (!live || pending) return;
    let s = { ...w, log: [...w.log] };
    let k = 0;
    const budget = Math.max(price, P.rebetFraction * s.balance);
    let spent = 0;
    while (s.balance >= price && spent < budget && k < P.opensPerSession) {
      const o = live.open("player");
      s.balance -= price;
      s.wagered += price;
      s.opens++;
      spent += price;
      k++;
      if (o.display >= P.shipAboveMultiple * price) {
        s.shippedValue += o.item.realized;
        s.shippedCount++;
      } else {
        const v = sellValue(o);
        s.sold++;
        s.credited += v;
        if (cfg.sellback.mode === "vendor") s.balance += v;
        else s.cashOut += v;
      }
    }
    s = push(s, log(`Auto-played ${k} opens with the agent policy (ship at ≥ ${P.shipAboveMultiple}× price, otherwise sell back).`));
    setW(s);
  };
  const reset = () => {
    liveRef.current = null;
    setW(EMPTY);
    setPending(null);
  };

  if (!live) {
    return (
      <Card title="Nothing to open yet">
        <p className="text-sm text-ink-2">{liveRef.current?.error}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings("box")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Add items in Settings
        </button>
      </Card>
    );
  }

  const left = w.cashOut + w.shippedValue;
  const hold = w.deposited ? (w.deposited - left) / w.deposited : 0;
  const ggr = w.wagered - w.credited - w.shippedValue;
  const vendor = cfg.sellback.mode === "vendor";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title="Your wallet">
          <div className="text-xs text-ink-3">site balance</div>
          <div className="text-3xl font-semibold tabular-nums">{money(w.balance)}</div>
          <div className="mt-1 text-xs text-ink-2">
            deposited {money(w.deposited)} · cash out {money(w.cashOut)}
          </div>
          <div className="mt-3 flex gap-1">
            <input type="number" className="w-28" min={1} step={10} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
            <button type="button" className="btn btn-primary" onClick={doDeposit}>
              <Icon name="ph:piggy-bank" size={16} className="text-white" /> Deposit
            </button>
          </div>
          <button type="button" className="btn mt-2 w-full" onClick={doWithdraw} disabled={w.balance <= 0 || w.withdrawMode} title={cfg.withdrawal.mode === "cash" ? "Move the balance to cash" : "This operator pays out only through items"}>
            <Icon name="ph:hand-coins" size={16} /> {cfg.withdrawal.mode === "cash" ? "Withdraw balance as cash" : w.withdrawMode ? "Withdrawal pending (needs an item)" : "Withdraw balance"}
          </button>
          <div className="mt-3 rounded-lg bg-paper p-2 text-[11px] text-ink-2">
            <b>Rules here:</b> sell-back {cfg.sellback.mode === "vendor" ? `credits ${pct(1 - cfg.sellback.haircut, 0)} of the displayed value to your balance` : `pays ${pct(1 - cfg.sellback.haircut, 0)} of ${cfg.sellback.layer} value in cash`}; withdrawal {cfg.withdrawal.mode === "cash" ? "in cash at any time" : `only through items worth at least ${money(cfg.withdrawal.minWithdraw)}`}.{" "}
            <button type="button" className="underline" onClick={() => onSettings("economy")}>
              change
            </button>
          </div>
        </Card>

        <Card title="The box">
          <div className="flex flex-wrap items-center gap-3">
            <Icon name="fluent:package" size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{cfg.box.name}</div>
              <div className="text-xs text-ink-2">
                {money(price)} per open · values shown at {cfg.box.displayLayer}
              </div>
            </div>
          </div>
          {!pending ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-lg" onClick={doOpen} disabled={w.balance < price}>
                <Icon name="ph:play" size={18} className="text-white" /> Open for {money(price)}
              </button>
              <button type="button" className="btn" onClick={autoSession} disabled={w.balance < price} title={`Up to ${P.opensPerSession} opens, re-betting ${pct(P.rebetFraction, 0)} of the balance, with the agent policy`}>
                <Icon name="ph:robot" size={16} /> Auto-play a session
              </button>
              <button type="button" className="btn" onClick={reset}>
                <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset
              </button>
              {w.balance < price && <span className="text-xs text-warn">Balance below the box price. Deposit to continue (the moment the economy relies on).</span>}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-accent bg-accent-soft p-3 animate-rise">
              <div className="flex flex-wrap items-center gap-3">
                <ItemTile item={pending.item} size={64} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ink-3">{pending.item.brand}</div>
                  <div className="font-semibold">{pending.item.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <TierBadge tier={pending.item.tier} />
                    <span>shown as {money(pending.display)}</span>
                    <span className="text-ink-3">cash value {money(pending.item.realized)}</span>
                    {pending.verified === false && <Badge tone="bad">proof fails</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={doSell}>
                  <Icon name="ph:arrows-clockwise" size={16} className="text-white" /> {vendor ? `Sell back for ${money(sellValue(pending))} credit` : `Sell for ${money(sellValue(pending))} cash`}
                </button>
                <button type="button" className="btn" onClick={doShip}>
                  <Icon name="ph:truck" size={16} /> Ship it (operator cost {money(pending.item.realized)})
                </button>
                {w.withdrawMode && cfg.withdrawal.mode === "through-items" && pending.display >= cfg.withdrawal.minWithdraw && (
                  <button type="button" className="btn" onClick={doWithdrawItem}>
                    <Icon name="ph:hand-coins" size={16} /> Withdraw {money(pending.display)} through this item
                  </button>
                )}
              </div>
              {vendor && <p className="mt-2 text-[11px] text-ink-2">Selling back turns the item into site balance at its displayed value. Nothing leaves the system until an item ships.</p>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="The economy so far (operator view)">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Deposited" value={money(w.deposited)} />
            <Stat label="Wagered" value={money(w.wagered)} sub={`${num(w.opens)} opens · ${num(w.sold)} sold back · ${num(w.shippedCount)} shipped`} />
            <Stat label="Left the system" value={money(left)} sub={`cash ${money(w.cashOut)} · goods ${money(w.shippedValue)}`} />
            <Stat label="Operator hold" value={w.deposited ? pct(hold) : "—"} sub={`GGR ${money(ggr)}`} tone={w.deposited && hold > 0.5 ? "warn" : undefined} />
          </div>
          <p className="mt-2 text-xs text-ink-3">The vendor says 99.9% of items are sold back and hold runs at 15 to 30% of deposits. Press Run below to test that with {num(P.agents)} agents.</p>
        </Card>
        <Card title="Ledger">
          {w.log.length === 0 ? (
            <p className="text-xs text-ink-3">Deposit, then open the box.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto text-xs">
              {w.log.map((e) => (
                <li key={e.n} className={e.tone === "good" ? "text-good" : e.tone === "bad" ? "text-bad" : e.tone === "warn" ? "text-warn" : "text-ink-2"}>
                  {e.text}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
