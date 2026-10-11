import { runLab, type RunRequest } from "@/engine";

export type WorkerIn = { type: "run"; req: RunRequest };
export type WorkerOut =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; result: ReturnType<typeof runLab> }
  | { type: "error"; message: string };

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  if (e.data.type !== "run") return;
  try {
    let last = 0;
    const result = runLab(e.data.req, (done, total) => {
      const now = Date.now();
      if (now - last > 80) {
        last = now;
        (self as unknown as Worker).postMessage({ type: "progress", done, total } satisfies WorkerOut);
      }
    });
    (self as unknown as Worker).postMessage({ type: "done", result } satisfies WorkerOut);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOut);
  }
};
