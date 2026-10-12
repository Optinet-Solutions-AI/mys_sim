"use client";
import { useState } from "react";
import { OPERATOR_BY_ID, type FeatureDef } from "@/lib/operators";
import { Icon } from "./Icon";
import { Badge, Card, Info } from "./ui";
import { MysteryBoxLab } from "./labs/MysteryBoxLab";
import { SellbackLab } from "./labs/SellbackLab";
import { BattlesLab } from "./labs/BattlesLab";
import { RetentionLab } from "./labs/RetentionLab";
import { CreditsLab } from "./labs/CreditsLab";
import { UpgraderLab } from "./labs/UpgraderLab";

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
    case "upgrader":
      return <UpgraderLab variant={feature} operator={operator} />;
  }
}

/** One source, its features as tabs. Each feature is its own isolated lab with its own structure and presets. */
export function OperatorHub({ id }: { id: string }) {
  const op = OPERATOR_BY_ID.get(id);
  const [key, setKey] = useState(op?.features[0]?.key ?? "");
  if (!op) return <Card>Unknown source.</Card>;
  const feature = op.features.find((f) => f.key === key) ?? op.features[0];
  const kind = op.kind === "operator" ? "operator" : op.kind === "ours" ? "our design" : op.kind === "adjacent" ? "adjacent models" : "research";
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <Icon name={op.icon} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{op.name}</span>
            <Badge>{kind}</Badge>
            <Info>
              {op.description}
              <div className="mt-1 opacity-80">
                <b>Sources:</b> {op.sources}
              </div>
            </Info>
          </div>
          <div className="text-xs text-ink-2">{op.tagline}</div>
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
  );
}
