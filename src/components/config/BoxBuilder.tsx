"use client";
import { useMemo, useState } from "react";
import { CATALOG, CATALOG_BY_ID, TIER_ORDER, TIER_LABEL } from "@/engine/catalog";
import { applyGuarantee, expectedValue, resolveTable, solveWeights, weightsForPool, weightsForTiers, weightsFromPercents } from "@/engine/table";
import type { BoxDef, BoxModel, BoxTier, PriceLayer } from "@/engine/types";
import { TICKET_TOTAL } from "@/lib/presets";
import { money, oneIn, pct, pctSmart } from "@/lib/format";
import { ItemTile, TierBadge } from "../ItemTile";
import { Icon } from "../Icon";
import { Card, Field, NumberInput, Select, Help, Th, Td, Badge, Info, Toggle } from "../ui";

const LAYERS: { value: PriceLayer; label: string }[] = [
  { value: "retail", label: "Retail (boutique price)" },
  { value: "asking", label: "Asking (resale listings)" },
  { value: "realized", label: "Realized (what items actually sell for)" },
];

/** All item ids a box references, whatever its model. */
function idsOf(box: BoxDef): string[] {
  if (box.model === "pool" && box.pool) return Object.keys(box.pool.copies);
  if (box.model === "tiered" && box.tiers) return [...new Set(box.tiers.flatMap((t) => t.itemIds))];
  return box.items.map((b) => b.itemId);
}

export function BoxBuilder({ box, onChange, compact = false, lockModel = false, lockItems = false }: { box: BoxDef; onChange: (b: BoxDef) => void; compact?: boolean; lockModel?: boolean; lockItems?: boolean }) {
  const model: BoxModel = box.model ?? "weighted";
  const [unlocked, setUnlocked] = useState(false);
  const locked = lockItems && !unlocked;
  const [mode, setMode] = useState<"solver" | "manual">(lockItems ? "manual" : "solver");
  const [pickerOpen, setPickerOpen] = useState(!compact && !lockItems);
  const [filter, setFilter] = useState("");
  const [showCaptured, setShowCaptured] = useState(false);
  const [guaranteeShare, setGuaranteeShare] = useState(box.guarantee?.share ?? 0.4);
  const [guaranteeMin, setGuaranteeMin] = useState(box.guarantee?.minValue ?? box.price);
  const table = useMemo(() => {
    try {
      return resolveTable(box.items, box.ticketTotal, CATALOG_BY_ID);
    } catch {
      return null;
    }
  }, [box]);
  const statedRtp = useMemo(() => {
    if (!table) return null;
    return {
      retail: expectedValue(table, "retail") / box.price,
      asking: expectedValue(table, "asking") / box.price,
      realized: expectedValue(table, "realized") / box.price,
    };
  }, [table, box.price]);
  const [targetRtp, setTargetRtp] = useState(() => (statedRtp ? Number(statedRtp[box.valueLayer].toFixed(2)) : 0.9));
  const [percents, setPercents] = useState<Record<string, number>>(() =>
    Object.fromEntries(box.items.map((bi) => [bi.itemId, Math.round((bi.weight / box.ticketTotal) * 10000) / 100])),
  );
  const ids = idsOf(box);

  const resolve = (itemIds: string[], price: number, layer: PriceLayer, rtp: number) => {
    const items = itemIds.map((id) => CATALOG_BY_ID.get(id)!).filter(Boolean);
    if (!items.length) return [];
    return solveWeights(items, TICKET_TOTAL, price, rtp, layer).weights;
  };

  /** Rebuild the box for a new set of item ids, respecting the model. */
  const setItems = (next: string[]) => {
    if (model === "pool") {
      const copies: Record<string, number> = {};
      for (const id of next) copies[id] = box.pool?.copies[id] ?? 10;
      onChange({ ...box, pool: { ...(box.pool ?? { retire: "when-empty" }), copies }, items: weightsForPool(copies, TICKET_TOTAL) });
      return;
    }
    if (model === "tiered") {
      const tiers = (box.tiers ?? []).map((t) => ({ ...t, itemIds: t.itemIds.filter((id) => next.includes(id)) }));
      const placed = new Set(tiers.flatMap((t) => t.itemIds));
      const unplaced = next.filter((id) => !placed.has(id));
      if (unplaced.length) {
        if (!tiers.length) tiers.push({ id: "t1", name: "Tier 1", percent: 100, itemIds: [] });
        tiers[tiers.length - 1].itemIds.push(...unplaced);
      }
      onChange({ ...box, tiers, items: weightsForTiers(tiers, TICKET_TOTAL) });
      return;
    }
    if (mode === "solver") onChange({ ...box, ticketTotal: TICKET_TOTAL, items: resolve(next, box.price, box.valueLayer, targetRtp), guarantee: undefined });
    else {
      const p = Object.fromEntries(next.map((id) => [id, percents[id] ?? 1]));
      setPercents(p);
      onChange({ ...box, ticketTotal: TICKET_TOTAL, items: weightsFromPercents(next.map((id) => ({ itemId: id, percent: p[id] })), TICKET_TOTAL).items, guarantee: undefined });
    }
  };
  const toggle = (id: string) => setItems(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const resolveNow = (patch: Partial<{ price: number; layer: PriceLayer; rtp: number }>) => {
    const price = patch.price ?? box.price;
    const layer = patch.layer ?? box.valueLayer;
    const rtp = patch.rtp ?? targetRtp;
    onChange({ ...box, price, valueLayer: layer, items: model === "weighted" && mode === "solver" ? resolve(ids, price, layer, rtp) : box.items });
  };
  const setPercent = (id: string, v: number) => {
    const p = { ...percents, [id]: v };
    setPercents(p);
    onChange({ ...box, items: weightsFromPercents(ids.map((x) => ({ itemId: x, percent: p[x] ?? 0 })), TICKET_TOTAL).items, guarantee: undefined });
  };
  const percentSum = ids.reduce((a, id) => a + (percents[id] ?? 0), 0);

  const switchModel = (m: BoxModel) => {
    if (m === model) return;
    if (m === "pool") {
      const copies: Record<string, number> = {};
      for (const bi of box.items) copies[bi.itemId] = Math.max(1, Math.round((bi.weight / box.ticketTotal) * 100));
      onChange({ ...box, model: "pool", pool: { copies, retire: "when-empty" }, tiers: undefined, items: weightsForPool(copies, TICKET_TOTAL) });
    } else if (m === "tiered") {
      const sorted = [...box.items].map((bi) => CATALOG_BY_ID.get(bi.itemId)!).filter(Boolean).sort((a, b) => b[box.valueLayer] - a[box.valueLayer]);
      const n = Math.max(1, Math.min(4, Math.ceil(sorted.length / 3)));
      const tiers: BoxTier[] = [];
      const pcts = [0.5, 5, 20.5, 74].slice(4 - n);
      const scale = 100 / pcts.reduce((a, b) => a + b, 0);
      for (let k = 0; k < n; k++) tiers.push({ id: `t${k + 1}`, name: `Tier ${k + 1}`, percent: Math.round(pcts[k] * scale * 100) / 100, itemIds: sorted.slice(k * 3, k === n - 1 ? sorted.length : (k + 1) * 3).map((c) => c.id) });
      onChange({ ...box, model: "tiered", tiers, pool: undefined, items: weightsForTiers(tiers, TICKET_TOTAL) });
    } else {
      onChange({ ...box, model: "weighted", pool: undefined, tiers: undefined, items: resolve(ids, box.price, box.valueLayer, targetRtp) });
    }
  };

  // pool editors
  const setCopies = (id: string, c: number) => {
    const copies = { ...(box.pool?.copies ?? {}), [id]: Math.max(0, Math.floor(c)) };
    onChange({ ...box, pool: { ...(box.pool ?? { retire: "when-empty" }), copies }, items: weightsForPool(copies, TICKET_TOTAL) });
  };
  const poolTotal = box.pool ? Object.values(box.pool.copies).reduce((a, b) => a + b, 0) : 0;
  const fillPoolFromOdds = (size: number) => {
    const copies: Record<string, number> = {};
    for (const bi of box.items) copies[bi.itemId] = Math.max(1, Math.round((bi.weight / box.ticketTotal) * size));
    onChange({ ...box, pool: { ...(box.pool ?? { retire: "when-empty" }), copies }, items: weightsForPool(copies, TICKET_TOTAL) });
  };

  // tier editors
  const setTiers = (tiers: BoxTier[]) => onChange({ ...box, tiers, items: weightsForTiers(tiers, TICKET_TOTAL) });
  const tierSum = (box.tiers ?? []).reduce((a, t) => a + t.percent, 0);

  // value floor and guarantee
  const floorViolations = box.floorMultiple ? ids.filter((id) => (CATALOG_BY_ID.get(id)?.[box.valueLayer] ?? 0) < box.floorMultiple! * box.price) : [];
  const applyFloor = () => setItems(ids.filter((id) => !floorViolations.includes(id)));
  const applyGuaranteeNow = () => {
    const items = applyGuarantee(box.items, TICKET_TOTAL, guaranteeShare, guaranteeMin, box.valueLayer, CATALOG_BY_ID);
    onChange({ ...box, items, guarantee: { share: guaranteeShare, minValue: guaranteeMin } });
    setMode("manual");
    setPercents(Object.fromEntries(items.map((bi) => [bi.itemId, Math.round((bi.weight / TICKET_TOTAL) * 10000) / 100])));
  };
  const priceFromEv = () => {
    if (!table) return;
    const ev = expectedValue(table, box.valueLayer);
    onChange({ ...box, price: Math.max(0.5, Math.round((ev / Math.max(0.05, targetRtp)) * 100) / 100) });
  };

  const pickerItems = CATALOG.filter((c) => (showCaptured ? true : c.source !== "captured") || ids.includes(c.id)).filter((c) => (c.name + c.brand + (c.operator ?? "")).toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card
      title={
        <>
          Box {table && <Badge tone="accent">{ids.length} items</Badge>}
          {box.note && <Info>{box.note}</Info>}
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="Name" hint="A label for this box. It appears in results and reports.">
          <input type="text" value={box.name} onChange={(e) => onChange({ ...box, name: e.target.value })} />
        </Field>
        <Field label="Price per open ($)" hint={model === "weighted" ? "What one open costs. With the return slider on, changing the price re-spreads the odds to keep the same return." : "What one open costs."}>
          <NumberInput value={box.price} min={0.5} step={0.5} onChange={(v) => resolveNow({ price: Math.max(0.5, v) })} />
        </Field>
        <Field label="Price that counts as the payout" hint="What an item is worth when it is won. Retail is the boutique price, asking is what resellers list it for, realized is what it actually sells for. The vendor counts retail, which flatters the return; the Glass Box counts realized.">
          <Select value={box.valueLayer} onChange={(v) => resolveNow({ layer: v })} options={LAYERS} />
        </Field>
        <Field label="Price players are shown" hint="The value printed next to each item on the box page. Operators show retail because it is the biggest number.">
          <Select value={box.displayLayer} onChange={(v) => onChange({ ...box, displayLayer: v })} options={LAYERS} />
        </Field>
        <Field label="How the draw works" hint="Fixed odds: every open has the same chances (every case site). Finite drop: a set number of copies drawn without replacement, so the odds move as it sells (IcyBox, kuji, lucky bags). Tier-first: the draw picks a tier at stated odds and the operator picks the item inside it (StockX).">
          <Select<BoxModel> value={model} onChange={switchModel} disabled={lockModel} options={[{ value: "weighted", label: "Fixed odds (weighted)" }, { value: "pool", label: "Finite drop (pool)" }, { value: "tiered", label: "Tier-first (StockX)" }]} />
        </Field>
      </div>

      {lockItems && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
          <Icon name="ph:lock-key" size={14} />
          {locked ? "Captured table: items and odds as published (reconstructed). " : "Unlocked: you are editing a captured table. "}
          <button type="button" className="chip" onClick={() => setUnlocked((u) => !u)}>
            {locked ? "unlock to experiment" : "lock again"}
          </button>
        </div>
      )}

      {model === "weighted" && !locked && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="How the odds are set" hint="Return slider: pick a target return and the odds are spread across the items automatically, piling tickets on the cheap items as real tables do. Type percentages: enter each item&apos;s chance yourself.">
            <Select
              value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === "solver") onChange({ ...box, items: resolve(ids, box.price, box.valueLayer, targetRtp), guarantee: undefined });
              }}
              options={[
                { value: "solver", label: "Return slider (the vendor's knob)" },
                { value: "manual", label: "Type the percentages" },
              ]}
            />
          </Field>
          {mode === "solver" && (
            <Field label={`Target return: ${pct(targetRtp, 0)} of every $100, counted at ${box.valueLayer} prices`} hint="Of every $100 players put in, how much comes back on average, at the chosen price. The vendor defaults to 90% at retail. Under the hood the odds follow value to the power of minus beta, with beta solved to hit the target.">
              <input type="range" min={0.3} max={1.3} step={0.01} value={targetRtp} onChange={(e) => { const v = Number(e.target.value); setTargetRtp(v); resolveNow({ rtp: v }); }} className="w-56" />
            </Field>
          )}
          {mode === "manual" && (
            <div className="text-xs text-ink-2">
              Sum <b className={Math.abs(percentSum - 100) > 0.01 ? "text-warn" : "text-good"}>{percentSum.toFixed(2)}%</b>
              <Info>Percentages are normalised to integer tickets; the raw sum is kept so float-table effects can be studied.</Info>
            </div>
          )}
          <button type="button" className="chip" onClick={priceFromEv} data-tip="Courtyard pricing: keep the odds, set the price to expected value ÷ target RTP (100% = price equals EV)">
            price from EV
          </button>
          <button type="button" className="ml-auto text-xs text-accent-ink underline" onClick={() => setPickerOpen((o) => !o)}>
            {pickerOpen ? "Hide item picker" : "Pick items"}
          </button>
        </div>
      )}
      {model !== "weighted" && !locked && (
        <div className="mt-3 flex">
          <button type="button" className="ml-auto text-xs text-accent-ink underline" onClick={() => setPickerOpen((o) => !o)}>
            {pickerOpen ? "Hide item picker" : "Pick items"}
          </button>
        </div>
      )}

      {pickerOpen && !locked && (
        <div className="mt-3 rounded-lg border border-line bg-paper p-3">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <input type="text" placeholder="Filter items…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
            <label className="flex items-center gap-1 text-xs text-ink-2">
              <input type="checkbox" checked={showCaptured} onChange={(e) => setShowCaptured(e.target.checked)} /> include items from the reconstructed operator tables
            </label>
          </div>
          <div className="grid max-h-72 gap-1 overflow-auto md:grid-cols-2">
            {TIER_ORDER.flatMap((tier) =>
              pickerItems
                .filter((c) => c.tier === tier)
                .map((c) => (
                  <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface ${ids.includes(c.id) ? "bg-surface" : ""}`}>
                    <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} />
                    <ItemTile item={c} size={28} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-ink-3">{c.brand}</span> {c.name}
                      {c.source === "captured" && <span className="ml-1 text-[10px] text-warn">{c.operator}</span>}
                    </span>
                    <span className="text-ink-3">{TIER_LABEL[tier]}</span>
                    <span className="font-mono">{money(c.realized)}</span>
                  </label>
                )),
            )}
          </div>
        </div>
      )}

      {model === "pool" && box.pool && (
        <div className="mt-3 rounded-lg border border-line bg-paper p-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Retirement rule" hint="When empty: a new identical drop starts. Operator may retire: the early-retirement rig can end a drop while the grail is inside (IcyBox terms). Must distribute: at any retirement the remaining top items are awarded to buyers (Glass Box rule).">
              <Select<NonNullable<BoxDef["pool"]>["retire"]>
                value={box.pool.retire}
                onChange={(retire) => onChange({ ...box, pool: { ...box.pool!, retire } })}
                options={[
                  { value: "when-empty", label: "New drop when empty" },
                  { value: "operator-may-retire", label: "Operator may retire early (IcyBox)" },
                  { value: "must-distribute", label: "Must distribute at retirement (Glass Box)" },
                ]}
              />
            </Field>
            <Field label="Last One prize (kuji)" hint="The buyer of the final copy also receives this item.">
              <Select<string> value={box.pool.lastOneItemId ?? ""} onChange={(v) => onChange({ ...box, pool: { ...box.pool!, lastOneItemId: v || undefined } })} options={[{ value: "", label: "None" }, ...CATALOG.filter((c) => c.source !== "captured").map((c) => ({ value: c.id, label: `${c.brand} ${c.name} (${money(c.realized)})` }))]} />
            </Field>
            <div className="text-xs text-ink-2">
              <b>{poolTotal.toLocaleString()}</b> copies in the drop
            </div>
            <button type="button" className="chip" onClick={() => fillPoolFromOdds(100)} data-tip="Convert the current odds into copies for a drop of this size">
              fill 100 copies from odds
            </button>
            <button type="button" className="chip" onClick={() => fillPoolFromOdds(1000)}>
              fill 1,000
            </button>
          </div>
        </div>
      )}

      {model === "tiered" && box.tiers && (
        <div className="mt-3 space-y-2 rounded-lg border border-line bg-paper p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">Tiers</span>
            <span className={Math.abs(tierSum - 100) > 0.01 ? "text-warn" : "text-good"}>sum {tierSum.toFixed(2)}%</span>
            <Info>Each tier has stated odds and a list of items. The proof resolves to the tier; the item inside is picked from inventory. Leave inventory blank for unlimited; a tier that runs out delists the box and ends the run.</Info>
            <button type="button" className="chip" onClick={() => setTiers([...box.tiers!, { id: `t${box.tiers!.length + 1}`, name: `Tier ${box.tiers!.length + 1}`, percent: 0, itemIds: [] }])}>
              add tier
            </button>
            <button type="button" className="chip" onClick={() => box.tiers!.length > 1 && setTiers(box.tiers!.slice(0, -1))}>
              remove last
            </button>
          </div>
          {box.tiers.map((t, i) => (
            <div key={t.id} className="grid gap-2 rounded-lg border border-line bg-surface p-2 md:grid-cols-[1fr_90px_110px_2fr]">
              <input type="text" value={t.name} onChange={(e) => setTiers(box.tiers!.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <div className="flex items-center gap-1 text-xs">
                <input type="number" step={0.01} min={0} value={t.percent} onChange={(e) => setTiers(box.tiers!.map((x, k) => (k === i ? { ...x, percent: Number(e.target.value) } : x)))} />%
              </div>
              <input type="number" placeholder="inventory" min={0} step={1} value={t.inventory ?? ""} onChange={(e) => setTiers(box.tiers!.map((x, k) => (k === i ? { ...x, inventory: e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value))) } : x)))} />
              <div className="flex flex-wrap gap-1">
                {ids.map((id) => {
                  const c = CATALOG_BY_ID.get(id);
                  if (!c) return null;
                  const inThis = t.itemIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`chip ${inThis ? "chip-accent" : ""}`}
                      data-tip={`${c.brand} ${c.name} · ${money(c[box.valueLayer])}`}
                      onClick={() => setTiers(box.tiers!.map((x, k) => (k === i ? { ...x, itemIds: inThis ? x.itemIds.filter((y) => y !== id) : [...x.itemIds, id] } : { ...x, itemIds: x.itemIds.filter((y) => y !== id) })))}
                    >
                      {c.name.split(",")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-3 text-xs ${locked ? "hidden" : ""}`}>
        <Toggle checked={!!box.floorMultiple} onChange={(v) => onChange({ ...box, floorMultiple: v ? 1 : undefined })} label="Value floor" hint="StockX: every item worth at least this multiple of the price (before fees). Items below it are listed here; apply removes them." />
        {box.floorMultiple && (
          <>
            <NumberInput value={box.floorMultiple} min={0.1} max={10} step={0.1} onChange={(v) => onChange({ ...box, floorMultiple: v })} />
            {floorViolations.length ? (
              <button type="button" className="chip chip-bad" onClick={applyFloor}>
                {floorViolations.length} item{floorViolations.length > 1 ? "s" : ""} below the floor · remove
              </button>
            ) : (
              <Badge tone="good">floor holds</Badge>
            )}
          </>
        )}
        {model === "weighted" && (
          <>
            <span className="mx-1 text-ink-3">·</span>
            <span className="flex items-center gap-1">
              Guarantee <Info>Jemlit &ldquo;40% guaranteed&rdquo;: a share of opens drawn only from items at or above a value. Applying rewrites the weights as the mixture.</Info>
            </span>
            <NumberInput value={guaranteeShare} min={0} max={1} step={0.05} onChange={setGuaranteeShare} />
            <span>of opens ≥</span>
            <NumberInput value={guaranteeMin} min={0} step={1} onChange={setGuaranteeMin} />
            <button type="button" className="chip" onClick={applyGuaranteeNow}>
              apply
            </button>
            {box.guarantee && <Badge tone="accent">guarantee {pct(box.guarantee.share, 0)} ≥ {money(box.guarantee.minValue)}</Badge>}
            <span className="mx-1 text-ink-3">·</span>
            <Toggle checked={!!box.pity} onChange={(v) => onChange({ ...box, pity: v ? { afterLosses: 20, minValueMultiple: 1 } : undefined })} label="Pity ceiling" hint="Gacha: after N consecutive drops below the price, the next open is drawn only from items worth at least the multiple of the price. Disclosed and verifiable." />
            {box.pity && (
              <>
                <span>after</span>
                <NumberInput value={box.pity.afterLosses} min={1} max={500} step={1} onChange={(v) => onChange({ ...box, pity: { ...box.pity!, afterLosses: Math.max(1, Math.floor(v)) } })} />
                <span>losses, pay ≥ price ×</span>
                <NumberInput value={box.pity.minValueMultiple} min={0.1} max={50} step={0.1} onChange={(v) => onChange({ ...box, pity: { ...box.pity!, minValueMultiple: v } })} />
              </>
            )}
          </>
        )}
      </div>

      {table && statedRtp && (
        <>
          <div className="mt-3 overflow-x-auto">
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Item</Th>
                  {model === "pool" && <Th right>Copies</Th>}
                  <Th right>Odds</Th>
                  <Th right>1 in</Th>
                  <Th right>Retail</Th>
                  <Th right>Asking</Th>
                  <Th right>Realized</Th>
                  {model === "weighted" && mode === "manual" && !locked && <Th right>Percent</Th>}
                </tr>
              </thead>
              <tbody>
                {table.items.map((r) => (
                  <tr key={r.itemId}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <ItemTile item={r.item} size={24} />
                        <span className="truncate">
                          <span className="text-ink-3">{r.item.brand}</span> {r.item.name}
                        </span>
                        <TierBadge tier={r.item.tier} />
                        {box.floorMultiple && r.item[box.valueLayer] < box.floorMultiple * box.price && <Badge tone="bad">below floor</Badge>}
                      </span>
                    </Td>
                    {model === "pool" && (
                      <Td right>
                        <input type="number" className="w-20 text-right" min={0} step={1} value={box.pool?.copies[r.itemId] ?? 0} disabled={locked} onChange={(e) => setCopies(r.itemId, Number(e.target.value))} />
                      </Td>
                    )}
                    <Td right mono>{pctSmart(r.weight / table.T)}</Td>
                    <Td right mono>{oneIn(r.weight / table.T)}</Td>
                    <Td right mono>{money(r.item.retail)}</Td>
                    <Td right mono>{money(r.item.asking)}</Td>
                    <Td right mono>{money(r.item.realized)}</Td>
                    {model === "weighted" && mode === "manual" && !locked && (
                      <Td right>
                        <input type="number" className="w-24 text-right" step={0.01} min={0} value={percents[r.itemId] ?? 0} onChange={(e) => setPercent(r.itemId, Number(e.target.value))} />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
            {LAYERS.map((L) => (
              <div key={L.value} className={`rounded-lg border px-3 py-2 ${L.value === box.valueLayer ? "border-accent bg-accent-soft" : "border-line bg-paper"}`}>
                <div className="text-[11px] uppercase tracking-wide text-ink-3">Stated RTP on {L.value}</div>
                <div className="text-lg font-semibold tabular-nums">{pct(statedRtp[L.value])}</div>
                <div className="text-ink-3">EV {money(statedRtp[L.value] * box.price)} on a {money(box.price)} box</div>
              </div>
            ))}
          </div>
          <Help>
            Displayed percentages (rounded to 2 decimals) sum to {table.floatSumPercent.toFixed(2)}%. The engine draws from exact integer tickets out of {box.ticketTotal.toLocaleString()} (or from the copies left, in a finite drop); the float-cumulative mapping reproduces what rounded percentages do instead.
          </Help>
        </>
      )}
    </Card>
  );
}
