"use client";
import { useState, type ReactNode } from "react";
import type { FeatureDoc } from "@/lib/operators";
import { GUIDES, GUIDE_BY_LAB, SETTINGS_PLAIN } from "@/lib/skins";
import type { LabId } from "@/engine/types";
import { Icon } from "../Icon";
import { Badge, Info } from "../ui";
import { GuideModal } from "./GuideModal";

export interface Chip {
  label: ReactNode;
  section?: string;
  tone?: "neutral" | "bad" | "accent";
  tip?: string;
}

/** Frame for one operator feature: title, two plain-language guides (player view, settings view), the cog, chips, then the stage. */
export function LabFrame({ doc, operator, featureKey, lab, chips, onSettings, rigCount, children }: { doc: FeatureDoc; operator: string; featureKey?: string; lab?: LabId; chips: Chip[]; onSettings: (section?: string) => void; rigCount: number; settingsOpen?: boolean; children: ReactNode }) {
  const [guide, setGuide] = useState<"player" | "settings" | null>(null);
  const g = (featureKey && GUIDES[featureKey]) || (lab && GUIDE_BY_LAB[lab]) || { player: [doc.what], settings: doc.configure };
  const badge = rigCount > 0 ? <span className="cog-badge">{rigCount}</span> : null;
  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <Badge tone="accent">{operator}</Badge>
          <Info size={16}>{doc.what}</Info>
        </div>
        <button type="button" className="btn rounded-full" data-tip="How this works for a player, in plain words" data-tip-end="" onClick={() => setGuide("player")}>
          <Icon name="ph:user" size={18} /> <span className="hidden sm:inline">Player view</span>
        </button>
        <button type="button" className="btn rounded-full" data-tip="What the settings and the algorithm mean, in plain words" data-tip-end="" onClick={() => setGuide("settings")}>
          <Icon name="ph:question" size={18} /> <span className="hidden sm:inline">Settings explained</span>
        </button>
        <button type="button" className="btn-cog" data-tip="Settings" data-tip-end="" onClick={() => onSettings()} aria-label="Settings">
          <Icon name="ph:gear-six" size={26} className="text-white" />
          {badge}
        </button>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <button key={i} type="button" className={`chip ${c.tone === "bad" ? "chip-bad" : c.tone === "accent" ? "chip-accent" : ""}`} data-tip={c.tip ?? "Open in settings"} data-tip-below="" onClick={() => onSettings(c.section)}>
            {c.label}
            <Icon name="ph:caret-right" size={11} />
          </button>
        ))}
      </div>
      {children}
      <GuideModal open={guide === "player"} onClose={() => setGuide(null)} title={`${operator} · ${doc.title}: how it works for a player`} icon="ph:user" bullets={g.player} extra={[{ title: "Source", text: doc.source }]} />
      <GuideModal open={guide === "settings"} onClose={() => setGuide(null)} title={`${operator} · ${doc.title}: the settings, explained`} icon="ph:gear-six" bullets={g.settings} extra={SETTINGS_PLAIN} />
    </div>
  );
}
