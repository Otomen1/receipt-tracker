import { fromPath } from "pdf2pic";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function pdfToBase64Image(
  pdfBuffer: Buffer
): Promise<{ base64: string; mimeType: string }> {
  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `receipt-${Date.now()}.pdf`);
  const tmpOutputDir = path.join(tmpDir, `receipt-img-${Date.now()}`);

  fs.mkdirSync(tmpOutputDir, { recursive: true });
  fs.writeFileSync(tmpPdf, pdfBuffer);

  try {
    const convert = fromPath(tmpPdf, {
      density: 150,
      saveFilename: "page",
      savePath: tmpOutputDir,
      format: "jpeg",
      width: 1200,
      height: 1600,
    });

    const result = await convert(1);
    const imagePath = result.path;
    if (!imagePath) {
      throw new Error("PDF conversion produced no output");
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");

    // Cleanup
    fs.unlinkSync(tmpPdf);
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });

    return { base64, mimeType: "image/jpeg" };
  } catch (err) {
    // Cleanup on error
    try {
      fs.unlinkSync(tmpPdf);
      fs.rmSync(tmpOutputDir, { recursive: true, force: true });
    } catch {}
    throw err;
  }
}
