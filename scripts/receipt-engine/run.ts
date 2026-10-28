import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { recognizeImageIsolated } from "../../lib/receipt-input/isolated";
import type { TemplateBank } from "../../lib/receipt-engine";

async function main() {
  const args = process.argv.slice(2), get = (flag: string, fallback?: string) => { const i = args.indexOf(flag); return i < 0 ? fallback : args[i + 1]; };
  const input = get("--image"), output = get("--output");
  if (!input) throw new Error("Usage: npm run recognize:offline -- --image receipt.png [--output result.json]");
  const file = path.resolve(input);
  if (fs.statSync(file).size > 20 * 1024 * 1024) throw new Error("Input exceeds 20 MiB");
  const bank = JSON.parse(fs.readFileSync(path.resolve(get("--templates", "assets/receipt-engine/templates.json")!), "utf8")) as TemplateBank;
  const start = performance.now(), cpu = process.cpuUsage();
  const result = await recognizeImageIsolated(fs.readFileSync(file), bank, { orientation: args.includes("--upright") ? 0 : "auto" });
  const usage = process.cpuUsage(cpu);
  const body = JSON.stringify({ ...result, measurement: { wall_ms: performance.now() - start, cpu_ms: (usage.user + usage.system) / 1000, peak_rss_kib: process.resourceUsage().maxRSS, scope: "isolated_worker_startup_decode_preprocess_recognize_parse_validate_after_parent_imports" } }, null, 2) + "\n";
  if (output) { fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true }); fs.writeFileSync(output, body); }
  else process.stdout.write(body);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Offline engine failed"); process.exitCode = 1; });
