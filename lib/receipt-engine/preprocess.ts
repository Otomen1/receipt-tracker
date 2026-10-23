import type { BinaryPage, EngineOptions, GrayImage } from "./contracts";
import { detectReceiptQuad, IDENTITY, rectify, rotate } from "./geometry";
import { suppressGraphics } from "./segment";

export function validateImage(image: GrayImage, maxPixels = 8_000_000): void {
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 2 || image.height < 2 || image.width > 12000 || image.height > 12000 || image.width * image.height > maxPixels || image.data.length !== image.width * image.height) throw new Error("Invalid raster dimensions or pixel budget exceeded");
}
export function contrast(image: GrayImage): GrayImage {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < image.data.length; i++) histogram[image.data[i]]++;
  const percentile = (fraction: number) => { let count = 0; for (let i = 0; i < 256; i++) { count += histogram[i]; if (count > image.data.length * fraction) return i; } return 255; };
  const low = percentile(.005), high = percentile(.995);
  if (high - low < 8) return { ...image, data: image.data.slice() };
  return { ...image, data: Uint8Array.from(image.data, x => Math.max(0, Math.min(255, Math.round((x - low) * 255 / (high - low))))) };
}
export function medianDenoise(image: GrayImage): GrayImage {
  const { width: w, height: h } = image, data = image.data.slice();
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const values = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values.push(image.data[(y + dy) * w + x + dx]);
    values.sort((a, b) => a - b); data[y * w + x] = values[4];
  }
  return { width: w, height: h, data };
}
export function otsu(image: GrayImage): Uint8Array {
  const hist = new Uint32Array(256); let sum = 0;
  for (let i = 0; i < image.data.length; i++) { const value = image.data[i]; hist[value]++; sum += value; }
  let count = 0, weighted = 0, best = -1, threshold = 0;
  for (let value = 0; value < 255; value++) {
    count += hist[value]; weighted += value * hist[value];
    const rest = image.data.length - count;
    if (!count || !rest) continue;
    const variance = count * rest * (weighted / count - (sum - weighted) / rest) ** 2;
    if (variance > best) { best = variance; threshold = value; }
  }
  // Inclusive threshold retains pure black pixels; constant images contain no text.
  return best < 0 ? new Uint8Array(image.data.length) : Uint8Array.from(image.data, x => x <= threshold ? 1 : 0);
}
export function adaptive(image: GrayImage, checkpoint = () => {}): Uint8Array {
  const { width: w, height: h, data } = image, stride = w + 1;
  const sum = new Float64Array(stride * (h + 1)), squares = new Float64Array(sum.length);
  for (let y = 1; y <= h; y++) {
    if (y % 64 === 0) checkpoint();
    let row = 0, sq = 0;
    for (let x = 1; x <= w; x++) { const value = data[(y - 1) * w + x - 1]; row += value; sq += value * value; sum[y * stride + x] = sum[(y - 1) * stride + x] + row; squares[y * stride + x] = squares[(y - 1) * stride + x] + sq; }
  }
  const radius = Math.max(8, Math.min(40, Math.round(w / 30))), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    if (y % 64 === 0) checkpoint();
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), y0 = Math.max(0, y - radius), x1 = Math.min(w, x + radius + 1), y1 = Math.min(h, y + radius + 1);
      const n = (x1 - x0) * (y1 - y0), a = y0 * stride + x0, b = y0 * stride + x1, c = y1 * stride + x0, d = y1 * stride + x1;
      const mean = (sum[d] - sum[b] - sum[c] + sum[a]) / n;
      const deviation = Math.sqrt(Math.max(0, (squares[d] - squares[b] - squares[c] + squares[a]) / n - mean * mean));
      mask[y * w + x] = data[y * w + x] < mean * (1 + .2 * (deviation / 128 - 1)) ? 1 : 0;
    }
  }
  return mask;
}
export function estimateSkew(page: GrayImage, checkpoint = () => {}): number {
  const points: [number, number][] = [];
  const step = Math.max(1, Math.ceil(page.data.length / 150000));
  for (let i = 0; i < page.data.length; i += step) if (page.data[i]) points.push([i % page.width, Math.floor(i / page.width)]);
  if (points.length < 30) return 0;
  let bestScore = 0, bestAngle = 0, zeroScore = 0;
  for (let angle = -6; angle <= 6; angle += .5) {
    checkpoint();
    const a = angle * Math.PI / 180, s = Math.sin(a), c = Math.cos(a), offset = page.width;
    const rows = new Uint32Array(page.height + page.width * 2 + 4);
    for (const [x, y] of points) rows[Math.round(s * x + c * y) + offset]++;
    let score = 0; for (let i = 0; i < rows.length; i++) score += rows[i] * rows[i];
    if (!angle) zeroScore = score;
    if (score > bestScore) { bestScore = score; bestAngle = angle; }
  }
  return bestScore > zeroScore * 1.035 ? bestAngle : 0;
}
export function preprocess(input: GrayImage, options: EngineOptions = {}): BinaryPage {
  const limit = options.maxPixels ?? 8_000_000;
  validateImage(input, limit); options.checkpoint?.();
  let image = input, toInput = IDENTITY;
  const operations: string[] = [];
  const quad = options.quad ?? (options.autoPerspective ? detectReceiptQuad(input) : null);
  if (quad) { const rectified = rectify(input, quad, limit); image = rectified.image; toInput = rectified.toInput; operations.push("perspective"); }
  image = contrast(image); operations.push("percentile_contrast");
  if (options.denoise) { image = medianDenoise(image); operations.push("median3x3"); }
  const mode = options.threshold ?? "adaptive";
  let page: BinaryPage = { ...image, data: mode === "adaptive" ? adaptive(image, options.checkpoint) : otsu(image), toInput, operations: [...operations, mode] };
  page = suppressGraphics(page, options.checkpoint);
  if (options.deskew !== false) { const angle = estimateSkew(page, options.checkpoint); if (angle) page = rotate(page, angle); }
  options.checkpoint?.();
  return page;
}
