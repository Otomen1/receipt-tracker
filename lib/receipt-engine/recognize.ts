import type { BinaryPage, Candidate, EngineOptions, Glyph, Quad, TemplateBank, TextLine } from "./contracts";
import { mapPoint } from "./geometry";
import { cropGlyph, segment } from "./segment";

/** Aspect-preserving nearest-neighbor normalization; no character-specific rules. */
export function normalizeBitmap(data: Uint8Array, width: number, height: number, outWidth: number, outHeight: number): Uint8Array {
  const out = new Uint8Array(outWidth * outHeight), scale = Math.min((outWidth - 2) / width, (outHeight - 2) / height);
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const left = Math.floor((outWidth - w) / 2), top = Math.floor((outHeight - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(top + y) * outWidth + left + x] = data[Math.min(height - 1, Math.floor(y * height / h)) * width + Math.min(width - 1, Math.floor(x * width / w))];
  return out;
}
function distanceMap(bitmap: Uint8Array, width: number, height: number): Float32Array {
  const out = Float32Array.from(bitmap, ink => ink ? 0 : width + height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (x) out[i] = Math.min(out[i], out[i - 1] + 1);
    if (y) out[i] = Math.min(out[i], out[i - width] + 1);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (x + 1 < width) out[i] = Math.min(out[i], out[i + 1] + 1);
    if (y + 1 < height) out[i] = Math.min(out[i], out[i + width] + 1);
  }
  return out;
}
export function createRecognizer(bank: TemplateBank) {
  if (bank.schema !== "receipt-templates/v1" || bank.sourceSplit !== "development" || !Number.isInteger(bank.width) || !Number.isInteger(bank.height) || bank.width < 4 || bank.height < 4 || bank.width > 64 || bank.height > 64 || !bank.templates.length || bank.templates.length > 10000) throw new Error("Invalid or non-development template bank");
  const templates = bank.templates.map(t => {
    if (t.character.length !== 1 || t.bitmap.length !== bank.width * bank.height || !/^[01]+$/.test(t.bitmap) || !Number.isFinite(t.aspect) || !Number.isFinite(t.relativeHeight) || t.aspect <= 0 || t.relativeHeight <= 0) throw new Error("Invalid glyph template");
    const bitmap = Uint8Array.from(t.bitmap, x => Number(x));
    return { ...t, bitmap, distance: distanceMap(bitmap, bank.width, bank.height) };
  });
  return (ink: Uint8Array, width: number, height: number, nominalHeight: number): Candidate[] => {
    const bitmap = normalizeBitmap(ink, width, height, bank.width, bank.height), map = distanceMap(bitmap, bank.width, bank.height);
    const best = new Map<string, number>();
    for (const template of templates) {
      let mismatch = 0, union = 0, chamfer = 0, count = 0;
      for (let i = 0; i < bitmap.length; i++) {
        if (bitmap[i] || template.bitmap[i]) union++;
        if (bitmap[i] !== template.bitmap[i]) mismatch++;
        if (bitmap[i]) { chamfer += template.distance[i]; count++; }
        if (template.bitmap[i]) { chamfer += map[i]; count++; }
      }
      const aspect = Math.min(1, Math.abs(Math.log((width / height) / template.aspect)) / 2);
      const relative = Math.min(1, Math.abs(height / nominalHeight - template.relativeHeight));
      const distance = .5 * mismatch / Math.max(1, union) + .3 * Math.min(1, chamfer / Math.max(1, count) / 3) + .12 * aspect + .08 * relative;
      if (distance < (best.get(template.character) ?? Infinity)) best.set(template.character, distance);
    }
    return Array.from(best.entries()).map(([character, distance]) => ({ character, distance, score: Math.max(0, 1 - distance) })).sort((a, b) => a.distance - b.distance || a.character.localeCompare(b.character)).slice(0, 5);
  };
}
export function recognize(page: BinaryPage, bank: TemplateBank, options: EngineOptions = {}, sampleLines = Infinity): TextLine[] {
  const match = createRecognizer(bank);
  const segments = segment(page, options.checkpoint);
  if (segments.length > 700 || segments.reduce((n, l) => n + l.glyphs.length, 0) > 12000) throw new Error("Text segmentation exceeds glyph/line budget");
  return segments.slice(0, sampleLines).map((line, id) => {
    const glyphs: Glyph[] = line.glyphs.map(proposal => {
      options.checkpoint?.();
      const { box } = proposal, crop = cropGlyph(page, box);
      const candidates = match(crop.data, crop.width, crop.height, line.nominalHeight);
      const top = candidates[0], margin = (candidates[1]?.distance ?? 1) - top.distance;
      const known = top.score >= (options.minGlyphScore ?? .75) && margin >= (options.minGlyphMargin ?? .015);
      const inputQuad = [[box.x, box.y], [box.x + box.width - 1, box.y], [box.x + box.width - 1, box.y + box.height - 1], [box.x, box.y + box.height - 1]].map(([x, y]) => mapPoint(page.toInput, x, y)) as Quad;
      return { box, inputQuad, spaceBefore: proposal.spaceBefore, character: known ? top.character : null, candidates, score: top.score };
    });
    return { id, box: line.box, glyphs, text: glyphs.map(g => `${g.spaceBefore ? " " : ""}${g.character ?? "?"}`).join(""), score: glyphs.reduce((sum, g) => sum + (g.character ? g.score : 0), 0) / Math.max(1, glyphs.length) };
  });
}
