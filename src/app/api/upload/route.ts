import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "../_lib/helpers";
import { guard } from "@/lib/rate-limit";
import { ensureBucket, getStorage, STORAGE_BUCKET } from "@/lib/supabase";

/**
 * POST /api/upload — PUBLIC (guests attach photos to their quick-list
 * request; staff upload listing/banner/ward images). multipart/form-data
 * with a `file` field.
 *
 * Primary path: Supabase Storage (public bucket, CDN-backed, survives
 * deploys) — returns the permanent public URL. Fallback (no Supabase
 * env or Storage failure): legacy local disk under public/uploads
 * served by /api/files/<name>.
 *
 * Defence: fixed-window rate limit per IP, strict image type allowlist,
 * 6 MB cap, generated filename (client name is never trusted).
 */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limited = guard(req, "upload", 10);
  if (limited) return limited;
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("Expected multipart form data with a `file` field", 400);
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Attach an image in the `file` field", 400);
    const ext = ALLOWED[file.type];
    if (!ext) return jsonError("Please upload a JPG, PNG, WebP or GIF image", 400);
    if (file.size === 0) return jsonError("That file is empty", 400);
    if (file.size > MAX_BYTES) return jsonError("Image is too large — keep it under 6 MB", 400);

    const name = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    // ── Primary: Supabase Storage ────────────────────────────────
    const supa = getStorage();
    if (supa) {
      const ok = await ensureBucket(supa);
      if (ok) {
        const store = supa.storage.from(STORAGE_BUCKET);
        const { error } = await store.upload(name, bytes, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
        if (!error) {
          const { data } = store.getPublicUrl(name);
          return NextResponse.json({ url: data.publicUrl }, { status: 201 });
        }
        console.error("[upload] Supabase upload failed, falling back to disk:", error.message);
      }
    }

    // ── Fallback: local disk (legacy path, still served by /api/files) ──
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return NextResponse.json({ url: `/api/files/${name}` }, { status: 201 });
  } catch (err) {
    console.error("[upload] POST failed:", err);
    return jsonError("Upload failed — please try again", 500);
  }
}
