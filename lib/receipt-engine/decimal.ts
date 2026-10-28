export interface Decimal { n: bigint; scale: number }
const ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), TEN = BigInt(10);
function power10(scale: number): bigint { let n = ONE; for (let i = 0; i < scale; i++) n *= TEN; return n; }
export function decimal(value: string): Decimal | null {
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(value) || value.length > 24) return null;
  const [whole, fraction = ""] = value.split(".");
  return { n: BigInt(whole + fraction), scale: fraction.length };
}
export function cents(value: string): bigint | null {
  const d = decimal(value); if (!d || d.scale > 2) return null;
  return d.n * power10(2 - d.scale);
}
export function formatCents(value: bigint): string {
  const text = (value < ZERO ? -value : value).toString().padStart(3, "0");
  return `${value < ZERO ? "-" : ""}${text.slice(0, -2)}.${text.slice(-2)}`;
}
export function lineAmount(unit: string, quantity: string): string | null {
  const u = cents(unit), q = decimal(quantity); if (u == null || !q) return null;
  const divisor = power10(q.scale), product = u * q.n, sign = product < ZERO ? -ONE : ONE;
  return formatCents(sign * ((sign * product + divisor / TWO) / divisor));
}
export function deriveUnit(line: string, quantity: string): string | null {
  const amount = cents(line), qty = decimal(quantity); if (amount == null || !qty || qty.n <= ZERO) return null;
  const numerator = amount * power10(qty.scale);
  // Never manufacture a fractional-cent unit price to make the receipt balance.
  return numerator % qty.n === ZERO ? formatCents(numerator / qty.n) : null;
}
export function safeNumber(value: string | null): number | undefined {
  if (value == null || !decimal(value)) return undefined;
  const n = Number(value); return Number.isFinite(n) && Math.abs(n) < 1_000_000_000 ? n : undefined;
}
