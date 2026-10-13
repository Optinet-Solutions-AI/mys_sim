"use client";
import { useEffect } from "react";
import { Icon } from "../Icon";

export function GuideModal({ open, onClose, title, icon, bullets, extra }: { open: boolean; onClose: () => void; title: string; icon: string; bullets: string[]; extra?: { title: string; text: string }[] }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[90vh] w-[min(760px,100%)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name={icon} size={22} className="text-accent-ink" />
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="btn btn-icon ml-auto" onClick={onClose} aria-label="Close">
            <Icon name="ph:x" size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ul className="space-y-2 text-sm leading-relaxed">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {extra && extra.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <dl className="grid gap-2 md:grid-cols-2">
                {extra.map((e) => (
                  <div key={e.title} className="rounded-lg border border-line bg-paper p-3 text-xs">
                    <dt className="font-semibold">{e.title}</dt>
                    <dd className="mt-1 text-ink-2">{e.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
