"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * An info icon whose explanation appears on hover, focus or tap. The popover is positioned fixed, below the icon
 * when there is room and above otherwise, clamped to the viewport, so it is never cut off by a card edge, a scrolling
 * table or the top of the page.
 */
export function Info({ children, size = 14, className = "" }: { children: ReactNode; align?: "left" | "right" | "center"; size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: -9999, left: 0 });

  useLayoutEffect(() => {
    if (!open || !ref.current || !pop.current) return;
    const r = ref.current.getBoundingClientRect();
    const p = pop.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fitsBelow = r.bottom + 8 + p.height <= vh;
    const fitsAbove = r.top - 8 - p.height >= 0;
    const top = fitsBelow || !fitsAbove ? r.bottom + 8 : r.top - 8 - p.height;
    let left = r.left;
    if (left + p.width > vw - 8) left = Math.max(8, vw - 8 - p.width);
    setStyle({ position: "fixed", top: Math.max(8, Math.min(top, vh - p.height - 8)), left, maxWidth: Math.min(340, vw - 16) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={`info ${className}`}
      tabIndex={0}
      aria-label="More information"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      <Icon name="ph:info" size={size} className="text-ink-3" />
      {open && (
        <span ref={pop} className="info-pop info-pop-fixed" role="tooltip" style={style}>
          {children}
        </span>
      )}
    </span>
  );
}

/** Wraps any element; on hover or focus a fixed-position tooltip with the given text appears below it, never clipped. */
export function HoverTip({ tip, children, className = "" }: { tip: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: -9999, left: 0 });
  useLayoutEffect(() => {
    if (!open || !ref.current || !pop.current) return;
    const r = ref.current.getBoundingClientRect();
    const p = pop.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fitsBelow = r.bottom + 6 + p.height <= vh;
    const top = fitsBelow ? r.bottom + 6 : Math.max(8, r.top - 6 - p.height);
    let left = r.left;
    if (left + p.width > vw - 8) left = Math.max(8, vw - 8 - p.width);
    setStyle({ position: "fixed", top, left, maxWidth: Math.min(360, vw - 16) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);
  return (
    <span ref={ref} className={`inline-flex min-w-0 items-center ${className}`} tabIndex={0} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && (
        <span ref={pop} className="info-pop info-pop-fixed" role="tooltip" style={style}>
          {tip}
        </span>
      )}
    </span>
  );
}
