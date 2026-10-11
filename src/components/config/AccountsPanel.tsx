"use client";
import type { AccountMix } from "@/engine/types";
import { Card, Help } from "../ui";

export function AccountsPanel({ accounts, onChange }: { accounts: AccountMix; onChange: (a: AccountMix) => void }) {
  const tags = accounts.tags.length ? accounts.tags : [{ tag: "player", share: 1 }];
  const set = (i: number, patch: Partial<{ tag: string; share: number }>) => {
    const next = tags.map((t, k) => (k === i ? { ...t, ...patch } : t));
    onChange({ tags: next });
  };
  return (
    <Card title="Accounts">
      <Help>Shares of opens by account tag. Tags only matter when a per-account rig targets one of them; the detector compares outcomes by tag.</Help>
      <div className="mt-2 space-y-2">
        {tags.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <input type="text" className="w-40" value={t.tag} onChange={(e) => set(i, { tag: e.target.value })} />
            <input type="range" min={0} max={1} step={0.01} value={t.share} onChange={(e) => set(i, { share: Number(e.target.value) })} className="w-40" />
            <span className="w-12 font-mono">{(t.share * 100).toFixed(0)}%</span>
            {tags.length > 1 && (
              <button type="button" className="text-bad" onClick={() => onChange({ tags: tags.filter((_, k) => k !== i) })}>
                remove
              </button>
            )}
          </div>
        ))}
        {tags.length < 4 && (
          <button type="button" className="text-xs text-accent-ink underline" onClick={() => onChange({ tags: [...tags, { tag: "streamer", share: 0.1 }] })}>
            Add a tag
          </button>
        )}
      </div>
    </Card>
  );
}
