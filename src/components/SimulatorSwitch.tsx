"use client";
import { useEffect, useState } from "react";
import { MistySimulator } from "./MistySimulator";
import { JemlitSimulator } from "./JemlitSimulator";
import { IcyboxSimulator } from "./IcyboxSimulator";

/** /simulate?src=misty|jemlit&box=slug: picks the source's simulator. Misty is the default. */
export function SimulatorSwitch() {
  const [src, setSrc] = useState<"misty" | "jemlit" | "icybox">("misty");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("src");
    if (q === "jemlit" || q === "icybox") setSrc(q);
  }, []);
  return (
    <div>
      <div className="mb-3 flex gap-1 text-xs">
        {(["misty", "jemlit", "icybox"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={`chip ${src === k ? "chip-accent" : ""}`}
            onClick={() => {
              setSrc(k);
              const u = new URL(window.location.href);
              u.searchParams.set("src", k);
              u.searchParams.delete("box");
              window.history.replaceState(null, "", u.toString());
            }}
          >
            {k === "misty" ? "Misty" : k === "jemlit" ? "Jemlit" : "IcyBox"}
          </button>
        ))}
      </div>
      {src === "jemlit" ? <JemlitSimulator /> : src === "icybox" ? <IcyboxSimulator /> : <MistySimulator />}
    </div>
  );
}
