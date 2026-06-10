import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { extractReceiptData } from "@/lib/gemini";
import { pdfToBase64Image } from "@/lib/pdf-to-image";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileType = file.type; // e.g. "image/jpeg", "application/pdf"
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Vercel Blob
    const blob = await put(file.name, buffer, {
      access: "public",
      contentType: fileType,
    });

    // Convert to image for OCR
    let imageBase64: string;
    let imageMimeType: string;

    if (fileType === "application/pdf") {
      const converted = await pdfToBase64Image(buffer);
      imageBase64 = converted.base64;
      imageMimeType = converted.mimeType;
    } else {
      imageBase64 = buffer.toString("base64");
      imageMimeType = fileType;
    }

    // Run OCR
    const extracted = await extractReceiptData(imageBase64, imageMimeType);

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
