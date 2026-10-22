import type { ExtractedReceiptData, ValidationResult } from "../types";

export interface GrayImage { width: number; height: number; data: Uint8Array }
export type Matrix = [number, number, number, number, number, number, number, number, number];
export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export interface Box { x: number; y: number; width: number; height: number }
export interface BinaryPage extends GrayImage {
  /** Ink=1, background=0; coordinates map back to the decoded input. */
  toInput: Matrix;
  operations: string[];
}
export interface Candidate { character: string; distance: number; score: number }
export interface Glyph {
  box: Box;
  inputQuad: Quad;
  spaceBefore: boolean;
  character: string | null;
  candidates: Candidate[];
  score: number;
}
export interface TextLine { id: number; box: Box; glyphs: Glyph[]; text: string; score: number }
export type Role = "header" | "columns" | "item" | "summary" | "payment" | "footer";
export interface LayoutLine extends TextLine { role: Role }
export type State = "observed" | "derived" | "unreadable" | "unannotated";
export interface EvidenceField<T> { value: T | null; state: State; lineIds: number[]; score: number; corrected?: boolean }
export interface ParsedItem {
  name: EvidenceField<string>;
  quantity: EvidenceField<string>;
  unitPrice: EvidenceField<string>;
  lineAmount: EvidenceField<string>;
}
export interface ParsedReceipt {
  merchant: EvidenceField<string>;
  date: EvidenceField<string>;
  total: EvidenceField<string>;
  currency: EvidenceField<string>;
  tax: EvidenceField<string>;
  discount: EvidenceField<string>;
  payment: EvidenceField<string>;
  items: ParsedItem[];
  warnings: string[];
}
export interface Template {
  character: string;
  bitmap: string;
  aspect: number;
  relativeHeight: number;
  provenance: string;
}
export interface TemplateBank {
  schema: "receipt-templates/v1";
  width: number;
  height: number;
  sourceSplit: "development";
  source: { fontSha256: string; fontFile: string; licenseFile: string; generator: string; sizes: number[]; glyphManifestSha256?: string };
  templates: Template[];
}
export interface EngineOptions {
  threshold?: "adaptive" | "otsu";
  denoise?: boolean;
  deskew?: boolean;
  autoPerspective?: boolean;
  orientation?: "auto" | 0 | 90 | 180 | 270;
  quad?: Quad;
  minGlyphScore?: number;
  minGlyphMargin?: number;
  maxPixels?: number;
  /** Invoked inside large loops. A worker can enforce a hard deadline too. */
  checkpoint?: () => void;
}
export interface EngineResult {
  engine: "custom-classical-v1";
  data: ExtractedReceiptData;
  validation: ValidationResult;
  parsed: ParsedReceipt;
  lines: LayoutLine[];
  diagnostics: {
    operations: string[];
    unknownGlyphs: number;
    totalGlyphs: number;
    score: number;
    calibration: "uncalibrated";
    templateSource: "development";
  };
}
