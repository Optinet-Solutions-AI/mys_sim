import { Suspense } from "react";
import { RunDetail } from "@/components/RunDetail";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-3">Loading run…</p>}>
      <RunDetail />
    </Suspense>
  );
}
