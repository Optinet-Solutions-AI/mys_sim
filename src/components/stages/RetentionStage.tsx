"use client";
import type { RetentionConfig } from "@/engine/types";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { Badge, Card } from "../ui";

/** Retention is a population experiment, so the stage shows "the offer" as a visitor sees it and the horizon the run covers. */
export function RetentionStage({ cfg, onSettings }: { cfg: RetentionConfig; onSettings: (section?: string) => void }) {
  const days = Math.max(1, Math.floor(cfg.days));
  const raceDay = (d: number) => cfg.race.enabled && (d + 1) % Math.max(1, cfg.race.cadenceDays) === 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Icon name="fluent:wrapped-gift" size={22} /> Daily free box {cfg.dailyBox.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}
            </span>
          }
          actions={<button type="button" className="chip" onClick={() => onSettings("incentives")}>edit</button>}
        >
          <p className="text-sm text-ink-2">
            One free box a day, worth {cfg.dailyBox.tierValues.map((v) => money(v)).join(" → ")} as the player climbs levels by wagering.
          </p>
          <p className="mt-1 text-xs text-ink-3">{cfg.dailyBox.expiry === "24h" ? "Expires after 24 hours and does not stack: miss a day, lose it. This is the vendor's rule." : "Stacks until claimed."}</p>
        </Card>
        <Card
          title={
            <span className="flex items-center gap-2">
              <Icon name="fluent:trophy" size={22} /> Wager races {cfg.race.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}
            </span>
          }
          actions={<button type="button" className="chip" onClick={() => onSettings("incentives")}>edit</button>}
        >
          <p className="text-sm text-ink-2">
            Every {cfg.race.cadenceDays} day{cfg.race.cadenceDays > 1 ? "s" : ""} the top wagerers win {cfg.race.prizes.map((v) => money(v)).join(" / ")}.
          </p>
          <p className="mt-1 text-xs text-ink-3">Leaderboards pay for volume, so the few who chase them wager far more than everyone else.</p>
        </Card>
        <Card
          title={
            <span className="flex items-center gap-2">
              <Icon name="ph:users" size={22} className="text-accent-ink" /> Invite a friend {cfg.affiliate.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}
            </span>
          }
          actions={<button type="button" className="chip" onClick={() => onSettings("incentives")}>edit</button>}
        >
          <p className="text-sm text-ink-2">
            {pct(cfg.affiliate.referredShare, 0)} of visitors arrive through a code, get {cfg.affiliate.freeBoxes} free box{cfg.affiliate.freeBoxes === 1 ? "" : "es"}, and the referrer earns {pct(cfg.affiliate.commission, 0)} of their deposits.
          </p>
        </Card>
      </div>

      <Card title={`The horizon: ${days} days for ${num(cfg.agents)} visitors`} actions={<button type="button" className="chip" onClick={() => onSettings("population")}>edit</button>}>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: Math.min(days, 90) }, (_, d) => (
            <div key={d} className={`flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[10px] ${raceDay(d) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-paper text-ink-3"}`} title={`day ${d + 1}${raceDay(d) ? " · race pays out" : ""}${cfg.dailyBox.enabled ? " · daily box" : ""}`}>
              <span>{d + 1}</span>
              <span className="flex gap-0.5">
                {cfg.dailyBox.enabled && <Icon name="ph:gift" size={10} />}
                {raceDay(d) && <Icon name="ph:trophy" size={10} />}
              </span>
            </div>
          ))}
          {days > 90 && <div className="self-center text-xs text-ink-3">… {days - 90} more days</div>}
        </div>
        <div className="mt-3 grid gap-2 text-xs text-ink-2 md:grid-cols-3">
          <div>
            <b>Visitor model (assumption):</b> comes back on {pct(cfg.visitor.baseVisit, 0)} of days, {pct(cfg.visitor.baseVisit + cfg.visitor.incentiveLift, 0)} when a free box is waiting, {pct(cfg.visitor.baseVisit + cfg.visitor.raceLift, 0)} when near the top of a race.
          </div>
          <div>
            Deposits {money(cfg.visitor.depositPerVisit)} and opens {cfg.visitor.opensPerVisit} boxes per visit; {pct(cfg.visitor.churnHazard, 0)} chance of leaving for good after a losing day.{" "}
            <button type="button" className="underline" onClick={() => onSettings("visitor")}>
              edit
            </button>
          </div>
          <div>Pressing Run simulates all visitors twice on the same seed: once with the incentives above and once with none. The difference is what the incentives buy and what they cost.</div>
        </div>
      </Card>
    </div>
  );
}
