"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { MysteryBoxConfig, RunRecord } from "@/engine/types";
import { getRun } from "@/lib/store";
import { reportMarkdown, headlineFor } from "@/lib/report";
import { downloadJson, downloadText, copyText } from "@/lib/download";
import { MysteryBoxResults } from "./results/MysteryBoxResults";
import { BattlesResults, RetentionResults, SellbackResults } from "./results/OtherResults";
import { CreditsResults, UpgraderResults } from "./results/MoreResults";
import { MistyResults } from "./results/MistyResults";
import { JemlitResults } from "./results/JemlitResults";
import { Badge, Button, Card } from "./ui";
import { Icon } from "./Icon";

function Results({ run }: { run: RunRecord }) {
  const r = run.result;
  if (r.kind === "mystery-box") return <MysteryBoxResults cfg={run.config as MysteryBoxConfig} r={r} />;
  if (r.kind === "sellback") return <SellbackResults r={r} />;
  if (r.kind === "battles") return <BattlesResults r={r} />;
  if (r.kind === "credits") return <CreditsResults r={r} />;
  if (r.kind === "upgrader") return <UpgraderResults r={r} />;
  if (r.kind === "misty") return <MistyResults r={r} />;
  if (r.kind === "jemlit") return <JemlitResults r={r} />;
  return <RetentionResults r={r} />;
}

function RunCard({ run }: { run: RunRecord }) {
  const [showCfg, setShowCfg] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            {run.name} <Badge tone="accent">{run.lab}</Badge>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button kind="ghost" onClick={() => downloadJson(`${run.id}.json`, run)}>
              <Icon name="ph:download-simple" size={14} /> JSON
            </Button>
            <Button kind="ghost" onClick={() => downloadText(`${run.id}.md`, reportMarkdown(run), "text/markdown")}>
              <Icon name="ph:file-text" size={14} /> Report .md
            </Button>
            <Button
              kind="ghost"
              onClick={async () => {
                setCopied(await copyText(reportMarkdown(run)));
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Icon name="ph:copy" size={14} /> {copied ? "Copied" : "Copy report"}
            </Button>
          </div>
        }
      >
        <div className="text-sm text-ink-2">{headlineFor(run.result)}</div>
        <div className="mt-1 text-xs text-ink-3">
          seed {run.seed} · engine {run.engineVersion} · {new Date(run.createdAt).toLocaleString()} · {run.catalogSnapshot.length} catalogue items snapshotted
        </div>
        <button type="button" className="mt-2 text-xs text-accent-ink underline" onClick={() => setShowCfg((s) => !s)}>
          {showCfg ? "Hide" : "Show"} frozen configuration
        </button>
        {showCfg && <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-paper p-3 text-[11px]">{JSON.stringify(run.config, null, 2)}</pre>}
      </Card>
      <Results run={run} />
    </div>
  );
}

export function RunDetail() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const compareId = search.get("compare");
  const [run, setRun] = useState<RunRecord | null | undefined>(undefined);
  const [other, setOther] = useState<RunRecord | null | undefined>(undefined);
  useEffect(() => {
    getRun(params.id).then((r) => setRun(r ?? null));
    if (compareId) getRun(compareId).then((r) => setOther(r ?? null));
    else setOther(null);
  }, [params.id, compareId]);
  if (run === undefined) return <p className="text-sm text-ink-3">Loading run…</p>;
  if (run === null) return <Card>Run not found in this browser&apos;s history.</Card>;
  if (other) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Compare two runs</h1>
        <div className="grid gap-4 xl:grid-cols-2">
          <RunCard run={run} />
          <RunCard run={other} />
        </div>
      </div>
    );
  }
  return <RunCard run={run} />;
}
