import { readFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * GET /api/files/[name] — serves images uploaded to public/uploads via
 * POST /api/upload. Reads the file at request time so uploads work in
 * both `next dev` and standalone production builds (runtime-added files
 * under public/ are not picked up by a prebuilt standalone bundle).
 * Filenames are server-generated (`<base36>-<uuid>.<ext>`); the pattern
 * check below blocks anything path-shaped.
 */
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith(".")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "uploads", name));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
