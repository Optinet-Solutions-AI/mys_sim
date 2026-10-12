"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { LabId } from "@/engine/types";
import { LAB_DOCS } from "@/lib/labDocs";
import { Icon } from "../Icon";
import { Badge, Card } from "../ui";

export interface Chip {
  label: ReactNode;
  section?: string;
  tone?: "neutral" | "bad" | "accent";
}

/** Page frame for a lab: title, the cog, summary chips, an optional help panel, then the stage. */
export function LabFrame({ lab, chips, onSettings, rigCount, children }: { lab: LabId; chips: Chip[]; onSettings: (section?: string) => void; rigCount: number; children: ReactNode }) {
  const doc = LAB_DOCS[lab];
  const [help, setHelp] = useState(false);
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            <Badge tone="accent">{doc.wave}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">{doc.what}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={`btn ${help ? "border-accent text-accent-ink" : ""}`} onClick={() => setHelp((h) => !h)} title="How this lab works">
            <Icon name="ph:question" size={18} /> How it works
          </button>
          <button type="button" className="btn btn-primary relative" onClick={() => onSettings()} title="Settings: items, algorithm, rigs, run size">
            <Icon name="ph:gear-six" size={18} className="text-white" /> Settings
            {rigCount > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-bad px-1.5 text-[10px] font-semibold text-white" title={`${rigCount} rig(s) active`}>{rigCount}</span>}
          </button>
        </div>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <button key={i} type="button" className={`chip ${c.tone === "bad" ? "chip-bad" : c.tone === "accent" ? "chip-accent" : ""}`} onClick={() => onSettings(c.section)} title="Open in settings">
            {c.label}
            <Icon name="ph:caret-right" size={11} />
          </button>
        ))}
      </div>
      {help && (
        <Card title={`How ${doc.title} works`} actions={<Link href="/docs" className="text-xs">Full docs</Link>}>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <h3 className="mb-1 font-semibold">What you configure (cog)</h3>
              <ul className="list-disc space-y-1 pl-5">
                {doc.configure.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">What you read (results)</h3>
              <ul className="list-disc space-y-1 pl-5">
                {doc.read.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            <b>Source:</b> {doc.source} · Live opens on this page use the same engine, rigs and verifier as the simulation; only the pace differs.
          </p>
        </Card>
      )}
      {children}
    </div>
  );
}
