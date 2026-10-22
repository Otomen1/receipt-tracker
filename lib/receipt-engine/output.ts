import type { Category, ExtractedReceiptData } from "../types";
import type { ParsedReceipt } from "./contracts";
import { safeNumber } from "./decimal";

export function structuredOutput(parsed: ParsedReceipt, rawText: string): ExtractedReceiptData {
  const merchant = parsed.merchant.value;
  const category: Category | null = merchant && /\b(?:RESTAURANT|RESTORAN|CAFE|KAFE)\b/i.test(merchant) ? "Restaurant"
    : merchant && /\b(?:GROCERY|GROCERIES|SUPERMARKET|PASARAYA|MINIMARKET)\b/i.test(merchant) ? "Groceries" : null;
  return { merchant, receipt_date: parsed.date.value, total: safeNumber(parsed.total.value) ?? null,
    currency: parsed.currency.value ?? "MYR", category,
    items: parsed.items.filter(item => item.name.value != null).map(item => {
      const quantity = safeNumber(item.quantity.value), price = safeNumber(item.unitPrice.value);
      return { name: item.name.value!, ...(quantity == null ? {} : { quantity }), ...(price == null ? {} : { price }) };
    }), raw_text: rawText || null, sst_amount: safeNumber(parsed.tax.value) ?? null,
    discount: safeNumber(parsed.discount.value) ?? null, payment_method: parsed.payment.value };
}
