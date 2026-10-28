import type { LayoutLine, Role, TextLine } from "./contracts";

export const summaryLabel = /^(?:(?:GRAND|NET)\s+TOTAL|AMOUNT\s+DUE|TOTAL(?:\s+(?:DUE|RM|MYR))?|JUMLAH(?:\s+(?:BESAR|AKHIR|RM|MYR))?|SUB\s*TOTAL|DISCOUNT|DISKAUN|SST|SERVICE\s+TAX|ROUNDING|PEMBUNDARAN)\b/i;
export const columnLabel = /\b(?:ITEM|DESCRIPTION|BUTIRAN|PRODUK|QTY|QUANTITY|KUANTITI|UNIT|AMOUNT)\b/i;
export const footerLabel = /^(?:THANK|TERIMA\s+KASIH|NOT\s+A\s+PURCHASE|BUKAN\s+PEMBELIAN|SYNTHETIC|UJIAN|TOTAL\s+ITEMS|ITEMS\s+COUNT)\b/i;
export function interpretLayout(lines: TextLine[]): LayoutLine[] {
  let started = false, summary = false;
  return lines.map(line => {
    const text = line.text.trim(); let role: Role = "header";
    if (footerLabel.test(text)) role = "footer";
    else if (/^(?:PAID\s+BY|BAYARAN|PAYMENT|CASH|TUNAI|CHANGE|BALANCE|BAKI|CARD|KAD)\b/i.test(text)) role = "payment";
    else if (summaryLabel.test(text) && !/^TOTAL\s+ITEMS/i.test(text)) { role = "summary"; summary = true; }
    else if ((text.match(new RegExp(columnLabel.source, "gi"))?.length ?? 0) >= 2 && !/\d+\.\d{2}\s*$/.test(text)) { role = "columns"; started = true; }
    else if (!summary && (started || /\S+.*\s-?\d[\d,]*\.\d{2}\s*$/.test(text))) { role = "item"; started = true; }
    return { ...line, role };
  });
}
