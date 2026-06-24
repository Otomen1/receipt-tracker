import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM receipts WHERE id = ${params.id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const row = rows[0];
    return NextResponse.json({
      ...row,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [],
    });
  } catch (err) {
    console.error("GET /api/receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getDb();
    const body = await req.json();
    const { merchant, receipt_date, total, currency, category, items, sst_amount, discount, payment_method } = body;

    const rows = await sql`
      UPDATE receipts
      SET
        merchant = ${merchant ?? null},
        receipt_date = ${receipt_date ?? null},
        total = ${total ?? null},
        currency = ${currency ?? "MYR"},
        category = ${category ?? null},
        items = ${JSON.stringify(items ?? [])},
        sst_amount = ${sst_amount ?? null},
        discount = ${discount ?? null},
        payment_method = ${payment_method ?? null}
      WHERE id = ${params.id}
      RETURNING *
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const row = rows[0];
    return NextResponse.json({
      ...row,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [],
    });
  } catch (err) {
    console.error("PUT /api/receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getDb();
    await sql`DELETE FROM receipts WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
