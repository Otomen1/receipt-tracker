import type { BinaryPage, Box } from "./contracts";

export interface Component extends Box { area: number; seed: number }
export interface SegmentedLine { box: Box; glyphs: { box: Box; spaceBefore: boolean }[]; nominalHeight: number }
export const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

export function connectedComponents(page: BinaryPage, checkpoint = () => {}): Component[] {
  const { width: w, height: h, data } = page, seen = new Uint8Array(data.length), queue = new Int32Array(data.length), result: Component[] = [];
  for (let seed = 0; seed < data.length; seed++) {
    if (seed % (w * 64) === 0) checkpoint();
    if (!data[seed] || seen[seed]) continue;
    let start = 0, end = 1, minX = seed % w, maxX = minX, minY = Math.floor(seed / w), maxY = minY;
    queue[0] = seed; seen[seed] = 1;
    while (start < end) {
      const i = queue[start++], x = i % w, y = Math.floor(i / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
        const next = (y + dy) * w + x + dx;
        if (data[next] && !seen[next]) { seen[next] = 1; queue[end++] = next; }
      }
    }
    result.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area: end, seed });
  }
  return result;
}
/** Erase only pixels connected to a confident frame/rule, never its bounding box. */
export function suppressGraphics(page: BinaryPage, checkpoint = () => {}): BinaryPage {
  const components = connectedComponents(page, checkpoint);
  const nominal = median(components.filter(c => c.height >= 4 && c.height < page.height / 4 && c.width < c.height * 2.5).map(c => c.height)) || 12;
  const graphics = components.filter(c => {
    const edge = c.x <= 1 || c.y <= 1 || c.x + c.width >= page.width - 1 || c.y + c.height >= page.height - 1;
    const frame = edge && (c.height > page.height * .55 || c.width > page.width * .55) && c.area < c.width * c.height * .35;
    const vertical = c.height > nominal * 8 && c.width < c.height * .2 && edge;
    const horizontal = c.width > nominal * 10 && c.height <= Math.max(3, nominal * .18);
    return frame || vertical || horizontal;
  });
  if (!graphics.length) return page;
  const data = page.data.slice(), w = page.width, h = page.height;
  for (const component of graphics) {
    const queue = new Int32Array(component.area); let start = 0, end = 1;
    queue[0] = component.seed; data[component.seed] = 0;
    while (start < end) {
      if (start % 8192 === 0) checkpoint();
      const i = queue[start++], x = i % w, y = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
        const next = (y + dy) * w + x + dx;
        if (data[next]) { data[next] = 0; queue[end++] = next; }
      }
    }
  }
  return { ...page, data, operations: [...page.operations, `suppress_graphics:${graphics.length}`] };
}
export function tightBox(page: BinaryPage, box: Box): Box | null {
  let left = box.x + box.width, right = -1, top = box.y + box.height, bottom = -1;
  for (let y = box.y; y < box.y + box.height; y++) for (let x = box.x; x < box.x + box.width; x++) if (page.data[y * page.width + x]) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right >= left ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1 } : null;
}
export function cropGlyph(page: BinaryPage, box: Box): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(box.width * box.height);
  for (let y = 0; y < box.height; y++) data.set(page.data.subarray((box.y + y) * page.width + box.x, (box.y + y) * page.width + box.x + box.width), y * box.width);
  return { data, width: box.width, height: box.height };
}
function splitWide(box: Box, columns: Uint32Array, nominal: number, advance: number): Box[] {
  if (box.width <= nominal * 1.12) return [box];
  const count = Math.max(2, Math.round(box.width / advance)), cuts = [box.x];
  for (let n = 1; n < count; n++) {
    const target = box.x + box.width * n / count, radius = Math.max(2, Math.floor(nominal * .2));
    let best = -1, score = Infinity;
    for (let x = Math.max(cuts[cuts.length - 1] + 2, Math.round(target) - radius); x < Math.min(box.x + box.width - 2, target + radius); x++) {
      const cost = columns[x] + Math.abs(x - target) * .25;
      if (cost < score && columns[x] <= nominal * .35) { score = cost; best = x; }
    }
    if (best >= 0) cuts.push(best);
  }
  cuts.push(box.x + box.width);
  return cuts.slice(0, -1).map((x, i) => ({ ...box, x, width: cuts[i + 1] - x }));
}
export function segment(page: BinaryPage, checkpoint = () => {}): SegmentedLine[] {
  const components = connectedComponents(page, checkpoint);
  const heights = components.filter(c => c.height >= 4 && c.width <= c.height * 2.5 && c.height < page.height / 4).map(c => c.height);
  const nominalHeight = median(heights) || 12;
  const rows = new Uint32Array(page.height);
  for (let y = 0; y < page.height; y++) for (let x = 0; x < page.width; x++) rows[y] += page.data[y * page.width + x];
  const bands: [number, number][] = [];
  for (let y = 0; y < page.height;) {
    if (!rows[y]) { y++; continue; }
    const start = y; while (y < page.height && rows[y]) y++;
    const previous = bands[bands.length - 1];
    if (previous && start - previous[1] <= Math.max(1, Math.floor(nominalHeight * .32))) previous[1] = y;
    else bands.push([start, y]);
  }
  const lines: SegmentedLine[] = [];
  for (const [top, bottom] of bands) {
    checkpoint();
    const centers = components.filter(c => c.y >= top && c.y + c.height <= bottom && c.height >= nominalHeight * .6 && c.width <= nominalHeight * 1.1).map(c => c.x + c.width / 2).sort((a, b) => a - b);
    const advances = centers.slice(1).map((c, i) => c - centers[i]).filter(d => d >= nominalHeight * .4 && d <= nominalHeight * 1.6);
    const advance = median(advances) || nominalHeight * .8;
    const columns = new Uint32Array(page.width);
    for (let y = top; y < bottom; y++) for (let x = 0; x < page.width; x++) columns[x] += page.data[y * page.width + x];
    const boxes: Box[] = [];
    for (let x = 0; x < page.width;) {
      if (!columns[x]) { x++; continue; }
      const start = x; while (x < page.width && columns[x]) x++;
      const raw = { x: start, y: top, width: x - start, height: bottom - top };
      for (const candidate of splitWide(raw, columns, nominalHeight, advance)) { const box = tightBox(page, candidate); if (box) boxes.push(box); }
    }
    if (!boxes.length || (bottom - top <= 3 && boxes[boxes.length - 1].x + boxes[boxes.length - 1].width - boxes[0].x > nominalHeight * 8)) continue;
    const gaps = boxes.slice(1).map((b, i) => b.x - boxes[i].x - boxes[i].width);
    const pitches = boxes.slice(1).map((b, i) => b.x + b.width / 2 - boxes[i].x - boxes[i].width / 2);
    const normalGap = median(gaps), pitch = median(pitches);
    const glyphs = boxes.map((box, i) => {
      const gap = i ? gaps[i - 1] : 0, distance = i ? pitches[i - 1] : 0;
      return { box, spaceBefore: i > 0 && (gap >= nominalHeight * .9 || (gap > Math.max(2, normalGap * 1.6, nominalHeight * .15) && distance > pitch * 1.45)) };
    });
    const x = boxes[0].x, right = boxes[boxes.length - 1].x + boxes[boxes.length - 1].width;
    lines.push({ box: { x, y: top, width: right - x, height: bottom - top }, glyphs, nominalHeight });
  }
  return lines;
}
