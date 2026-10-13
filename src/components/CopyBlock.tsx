"use client";
import { useState } from "react";

/** A block of text with a Copy button. */
export function CopyBlock({ text, label = "Copy prompt", filename }: { text: string; label?: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = filename ?? "prompt.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? "Copied" : label}
        </button>
        {filename && (
          <button type="button" className="btn" onClick={download}>
            Download .txt
          </button>
        )}
        <span className="ml-auto text-[11px] text-ink-3">{text.length.toLocaleString()} characters</span>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap p-3 text-[12px] leading-5">{text}</pre>
    </div>
  );
}
