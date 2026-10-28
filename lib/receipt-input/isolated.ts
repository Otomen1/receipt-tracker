import { Worker } from "node:worker_threads";
import path from "node:path";
import type { EngineOptions, EngineResult, TemplateBank } from "../receipt-engine";

/** Standalone Node adapter. Next/Vercel worker asset packaging still needs integration tests. */
export function recognizeImageIsolated(bytes: Buffer, templates: TemplateBank, options: Omit<EngineOptions, "checkpoint"> = {}, timeoutMs = 60000, signal?: AbortSignal): Promise<EngineResult> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) return Promise.reject(new Error("Invalid offline deadline"));
  if (signal?.aborted) return Promise.reject(new Error("Offline recognition aborted"));
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) return Promise.reject(new Error("Invalid image size"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "worker.js"), { workerData: { bytes, templates, options }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    let settled = false;
    const finish = (error?: Error, result?: EngineResult) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      void worker.terminate(); if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(new Error("Offline recognition aborted"));
    const timer = setTimeout(() => finish(new Error("Offline recognition deadline exceeded")), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    worker.on("message", message => message.ok ? finish(undefined, message.result) : finish(new Error(message.error)));
    worker.on("error", error => finish(error));
    worker.on("exit", code => { if (!settled) finish(new Error(`Offline worker exited without a result (${code})`)); });
    if (signal?.aborted) abort();
  });
}
