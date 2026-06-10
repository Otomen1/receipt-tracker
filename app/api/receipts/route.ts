import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const result = await sql`
      SELECT * FROM receipts ORDER BY receipt_date DESC NULLS LAST, created_at DESC
    `;
    const rows = result.rows.map((r) => ({
      ...r,
      items: typeof r.items === "string" ? JSON.parse(r.items) : r.items ?? [],
    }));
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/receipts error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    } = body;

    const result = await sql`
      INSERT INTO receipts (merchant, receipt_date, total, currency, category, items, raw_text, file_url, file_type)
      VALUES (
        ${merchant || null},
        ${receipt_date || null},
        ${total ?? null},
        ${currency},
        ${category || null},
        ${JSON.stringify(items)},
        ${raw_text || null},
        ${file_url || null},
        ${file_type || null}
      )
      RETURNING *
    `;
    const row = result.rows[0];
    return NextResponse.json({
      ...row,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [],
    });
  } catch (err) {
    console.error("POST /api/receipts error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
