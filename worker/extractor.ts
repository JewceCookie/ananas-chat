/**
 * Text extraction from various document types.
 * Supports: PDF, DOCX, TXT, Markdown, HTML, CSV, and images (via AI description).
 */

import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type ExtractedText = {
  text: string;
  mimeType: string;
};

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const mime = mimeType.toLowerCase();

  if (mime === "application/pdf") {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "text/csv" ||
    mime === "text/html" ||
    filename.endsWith(".md") ||
    filename.endsWith(".txt") ||
    filename.endsWith(".csv")
  ) {
    return buffer.toString("utf-8");
  }

  // Images handled separately via AI description
  if (mime.startsWith("image/")) {
    return "";
  }

  return buffer.toString("utf-8");
}

export function isImageType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

/**
 * Split text into overlapping chunks for embedding.
 */
export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.trim().length > 0);
}
