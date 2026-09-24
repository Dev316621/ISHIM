import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage (SERVER ONLY — uses the service_role key, never ship
 * this to the client). One bucket holds every uploaded image: property
 * photos, quick-list lead photos, ward images, ad banners, page banners.
 *
 * The bucket is created on first use (public read — images are meant to
 * be served straight from Supabase's CDN by their public URL) and the
 * result is cached per process so the check costs nothing afterwards.
 * If Supabase env vars are absent the upload route falls back to the
 * legacy local-disk path, so local dev keeps working without config.
 */

const BUCKET = "uploads";

let cached: SupabaseClient | null = null;
let bucketReady = false;

export function getStorage(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

/** Ensure the public bucket exists (self-healing; cached after first check). */
export async function ensureBucket(client: SupabaseClient): Promise<boolean> {
  if (bucketReady) return true;
  try {
    const { data: existing } = await client.storage.getBucket(BUCKET);
    if (existing) {
      bucketReady = true;
      return true;
    }
    const { error } = await client.storage.createBucket(BUCKET, { public: true });
    if (!error || /exists/i.test(error.message ?? "")) {
      bucketReady = true;
      return true;
    }
    console.error("[supabase] bucket create failed:", error.message);
    return false;
  } catch (err) {
    console.error("[supabase] ensureBucket failed:", err);
    return false;
  }
}

export const STORAGE_BUCKET = BUCKET;
