import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { extractReceiptData, extractReceiptDataFromUrl } from "@/lib/mistral";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Vercel Blob first (needed for PDF OCR URL)
    const blob = await put(file.name, buffer, {
      access: "public",
      contentType: fileType,
    });

    // Run OCR — PDFs use Mistral document OCR via URL, images use vision model
    let extracted;
    if (fileType === "application/pdf") {
      extracted = await extractReceiptDataFromUrl(blob.url);
    } else {
      const imageBase64 = buffer.toString("base64");
      extracted = await extractReceiptData(imageBase64, fileType);
    }

    return NextResponse.json({
      ...extracted,
      file_url: blob.url,
      file_type: fileType,
    });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
