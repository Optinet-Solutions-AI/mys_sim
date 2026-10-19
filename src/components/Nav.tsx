"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OPERATORS } from "@/lib/operators";
import { Icon } from "./Icon";

const NAV_ICON: Record<string, string> = {
  vendor: "ph:storefront",
  icybox: "ph:watch",
  stockx: "ph:sneaker",
  courtyard: "ph:ticket",
  jemlit: "ph:cube",
  cases: "ph:dice-five",
  misty: "ph:handbag",
  glassbox: "ph:shield-check",
  adjacent: "ph:gift",
  presentation: "ph:sparkle",
};

const ORDER = ["misty", "jemlit", "icybox", "vendor"];
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

const groups: { label: string; items: { href: string; label: string; icon: string; external?: boolean }[] }[] = [
  {
    label: "Hub",
    items: [
      { href: "/", label: "Overview", icon: "ph:house" },
      { href: "/build", label: "Build your own box", icon: "ph:cube" },
      { href: "/simulate", label: "Simulator", icon: "ph:chart-bar" },
      { href: "/catalog", label: "Catalogue", icon: "ph:handbag" },
      { href: "/runs", label: "Run history", icon: "ph:clock-counter-clockwise" },
    ],
  },
  {
    label: "Operators",
    items: [...OPERATORS.filter((o) => o.kind === "operator")].sort((a, b) => rank(a.id) - rank(b.id)).map((o) => ({ href: `/operators/${o.id}`, label: o.name.replace(" Mystery Boxes", "").replace(" platform", ""), icon: NAV_ICON[o.id] ?? "ph:package" })),
  },
  {
    label: "Ours and others",
    items: OPERATORS.filter((o) => o.kind !== "operator").map((o) => ({ href: `/operators/${o.id}`, label: o.name, icon: NAV_ICON[o.id] ?? "ph:package" })),
  },
  {
    label: "Tools",
    items: [
      { href: "/verify", label: "Verifier", icon: "ph:seal-check" },
      { href: "/docs/features", label: "Feature report", icon: "ph:chart-bar" },
      { href: "/docs/misty", label: "Misty, explained", icon: "ph:book-open-text" },
      { href: "/docs/misty/dev", label: "Misty for developers", icon: "ph:file-code" },
      { href: "/docs/battles", label: "Battles, explained", icon: "ph:book-open-text" },
      { href: "/docs/battles/dev", label: "Battles for developers", icon: "ph:file-code" },
      { href: "/docs/jemlit", label: "Jemlit, explained", icon: "ph:book-open-text" },
      { href: "/docs/icybox", label: "IcyBox, explained", icon: "ph:book-open-text" },
      { href: "/docs", label: "Docs", icon: "ph:book-open-text" },
      { href: "/research/index.html", label: "Research documents", icon: "ph:folders", external: true },
    ],
  },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const logo = (
    <Link href="/" className="flex items-center gap-2 px-2 text-ink no-underline">
      <Icon name="fluent:package" size={28} />
      <div className="leading-tight">
        <div className="font-semibold">Box Simulator</div>
        <div className="text-xs text-ink-3">research sandbox · v0.3</div>
      </div>
    </Link>
  );
  const list = groups.map((g) => (
    <div key={g.label} className="mb-5">
      <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g.label}</div>
      <ul className="space-y-0.5">
        {g.items.map((it) => {
          const active = isActive(it.href);
          return (
            <li key={it.href}>
              {it.external ? (
                <a href={it.href} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-sm no-underline ${active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-paper"}`}>
                  <Icon name={it.icon} size={18} className={active ? "text-accent-ink" : "text-ink-3"} />
                  {it.label}
                </a>
              ) : (
                <Link href={it.href} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-sm no-underline ${active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-paper"}`}>
                  <Icon name={it.icon} size={18} className={active ? "text-accent-ink" : "text-ink-3"} />
                  {it.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  ));
  return (
    <>
      {/* phones: a top bar and a drawer */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 md:hidden">
        <button type="button" className="btn btn-icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="ph:list" size={22} />
        </button>
        <Link href="/" className="flex items-center gap-2 text-ink no-underline">
          <Icon name="fluent:package" size={24} />
          <span className="font-semibold">Box Simulator</span>
        </Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Dismiss menu" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto bg-surface px-3 py-3 shadow-2xl" aria-label="Site menu">
            <div className="mb-4 flex items-center justify-between">
              {logo}
              <button type="button" className="btn btn-icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <Icon name="ph:x" size={20} />
              </button>
            </div>
            {list}
          </nav>
        </div>
      )}
      {/* wide screens: the sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface px-4 py-6 md:block">
        <div className="mb-6">{logo}</div>
        {list}
      </aside>
    </>
  );
}
