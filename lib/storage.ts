import { createWriteStream, mkdirSync } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

export interface StoredFile {
  url: string;
  pathname: string;
  contentType: string;
}

function getPublicUrl(pathname: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/files/serve/${encodeURIComponent(pathname)}`;
}

export async function putFile(
  filename: string,
  data: ArrayBuffer | Uint8Array,
  options: { contentType?: string } = {}
): Promise<StoredFile> {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const pathname = `${timestamp}-${safeName}`;
  const destDir = UPLOADS_DIR;

  await mkdir(destDir, { recursive: true });

  const fullPath = path.join(destDir, pathname);
  const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data);
  await import("node:fs/promises").then((fs) => fs.writeFile(fullPath, buffer));

  return {
    url: getPublicUrl(pathname),
    pathname,
    contentType: options.contentType ?? "application/octet-stream",
  };
}

export async function deleteFile(pathname: string): Promise<void> {
  const fullPath = path.join(UPLOADS_DIR, path.basename(pathname));
  try {
    await unlink(fullPath);
  } catch {
    // ignore if already deleted
  }
}

export async function getFile(pathname: string): Promise<Buffer> {
  const fullPath = path.join(UPLOADS_DIR, path.basename(pathname));
  return readFile(fullPath);
}
