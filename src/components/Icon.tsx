import { ICONS } from "@/lib/icons.generated";

/** Inline SVG icon from the generated set. `name` like "fluent:watch" or "ph:dice-five". */
export function Icon({ name, size = 20, className = "", title }: { name: string; size?: number; className?: string; title?: string }) {
  const def = ICONS[name];
  if (!def) {
    return (
      <span className={`inline-block rounded bg-line ${className}`} style={{ width: size, height: size }} title={`missing icon ${name}`} />
    );
  }
  return (
    <svg
      viewBox={`0 0 ${def.w} ${def.h}`}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : "") + def.body }}
    />
  );
}
