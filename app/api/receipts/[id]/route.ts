import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function normalizeReceiptRow(r: any) {
  return {
    ...r,
    total: r.total != null ? parseFloat(r.total) : null,
    sst_amount: r.sst_amount != null ? parseFloat(r.sst_amount) : null,
    discount: r.discount != null ? parseFloat(r.discount) : null,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items ?? [],
  };
}

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
    return NextResponse.json(normalizeReceiptRow(rows[0]));
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
        total = ${total != null ? parseFloat(total) : null},
        currency = ${currency ?? "MYR"},
        category = ${category ?? null},
        items = ${JSON.stringify(items ?? [])},
        sst_amount = ${sst_amount != null ? parseFloat(sst_amount) : null},
        discount = ${discount != null ? parseFloat(discount) : null},
        payment_method = ${payment_method ?? null}
      WHERE id = ${params.id}
      RETURNING *
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(normalizeReceiptRow(rows[0]));
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
