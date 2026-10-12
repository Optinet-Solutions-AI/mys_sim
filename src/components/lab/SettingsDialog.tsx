"use client";
import { useEffect, type ReactNode } from "react";
import { Icon } from "../Icon";
import { Info } from "../ui";

export interface SettingsSection {
  id: string;
  label: string;
  icon: string;
  content: ReactNode;
  badge?: ReactNode;
}

/** The cog dialog: every setting of a lab, in sections. Changes apply immediately to the lab's own state. */
export function SettingsDialog({
  open,
  onClose,
  title,
  sections,
  active,
  onActive,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: SettingsSection[];
  active: string;
  onActive: (id: string) => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const current = sections.find((s) => s.id === active) ?? sections[0];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-2 md:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="flex h-[min(900px,96vh)] w-[min(1200px,100%)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Icon name="ph:gear-six" size={20} className="text-accent-ink" />
          <h2 className="text-base font-semibold">{title}</h2>
          <Info>Changes apply immediately and affect only this lab. Live opens restart with a fresh session when settings change.</Info>
          <button type="button" className="btn btn-icon ml-auto" onClick={onClose} aria-label="Close settings">
            <Icon name="ph:x" size={18} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-paper p-2 md:w-56 md:flex-col md:border-b-0 md:border-r">
            {sections.map((s) => {
              const on = s.id === current.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onActive(s.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${on ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface"}`}
                >
                  <Icon name={s.icon} size={16} className={on ? "text-accent-ink" : "text-ink-3"} />
                  <span className="whitespace-nowrap">{s.label}</span>
                  {s.badge}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-3 md:p-4">{current.content}</div>
        </div>
        {footer && <footer className="flex items-center gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
