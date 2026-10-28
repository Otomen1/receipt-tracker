import type { ParsedReceipt } from "./contracts";
import { cents, formatCents, lineAmount, safeNumber } from "./decimal";

export function validate(parsed: ParsedReceipt, unknownGlyphs: number): string[] {
  const warnings = [...parsed.warnings];
  for (const [name, value] of [["merchant", parsed.merchant], ["date", parsed.date], ["total", parsed.total]] as const) if (value.value == null) warnings.push(`Missing or uncertain ${name}; review required.`);
  if (!parsed.currency.value) warnings.push("Currency was not read; the existing API default MYR is retained for review.");
  if (unknownGlyphs) warnings.push(`${unknownGlyphs} glyphs are uncertain; question marks represent unreadable text.`);
  if (!parsed.items.length) warnings.push("No item rows were extracted; this is not a verified empty receipt.");
  const zero = BigInt(0);
  let sum = zero, allAmounts = parsed.items.length > 0;
  for (let index = 0; index < parsed.items.length; index++) {
    const item = parsed.items[index], amount = item.lineAmount.value == null ? null : cents(item.lineAmount.value);
    if (amount == null) allAmounts = false; else sum += amount;
    if (!item.quantity.value || !item.unitPrice.value) warnings.push(`Item ${index + 1}: quantity or unit price is unresolved; line amount is retained in diagnostics.`);
    if (item.quantity.value && safeNumber(item.quantity.value) === 0) warnings.push(`Item ${index + 1}: zero quantity requires review.`);
    if (item.quantity.value && item.unitPrice.value && item.lineAmount.value) {
      const computed = lineAmount(item.unitPrice.value, item.quantity.value);
      if (computed !== item.lineAmount.value) warnings.push(`Item ${index + 1}: quantity × unit price does not equal the printed line amount.`);
    }
    for (const f of [item.name, item.quantity, item.unitPrice, item.lineAmount]) if (f.corrected) warnings.push(`Item ${index + 1}: numeric-context character correction requires review.`);
  }
  const total = parsed.total.value == null ? null : cents(parsed.total.value);
  if (total != null && total < zero) warnings.push("Negative receipt total requires review.");
  if (allAmounts && total != null) {
    const tax = parsed.tax.value == null ? zero : cents(parsed.tax.value), discount = parsed.discount.value == null ? zero : cents(parsed.discount.value);
    if (tax != null && discount != null && sum + tax - discount !== total) warnings.push(`Printed items/tax/discount give ${formatCents(sum + tax - discount)}; total is ${formatCents(total)}. No balancing values were invented.`);
  }
  for (const f of [parsed.total, parsed.tax, parsed.discount]) if (f.corrected) warnings.push("A summary amount used a visually supported alternative character; review required.");
  return Array.from(new Set(warnings));
}
