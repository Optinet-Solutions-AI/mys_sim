"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { LabId } from "@/engine/types";
import { LAB_DOCS } from "@/lib/labDocs";
import { Icon } from "../Icon";
import { Badge, Card, Info } from "../ui";

export interface Chip {
  label: ReactNode;
  section?: string;
  tone?: "neutral" | "bad" | "accent";
  tip?: string;
}

/** Page frame for a lab: title, the cog (header and floating), summary chips, help on demand, then the stage. */
export function LabFrame({ lab, chips, onSettings, rigCount, settingsOpen, children }: { lab: LabId; chips: Chip[]; onSettings: (section?: string) => void; rigCount: number; settingsOpen: boolean; children: ReactNode }) {
  const doc = LAB_DOCS[lab];
  const [help, setHelp] = useState(false);
  const badge = rigCount > 0 ? <span className="cog-badge">{rigCount}</span> : null;
  return (
    <div className="space-y-4 pb-20">
      <header className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <Badge tone="accent">{doc.wave}</Badge>
          <Info size={16}>{doc.what}</Info>
        </div>
        <button type="button" className={`btn btn-icon rounded-full ${help ? "border-accent text-accent-ink" : ""}`} data-tip="How this lab works" data-tip-end="" onClick={() => setHelp((h) => !h)} aria-label="How this lab works">
          <Icon name="ph:question" size={20} />
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
      {help && (
        <Card
          title={`How ${doc.title} works`}
          actions={
            <Link href="/docs" className="text-xs">
              Full docs
            </Link>
          }
        >
          <p className="mb-3 text-sm text-ink-2">{doc.what}</p>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <h3 className="mb-1 font-semibold">Settings (cog)</h3>
              <ul className="list-disc space-y-1 pl-5">
                {doc.configure.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">Results</h3>
              <ul className="list-disc space-y-1 pl-5">
                {doc.read.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            <b>Source:</b> {doc.source}
          </p>
        </Card>
      )}
      {children}
      {!settingsOpen && (
        <button type="button" className="fab" data-tip="Settings" data-tip-end="" onClick={() => onSettings()} aria-label="Settings">
          <Icon name="ph:gear-six" size={30} className="text-white" />
          {badge}
        </button>
      )}
    </div>
  );
}
