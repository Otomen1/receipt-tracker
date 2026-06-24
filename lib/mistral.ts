import { Mistral } from "@mistralai/mistralai";
import { Category, ExtractedReceiptData, ValidationResult } from "./types";
import { classifyReceipt } from "./classify";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || "" });

const PROMPT = `You are a Malaysian receipt data extraction specialist. Extract structured data from this receipt.

RULES:
- Return ONLY a valid JSON object. No explanation, no markdown, no code fences.
- Use null for any field you cannot determine with confidence.
- Currency is almost always MYR. Use MYR unless the receipt clearly shows another currency (USD, SGD, etc.).
- For "total": extract the FINAL PAYABLE amount — what was actually paid after tax and discount. Look for: TOTAL, JUMLAH, AMAUN DIBAYAR, BAYARAN, GRAND TOTAL. Do NOT use subtotal.
- For "merchant": the business name only, not branch or address. Clean and concise.
- For "receipt_date": return YYYY-MM-DD only. Convert from any format found on the receipt.
- For "category": use ONLY one of these exact values: Groceries, Restaurant, Transport, Shopping, Healthcare, Entertainment, Utilities, Travel, Beauty, Education, Other.
- For "items": individual line items only. Exclude tax lines, subtotals, totals, and headers.
- For "sst_amount": SST or Service Tax amount if shown (common on Malaysian receipts: SST, CUKAI PERKHIDMATAN).
- For "discount": total discount applied if shown (DISKAUN, REBAT, MEMBER DISC).
- For "payment_method": look for Cash/Tunai, Visa, Mastercard, Touch n Go/TNG, DuitNow, GrabPay, ShopeePay, Ewallet.

OUTPUT — return exactly this JSON structure, nothing else:
{
  "merchant": string or null,
  "receipt_date": "YYYY-MM-DD" or null,
  "total": number or null,
  "currency": "MYR",
  "category": "Groceries" or "Restaurant" or "Transport" or "Shopping" or "Healthcare" or "Entertainment" or "Utilities" or "Travel" or "Beauty" or "Education" or "Other" or null,
  "sst_amount": number or null,
  "discount": number or null,
  "payment_method": string or null,
  "items": [{"name": string, "quantity": number or null, "price": number or null}]
}`;

const RETRY_PROMPT = `A previous extraction of this receipt was incomplete. Focus only on finding these two fields:
1. The merchant/store name (look at the top of the receipt)
2. The final payable total amount (look for TOTAL, JUMLAH, GRAND TOTAL — the largest prominent number near the bottom)

Return ONLY this JSON, nothing else:
{"merchant": string or null, "total": number or null}`;

const VALID_CATEGORIES = new Set<string>(["Groceries", "Restaurant", "Transport", "Shopping", "Other"]);

function extractJsonFromText(text: string): string {
  let s = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // Extract first {...} block if model wrapped JSON in prose
  const match = s.match(/\{[\s\S]*\}/);
  if (match) s = match[0];

  // Remove trailing commas before } or ] (common model mistake)
  s = s.replace(/,(\s*[}\]])/g, "$1");

  return s;
}

function normalizeExtracted(parsed: Record<string, unknown>, ocrRawText: string | null): ExtractedReceiptData {
  // Currency: RM → MYR
  const rawCurrency = String(parsed.currency ?? "").toUpperCase().trim();
  const currency = rawCurrency === "RM" ? "MYR" : (rawCurrency || "MYR");

  // Date: normalize to YYYY-MM-DD, reject invalid
  let receipt_date: string | null = null;
  if (parsed.receipt_date) {
    const d = new Date(String(parsed.receipt_date));
    if (!isNaN(d.getTime())) {
      receipt_date = d.toISOString().split("T")[0];
    }
  }

  // Merchant: trim, reject blank
  const merchant = String(parsed.merchant ?? "").trim() || null;

  // Total: must be positive number
  const rawTotal = Number(parsed.total);
  const total = !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : null;

  // Category: validate against enum
  const llmCategory = VALID_CATEGORIES.has(String(parsed.category))
    ? (parsed.category as Category)
    : null;

  // Deterministic category override from merchant/text
  const category = classifyReceipt(merchant, ocrRawText, llmCategory);

  // Items: filter out entries without a name
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .filter((i): i is Record<string, unknown> => i && typeof i === "object" && typeof i.name === "string" && (i.name as string).trim() !== "")
    .map((i) => ({
      name: String(i.name).trim(),
      quantity: i.quantity != null ? Number(i.quantity) || undefined : undefined,
      price: i.price != null ? Number(i.price) || undefined : undefined,
    }));

  const sst = parsed.sst_amount != null ? Number(parsed.sst_amount) : null;
  const discount = parsed.discount != null ? Number(parsed.discount) : null;
  const payment_method = parsed.payment_method ? String(parsed.payment_method).trim() : null;

  return {
    merchant,
    receipt_date,
    total,
    currency,
    category,
    items,
    raw_text: ocrRawText,
    sst_amount: !isNaN(sst as number) && (sst as number) >= 0 ? sst : null,
    discount: !isNaN(discount as number) && (discount as number) >= 0 ? discount : null,
    payment_method: payment_method || null,
  };
}

function parseExtracted(text: string, ocrRawText: string | null = null): ExtractedReceiptData {
  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(extractJsonFromText(text));
  } catch {
    // Field-by-field regex recovery on parse failure
    const merchantMatch = text.match(/"merchant"\s*:\s*"([^"]+)"/);
    const dateMatch = text.match(/"receipt_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
    const totalMatch = text.match(/"total"\s*:\s*([\d.]+)/);
    const currencyMatch = text.match(/"currency"\s*:\s*"([A-Z]{2,3})"/);
    const categoryMatch = text.match(/"category"\s*:\s*"([^"]+)"/);
    const paymentMatch = text.match(/"payment_method"\s*:\s*"([^"]+)"/);
    parsed = {
      merchant: merchantMatch?.[1] ?? null,
      receipt_date: dateMatch?.[1] ?? null,
      total: totalMatch ? parseFloat(totalMatch[1]) : null,
      currency: currencyMatch?.[1] ?? "MYR",
      category: categoryMatch?.[1] ?? null,
      payment_method: paymentMatch?.[1] ?? null,
    };
  }

  return normalizeExtracted(parsed, ocrRawText);
}

export function validateExtraction(data: ExtractedReceiptData): ValidationResult {
  const warnings: string[] = [];

  if (!data.merchant) warnings.push("Merchant name missing");
  if (!data.receipt_date) warnings.push("Date missing");
  if (!data.total) warnings.push("Total amount missing");
  if (data.total && data.total < 0) warnings.push("Total is negative");
  if (data.total && data.total > 50000) warnings.push("Total unusually high (>RM 50,000)");

  if (data.items.length > 0 && data.total) {
    const itemsSum = data.items.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 1), 0);
    if (itemsSum > 0 && Math.abs(itemsSum - data.total) / data.total > 0.15) {
      warnings.push(`Items sum (${itemsSum.toFixed(2)}) differs from total (${data.total.toFixed(2)}) by >15%`);
    }
  }

  if (data.receipt_date) {
    const d = new Date(data.receipt_date);
    if (d > new Date()) warnings.push("Receipt date is in the future");
    if (d.getFullYear() < 2000) warnings.push("Receipt date before year 2000");
  }

  const missingCritical = !data.merchant || !data.total;
  const confidence: "high" | "medium" | "low" =
    warnings.length === 0 ? "high" : missingCritical ? "low" : "medium";

  return { valid: warnings.length === 0, warnings, confidence };
}

const EMPTY: ExtractedReceiptData = {
  merchant: null,
  receipt_date: null,
  total: null,
  currency: "MYR",
  category: null,
  items: [],
  raw_text: null,
};

async function mergeWithRetry(
  initial: ExtractedReceiptData,
  retryFn: () => Promise<Record<string, unknown>>
): Promise<ExtractedReceiptData> {
  const validation = validateExtraction(initial);
  if (validation.confidence !== "low") return initial;

  try {
    const retryParsed = await retryFn();
    return {
      ...initial,
      merchant: initial.merchant ?? (String(retryParsed.merchant ?? "").trim() || null),
      total: initial.total ?? (Number(retryParsed.total) > 0 ? Number(retryParsed.total) : null),
    };
  } catch {
    return initial;
  }
}

// For PDFs: Mistral document OCR → markdown → mistral-small for structuring
export async function extractReceiptDataFromUrl(fileUrl: string): Promise<ExtractedReceiptData> {
  try {
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document: { type: "document_url", documentUrl: fileUrl },
      includeImageBase64: false,
    });

    const rawText = ocrResponse.pages?.map((p) => p.markdown).join("\n") ?? "";

    const response = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: `${PROMPT}\n\nReceipt text:\n${rawText}` }],
    });

    const text = (response.choices?.[0]?.message?.content as string ?? "").trim();
    const initial = parseExtracted(text, rawText);

    return mergeWithRetry(initial, async () => {
      const r2 = await client.chat.complete({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: `${RETRY_PROMPT}\n\nReceipt text:\n${rawText}` }],
      });
      const t2 = (r2.choices?.[0]?.message?.content as string ?? "").trim();
      return JSON.parse(extractJsonFromText(t2));
    });
  } catch (err) {
    console.error("Mistral PDF OCR error:", err);
    return EMPTY;
  }
}

// For images: pixtral vision model with base64
export async function extractReceiptData(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedReceiptData> {
  try {
    const response = await client.chat.complete({
      model: "pixtral-12b-2409",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", imageUrl: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    });

    const text = (response.choices?.[0]?.message?.content as string ?? "").trim();
    const initial = parseExtracted(text, null);

    return mergeWithRetry(initial, async () => {
      const r2 = await client.chat.complete({
        model: "pixtral-12b-2409",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: RETRY_PROMPT },
              { type: "image_url", imageUrl: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      });
      const t2 = (r2.choices?.[0]?.message?.content as string ?? "").trim();
      return JSON.parse(extractJsonFromText(t2));
    });
  } catch (err) {
    console.error("Mistral OCR error:", err);
    return EMPTY;
  }
}
