import sharp from "sharp";
import type { GrayImage } from "../receipt-engine/contracts";

/** Existing Sharp is a decoder only; all recognition is performed by our core. */
export async function decodeReceiptImage(bytes: Buffer, maxPixels = 8_000_000): Promise<GrayImage> {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Image is empty or exceeds 20 MiB");
  if (bytes.subarray(0, 4).toString() === "%PDF") throw new Error("Offline PDF rendering is not implemented; no cloud fallback was called");
  const decoder = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
  const metadata = await decoder.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Only JPEG, PNG, and WebP images are supported");
  // Refuse over-budget inputs rather than silently destroying small receipt text.
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) throw new Error("Image exceeds offline recognition pixel budget");
  const { data, info } = await decoder.rotate().flatten({ background: "#ffffff" }).greyscale().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error("Decoder did not produce grayscale pixels");
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}
