"use client";
import { useState } from "react";
import { Td, Th } from "./ui";

/** A table that shows the first few rows and unfolds on click. Cells are plain strings so a server page can pass them. */
export function CollapsibleTable({ head, rows, initial = 3, minWidth = 720, noun = "rows" }: { head: string[]; rows: string[][]; initial?: number; minWidth?: number; noun?: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(0, initial);
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="tbl"><table className="w-full text-xs" style={{ minWidth }}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <Th key={h} right={i > 0}>
                  {h}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {r.map((c, j) => (
                  <Td key={j} right={j > 0} mono={j > 0}>
                    {c}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      {rows.length > initial && (
        <button type="button" className="chip mt-2" onClick={() => setOpen((o) => !o)}>
          {open ? `Show fewer` : `Show all ${rows.length} ${noun}`}
        </button>
      )}
    </div>
  );
}
