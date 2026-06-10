import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        merchant VARCHAR(255),
        receipt_date DATE,
        total NUMERIC(10,2),
        currency VARCHAR(10) DEFAULT 'MYR',
        category VARCHAR(100),
        items JSONB DEFAULT '[]',
        raw_text TEXT,
        file_url TEXT,
        file_type VARCHAR(20)
      )
    `;
    return NextResponse.json({ ok: true, message: "Table created or already exists" });
  } catch (err) {
    console.error("init-db error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
