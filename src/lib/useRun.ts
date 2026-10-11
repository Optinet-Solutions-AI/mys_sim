"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RunRequest } from "@/engine";
import type { AnyResult } from "@/engine/types";
import type { WorkerOut } from "@/workers/sim.worker";

export type RunStatus = "idle" | "running" | "done" | "error";

/** Runs a lab in a Web Worker with progress, cancel, and the last result. */
export function useRun() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  const kill = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => kill, [kill]);

  const run = useCallback(
    (req: RunRequest) =>
      new Promise<AnyResult>((resolve, reject) => {
        kill();
        setStatus("running");
        setProgress(0);
        setError(null);
        setResult(null);
        startRef.current = Date.now();
        const w = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = w;
        w.onmessage = (e: MessageEvent<WorkerOut>) => {
          const m = e.data;
          if (m.type === "progress") setProgress(m.total ? m.done / m.total : 0);
          else if (m.type === "done") {
            setProgress(1);
            setElapsed(Date.now() - startRef.current);
            setResult(m.result);
            setStatus("done");
            resolve(m.result);
            kill();
          } else {
            setError(m.message);
            setStatus("error");
            reject(new Error(m.message));
            kill();
          }
        };
        w.onerror = (ev) => {
          const msg = ev.message || "worker error";
          setError(msg);
          setStatus("error");
          reject(new Error(msg));
          kill();
        };
        w.postMessage({ type: "run", req });
      }),
    [kill],
  );

  const cancel = useCallback(() => {
    kill();
    setStatus("idle");
    setProgress(0);
  }, [kill]);

  return { run, cancel, status, progress, result, error, elapsed };
}
