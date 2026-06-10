export interface ReceiptItem {
  name: string;
  quantity?: number;
  price?: number;
}

export interface Receipt {
  id: string;
  created_at: string;
  merchant: string | null;
  receipt_date: string | null;
  total: number | null;
  currency: string;
  category: string | null;
  items: ReceiptItem[];
  raw_text: string | null;
  file_url: string | null;
  file_type: string | null;
}

export type Category =
  | "Groceries"
  | "Restaurant"
  | "Transport"
  | "Shopping"
  | "Other";

export interface ExtractedReceiptData {
  merchant: string | null;
  receipt_date: string | null;
  total: number | null;
  currency: string;
  category: Category | null;
  items: ReceiptItem[];
  raw_text: string | null;
}
