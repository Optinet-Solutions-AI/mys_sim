"use client";
import { useState, type ReactNode } from "react";
import type { LabId } from "@/engine/types";
import { LAB_DOCS } from "@/lib/labDocs";
import { Badge, Card } from "./ui";

export function LabShell({
  lab,
  configure,
  run,
  results,
  hasResults,
}: {
  lab: LabId;
  configure: ReactNode;
  run: ReactNode;
  results: ReactNode;
  hasResults: boolean;
}) {
  const doc = LAB_DOCS[lab];
  const [tab, setTab] = useState<"configure" | "results" | "docs">("configure");
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "configure", label: "Configure & run" },
    { id: "results", label: hasResults ? "Results" : "Results (run first)" },
    { id: "docs", label: "How this lab works" },
  ];
  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <Badge tone="accent">{doc.wave}</Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">{doc.what}</p>
      </header>
      <nav className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-accent font-medium text-accent-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "configure" && (
        <div className="space-y-4">
          {configure}
          {run}
        </div>
      )}
      {tab === "results" && (hasResults ? results : <Card>No results yet. Configure the lab and run a simulation.</Card>)}
      {tab === "docs" && (
        <Card title={doc.title}>
          <div className="prose-sm max-w-3xl space-y-3 text-sm">
            <p>{doc.what}</p>
            <h3 className="font-semibold">What you configure</h3>
            <ul className="list-disc space-y-1 pl-5">
              {doc.configure.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <h3 className="font-semibold">What you read</h3>
            <ul className="list-disc space-y-1 pl-5">
              {doc.read.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="text-xs text-ink-3">
              <b>Source:</b> {doc.source}
            </p>
            <p className="text-xs text-ink-3">Isolation: this lab&apos;s configuration and runs are stored under its own key and never read by another lab. Each run snapshots the box, the algorithm, the rigs and the catalogue items it used.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
