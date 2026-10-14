"use client";
import { useState, type CSSProperties } from "react";
import { OPERATOR_BY_ID, type FeatureDef } from "@/lib/operators";
import { skinFor } from "@/lib/skins";
import { Icon } from "./Icon";
import { Badge, Card, Info } from "./ui";
import { SkinProvider } from "./lab/SkinContext";
import { MysteryBoxLab } from "./labs/MysteryBoxLab";
import { SellbackLab } from "./labs/SellbackLab";
import { BattlesLab } from "./labs/BattlesLab";
import { RetentionLab } from "./labs/RetentionLab";
import { CreditsLab } from "./labs/CreditsLab";
import { UpgraderLab } from "./labs/UpgraderLab";
import { MistyLab } from "./labs/MistyLab";
import { JemlitLab } from "./labs/JemlitLab";
import { JemlitGamesLab } from "./labs/JemlitGamesLab";

function FeatureLab({ feature, operator }: { feature: FeatureDef; operator: string }) {
  switch (feature.lab) {
    case "mystery-box":
      return <MysteryBoxLab variant={feature} operator={operator} />;
    case "sellback":
      return <SellbackLab variant={feature} operator={operator} />;
    case "battles":
      return <BattlesLab variant={feature} operator={operator} />;
    case "retention":
      return <RetentionLab variant={feature} operator={operator} />;
    case "credits":
      return <CreditsLab variant={feature} operator={operator} />;
    case "misty":
      return <MistyLab variant={feature} operator={operator} />;
    case "jemlit":
      return <JemlitLab variant={feature} operator={operator} />;
    case "jemlit-games":
      return <JemlitGamesLab variant={feature} operator={operator} />;
    case "upgrader":
      return <UpgraderLab variant={feature} operator={operator} />;
  }
}

/** One source, in its own look, its features as tabs. Each feature is an isolated lab with its own structure and presets. */
export function OperatorHub({ id }: { id: string }) {
  const op = OPERATOR_BY_ID.get(id);
  const [key, setKey] = useState(op?.features[0]?.key ?? "");
  if (!op) return <Card>Unknown source.</Card>;
  const skin = skinFor(op.id);
  const feature = op.features.find((f) => f.key === key) ?? op.features[0];
  const kind = op.kind === "operator" ? "operator" : op.kind === "ours" ? "our design" : op.kind === "adjacent" ? "adjacent models" : "research";
  return (
    <SkinProvider skin={skin}>
      <div className={`op-skin -mx-5 -my-6 min-h-screen px-5 py-6 md:-mx-8 md:px-8 ${skin.font === "serif" ? "op-serif" : ""}`} style={skin.vars as CSSProperties} data-skin={skin.id}>
        <div className="space-y-4">
          <header className="op-banner flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface shadow-sm">
              <Icon name={op.icon} size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-semibold">{op.name}</span>
                <Badge>{kind}</Badge>
                <Info>
                  {op.description}
                  <div className="mt-1 opacity-80">
                    <b>Sources:</b> {op.sources}
                  </div>
                  <div className="mt-1 opacity-80">
                    <b>Look:</b> {skin.tagline}. Inspired by the public product; no logos or assets are copied.
                  </div>
                </Info>
              </div>
              {op.tagline && <div className="text-xs text-ink-2">{op.tagline}</div>}
            </div>
          </header>
          <nav className="flex flex-wrap gap-1 border-b border-line">
            {op.features.map((f) => (
              <button key={f.key} type="button" onClick={() => setKey(f.key)} data-tip={f.doc.short} data-tip-below="" className={`-mb-px border-b-2 px-3 py-2 text-sm ${feature.key === f.key ? "border-accent font-medium text-accent-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
                {f.doc.title}
              </button>
            ))}
          </nav>
          <div key={feature.key}>
            <FeatureLab feature={feature} operator={op.name} />
          </div>
        </div>
      </div>
    </SkinProvider>
  );
}
