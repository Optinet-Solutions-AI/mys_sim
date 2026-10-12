"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const groups: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "Hub",
    items: [
      { href: "/", label: "Overview", icon: "ph:house" },
      { href: "/catalog", label: "Catalogue", icon: "ph:handbag" },
      { href: "/runs", label: "Run history", icon: "ph:clock-counter-clockwise" },
    ],
  },
  {
    label: "Labs · wave 1 (vendor)",
    items: [
      { href: "/labs/mystery-box", label: "Mystery Boxes", icon: "ph:package" },
      { href: "/labs/sellback", label: "Sell-back / Cart", icon: "ph:wallet" },
      { href: "/labs/battles", label: "Battles", icon: "ph:users-three" },
      { href: "/labs/retention", label: "Retention", icon: "ph:gift" },
    ],
  },
  {
    label: "Labs · wave 3 (Misty, Jemlit, Cases.gg)",
    items: [
      { href: "/labs/credits", label: "Credits & draws", icon: "ph:ticket" },
      { href: "/labs/upgrader", label: "Upgrader & Deals", icon: "ph:arrow-up-right" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/verify", label: "Verifier", icon: "ph:seal-check" },
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
          <div className="text-xs text-ink-3">research sandbox · v0.1</div>
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
      <div className="mt-8 px-2 text-[11px] leading-snug text-ink-3">
        Icons: Fluent Emoji (MIT) and Phosphor (MIT). No real money, no real players; every participant is a simulated agent.
      </div>
    </aside>
  );
}
