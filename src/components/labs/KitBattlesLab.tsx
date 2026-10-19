"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { BattleMode, BoxDef, KitBattlesConfig } from "@/engine/types";
import { KIT_BATTLE_MODES } from "@/engine/labs/battleKit";
import type { FeatureDef } from "@/lib/operators";
import { ALL_KIT_MODES, entryOf, normaliseKitBattles, prepareRound } from "@/lib/kitBattles";
import { money, num, pct } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { KitBattleStage, type KitBattleRecord } from "../stages/KitBattleStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { ItemTile } from "../ItemTile";
import { Badge, Button, Card, Field, Help, Info, NumberInput, Td, Th, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const cents = (c: number) => money(c / 100);
const shortName = (b: BoxDef) => b.name.split(" · ")[0];

/**
 * Evo Verse battles on the backend kit's logic, in the Misty page format: Document, Admin panel and Developer
 * buttons; the player's create form inside the admin's limits; the boxes and their odds; the battle; analysis folded.
 */
export function KitBattlesLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as unknown as KitBattlesConfig;
  const [cfg, setCfgRaw] = useState<KitBattlesConfig>(() => normaliseKitBattles(clone(initial)));
  const setCfg = useCallback((next: KitBattlesConfig) => setCfgRaw(normaliseKitBattles(next)), []);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "settings" });
  const [editBox, setEditBox] = useState(0);
  const [records, setRecords] = useState<KitBattleRecord[]>([]);
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "settings" }), []);
  const closeSettings = useCallback(() => setSettings((x) => ({ ...x, open: false })), []);
  const s = cfg.settings;
  const coin = cfg.play.mode === "coinflip";
  const prepared = useMemo(() => cfg.boxes.map((b, i) => prepareRound(b, i)), [cfg.boxes]);
  const chosen = cfg.play.rounds.map((i) => prepared[i]).filter(Boolean);
  const entry = entryOf(chosen.map((p) => p.round), s.feePercent);
  const setPlay = (patch: Partial<KitBattlesConfig["play"]>) => setCfg({ ...cfg, play: { ...cfg.play, ...patch } });
  const setS = (patch: Partial<KitBattlesConfig["settings"]>) => setCfg({ ...cfg, settings: { ...s, ...patch } });
  const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const distinctChosen = [...new Set(cfg.play.rounds)].map((i) => prepared[i]).filter(Boolean);

  const report = useMemo(() => {
    const byMode = new Map<string, { battles: number; sponsored: number; withBots: number; entries: number; paid: number; fee: number }>();
    for (const r of records) {
      const row = byMode.get(r.mode) ?? { battles: 0, sponsored: 0, withBots: 0, entries: 0, paid: 0, fee: 0 };
      row.battles++;
      if (r.sponsored) row.sponsored++;
      if (r.bots > 0) row.withBots++;
      row.entries += r.playerEntriesCents;
      row.paid += r.playerPaidCents;
      row.fee += r.feeCents;
      byMode.set(r.mode, row);
    }
    return [...byMode.entries()];
  }, [records]);

  const sections: SettingsSection[] = [
    {
      id: "settings",
      label: "Battle settings",
      icon: "ph:sliders-horizontal",
      content: (
        <div className="space-y-4">
          <Card title="Switches and limits" actions={<Info>What the kit&apos;s admin panel holds. Players create battles inside these limits and never see the settings. Changes apply to new battles only.</Info>}>
            <div className="space-y-3">
              <Toggle checked={s.enabled} onChange={(v) => setS({ enabled: v })} label="Battles enabled" hint="The master switch. Off hides the lobby." />
              <Field label="Modes allowed" hint="Which modes players may pick. The kit's production default is normal, crazy and terminal; every mode is on here so each can be tried.">
                <div className="flex flex-wrap gap-1">
                  {ALL_KIT_MODES.map((m) => (
                    <button key={m} type="button" className={`chip ${s.modesAllowed.includes(m) ? "chip-accent" : ""}`} onClick={() => setS({ modesAllowed: toggleIn(s.modesAllowed, m) })}>
                      {KIT_BATTLE_MODES.find((x) => x.id === m)?.name ?? m}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Seats allowed" hint="How many seats a battle may have. Coinflip is always two.">
                <div className="flex flex-wrap gap-1">
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <button key={n} type="button" className={`chip ${s.seatsAllowed.includes(n) ? "chip-accent" : ""}`} onClick={() => setS({ seatsAllowed: toggleIn(s.seatsAllowed, n) })}>
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Rounds max" hint="Boxes per battle, 1 to 50.">
                  <NumberInput value={s.roundsMax} min={1} max={50} step={1} onChange={(v) => setS({ roundsMax: v })} />
                </Field>
                <Field label="Fee (%)" hint="A disclosed charge on top of the box prices, kept by the house. Never part of the pot. 0 to 20.">
                  <NumberInput value={s.feePercent} min={0} max={20} step={0.5} onChange={(v) => setS({ feePercent: v })} />
                </Field>
                <Field label="Coinflip edge" hint="Taken from the coinflip pot before the winner is paid, 0 to 0.10.">
                  <NumberInput value={s.coinflipEdge} min={0} max={0.1} step={0.01} onChange={(v) => setS({ coinflipEdge: v })} />
                </Field>
                <Field label="Countdown (seconds)" hint="From every seat taken to the start. A server timer, never a client one.">
                  <NumberInput value={s.countdownSeconds} min={0} max={30} step={1} onChange={(v) => setS({ countdownSeconds: v })} />
                </Field>
                <Field label="Open battle expiry (minutes)" hint="How long a waiting battle lives before it expires and refunds its holds. Not simulated here.">
                  <NumberInput value={s.openExpiryMinutes} min={1} max={1440} step={5} onChange={(v) => setS({ openExpiryMinutes: v })} />
                </Field>
                <Field label="Max open battles per player" hint="Anti-abuse. Not simulated here.">
                  <NumberInput value={s.maxConcurrentPerPlayer} min={1} max={20} step={1} onChange={(v) => setS({ maxConcurrentPerPlayer: v })} />
                </Field>
                <Field label="Credit face (cents)" hint="What one credit counts for in totals when a box pays credit. 100 = $1.">
                  <NumberInput value={s.creditFaceCents} min={1} max={10000} step={1} onChange={(v) => setS({ creditFaceCents: v })} />
                </Field>
              </div>
              <Toggle checked={s.privateAllowed} onChange={(v) => setS({ privateAllowed: v })} label="Private battles allowed" hint="Invite code instead of the public list. Not simulated here." />
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: "boxes",
      label: "Eligible boxes",
      icon: "ph:package",
      content: (
        <Card
          title={`Boxes players may put in a battle (${cfg.boxes.length})`}
          actions={
            <div className="flex gap-2">
              <Button kind="ghost" onClick={() => setCfg({ ...cfg, boxes: [...cfg.boxes, clone(cfg.boxes[cfg.boxes.length - 1] ?? initial.boxes[0])] })} disabled={cfg.boxes.length >= 8}>
                <Icon name="ph:plus" size={14} /> Add box
              </Button>
              <Button
                kind="ghost"
                onClick={() => {
                  const i = editBox;
                  setCfg({ ...cfg, boxes: cfg.boxes.filter((_, k) => k !== i), play: { ...cfg.play, rounds: cfg.play.rounds.filter((r) => r !== i).map((r) => (r > i ? r - 1 : r)) } });
                  setEditBox((e) => Math.max(0, Math.min(e, cfg.boxes.length - 2)));
                }}
                disabled={cfg.boxes.length <= 1}
              >
                <Icon name="ph:minus" size={14} /> Remove selected
              </Button>
            </div>
          }
        >
          <Help>Each box carries its own odds table; the table is hashed and the hash is pinned on every battle that uses it. The return is what the box pays back per open at its value layer, which is what the pot will pay back.</Help>
          <div className="my-3 flex flex-wrap gap-1">
            {prepared.map((p, i) => (
              <button key={i} type="button" onClick={() => setEditBox(i)} className={`chip ${editBox === i ? "chip-accent" : ""}`} title={`table hash ${p.round.table.hash}`}>
                {shortName(p.box)} · {money(p.box.price)} · returns {pct(p.ret, 0)}
              </button>
            ))}
          </div>
          {prepared[editBox] && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <Badge>{prepared[editBox].round.table.entries.length} items</Badge>
              <Badge tone={prepared[editBox].ret > 1 ? "bad" : "good"}>pays back {cents(Math.round(prepared[editBox].evCents))} per open = {pct(prepared[editBox].ret, 1)}</Badge>
              <span className="font-mono text-[11px] text-ink-3">table hash {prepared[editBox].round.table.hash.slice(0, 16)}…</span>
            </div>
          )}
          {cfg.boxes[editBox] && <BoxBuilder box={cfg.boxes[editBox]} onChange={(b) => setCfg({ ...cfg, boxes: cfg.boxes.map((x, k) => (k === editBox ? b : x)) })} compact />}
        </Card>
      ),
    },
    {
      id: "bots",
      label: "Bots",
      icon: "ph:robot",
      badge: s.botsEnabled ? <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] text-white">{s.botNames.length}</span> : undefined,
      content: (
        <Card title="Bots">
          <div className="space-y-3">
            <Toggle checked={s.botsEnabled} onChange={(v) => setS({ botsEnabled: v })} label="Bots may fill empty seats" hint="Off by default in the kit. On: the creator of a waiting battle can ask bots to join; every free seat gets a bot." />
            <Help>A bot is a name and a picture, nothing else. It plays the same boxes with the same odds and the same committed secret, holds no credit, and what it wins returns to the house. It is labelled as a bot on every screen. There is no setting that favours a bot; the engine does not have one.</Help>
            <Field label="Bot names" hint="Used in order for the bot seats.">
              <div className="space-y-1">
                {s.botNames.map((n, i) => (
                  <div key={i} className="flex gap-1">
                    <input className="w-full max-w-xs rounded-md border border-line bg-paper px-2 py-1 text-sm" value={n} onChange={(e) => setS({ botNames: s.botNames.map((x, k) => (k === i ? e.target.value : x)) })} />
                    <Button kind="ghost" onClick={() => setS({ botNames: s.botNames.filter((_, k) => k !== i) })} title="Remove">
                      <Icon name="ph:x" size={14} />
                    </Button>
                  </div>
                ))}
                <Button kind="ghost" onClick={() => setS({ botNames: [...s.botNames, `Bot ${s.botNames.length + 1}`] })}>
                  <Icon name="ph:plus" size={14} /> Add a bot
                </Button>
              </div>
            </Field>
          </div>
        </Card>
      ),
    },
    {
      id: "sponsored",
      label: "Sponsored",
      icon: "ph:gift",
      badge: s.sponsored.enabled ? <span className="ml-auto rounded-full bg-warn px-1.5 text-[10px] text-white">on</span> : undefined,
      content: (
        <Card title="Sponsored battles">
          <div className="space-y-3">
            <Toggle checked={s.sponsored.enabled} onChange={(v) => setS({ sponsored: { ...s.sponsored, enabled: v } })} label="New battles are sponsored" hint="The house pays every entry (one battle-sponsor ledger entry); players join free; the pot is real and the winner is paid as usual." />
            <Field label="Sponsor shown on the battle" hint="Appears as 'Sponsored by …' on the lobby and the battle page.">
              <input className="w-full max-w-xs rounded-md border border-line bg-paper px-2 py-1 text-sm" value={s.sponsored.sponsor} onChange={(e) => setS({ sponsored: { ...s.sponsored, sponsor: e.target.value } })} />
            </Field>
            <Help>In the real product the admin creates a sponsored battle from this panel, for a stream or a promotion. A promo code that gives a free battle is a credit voucher limited to battle entries and belongs to the promo module.</Help>
          </div>
        </Card>
      ),
    },
    {
      id: "battles",
      label: "Battles & report",
      icon: "ph:table",
      badge: records.length ? <span className="ml-auto rounded-full bg-ink-3/40 px-1.5 text-[10px] text-white">{records.length}</span> : undefined,
      content: (
        <div className="space-y-4">
          <Card title="Report: battles and GGR per mode" actions={<Info>Gross gaming revenue = what players paid in minus what players took home (credit and items at listed value). Bot seats and sponsored seats are not player money. The kit&apos;s view battle_daily_report does the same arithmetic per day.</Info>}>
            {report.length ? (
              <div className="tbl">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <Th>Mode</Th>
                      <Th right>Battles</Th>
                      <Th right>Sponsored</Th>
                      <Th right>With bots</Th>
                      <Th right>Player entries</Th>
                      <Th right>Paid to players</Th>
                      <Th right>Fee</Th>
                      <Th right>GGR</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.map(([m, r]) => (
                      <tr key={m} className="border-t border-line">
                        <Td>{m}</Td>
                        <Td right mono>{num(r.battles)}</Td>
                        <Td right mono>{num(r.sponsored)}</Td>
                        <Td right mono>{num(r.withBots)}</Td>
                        <Td right mono>{cents(r.entries)}</Td>
                        <Td right mono>{cents(r.paid)}</Td>
                        <Td right mono>{cents(r.fee)}</Td>
                        <Td right mono>
                          <span className={r.entries - r.paid >= 0 ? "text-good" : "text-bad"}>{cents(r.entries - r.paid)}</span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-2">No settled battles in this session yet. Play one and it appears here, as it would in the admin dashboard.</p>
            )}
          </Card>
          <Card title={`Battles this session (${records.length})`}>
            {records.length ? (
              <div className="tbl">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <Th>id</Th>
                      <Th>mode</Th>
                      <Th right>seats</Th>
                      <Th right>bots</Th>
                      <Th>status</Th>
                      <Th>winner</Th>
                      <Th right>pot</Th>
                      <Th right>player entries</Th>
                      <Th right>paid</Th>
                      <Th>settled</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...records].reverse().map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <Td mono>{r.id}</Td>
                        <Td>
                          {r.mode}
                          {r.sponsored ? " · sponsored" : ""}
                        </Td>
                        <Td right mono>{r.seats}</Td>
                        <Td right mono>{r.bots}</Td>
                        <Td>
                          <Badge tone="good">finished</Badge>
                        </Td>
                        <Td>{r.winnerName}</Td>
                        <Td right mono>{cents(r.potCents)}</Td>
                        <Td right mono>{cents(r.playerEntriesCents)}</Td>
                        <Td right mono>{cents(r.playerPaidCents)}</Td>
                        <Td mono>{r.settledAt}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-2">The admin&apos;s battle list: every battle with its status, seats, result and times. Running battles would show as in_progress here.</p>
            )}
          </Card>
        </div>
      ),
    },
  ];

  return (
    <>
      <LabFrame doc={variant.doc} featureKey={variant.key} lab={variant.lab} operator={operator} rigCount={0} onSettings={openSettings} settingsOpen={settings.open} chips={[]}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
          <Link href="/docs/battles" className="btn no-underline">
            <Icon name="ph:book-open-text" size={16} /> Document
          </Link>
          <button type="button" className="btn" onClick={() => openSettings("settings")}>
            <Icon name="ph:sliders-horizontal" size={16} /> Admin panel
          </button>
          <Link href="/docs/battles/dev" className="btn no-underline">
            <Icon name="ph:file-code" size={16} /> Developer document
          </Link>
        </div>

        {s.enabled && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-2">Create a battle</h2>
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mode" hint={KIT_BATTLE_MODES.find((m) => m.id === cfg.play.mode)?.rule}>
                  <div className="flex flex-wrap gap-1">
                    {s.modesAllowed.map((m: BattleMode) => (
                      <button key={m} type="button" className={`chip ${cfg.play.mode === m ? "chip-accent" : ""}`} onClick={() => setPlay({ mode: m })}>
                        {KIT_BATTLE_MODES.find((x) => x.id === m)?.name ?? m}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Seats" hint={coin ? "Coinflip is always two seats." : "How many seats the battle has, from the admin's list."}>
                  <div className="flex flex-wrap gap-1">
                    {(coin ? [2] : s.seatsAllowed).map((n) => (
                      <button key={n} type="button" className={`chip ${cfg.play.seats === n ? "chip-accent" : ""}`} onClick={() => setPlay({ seats: n })} disabled={coin}>
                        {n}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={coin ? "Stake: the box price stands in" : `Rounds (${cfg.play.rounds.length} of ${s.roundsMax})`} hint={coin ? "No boxes are opened in a coinflip; the first box's price is the stake." : "Each round every seat opens the same box. Tap a box below to add it as the next round; tap a round to remove it."}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {cfg.play.rounds.map((bi, i) => (
                        <button key={i} type="button" className="chip chip-accent" onClick={() => setPlay({ rounds: cfg.play.rounds.filter((_, k) => k !== i) })} title="Remove this round" disabled={coin || cfg.play.rounds.length <= 1}>
                          {i + 1}. {shortName(cfg.boxes[bi])} · {money(cfg.boxes[bi].price)} <Icon name="ph:x" size={10} />
                        </button>
                      ))}
                    </div>
                    {!coin && (
                      <div className="flex flex-wrap gap-1">
                        {prepared.map((p, i) => (
                          <button key={i} type="button" className="chip" onClick={() => setPlay({ rounds: [...cfg.play.rounds, i] })} disabled={cfg.play.rounds.length >= s.roundsMax}>
                            <Icon name="ph:plus" size={10} /> {shortName(p.box)} · {money(p.box.price)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Who sits down" hint={s.botsEnabled ? "Real players take the first seats; the rest are filled by bots when you ask. Bots are labelled and play the same odds." : "Bots are off in the admin panel, so every seat is a real player."}>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.botsEnabled ? (
                      <>
                        <span className="text-xs text-ink-2">real players</span>
                        <NumberInput value={cfg.play.humans} min={1} max={coin ? 2 : cfg.play.seats} step={1} onChange={(v) => setPlay({ humans: v })} />
                        <Badge>{(coin ? 2 : cfg.play.seats) - Math.min(coin ? 2 : cfg.play.seats, cfg.play.humans)} bots</Badge>
                      </>
                    ) : (
                      <Badge>{coin ? 2 : cfg.play.seats} real players</Badge>
                    )}
                    <Badge tone="accent">
                      entry {cents(entry.entryCents)} per seat{entry.feeCents ? ` (incl. ${cents(entry.feeCents)} fee)` : ""}
                    </Badge>
                    {s.sponsored.enabled && <Badge tone="warn">sponsored: players pay nothing</Badge>}
                  </div>
                </Field>
              </div>
            </Card>
          </div>
        )}

        {s.enabled && !coin && distinctChosen.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-2">Box content and odds</h2>
            <div className="space-y-2">
              {distinctChosen.map((p) => (
                <details key={p.round.slug} className="acc">
                  <summary>
                    {shortName(p.box)} · {money(p.box.price)}
                    <Badge tone={p.ret > 1 ? "bad" : "good"}>pays back {pct(p.ret, 1)}</Badge>
                    <span className="text-xs font-normal text-ink-3">{p.round.table.entries.length} items · table hash {p.round.table.hash.slice(0, 12)}…</span>
                  </summary>
                  <div className="tbl pt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <Th>Item</Th>
                          <Th right>Chance</Th>
                          <Th right>One in</Th>
                          <Th right>Value</Th>
                          <Th right>Costs per open</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...p.round.table.entries]
                          .sort((a, b) => (b.outcome.valueUsd ?? 0) - (a.outcome.valueUsd ?? 0))
                          .map((e) => {
                            const item = p.pool.find((x) => x.item.id === e.outcome.id)?.item;
                            return (
                              <tr key={e.outcome.id} className="border-t border-line">
                                <Td>
                                  <span className="flex items-center gap-2">
                                    {item && <ItemTile item={item} size={24} />}
                                    {e.outcome.label}
                                  </span>
                                </Td>
                                <Td right mono>{e.percent >= 1 ? e.percent.toFixed(2) : e.percent.toFixed(3)}%</Td>
                                <Td right mono>{e.percent > 0 ? num(Math.round(100 / e.percent)) : "never"}</Td>
                                <Td right mono>{money(e.outcome.valueUsd ?? 0)}</Td>
                                <Td right mono>{money(((e.outcome.valueUsd ?? 0) * e.percent) / 100, 2)}</Td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-ink font-semibold">
                          <Td>Pays back per open</Td>
                          <Td right mono>{p.round.table.total.toFixed(1)}%</Td>
                          <Td right> </Td>
                          <Td right> </Td>
                          <Td right mono>{cents(Math.round(p.evCents))}</Td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        <KitBattleStage cfg={cfg} onSettings={openSettings} onRecord={(r) => setRecords((xs) => [...xs, r])} />
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title={`${operator} · Battles · admin panel`}
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => setCfg(clone(initial))}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset
            </Button>
            <span className="ml-auto text-xs text-ink-3">changes apply to new battles only</span>
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={sections}
      />
    </>
  );
}
