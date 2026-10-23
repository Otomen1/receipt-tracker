import type { BinaryPage, Box } from "./contracts";

export interface Component extends Box { area: number; seed: number }
export interface SegmentedLine { box: Box; glyphs: { box: Box; spaceBefore: boolean; ink: Uint8Array }[]; nominalHeight: number }
export const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

export function connectedComponents(page: BinaryPage, checkpoint = () => {}, labels?: Int32Array): Component[] {
  const { width: w, height: h, data } = page, seen = new Uint8Array(data.length), queue = new Int32Array(data.length), result: Component[] = [];
  if (labels && labels.length !== data.length) throw new Error("Component label map has incorrect dimensions");
  labels?.fill(0);
  for (let seed = 0; seed < data.length; seed++) {
    if (seed % (w * 64) === 0) checkpoint();
    if (!data[seed] || seen[seed]) continue;
    let start = 0, end = 1, minX = seed % w, maxX = minX, minY = Math.floor(seed / w), maxY = minY;
    queue[0] = seed; seen[seed] = 1;
    if (labels) labels[seed] = result.length + 1;
    while (start < end) {
      const i = queue[start++], x = i % w, y = Math.floor(i / w);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
        const next = (y + dy) * w + x + dx;
        if (data[next] && !seen[next]) { seen[next] = 1; queue[end++] = next; if (labels) labels[next] = result.length + 1; }
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
  const labels = new Int32Array(page.data.length);
  const components = connectedComponents(page, checkpoint, labels);
  const heights = components.filter(c => c.height >= 4 && c.width <= c.height * 2.5 && c.height < page.height / 4).map(c => c.height);
  const nominalHeight = median(heights) || 12;
  // Speckle can put ink in every scan row. Body components define baselines;
  // punctuation may attach to a baseline but cannot create one.
  interface Group { bodies: number[]; members: number[]; center: number; height: number }
  const groups: Group[] = [], owner = new Int32Array(components.length).fill(-1);
  const bodies = components.map((c, i) => ({ c, i })).filter(({ c }) => c.height >= Math.max(4, nominalHeight * .42) && c.height <= nominalHeight * 3 && c.width <= c.height * 12 && c.area >= Math.max(3, c.height));
  bodies.sort((a, b) => a.c.y + a.c.height / 2 - b.c.y - b.c.height / 2);
  for (const { c, i } of bodies) {
    let best: Group | undefined, distance = Infinity;
    for (const group of groups) {
      const d = Math.abs(c.y + c.height / 2 - group.center);
      const overlap = Math.min(c.y + c.height, group.center + group.height / 2) - Math.max(c.y, group.center - group.height / 2);
      if (overlap >= Math.min(c.height, group.height) * .45 && d <= Math.max(c.height, group.height) * .5 && d < distance) { best = group; distance = d; }
    }
    if (!best) { best = { bodies: [], members: [], center: c.y + c.height / 2, height: c.height }; groups.push(best); }
    best.bodies.push(i); best.members.push(i);
    best.center = median(best.bodies.map(n => components[n].y + components[n].height / 2));
    best.height = median(best.bodies.map(n => components[n].height));
  }
  groups.sort((a, b) => a.center - b.center);
  groups.forEach((g, n) => g.bodies.forEach(i => { owner[i] = n; }));
  for (let i = 0; i < components.length; i++) if (owner[i] < 0) {
    const c = components[i]; let selected = -1, best = Infinity;
    if (c.area < Math.max(1, Math.floor(nominalHeight * .08)) || c.height > nominalHeight * .65 || c.width > nominalHeight * 1.3) continue;
    for (let n = 0; n < groups.length; n++) {
      const g = groups[n], top = g.center - g.height / 2, bottom = g.center + g.height / 2;
      if (c.y < top - g.height * .5 || c.y + c.height > bottom + g.height * .25) continue;
      const gap = Math.min(...g.bodies.map(i => { const b = components[i]; return Math.max(0, b.x - c.x - c.width, c.x - b.x - b.width); }));
      const distance = Math.abs(c.y + c.height / 2 - g.center) + gap;
      if (gap <= g.height * .55 && distance < best) { selected = n; best = distance; }
    }
    if (selected >= 0) { groups[selected].members.push(i); owner[i] = selected; }
  }
  const lines: SegmentedLine[] = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    checkpoint();
    const group = groups[groupIndex], members = group.members.map(i => components[i]);
    const top = Math.min(...members.map(c => c.y)), bottom = Math.max(...members.map(c => c.y + c.height));
    const localHeight = group.height;
    const centers = group.bodies.map(i => components[i]).filter(c => c.width <= localHeight * 1.1).map(c => c.x + c.width / 2).sort((a, b) => a - b);
    const advances = centers.slice(1).map((c, i) => c - centers[i]).filter(d => d >= localHeight * .4 && d <= localHeight * 1.6);
    const advance = median(advances) || localHeight * .8;
    const localData = new Uint8Array(page.width * (bottom - top));
    const columns = new Uint32Array(page.width);
    for (let y = top; y < bottom; y++) for (let x = 0; x < page.width; x++) {
      const label = labels[y * page.width + x];
      if (label && owner[label - 1] === groupIndex) { localData[(y - top) * page.width + x] = 1; columns[x]++; }
    }
    const localPage: BinaryPage = { ...page, height: bottom - top, data: localData };
    const boxes: Box[] = [];
    for (let x = 0; x < page.width;) {
      if (!columns[x]) { x++; continue; }
      const start = x; while (x < page.width && columns[x]) x++;
      const raw = { x: start, y: 0, width: x - start, height: bottom - top };
      for (const candidate of splitWide(raw, columns, localHeight, advance)) { const box = tightBox(localPage, candidate); if (box) boxes.push(box); }
    }
    if (!boxes.length) continue;
    const gaps = boxes.slice(1).map((b, i) => b.x - boxes[i].x - boxes[i].width);
    const pitches = boxes.slice(1).map((b, i) => b.x + b.width / 2 - boxes[i].x - boxes[i].width / 2);
    const normalGap = median(gaps), pitch = median(pitches);
    const glyphs = boxes.map((box, i) => {
      const gap = i ? gaps[i - 1] : 0, distance = i ? pitches[i - 1] : 0;
      return { box: { ...box, y: box.y + top }, ink: cropGlyph(localPage, box).data, spaceBefore: i > 0 && (gap >= localHeight * .9 || (gap > Math.max(2, normalGap * 1.6, localHeight * .15) && distance > pitch * 1.45)) };
    });
    const x = boxes[0].x, right = boxes[boxes.length - 1].x + boxes[boxes.length - 1].width;
    lines.push({ box: { x, y: top, width: right - x, height: bottom - top }, glyphs, nominalHeight: localHeight });
  }
  return lines;
}
