import type { BinaryPage, GrayImage, Matrix, Point, Quad } from "./contracts";

export const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function mapPoint(m: Matrix, x: number, y: number): Point {
  const d = m[6] * x + m[7] * y + m[8];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-10) throw new Error("Singular coordinate transform");
  return { x: (m[0] * x + m[1] * y + m[2]) / d, y: (m[3] * x + m[4] * y + m[5]) / d };
}
export function multiply(a: Matrix, b: Matrix): Matrix {
  const out = Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) out[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return out as Matrix;
}
function solve(a: number[][]): number[] {
  const n = a.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < 1e-9) throw new Error("Degenerate perspective quadrilateral");
    [a[c], a[pivot]] = [a[pivot], a[c]];
    const d = a[c][c];
    for (let k = c; k <= n; k++) a[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) {
      const scale = a[r][c];
      for (let k = c; k <= n; k++) a[r][k] -= scale * a[c][k];
    }
  }
  return a.map(row => row[n]);
}
export function homography(from: Quad, to: Quad): Matrix {
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i], u = to[i].x, v = to[i].y;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  return [...solve(rows), 1] as Matrix;
}
export function validateQuad(q: Quad, image: GrayImage): void {
  const cross: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    if (![a.x, a.y].every(Number.isFinite) || a.x < 0 || a.y < 0 || a.x >= image.width || a.y >= image.height) throw new Error("Perspective corner outside input");
    cross.push((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  }
  if (!cross.every(x => x > 1) && !cross.every(x => x < -1)) throw new Error("Perspective corners must form a convex ordered quadrilateral");
}
export function rectify(image: GrayImage, quad: Quad, limit: number): { image: GrayImage; toInput: Matrix } {
  validateQuad(quad, image);
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const width = Math.max(2, Math.round(Math.max(distance(quad[0], quad[1]), distance(quad[3], quad[2]))));
  const height = Math.max(2, Math.round(Math.max(distance(quad[0], quad[3]), distance(quad[1], quad[2]))));
  if (width * height > limit) throw new Error("Rectified image exceeds pixel budget");
  const toInput = homography([{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }], quad);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = mapPoint(toInput, x, y), ix = Math.round(p.x), iy = Math.round(p.y);
    data[y * width + x] = ix >= 0 && iy >= 0 && ix < image.width && iy < image.height ? image.data[iy * image.width + ix] : 255;
  }
  return { image: { width, height, data }, toInput };
}
/** Conservative proposal: bright receipt on a clearly darker surrounding surface. */
export function detectReceiptQuad(image: GrayImage): Quad | null {
  const { width: w, height: h, data } = image;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 150));
  let border = 0, bn = 0, center = 0, cn = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    if (x < w * .04 || x > w * .96 || y < h * .04 || y > h * .96) { border += data[y * w + x]; bn++; }
    if (x > w * .35 && x < w * .65 && y > h * .35 && y < h * .65) { center += data[y * w + x]; cn++; }
  }
  if (!bn || !cn || center / cn - border / bn < 55) return null;
  const threshold = (center / cn + border / bn) / 2;
  let tl: Point = { x: 0, y: 0 }, tr = tl, br = tl, bl = tl;
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  for (let y = step; y < h - step; y += step) for (let x = step; x < w - step; x += step) if (data[y * w + x] > threshold) {
    if (x + y < minSum) { minSum = x + y; tl = { x, y }; }
    if (x + y > maxSum) { maxSum = x + y; br = { x, y }; }
    if (x - y > maxDiff) { maxDiff = x - y; tr = { x, y }; }
    if (x - y < minDiff) { minDiff = x - y; bl = { x, y }; }
  }
  const quad: Quad = [tl, tr, br, bl];
  try { validateQuad(quad, image); } catch { return null; }
  const area = Math.abs(quad.reduce((s, p, i) => s + p.x * quad[(i + 1) % 4].y - p.y * quad[(i + 1) % 4].x, 0)) / 2;
  return area > w * h * .35 ? quad : null;
}
export function rotate(page: BinaryPage, degrees: number): BinaryPage {
  if (!degrees) return page;
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const width = Math.ceil(Math.abs(page.width * c) + Math.abs(page.height * s));
  const height = Math.ceil(Math.abs(page.height * c) + Math.abs(page.width * s));
  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  const map: Matrix = [c, s, (page.width - 1) / 2 - c * cx - s * cy, -s, c, (page.height - 1) / 2 + s * cx - c * cy, 0, 0, 1];
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = mapPoint(map, x, y), ix = Math.round(p.x), iy = Math.round(p.y);
    if (ix >= 0 && iy >= 0 && ix < page.width && iy < page.height) data[y * width + x] = page.data[iy * page.width + ix];
  }
  return { width, height, data, toInput: multiply(page.toInput, map), operations: [...page.operations, `rotate:${degrees}`] };
}
