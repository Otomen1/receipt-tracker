import { OCRDocument, OCRLine, extractReceiptFromOCR } from "./rules-extractor";
import { ExtractedReceiptData } from "./types";

/**
 * Interface for Local OCR engines (Tesseract, PaddleOCR-ONNX, or Custom Model)
 */
export interface LocalOCREngine {
  recognize(imageBuffer: Buffer): Promise<OCRDocument>;
}

/**
 * Fallback Text-Parser for documents where text is already extracted (e.g., digital PDFs)
 */
export function parseRawTextToOCRDocument(rawText: string): OCRDocument {
  const lines: OCRLine[] = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text, idx) => ({
      text,
      bbox: {
        x: 10,
        y: idx * 25,
        width: text.length * 10,
        height: 18,
      },
    }));

  return {
    text: rawText,
    lines,
    imageHeight: lines.length * 25 + 50,
    imageWidth: 600,
  };
}

/**
 * Run rule-based extraction from an OCR Document
 */
export function processReceiptOCR(doc: OCRDocument): ExtractedReceiptData {
  return extractReceiptFromOCR(doc);
}
