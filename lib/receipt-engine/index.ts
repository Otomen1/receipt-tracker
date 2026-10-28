import type { EngineOptions, EngineResult, GrayImage, TemplateBank } from "./contracts";
import { preprocess } from "./preprocess";
import { recognize } from "./recognize";
import { interpretLayout } from "./layout";
import { extract } from "./extract";
import { validate } from "./validate";
import { structuredOutput } from "./output";
import { rotate } from "./geometry";

export type { EngineOptions, EngineResult, GrayImage, TemplateBank } from "./contracts";
/** Offline pixels → evidence → existing output contract. No storage or cloud fallback. */
export function recognizeReceipt(image: GrayImage, templates: TemplateBank, options: EngineOptions = {}): EngineResult {
  let page = preprocess(image, options);
  const orientation = options.orientation ?? "auto";
  if (orientation === "auto") {
    let best = -1, selected = page;
    for (const degrees of [0, 90, 180, 270]) {
      options.checkpoint?.();
      const candidate = rotate(page, degrees);
      try {
        const probe = recognize(candidate, templates, options, 10);
        const gs = probe.flatMap(line => line.glyphs);
        const letters = gs.filter(g => g.character != null && /^[A-Za-z0-9]$/.test(g.character));
        // A sideways page can collapse into a handful of convincing dots or
        // strokes. Orientation must explain text, not win by discarding it.
        const quality = letters.length >= 4 ? letters.reduce((s, g) => s + g.score, 0) / Math.max(1, gs.length) * Math.min(1, letters.length / 20) : 0;
        if (quality > best) { best = quality; selected = candidate; }
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("segmentation exceeds")) throw error;
      }
    }
    page = selected;
  } else if (orientation) page = rotate(page, orientation);
  const text = recognize(page, templates, options);
  const lines = interpretLayout(text), glyphs = text.flatMap(line => line.glyphs);
  const unknownGlyphs = glyphs.filter(g => g.character == null).length;
  const parsed = extract(lines), warnings = validate(parsed, unknownGlyphs);
  if (page.operations.some(s => s.startsWith("suppress_graphics:"))) warnings.push("Border/rule components were suppressed; inspect for clipped text.");
  const score = glyphs.reduce((sum, g) => sum + (g.character ? g.score : 0), 0) / Math.max(1, glyphs.length);
  // High confidence is deliberately unavailable before real-data calibration.
  const confidence = warnings.length || score < .85 ? "low" : "medium";
  return { engine: "custom-classical-v1", data: structuredOutput(parsed, text.map(line => line.text).join("\n")),
    validation: { valid: warnings.length === 0, warnings, confidence }, parsed, lines,
    diagnostics: { operations: page.operations, unknownGlyphs, totalGlyphs: glyphs.length, score, calibration: "uncalibrated", templateSource: "development" } };
}
