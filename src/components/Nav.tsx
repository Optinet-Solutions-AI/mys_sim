"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const groups: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "Hub",
    items: [
      { href: "/", label: "Overview", icon: "ph:house" },
      { href: "/build", label: "Build your own box", icon: "ph:cube" },
      { href: "/catalog", label: "Catalogue", icon: "ph:handbag" },
      { href: "/runs", label: "Run history", icon: "ph:clock-counter-clockwise" },
    ],
  },
  {
    label: "Operators",
    items: OPERATORS.filter((o) => o.kind === "operator").map((o) => ({ href: `/operators/${o.id}`, label: o.name.replace(" Mystery Boxes", "").replace(" platform", ""), icon: NAV_ICON[o.id] ?? "ph:package" })),
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
      { href: "/docs", label: "Docs", icon: "ph:book-open-text" },
    ],
  },
];

export function Nav() {
  const path = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-surface px-4 py-6 md:block">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-ink no-underline">
        <Icon name="fluent:package" size={28} />
        <div className="leading-tight">
          <div className="font-semibold">Box Simulator</div>
          <div className="text-xs text-ink-3">research sandbox · v0.3</div>
        </div>
      </Link>
      {groups.map((g) => (
        <div key={g.label} className="mb-5">
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g.label}</div>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm no-underline ${
                      active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-paper"
                    }`}
                  >
                    <Icon name={it.icon} size={18} className={active ? "text-accent-ink" : "text-ink-3"} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
