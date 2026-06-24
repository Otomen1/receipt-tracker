import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { extractReceiptData, extractReceiptDataFromUrl, validateExtraction } from "@/lib/mistral";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function detectMimeType(buf: Buffer): string | null {
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.slice(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const detectedType = detectMimeType(buffer);
    if (!detectedType) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload JPEG, PNG, WebP, or PDF." },
        { status: 415 }
      );
    }

    const ext = detectedType === "application/pdf" ? "pdf" : detectedType.split("/")[1];
    const blobName = `receipts/${crypto.randomUUID()}.${ext}`;
    const blob = await put(blobName, buffer, {
      access: "public",
      contentType: detectedType,
    });

    let extracted;

    if (detectedType === "application/pdf") {
      extracted = await extractReceiptDataFromUrl(blob.url);
    } else {
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
      file_type: detectedType,
      confidence: validation.confidence,
      warnings: validation.warnings,
    });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
