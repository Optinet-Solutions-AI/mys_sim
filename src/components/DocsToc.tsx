import Link from "next/link";

/** The contents box of a docs page: a collapsed "On this page" above the text on phones, a sticky rail beside it on wide screens. */
export function DocsToc({ toc, back, links = [] }: { toc: readonly (readonly [string, string])[]; back: { href: string; label: string }; links?: { href: string; label: string }[] }) {
  const list = (
    <ol className="space-y-1">
      {toc.map(([id, label]) => (
        <li key={id}>
          <a href={`#${id}`} className="block rounded px-1 py-1 text-ink-2 no-underline hover:bg-accent-soft hover:text-ink">
            {label}
          </a>
        </li>
      ))}
    </ol>
  );
  const extra = links.map((l) => (
    <Link key={l.href} href={l.href} className="mt-1 block text-accent-ink underline underline-offset-2">
      {l.label}
    </Link>
  ));
  return (
    <aside className="order-first mb-4 lg:order-none lg:mb-0">
      <details className="rounded-xl border border-line bg-paper p-3 text-sm lg:hidden">
        <summary className="cursor-pointer font-semibold">On this page</summary>
        <div className="mt-2 space-y-2">
          <Link href={back.href} className="btn w-full justify-center no-underline">
            {back.label}
          </Link>
          {list}
          {extra}
        </div>
      </details>
      <div className="hidden rounded-xl border border-line bg-paper p-3 text-xs lg:sticky lg:top-4 lg:block">
        <Link href={back.href} className="btn w-full justify-center no-underline">
          {back.label}
        </Link>
        <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-3">On this page</div>
        {list}
        {extra.length > 0 && <div className="mt-3">{extra}</div>}
      </div>
    </aside>
  );
}
