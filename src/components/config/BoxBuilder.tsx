"use client";
import { useMemo, useState } from "react";
import { CATALOG, CATALOG_BY_ID, TIER_ORDER, TIER_LABEL } from "@/engine/catalog";
import { expectedValue, resolveTable, solveWeights, weightsFromPercents } from "@/engine/table";
import type { BoxDef, PriceLayer } from "@/engine/types";
import { TICKET_TOTAL } from "@/lib/presets";
import { money, oneIn, pct, pctSmart } from "@/lib/format";
import { ItemTile, TierBadge } from "../ItemTile";
import { Card, Field, NumberInput, Select, Help, Th, Td, Badge } from "../ui";

const LAYERS: { value: PriceLayer; label: string }[] = [
  { value: "retail", label: "Retail (boutique price)" },
  { value: "asking", label: "Asking (resale listings)" },
  { value: "realized", label: "Realized (what items actually sell for)" },
];

export function BoxBuilder({ box, onChange, compact = false }: { box: BoxDef; onChange: (b: BoxDef) => void; compact?: boolean }) {
  const [mode, setMode] = useState<"solver" | "manual">("solver");
  const [pickerOpen, setPickerOpen] = useState(!compact);
  const [filter, setFilter] = useState("");
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

  const resolve = (itemIds: string[], price: number, layer: PriceLayer, rtp: number) => {
    const items = itemIds.map((id) => CATALOG_BY_ID.get(id)!).filter(Boolean);
    if (!items.length) return [];
    return solveWeights(items, TICKET_TOTAL, price, rtp, layer).weights;
  };

  const setItems = (ids: string[]) => {
    if (mode === "solver") onChange({ ...box, ticketTotal: TICKET_TOTAL, items: resolve(ids, box.price, box.valueLayer, targetRtp) });
    else {
      const p = Object.fromEntries(ids.map((id) => [id, percents[id] ?? 1]));
      setPercents(p);
      onChange({ ...box, ticketTotal: TICKET_TOTAL, items: weightsFromPercents(ids.map((id) => ({ itemId: id, percent: p[id] })), TICKET_TOTAL).items });
    }
  };
  const ids = box.items.map((b) => b.itemId);
  const toggle = (id: string) => setItems(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const resolveNow = (patch: Partial<{ price: number; layer: PriceLayer; rtp: number }>) => {
    const price = patch.price ?? box.price;
    const layer = patch.layer ?? box.valueLayer;
    const rtp = patch.rtp ?? targetRtp;
    onChange({ ...box, price, valueLayer: layer, items: mode === "solver" ? resolve(ids, price, layer, rtp) : box.items });
  };
  const setPercent = (id: string, v: number) => {
    const p = { ...percents, [id]: v };
    setPercents(p);
    onChange({ ...box, items: weightsFromPercents(ids.map((x) => ({ itemId: x, percent: p[x] ?? 0 })), TICKET_TOTAL).items });
  };
  const percentSum = ids.reduce((a, id) => a + (percents[id] ?? 0), 0);

  return (
    <Card title={<span className="flex items-center gap-2">Box {table && <Badge tone="accent">{ids.length} items</Badge>}</span>}>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Box name">
          <input type="text" value={box.name} onChange={(e) => onChange({ ...box, name: e.target.value })} />
        </Field>
        <Field label="Box price ($)">
          <NumberInput value={box.price} min={0.5} step={0.5} onChange={(v) => resolveNow({ price: Math.max(0.5, v) })} />
        </Field>
        <Field label="Value layer (used for payouts and RTP)" hint="The vendor computes RTP on listed values; Glass Box on realized.">
          <Select value={box.valueLayer} onChange={(v) => resolveNow({ layer: v })} options={LAYERS} />
        </Field>
        <Field label="Display layer (what players are shown as 'value')">
          <Select value={box.displayLayer} onChange={(v) => onChange({ ...box, displayLayer: v })} options={LAYERS} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Odds mode">
          <Select
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (m === "solver") onChange({ ...box, items: resolve(ids, box.price, box.valueLayer, targetRtp) });
            }}
            options={[
              { value: "solver", label: "RTP solver (the vendor's knob)" },
              { value: "manual", label: "Manual percentages" },
            ]}
          />
        </Field>
        {mode === "solver" && (
          <Field label={`Target RTP on ${box.valueLayer} value: ${pct(targetRtp, 0)}`} hint="Weights follow value^(−beta); beta is solved so expected value = RTP × price.">
            <input type="range" min={0.3} max={1.3} step={0.01} value={targetRtp} onChange={(e) => { const v = Number(e.target.value); setTargetRtp(v); resolveNow({ rtp: v }); }} className="w-56" />
          </Field>
        )}
        {mode === "manual" && (
          <div className="text-xs text-ink-2">
            Percentages sum to <b className={Math.abs(percentSum - 100) > 0.01 ? "text-warn" : "text-good"}>{percentSum.toFixed(2)}%</b>. They are normalised to integer tickets; the raw sum is kept so float-table effects can be studied.
          </div>
        )}
        <button type="button" className="ml-auto text-xs text-accent-ink underline" onClick={() => setPickerOpen((o) => !o)}>
          {pickerOpen ? "Hide item picker" : "Pick items"}
        </button>
      </div>

      {pickerOpen && (
        <div className="mt-3 rounded-lg border border-line bg-paper p-3">
          <input type="text" placeholder="Filter items…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2 max-w-xs" />
          <div className="grid max-h-72 gap-1 overflow-auto md:grid-cols-2">
            {TIER_ORDER.flatMap((tier) =>
              CATALOG.filter((c) => c.tier === tier && (c.name + c.brand).toLowerCase().includes(filter.toLowerCase())).map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface ${ids.includes(c.id) ? "bg-surface" : ""}`}>
                  <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} />
                  <ItemTile item={c} size={28} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-ink-3">{c.brand}</span> {c.name}
                  </span>
                  <span className="text-ink-3">{TIER_LABEL[tier]}</span>
                  <span className="font-mono">{money(c.realized)}</span>
                </label>
              )),
            )}
          </div>
        </div>
      )}

      {table && statedRtp && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th right>Odds</Th>
                  <Th right>1 in</Th>
                  <Th right>Retail</Th>
                  <Th right>Asking</Th>
                  <Th right>Realized</Th>
                  {mode === "manual" && <Th right>Percent</Th>}
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
                      </span>
                    </Td>
                    <Td right mono>{pctSmart(r.weight / table.T)}</Td>
                    <Td right mono>{oneIn(r.weight / table.T)}</Td>
                    <Td right mono>{money(r.item.retail)}</Td>
                    <Td right mono>{money(r.item.asking)}</Td>
                    <Td right mono>{money(r.item.realized)}</Td>
                    {mode === "manual" && (
                      <Td right>
                        <input type="number" className="w-24 text-right" step={0.01} min={0} value={percents[r.itemId] ?? 0} onChange={(e) => setPercent(r.itemId, Number(e.target.value))} />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
            Displayed percentages (rounded to 2 decimals) sum to {table.floatSumPercent.toFixed(2)}%. The engine always draws from exact integer tickets out of {box.ticketTotal.toLocaleString()}; the float-cumulative mapping reproduces what rounded percentages do instead.
          </Help>
        </>
      )}
    </Card>
  );
}
