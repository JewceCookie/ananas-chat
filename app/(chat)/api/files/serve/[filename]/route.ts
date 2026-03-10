import { NextResponse } from "next/server";
import { getFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const decoded = decodeURIComponent(filename);
    const buffer = await getFile(decoded);
    return new Response(new Uint8Array(buffer));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
