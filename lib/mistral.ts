import { Mistral } from "@mistralai/mistralai";
import { ExtractedReceiptData } from "./types";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || "" });

const PROMPT = `You are a receipt OCR assistant. Analyze this receipt image and extract the following information in JSON format:
{
  "merchant": "store/restaurant name",
  "receipt_date": "YYYY-MM-DD format",
  "total": numeric total amount (number only, no currency symbol),
  "currency": "3-letter currency code like MYR, USD, SGD",
  "category": one of: "Groceries", "Restaurant", "Transport", "Shopping", "Other",
  "items": [{"name": "item name", "quantity": number or null, "price": number or null}],
  "raw_text": "full raw text from receipt"
}

Return ONLY valid JSON. No markdown, no explanation. If you cannot determine a field, use null.`;

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
            {
              type: "image_url",
              imageUrl: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    const text = (response.choices?.[0]?.message?.content as string ?? "").trim();

    const jsonText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText);
    return {
      merchant: parsed.merchant || null,
      receipt_date: parsed.receipt_date || null,
      total: parsed.total != null ? Number(parsed.total) : null,
      currency: parsed.currency || "MYR",
      category: parsed.category || null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      raw_text: parsed.raw_text || null,
    };
  } catch (err) {
    console.error("Mistral OCR error:", err);
    return {
      merchant: null,
      receipt_date: null,
      total: null,
      currency: "MYR",
      category: null,
      items: [],
      raw_text: null,
    };
  }
}
