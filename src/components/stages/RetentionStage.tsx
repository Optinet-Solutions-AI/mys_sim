"use client";
import type { RetentionConfig } from "@/engine/types";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { Badge, Card, Info } from "../ui";

/** Retention is a population experiment: the stage shows the offer as a visitor sees it and the horizon the run covers. */
export function RetentionStage({ cfg, onSettings }: { cfg: RetentionConfig; onSettings: (section?: string) => void }) {
  const days = Math.max(1, Math.floor(cfg.days));
  const raceDay = (d: number) => cfg.race.enabled && (d + 1) % Math.max(1, cfg.race.cadenceDays) === 0;
  const V = cfg.visitor;
  const edit = (section: string) => (
    <button type="button" className="chip" onClick={() => onSettings(section)}>
      edit
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title={
            <>
              <Icon name="fluent:wrapped-gift" size={22} /> Daily box {cfg.dailyBox.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}
              <Info>One free box a day, worth more as the player climbs levels by wagering. {cfg.dailyBox.expiry === "24h" ? "It expires after 24 hours and does not stack: miss a day, lose it. This is the vendor's rule." : "It stacks until claimed."}</Info>
            </>
          }
          actions={edit("incentives")}
        >
          <div className="text-sm">{cfg.dailyBox.tierValues.map((v) => money(v)).join(" → ")}</div>
          <div className="text-xs text-ink-3">{cfg.dailyBox.expiry === "24h" ? "expires in 24 h" : "stacks"}</div>
        </Card>
        <Card
          title={
            <>
              <Icon name="fluent:trophy" size={22} /> Races {cfg.race.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}
              <Info>Leaderboards pay the top wagerers at each cadence. They pay for volume, so the few who chase them wager far more than everyone else.</Info>
            </>
          }
          actions={edit("incentives")}
        >
          <div className="text-sm">{cfg.race.prizes.map((v) => money(v)).join(" / ")}</div>
          <div className="text-xs text-ink-3">every {cfg.race.cadenceDays} day{cfg.race.cadenceDays > 1 ? "s" : ""}</div>
        </Card>
        <Card
          title={
            <>
              <Icon name="ph:users" size={22} className="text-accent-ink" /> Invite a friend {cfg.affiliate.enabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}
              <Info>A share of visitors arrive through a referral code, receive free boxes, and the referrer earns a commission on their deposits.</Info>
            </>
          }
          actions={edit("incentives")}
        >
          <div className="text-sm">
            {pct(cfg.affiliate.referredShare, 0)} referred · {cfg.affiliate.freeBoxes} free box{cfg.affiliate.freeBoxes === 1 ? "" : "es"}
          </div>
          <div className="text-xs text-ink-3">{pct(cfg.affiliate.commission, 0)} commission</div>
        </Card>
      </div>

      <Card
        title={
          <>
            {days} days · {num(cfg.agents)} visitors
            <Info>Pressing Run simulates every visitor twice on the same seed: once with the incentives above and once with none. The difference is what the incentives buy and what they cost.</Info>
          </>
        }
        actions={edit("population")}
      >
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: Math.min(days, 90) }, (_, d) => (
            <div key={d} className={`flex h-9 w-9 flex-col items-center justify-center rounded-md border text-[10px] ${raceDay(d) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-paper text-ink-3"}`} data-tip={`Day ${d + 1}${raceDay(d) ? " · race pays out" : ""}${cfg.dailyBox.enabled ? " · daily box" : ""}`}>
              <span>{d + 1}</span>
              <span className="flex gap-0.5">
                {cfg.dailyBox.enabled && <Icon name="ph:gift" size={10} />}
                {raceDay(d) && <Icon name="ph:trophy" size={10} />}
              </span>
            </div>
          ))}
          {days > 90 && <div className="self-center text-xs text-ink-3">… {days - 90} more days</div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-ink-3">
            Visitor model <Info>Assumptions, not data. Every number is editable in Settings → Visitor model.</Info>
          </span>
          <button type="button" className="chip" data-tip="Base probability that a visitor comes back on a given day" data-tip-below="" onClick={() => onSettings("visitor")}>
            visits {pct(V.baseVisit, 0)} of days
          </button>
          <button type="button" className="chip" data-tip="Added visit probability when a free box is waiting" data-tip-below="" onClick={() => onSettings("visitor")}>
            +{pct(V.incentiveLift, 0)} with a free box
          </button>
          <button type="button" className="chip" data-tip="Added visit probability when near the top of a race" data-tip-below="" onClick={() => onSettings("visitor")}>
            +{pct(V.raceLift, 0)} near a race top
          </button>
          <button type="button" className="chip" data-tip="Chance of leaving for good after a losing day" data-tip-below="" onClick={() => onSettings("visitor")}>
            {pct(V.churnHazard, 0)} churn after a loss
          </button>
          <button type="button" className="chip" data-tip="Deposit and opens on each visit" data-tip-below="" onClick={() => onSettings("visitor")}>
            {money(V.depositPerVisit)} · {V.opensPerVisit} opens per visit
          </button>
        </div>
      </Card>
    </div>
  );
}
