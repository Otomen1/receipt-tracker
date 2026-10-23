import { parentPort, workerData } from "node:worker_threads";
import { decodeReceiptImage } from "./image";
import { recognizeReceipt } from "../receipt-engine";

async function run() {
  const image = await decodeReceiptImage(Buffer.from(workerData.bytes));
  const result = recognizeReceipt(image, workerData.templates, workerData.options);
  parentPort?.postMessage({ ok: true, result });
}
run().catch(error => parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : "Offline worker failed" }));
