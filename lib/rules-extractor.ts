import { Category, ExtractedReceiptData, ReceiptItem } from "./types";
import { classifyReceipt } from "./classify";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRToken {
  text: string;
  bbox?: BoundingBox;
  confidence?: number;
}

export interface OCRLine {
  text: string;
  bbox?: BoundingBox;
  tokens?: OCRToken[];
}

export interface OCRDocument {
  text: string;
  lines: OCRLine[];
  imageWidth?: number;
  imageHeight?: number;
}

const HEADER_BLACKLIST = [
  /\bTAX\s+INVOICE\b/i,
  /\bINVOIS\s+CUKAI\b/i,
  /\bOFFICIAL\s+RECEIPT\b/i,
  /\bRESIT\s+RASMI\b/i,
  /\bCASH\s+RECEIPT\b/i,
  /\bCUSTOMER\s+COPY\b/i,
  /\bSALINAN\s+PELANGGAN\b/i,
  /\bSIMPANAN\s+RESIT\b/i,
  /\bDATE\b/i,
  /\bTARIKH\b/i,
  /\bTIME\b/i,
  /\bMASA\b/i,
  /\bCASHIER\b/i,
  /\bJURUWANG\b/i,
  /\bITEM\b/i,
  /\bQTY\b/i,
  /\bPRICE\b/i,
  /\bHARGA\b/i,
  /\bTOTAL\b/i,
  /\bJUMLAH\b/i,
  /\bSUBTOTAL\b/i,
  /\bBAYARAN\b/i,
  /\bWELCOME\b/i,
  /\bSELAMAT\s+DATANG\b/i,
  /\bTHANK\s+YOU\b/i,
  /\bTERIMA\s+KASIH\b/i,
  /\bREG\s*NO\b/i,
  /\bROC\s*NO\b/i,
  /\bCO\s*REG\b/i,
  /\bSST\s*ID\b/i,
  /\bSST\s*NO\b/i,
  /\bTEL\b/i,
  /\bFAX\b/i,
  /\bEMAIL\b/i,
  /\bWEBSITE\b/i,
  /\bHTTP/i,
  /\bWWW\./i,
];

const TOTAL_ANCHORS = [
  /\bGRAND\s*TOTAL\b/i,
  /\bJUMLAH\s*BESAR\b/i,
  /\bJUMLAH\s*BERSIH\b/i,
  /\bTOTAL\s*PAYABLE\b/i,
  /\bTOTAL\s*AMOUNT\b/i,
  /\bTOTAL\b/i,
  /\bJUMLAH\b/i,
  /\bBAYARAN\b/i,
  /\bAMAUN\s*DIBAYAR\b/i,
  /\bNET\s*TOTAL\b/i,
  /\bAMOUNT\s*DUE\b/i,
  /\bHARGA\s*BERSIH\b/i,
];

const NON_TOTAL_ANCHORS = [
  /\bSUBTOTAL\b/i,
  /\bSUB\s+TOTAL\b/i,
  /\bCASH\b/i,
  /\bTUNAI\b/i,
  /\bCHANGE\b/i,
  /\bBAKI\b/i,
  /\bROUNDING\b/i,
  /\bPEMBERATAN\b/i,
  /\bGENAP\b/i,
  /\bDISCOUNT\b/i,
  /\bDISKAUN\b/i,
  /\bSST\b/i,
  /\bSERVICE\s+TAX\b/i,
  /\bTAX\b/i,
];

const SST_ANCHORS = [
  /\bSST\b/i,
  /\bSERVICE\s+TAX\b/i,
  /\bCUKAI\s+PERKHIDMATAN\b/i,
  /\bCUKAI\s+JUALAN\b/i,
  /\bSST\s*(?:6%|8%|10%)\b/i,
];

const DISCOUNT_ANCHORS = [
  /\bDISCOUNT\b/i,
  /\bDISKAUN\b/i,
  /\bPOTONGAN\b/i,
  /\bREBAT\b/i,
  /\bREBATE\b/i,
  /\bMEMBER\s+DISC\b/i,
  /\bSAVINGS\b/i,
  /\bPENJIMATAN\b/i,
];

const PAYMENT_METHODS: [RegExp, string][] = [
  [/\bTOUCH\s*(?:['’]?N|&|AND)?\s*GO\b|\bTNG(?:\s*E?WALLET)?\b/i, "Touch 'n Go"],
  [/\b(DUITNOW|DUIT\s*NOW|QR\s*PAY|MAYBANK\s*QRPAY)\b/i, "DuitNow"],
  [/\b(GRABPAY|GRAB\s*PAY)\b/i, "GrabPay"],
  [/\b(SHOPEEPAY|SHOPEE\s*PAY)\b/i, "ShopeePay"],
  [/\b(BOOST)\b/i, "Boost"],
  [/\b(SETEL)\b/i, "Setel"],
  [/\b(VISA|MASTERCARD|CREDIT\s*CARD|DEBIT\s*CARD|MYDEBIT|WAVE)\b/i, "Card"],
  [/\b(CASH|TUNAI|WANG\s*TUNAI)\b/i, "Cash"],
];

function parseAmount(val: string): number | null {
  const clean = val.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

export function extractMerchant(lines: OCRLine[], imageHeight?: number): string | null {
  // Inspect the top lines of the receipt (top 20% or top 5 lines)
  const candidateLines = lines.filter((l, idx) => {
    if (imageHeight && l.bbox) {
      return l.bbox.y < imageHeight * 0.2;
    }
    return idx < 5;
  });

  const validCandidates: { line: OCRLine; score: number }[] = [];

  for (const item of candidateLines) {
    const text = item.text.trim();
    if (!text || text.length < 3) continue;

    // Reject headers, prices, and metadata lines
    if (HEADER_BLACKLIST.some((rx) => rx.test(text))) continue;
    if (/\d+\.\d{2}/.test(text)) continue; // Contains a monetary price
    if (/^\d+/.test(text)) continue; // Starts with numbers (postcode / phone / lot)
    if (/^(?:no\.?\s+\d|lot\s+\d|level\s+\d|jalan\b|persiaran\b|lorong\b|batu\b|bandar\b|poskod\b|kuala\s+lumpur|selangor|petaling\s+jaya|subang|penang|johor)/i.test(text)) continue;

    let score = 10;
    // Boost if font height is larger
    if (item.bbox?.height) {
      score += item.bbox.height;
    }
    // Boost if contains corporate suffix (SDN BHD, ENTERPRISE, MART, RESTORAN)
    if (/\b(SDN\s*B[NH]D|ENTERPRISE|RESTORAN|MART|STORE|SHOP|MARKET|PHARMACY|KLINIK|CAFE|BOOK)\b/i.test(text)) {
      score += 25;
    }
    // Boost uppercase letters
    if (text === text.toUpperCase()) {
      score += 5;
    }

    // Prefer lines appearing earlier near the very top of the receipt
    score += Math.max(0, 30 - (item.bbox ? item.bbox.y / 10 : 0));

    validCandidates.push({ line: item, score });
  }

  if (validCandidates.length === 0) return null;

  validCandidates.sort((a, b) => b.score - a.score);
  let merchant = validCandidates[0].line.text.trim();

  // Clean trailing punctuation or branch numbering
  merchant = merchant
    .replace(/^[*#@]+\s*/, "")
    .replace(/\s*[*#@]+$/, "")
    .replace(/\s*\([^)]*\)$/, "")
    .trim();

  return merchant || null;
}

export function extractDate(lines: OCRLine[]): string | null {
  const text = lines.map((l) => l.text).join("\n");

  // Format 1: DD/MM/YYYY or DD-MM-YYYY (or 2-digit year)
  const dmyMatch = text.match(/\b([0-3]?\d)[/.-]([0-1]?\d)[/.-](20\d{2}|\d{2})\b/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    // Detect US MM/DD/YYYY if first number > 12 (or month is valid day)
    if (day > 12 && month <= 12 && day <= 31) {
      // standard DD/MM
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    } else if (month > 12 && day <= 12 && month <= 31) {
      // MM/DD format
      const mm = String(day).padStart(2, "0");
      const dd = String(month).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    } else if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  // Format 2: YYYY-MM-DD
  const ymdMatch = text.match(/\b(20\d{2})[/.-]([0-1]?\d)[/.-]([0-3]?\d)\b/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    let month = parseInt(ymdMatch[2], 10);
    let day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2030) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  // Format 3: DD MMM YYYY (e.g. 29 OCT 2026 or 03 SEP 2026)
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const namedMatch = text.match(/\b([0-3]?\d)\s+([A-Za-z]{3,9})\s+(20\d{2}|\d{2})\b/i);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const mStr = namedMatch[2].slice(0, 3).toLowerCase();
    let year = parseInt(namedMatch[3], 10);
    if (year < 100) year += 2000;
    if (monthMap[mStr] && day >= 1 && day <= 31 && year >= 2000 && year <= 2030) {
      const dd = String(day).padStart(2, "0");
      return `${year}-${monthMap[mStr]}-${dd}`;
    }
  }

  return null;
}

export function extractTotal(lines: OCRLine[]): number | null {
  // 1. Mark tax summary exclusion zones to avoid grabbing subtotal from GST/SST breakdowns
  let inTaxSummaryZone = false;
  const processedLines = lines.map((line) => {
    const text = line.text.trim();
    if (/\b(GST\s*SUMMARY|SST\s*SUMMARY|TAX\s*SUMMARY|TAX\s*INVOICE\s*SUMMARY|RINGKASAN\s*CUKAI)\b/i.test(text)) {
      inTaxSummaryZone = true;
    }
    return { ...line, isTaxSummary: inTaxSummaryZone };
  });

  const KEYWORD_LEVELS = [
    // Priority 100: Explicit payable / rounded figures
    { rx: /\b(ROUNDED|ROUNDING\s*TOTAL|NETT?\s*TOTAL|NET\s*AMOUNT|TOTAL\s*PAYABLE|TOTAL\s*AFTER\s*ROUNDING|TOTAL\s*AMOUNT\s*DUE)\b/i, priority: 100 },
    // Priority 80: Standard Grand Total
    { rx: /\b(GRAND\s*TOTAL|JUMLAH\s*BESAR|JUMLAH\s*BERSIH)\b/i, priority: 80 },
    // Priority 60: General Total keywords
    { rx: /\b(TOTAL\s*AMT|TOTAL\s*AMOUNT|TOTAL|JUMLAH|BAYARAN)\b/i, priority: 60 }
  ];

  const REJECT_WORDS = /\b(SUBTOTAL|SUB\s*TOTAL|CASH|TUNAI|CHANGE|BAKI|DISCOUNT|DISKAUN|SAVINGS|ROUNDING\s*ADJ|PEMBERATAN)\b/i;
  const candidates: { val: number; score: number; y: number }[] = [];

  for (const { rx, priority } of KEYWORD_LEVELS) {
    for (let i = 0; i < processedLines.length; i++) {
      const anchor = processedLines[i];
      if (anchor.isTaxSummary && priority < 90) continue;
      if (!rx.test(anchor.text)) continue;
      if (REJECT_WORDS.test(anchor.text) && !/ROUNDED|NETT|TOTAL\s*PAYABLE/i.test(anchor.text)) continue;

      const aBox = anchor.bbox || { x: 0, y: i * 20, width: 100, height: 18 };
      const aCenterY = aBox.y + aBox.height / 2;

      // Check same horizontal row (2D bounding box alignment)
      const sameRow = processedLines.filter((other) => {
        if (other === anchor || !other.bbox) return false;
        const otherCenterY = other.bbox.y + other.bbox.height / 2;
        return Math.abs(otherCenterY - aCenterY) <= Math.max(18, aBox.height * 1.3) &&
               other.bbox.x >= aBox.x - 10;
      });

      for (const rowLine of sameRow) {
        const matches = Array.from(rowLine.text.matchAll(/(?:RM|\$)?\s*(\d{1,6}[.,]\d{2})\b/gi));
        for (const m of matches) {
          const val = parseAmount(m[1]);
          if (val !== null && val > 0 && val < 50000) {
            candidates.push({ val, score: priority + 30, y: aBox.y });
          }
        }
      }

      // Check inline on same text
      const inlineMatches = Array.from(anchor.text.matchAll(/(?:RM|\$)?\s*(\d{1,6}[.,]\d{2})\b/gi));
      for (const m of inlineMatches) {
        const val = parseAmount(m[1]);
        if (val !== null && val > 0 && val < 50000) {
          candidates.push({ val, score: priority + 20, y: aBox.y });
        }
      }

      // Check subsequent 1-2 lines
      for (let j = i + 1; j <= Math.min(i + 2, processedLines.length - 1); j++) {
        const next = processedLines[j];
        if (REJECT_WORDS.test(next.text)) break;
        const nextMatches = Array.from(next.text.matchAll(/(?:RM|\$)?\s*(\d{1,6}[.,]\d{2})\b/gi));
        for (const m of nextMatches) {
          const val = parseAmount(m[1]);
          if (val !== null && val > 0 && val < 50000) {
            candidates.push({ val, score: priority + 10, y: next.bbox ? next.bbox.y : aBox.y + 20 });
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score !== a.score ? b.score - a.score : b.y - a.y);
    return candidates[0].val;
  }

  // Fallback heuristic: Find maximum price in the bottom 40%
  const startIdx = Math.floor(lines.length * 0.5);
  const fallback: number[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const text = lines[i].text;
    if (REJECT_WORDS.test(text)) continue;
    const matches = Array.from(text.matchAll(/(?:RM|\$)?\s*(\d{1,6}[.,]\d{2})\b/gi));
    for (const m of matches) {
      const val = parseAmount(m[1]);
      if (val !== null && val > 0 && val < 50000) fallback.push(val);
    }
  }

  return fallback.length > 0 ? Math.max(...fallback) : null;
}

export function extractSST(lines: OCRLine[]): number | null {
  for (const line of lines) {
    if (SST_ANCHORS.some((rx) => rx.test(line.text))) {
      const match = line.text.match(/(?:RM|\$)?\s*(\d{1,4}[.,]\d{2})\b/i);
      if (match) {
        const val = parseAmount(match[1]);
        if (val !== null && val >= 0) return val;
      }
    }
  }
  return null;
}

export function extractDiscount(lines: OCRLine[]): number | null {
  for (const line of lines) {
    if (DISCOUNT_ANCHORS.some((rx) => rx.test(line.text))) {
      const match = line.text.match(/(?:RM|\$)?\s*(\d{1,4}[.,]\d{2})\b/i);
      if (match) {
        const val = parseAmount(match[1]);
        if (val !== null && val >= 0) return val;
      }
    }
  }
  return null;
}

export function extractPaymentMethod(lines: OCRLine[]): string | null {
  const fullText = lines.map((l) => l.text).join(" ");
  for (const [pattern, method] of PAYMENT_METHODS) {
    if (pattern.test(fullText)) {
      return method;
    }
  }
  return null;
}

export function extractLineItems(lines: OCRLine[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  let inItemSection = false;

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;

    // Detect start of item table
    if (/\b(ITEM|DESCRIPTION|DESKRIPSI|PARTICULARS|QTY|KUANTITI|HARGA)\b/i.test(text)) {
      inItemSection = true;
      continue;
    }

    // Detect end of item table
    if (/\b(SUBTOTAL|TOTAL|JUMLAH|BAYARAN|DISKAUN|DISCOUNT|CUKAI|SST|CASH|TUNAI)\b/i.test(text)) {
      if (inItemSection) break;
    }

    if (inItemSection) {
      // Look for a line containing text and a price at the end
      const priceMatch = text.match(/(?:RM|\$)?\s*(\d{1,5}[.,]\d{2})\s*$/);
      if (priceMatch) {
        const price = parseAmount(priceMatch[1]) ?? undefined;
        let name = text.slice(0, priceMatch.index).trim();

        // Check for quantity (e.g., "2 x", "x2", or leading number)
        let quantity: number | undefined = undefined;
        const qtyMatch = name.match(/\b(\d+)\s*[xX]\b/) || name.match(/^[xX]?(\d+)\s+/);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1], 10);
          name = name.replace(qtyMatch[0], "").trim();
        }

        if (name && name.length >= 2) {
          items.push({ name, quantity, price });
        }
      }
    }
  }

  return items;
}

/**
 * Main rule-based receipt extractor.
 * Runs completely locally and deterministically with zero AI/LLM server calls.
 */
export function extractReceiptFromOCR(doc: OCRDocument): ExtractedReceiptData {
  const lines = doc.lines.filter((l) => l.text && l.text.trim().length > 0);
  const rawText = doc.text || lines.map((l) => l.text).join("\n");

  const merchant = extractMerchant(lines, doc.imageHeight);
  const receipt_date = extractDate(lines);
  const total = extractTotal(lines);
  const sst_amount = extractSST(lines);
  const discount = extractDiscount(lines);
  const payment_method = extractPaymentMethod(lines);
  const items = extractLineItems(lines);

  // Deterministic Malaysian category classifier
  const category: Category = classifyReceipt(merchant, rawText, null);

  return {
    merchant,
    receipt_date,
    total,
    currency: "MYR",
    category,
    items,
    raw_text: rawText,
    sst_amount,
    discount,
    payment_method,
  };
}
