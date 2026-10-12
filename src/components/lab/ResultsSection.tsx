"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "../Icon";

export function ResultsSection({ title, meta, stale, saved, onSave, onReport, children }: { title: string; meta: string; stale: boolean; saved: boolean; onSave: () => void; onReport: () => void; children: ReactNode }) {
  return (
    <section id="results" className="scroll-mt-4 space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-ink-3">{meta}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={onReport}>
            <Icon name="ph:file-text" size={16} /> Report .md
          </button>
          <button type="button" className="btn" disabled={saved} onClick={onSave}>
            <Icon name="ph:download-simple" size={16} /> {saved ? "Saved to history" : "Save to history"}
          </button>
          {saved && (
            <Link href="/runs" className="btn no-underline">
              <Icon name="ph:clock-counter-clockwise" size={16} /> Open history
            </Link>
          )}
        </div>
      </div>
      {stale && <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Settings changed since this run. Run the simulation again to refresh the results.</div>}
      {children}
    </section>
  );
}
