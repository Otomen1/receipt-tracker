import type { EvidenceField, Glyph, LayoutLine, ParsedItem, ParsedReceipt, State } from "./contracts";
import { deriveUnit } from "./decimal";
import { footerLabel } from "./layout";

export function field<T>(value: T | null = null, line?: LayoutLine, state: State = value == null ? "unannotated" : "observed", corrected = false): EvidenceField<T> {
  return { value, state, lineIds: line ? [line.id] : [], score: line ? line.score : 0, ...(corrected ? { corrected: true } : {}) };
}
interface Word { text: string; glyphs: Glyph[] }
function words(line: LayoutLine): Word[] {
  if (!line.glyphs.length) return line.text.trim().split(/\s+/).map(text => ({ text, glyphs: [] }));
  const result: Word[] = [];
  for (const glyph of line.glyphs) {
    if (!result.length || glyph.spaceBefore) result.push({ text: "", glyphs: [] });
    const word = result[result.length - 1]; word.text += glyph.character ?? "?"; word.glyphs.push(glyph);
  }
  return result;
}
export function numericWord(word: Word, quantity = false): { value: string; corrected: boolean } | null {
  const pattern = quantity ? /^\d+(?:\.\d{1,4})?$/ : /^-?(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/;
  const plain = word.text.replace(/^(?:RM|MYR)/i, "");
  if (pattern.test(plain)) return { value: plain.replace(/,/g, ""), corrected: false };
  if (!word.glyphs.length || /^(?:RM|MYR)/i.test(word.text)) return null;
  let corrections = 0, resolved = "";
  for (const glyph of word.glyphs) {
    const current = glyph.character;
    if (current && /^[\d.,-]$/.test(current)) { resolved += current; continue; }
    const candidates = glyph.candidates.filter(c => /^[\d.,-]$/.test(c.character) && c.score >= .8 && c.distance <= glyph.candidates[0].distance + .06);
    // If context still leaves two plausible digits, abstain rather than balance a total.
    if (candidates.length !== 1 || ++corrections > 2) return null;
    resolved += candidates[0].character;
  }
  return pattern.test(resolved) ? { value: resolved.replace(/,/g, ""), corrected: true } : null;
}
function amountTail(line: LayoutLine): EvidenceField<string> {
  const tokens = words(line), token = tokens[tokens.length - 1];
  const result = token ? numericWord(token) : null;
  return field(result?.value ?? null, line, result ? "observed" : "unreadable", result?.corrected);
}
function choose(values: EvidenceField<string>[], label: string, warnings: string[]): EvidenceField<string> {
  const readable = values.filter(f => f.value != null);
  if (new Set(readable.map(f => f.value)).size > 1) { warnings.push(`Conflicting ${label} values require review.`); return field<string>(null, undefined, "unreadable"); }
  return readable[0] ?? values[0] ?? field<string>();
}
export function strictDate(text: string): string | null {
  let year: number, month: number, day: number;
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text), local = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/.exec(text);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (local) { day = Number(local[1]); month = Number(local[2]); year = Number(local[3]); }
  else return null;
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1900 && year <= 2199 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}
function combineName(lines: LayoutLine[], text: string, line: LayoutLine): EvidenceField<string> {
  const joined = [...lines.map(l => l.text.trim()), text].filter(Boolean).join(" ");
  if (!/[A-Za-z]/.test(joined) || joined.includes("?")) return { ...field<string>(null, line, "unreadable"), lineIds: [...lines.map(l => l.id), line.id] };
  return { ...field(joined, line), lineIds: [...lines.map(l => l.id), line.id] };
}
export function extract(lines: LayoutLine[]): ParsedReceipt {
  const warnings: string[] = [], totals: EvidenceField<string>[] = [], taxes: EvidenceField<string>[] = [], discounts: EvidenceField<string>[] = [], dates: EvidenceField<string>[] = [];
  const items: ParsedItem[] = [];
  let merchant = field<string>(), currency = field<string>(), payment = field<string>(), pending: LayoutLine[] = [];
  let itemZone = false;
  for (const line of lines) {
    const text = line.text.trim(); if (!text) continue;
    if (/\b(?:RM(?=\s|\d|$)|MYR\b)/i.test(text)) currency = field("MYR", line);
    else if (/\bIDR\b|\bRp(?=\s|\d)/i.test(text) && currency.value !== "MYR") currency = field("IDR", line);
    const date = strictDate(text);
    if (date && (line.role === "header" || /\b(?:DATE|TARIKH)\b/i.test(text))) dates.push(field(date, line));
    if (line.role === "header" && merchant.value == null && merchant.state !== "unreadable" && /[A-Za-z?]{3}/.test(text) && !/^(?:DATE|TARIKH|RECEIPT|RESIT|INVOICE|TAX\s+INVOICE|TEL|SYNTHETIC|NOT\s+A\s+PURCHASE)\b/i.test(text)) {
      merchant = text.includes("?") ? field<string>(null, line, "unreadable") : field(text, line);
    }
    if (line.role === "summary") {
      pending = [];
      if (/^(?:(?:GRAND|NET)\s+TOTAL|AMOUNT\s+DUE|TOTAL|JUMLAH)\b/i.test(text) && !/^TOTAL\s+(?:ITEMS|QTY|QUANTITY)/i.test(text)) totals.push(amountTail(line));
      else if (/^(?:SST|SERVICE\s+TAX)\b/i.test(text)) taxes.push(amountTail(line));
      else if (/^(?:DISCOUNT|DISKAUN)\b/i.test(text)) { const f = amountTail(line); if (f.value?.startsWith("-")) f.value = f.value.slice(1); discounts.push(f); }
      continue;
    }
    if (line.role === "payment") {
      const match = /\b(CASH|TUNAI|CARD|KAD|DUITNOW|EWALLET|E-WALLET)\b/i.exec(text);
      if (match && !/^(?:CHANGE|BALANCE|BAKI)\b/i.test(text)) payment = field(/CASH|TUNAI/i.test(match[1]) ? "Cash" : /CARD|KAD/i.test(match[1]) ? "Card" : "E-wallet", line);
      continue;
    }
    if (line.role === "columns") { itemZone = true; continue; }
    if (line.role !== "item" || footerLabel.test(text) || date) continue;
    const tokens = words(line), money = amountTail(line);
    if (!money.value) {
      if (itemZone && /[A-Za-z?]/.test(text) && !/^UNIT\b/i.test(text)) pending.push(line);
      continue;
    }
    let quantity = field<string>(), unitPrice = field<string>();
    let nameText = tokens.slice(0, -1).map(w => w.text).join(" ");
    const numericSuffix: { index: number; value: string; corrected: boolean }[] = [];
    for (let i = tokens.length - 2; i >= 0; i--) {
      const numeric = numericWord(tokens[i], numericSuffix.length > 0);
      if (numeric) numericSuffix.unshift({ index: i, ...numeric });
      else if (/^(?:X|@|QTY|UNIT|AMOUNT)$/i.test(tokens[i].text)) continue;
      else break;
    }
    if (numericSuffix.length >= 2) {
      const q = numericSuffix[numericSuffix.length - 2], u = numericSuffix[numericSuffix.length - 1];
      quantity = field(q.value, line, "observed", q.corrected); unitPrice = field(u.value, line, "observed", u.corrected);
      nameText = tokens.slice(0, q.index).map(w => w.text).join(" ").replace(/\b(?:QTY|UNIT)\s*$/i, "").trim();
    }
    // A separated QTY line may precede an explicit UNIT ... AMOUNT ... line.
    if (/^UNIT\b/i.test(text) && pending.length) {
      const qtyLine = pending[pending.length - 1], q = /^(?:.*\s)?QTY\s+(\d+(?:\.\d{1,4})?)$/i.exec(qtyLine.text);
      const u = /^UNIT\s+(\d[\d,]*\.\d{2})\s+AMOUNT\s+/i.exec(text);
      if (q && u) {
        quantity = field(q[1], qtyLine); unitPrice = field(u[1].replace(/,/g, ""), line); nameText = "";
        pending = pending.map((p, i) => i === pending.length - 1 ? { ...p, text: p.text.replace(/\bQTY\s+\d+(?:\.\d{1,4})?$/i, "").trim() } : p);
      }
    }
    if (quantity.value == null && pending.length) {
      const last = pending[pending.length - 1], q = /^QTY\s+(\d+(?:\.\d{1,4})?)$/i.exec(last.text.trim());
      if (q) { quantity = field(q[1], last); pending.pop(); }
    }
    const name = combineName(pending, nameText, line);
    if (quantity.value && !unitPrice.value) { const value = deriveUnit(money.value, quantity.value); if (value) unitPrice = field(value, line, "derived"); }
    if (!name.value) warnings.push(`Unreadable product name on line ${line.id + 1}; no name invented.`);
    items.push({ name, quantity, unitPrice, lineAmount: money }); pending = []; itemZone = true;
  }
  if (pending.length) warnings.push("Unpriced item text remains; review for missing item rows.");
  return { merchant, date: choose(dates, "date", warnings), total: choose(totals, "total", warnings), currency,
    tax: choose(taxes, "tax", warnings), discount: choose(discounts, "discount", warnings), payment, items, warnings };
}
