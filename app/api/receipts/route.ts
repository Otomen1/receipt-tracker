import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM receipts ORDER BY receipt_date DESC NULLS LAST, created_at DESC
    `;
    return NextResponse.json(rows.map((r) => ({
      ...r,
      items: typeof r.items === "string" ? JSON.parse(r.items) : r.items ?? [],
    })));
  } catch (err) {
    console.error("GET /api/receipts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getDb();
    const body = await req.json();
    const {
      merchant,
      receipt_date,
      total,
      currency = "MYR",
      category,
      items = [],
      raw_text,
      file_url,
      file_type,
      sst_amount,
      discount,
      payment_method,
    } = body;

    const rows = await sql`
      INSERT INTO receipts (merchant, receipt_date, total, currency, category, items, raw_text, file_url, file_type, sst_amount, discount, payment_method)
      VALUES (
        ${(merchant || null)?.slice(0, 255) ?? null},
        ${receipt_date || null},
        ${total ?? null},
        ${(currency ?? "MYR").slice(0, 10)},
        ${(category || null)?.slice(0, 100) ?? null},
        ${JSON.stringify(items)},
        ${(raw_text || null)?.slice(0, 50000) ?? null},
        ${(file_url || null)?.slice(0, 500) ?? null},
        ${(file_type || null)?.slice(0, 20) ?? null},
        ${sst_amount ?? null},
        ${discount ?? null},
        ${(payment_method || null)?.slice(0, 50) ?? null}
      )
      RETURNING *
    `;
    const row = rows[0];
    return NextResponse.json({
      ...row,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [],
    });
  } catch (err) {
    console.error("POST /api/receipts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
