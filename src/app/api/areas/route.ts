import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getJsonBody,
  jsonError,
  publicSettings,
  stringArrayOrNull,
  upsertSettings,
  type AppSettings,
} from "@/app/api/_lib/helpers";

/**
 * PATCH /api/areas — staff-only (ADMIN + AGENT). The simple Areas editor:
 * add/remove ward & community-block names and set their photos, without
 * touching any other setting.
 *
 * Body (both optional, at least one required):
 *   { blocks?: string[]                      — the official ward list
 *     wardImages?: Record<string, string> }  — ward name → image url
 *
 * Returns the fresh public settings so every open panel updates live.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireRole(["ADMIN", "AGENT"]);
  if (guard.error) return guard.error;

  try {
    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const patch: Partial<AppSettings> = {};

    if ("blocks" in body) {
      const blocks = stringArrayOrNull(body.blocks);
      if (blocks === null) return jsonError("blocks must be an array of strings", 400);
      if (blocks.length > 200) return jsonError("Too many blocks", 400);
      patch.blocks = blocks;
    }

    if ("wardImages" in body) {
      const raw = body.wardImages;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return jsonError("wardImages must be an object keyed by ward name", 400);
      }
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const key = k.trim().slice(0, 60);
        if (!key) continue;
        if (typeof v === "string" && v.trim() && v.length <= 500) clean[key] = v.trim();
      }
      patch.wardImages = clean;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("Nothing to update", 400);
    }

    const settings = await upsertSettings(patch);
    return NextResponse.json(publicSettings(settings));
  } catch (err) {
    console.error("[areas] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
