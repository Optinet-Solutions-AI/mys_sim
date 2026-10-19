"use client";
import { useEffect, useState } from "react";
import type { BattleMode, KitBattlesConfig } from "@/engine/types";
import { KIT_BATTLE_MODES, battleCommit, resolveBattle } from "@/engine/labs/battleKit";
import { randomHex } from "@/engine/hash";
import { entryOf, kitMode, type PreparedRound } from "@/lib/kitBattles";
import { money } from "@/lib/format";
import { Icon } from "../Icon";
import { Badge, Card, Info } from "../ui";
import { SIM_NAMES, type JoinedRoom, type LobbySeat } from "../stages/KitBattleStage";

/**
 * The battles lobby as a player sees it: rooms other people opened, seats filling, rooms playing and settling.
 * In the simulator the other people are simulated; on the main site they are real users and this list comes from
 * GET /v1/battles with live updates from the events stream.
 */

export interface LobbyRoom {
  id: string;
  createdAt: number;
  creator: string;
  mode: BattleMode;
  rounds: number[];
  seats: LobbySeat[];
  serverSeed: string;
  serverHash: string;
  status: "open" | "in_progress" | "finished";
  /** set when the room fills: the creator asked bots, or players came */
  changedAt: number;
  /** a creator who will ask bots after waiting a while */
  willAskBots: boolean;
  result?: { winner: string; potCents: number };
}

const cents = (c: number) => money(c / 100);
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const ago = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))}s ago` : `${Math.round(ms / 60_000)} min ago`);

function freeName(taken: string[]): string {
  const left = SIM_NAMES.filter((n) => !taken.includes(n));
  return left.length ? pick(left) : `Player ${taken.length + 1}`;
}

/** A new room within the admin's limits, opened by a simulated player. */
export function makeRoom(cfg: KitBattlesConfig, now: number, prefill = 0): LobbyRoom {
  const s = cfg.settings;
  const modes = s.modesAllowed.length ? s.modesAllowed : (["normal"] as BattleMode[]);
  const mode = pick(modes);
  const coin = mode === "coinflip";
  const seatsN = coin ? 2 : pick(s.seatsAllowed.length ? s.seatsAllowed : [2]);
  const nRounds = coin ? 1 : 1 + Math.floor(Math.random() * Math.min(4, Math.max(1, s.roundsMax)));
  const rounds = Array.from({ length: nRounds }, () => Math.floor(Math.random() * cfg.boxes.length));
  const creator = pick(SIM_NAMES);
  const seats: LobbySeat[] = Array.from({ length: seatsN }, (_, i) => ({ kind: "player", name: i === 0 ? creator : "", joined: i === 0 }));
  for (let i = 1; i <= Math.min(prefill, seatsN - 2); i++) seats[i] = { kind: "player", name: freeName(seats.map((x) => x.name)), joined: true };
  const serverSeed = randomHex(32);
  return { id: randomHex(6), createdAt: now - prefill * 9000, creator, mode, rounds, seats, serverSeed, serverHash: battleCommit(serverSeed), status: "open", changedAt: now, willAskBots: s.botsEnabled && Math.random() < 0.5 };
}

function resolveRoom(r: LobbyRoom, prepared: PreparedRound[], cfg: KitBattlesConfig): LobbyRoom["result"] {
  const res = resolveBattle(
    kitMode(r.mode),
    r.rounds.map((i) => prepared[i].round),
    r.seats.map((_, i) => ({ seat: i, clientSeed: `seat-${i}-${randomHex(4)}` })),
    r.serverSeed,
    { coinflipEdge: cfg.settings.coinflipEdge, creditFaceCents: cfg.settings.creditFaceCents },
  );
  const winner = r.mode === "group" ? "split between everyone" : r.mode === "break" ? "everyone keeps their pulls" : `${r.seats[res.winners[0]].name}${r.seats[res.winners[0]].kind === "bot" ? " (bot)" : ""}`;
  return { winner, potCents: res.potCents };
}

/** One step of the lobby: players join, creators ask bots, full rooms play and settle, settled rooms leave, new rooms open. */
export function evolveRooms(rooms: LobbyRoom[], cfg: KitBattlesConfig, prepared: PreparedRound[], now: number): LobbyRoom[] {
  const s = cfg.settings;
  let out = rooms
    .map((r): LobbyRoom => {
      if (r.status === "open") {
        const free = r.seats.findIndex((x) => !x.joined);
        if (free < 0) return { ...r, status: "in_progress", changedAt: now, result: resolveRoom(r, prepared, cfg) };
        if (r.willAskBots && now - r.createdAt > 14_000) {
          const names = s.botNames.length ? s.botNames : ["Bot"];
          let b = 0;
          return { ...r, seats: r.seats.map((x) => (x.joined ? x : { kind: "bot", name: names[b++ % names.length], joined: true })), changedAt: now };
        }
        if (Math.random() < 0.28) return { ...r, seats: r.seats.map((x, i) => (i === free ? { kind: "player", name: freeName(r.seats.map((y) => y.name)), joined: true } : x)), changedAt: now };
        return r;
      }
      if (r.status === "in_progress" && now - r.changedAt > 7000) return { ...r, status: "finished", changedAt: now };
      return r;
    })
    .filter((r) => !(r.status === "finished" && now - r.changedAt > 12_000));
  const waiting = out.filter((r) => r.status === "open").length;
  if (waiting < 4 && s.enabled && cfg.boxes.length) out = [makeRoom(cfg, now), ...out];
  return out;
}

export function BattleLobby({
  cfg,
  prepared,
  rooms,
  stats,
  onJoin,
  onCreate,
}: {
  cfg: KitBattlesConfig;
  prepared: PreparedRound[];
  rooms: LobbyRoom[];
  stats: { battles: number; wins: number; spent: number; won: number };
  onJoin: (room: LobbyRoom) => void;
  onCreate: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = cfg.settings;
  const order = { open: 0, in_progress: 1, finished: 2 } as const;
  const sorted = [...rooms].sort((a, b) => order[a.status] - order[b.status] || b.createdAt - a.createdAt);
  const name = (m: BattleMode) => KIT_BATTLE_MODES.find((x) => x.id === m)?.name ?? m;

  if (!s.enabled) {
    return (
      <Card title="Battles are switched off">
        <p className="text-sm text-ink-2">The admin panel has battles turned off, so the lobby is closed.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Battles lobby</h2>
        <Info>
          Rooms other people opened. Join a free seat and your entry is held; the room starts when every seat is taken. In the simulator the other people are simulated players; on the main site they are real users and this list comes from the server.
        </Info>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs text-ink-2">
          <span>
            your battles <b className="tabular-nums">{stats.battles}</b>
          </span>
          <span>
            won <b className="tabular-nums">{stats.wins}</b>
          </span>
          <span>
            spent <b className="tabular-nums">{cents(stats.spent)}</b>
          </span>
          <span>
            took home <b className={`tabular-nums ${stats.won < stats.spent && stats.battles > 2 ? "text-bad" : ""}`}>{cents(stats.won)}</b>
          </span>
        </span>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          <Icon name="ph:plus" size={16} className="text-white" /> Create battle
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((r) => {
          const rounds = r.rounds.map((i) => prepared[i]).filter(Boolean);
          const { entryCents } = entryOf(rounds.map((p) => p.round), s.feePercent);
          const taken = r.seats.filter((x) => x.joined).length;
          const coin = r.mode === "coinflip";
          const tone = r.status === "open" ? "neutral" : r.status === "in_progress" ? "accent" : "good";
          const word = r.status === "open" ? `Waiting · ${taken}/${r.seats.length}` : r.status === "in_progress" ? "Ongoing" : "Settled";
          return (
            <div key={r.id} className={`rounded-xl border p-3 transition ${r.status === "open" ? "border-line bg-paper" : "border-line bg-paper/60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Icon name={coin ? "fluent:coin" : "fluent:trophy"} size={24} />
                <span className="font-semibold">{name(r.mode)}</span>
                <Badge tone={tone}>{word}</Badge>
                <span className="ml-auto text-[11px] text-ink-3">
                  {r.creator} · {ago(now - r.createdAt)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {coin ? (
                  <span className="chip">stake {cents(rounds[0]?.round.priceCents ?? 0)}</span>
                ) : (
                  rounds.map((p, i) => (
                    <span key={i} className="chip" title={`table hash ${p.round.table.hash}`}>
                      <Icon name="ph:package" size={11} /> {p.box.name.split(" · ")[0]} · {money(p.box.price)}
                    </span>
                  ))
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                {r.seats.map((x, i) => (
                  <div key={i} className="flex w-14 flex-col items-center gap-0.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${!x.joined ? "border border-dashed border-line" : x.kind === "bot" ? "bg-ink-3/20" : "bg-accent-soft"}`}>
                      {x.joined ? <Icon name={x.kind === "bot" ? "ph:robot" : "ph:user"} size={18} className={x.kind === "bot" ? "text-ink-2" : "text-accent-ink"} /> : <Icon name="ph:plus" size={14} className="text-ink-3" />}
                    </span>
                    <span className="w-full truncate text-center text-[10px] text-ink-3">{x.joined ? x.name : "free"}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                <div className="text-xs">
                  <div className="text-ink-3">entry per seat</div>
                  <div className="font-semibold tabular-nums">{cents(entryCents)}</div>
                </div>
                <div className="min-w-0 text-[11px] text-ink-3">
                  <Icon name="ph:lock-key" size={12} /> <code className="font-mono">{r.serverHash.slice(0, 10)}…</code>
                </div>
                <span className="ml-auto" />
                {r.status === "open" ? (
                  <button type="button" className="btn btn-primary" onClick={() => onJoin(r)} disabled={taken >= r.seats.length}>
                    <Icon name="ph:users-three" size={16} className="text-white" /> Join · {cents(entryCents)}
                  </button>
                ) : r.status === "in_progress" ? (
                  <span className="flex items-center gap-1 text-xs text-accent-ink">
                    <Icon name="ph:timer" size={14} /> rounds playing…
                  </span>
                ) : (
                  <span className="text-xs">
                    <Icon name="ph:crown" size={14} className="text-warn" /> {r.result?.winner} · pot {cents(r.result?.potCents ?? 0)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
