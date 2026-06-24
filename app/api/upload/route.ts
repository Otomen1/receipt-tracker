import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { extractReceiptData, extractReceiptDataFromUrl, validateExtraction } from "@/lib/mistral";

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

    let extracted;

    if (fileType === "application/pdf") {
      extracted = await extractReceiptDataFromUrl(blob.url);
    } else {
      // Preprocess image: resize, grayscale, normalize, sharpen before OCR
      const processedBuffer = await sharp(buffer)
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 0.5 })
        .jpeg({ quality: 85 })
        .toBuffer();

      const imageBase64 = processedBuffer.toString("base64");
      extracted = await extractReceiptData(imageBase64, "image/jpeg");
    }

    const validation = validateExtraction(extracted);

    return NextResponse.json({
      ...extracted,
      file_url: blob.url,
      file_type: fileType,
      confidence: validation.confidence,
      warnings: validation.warnings,
    });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
