import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError, optionalInt, toBool } from "@/app/api/_lib/helpers";

export const AD_ACTIONS = ["SEARCH", "LIST", "URL"];

/**
 * GET /api/admin/ads — ADMIN. All banners (any active state), sortOrder asc.
 */
export async function GET() {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;
    const ads = await db.adBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(ads);
  } catch (err) {
    console.error("[admin/ads] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * POST /api/admin/ads — ADMIN. Create a banner.
 * { title required; kicker?, body?, ctaLabel?, action?(SEARCH|LIST|URL),
 *   actionUrl?, image?, active?, sortOrder? }
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const title = cleanStr(body.title);
    const image = cleanStr(body.image);
    if (!title) return jsonError("Title is required", 400);
    if (!image) return jsonError("Banner image is required", 400);

    const action = cleanStr(body.action).toUpperCase() || "SEARCH";
    if (!AD_ACTIONS.includes(action)) return jsonError("action must be SEARCH, LIST or URL", 400);
    const actionUrl = cleanStr(body.actionUrl);
    if (action === "URL" && !/^https?:\/\/.+/.test(actionUrl)) {
      return jsonError("A valid https:// link is required for URL actions", 400);
    }

    const ad = await db.adBanner.create({
      data: {
        title,
        kicker: cleanStr(body.kicker),
        body: cleanStr(body.body),
        ctaLabel: cleanStr(body.ctaLabel) || "Learn more",
        action,
        actionUrl,
        image,
        active: toBool(body.active) ?? true,
        sortOrder: optionalInt(body.sortOrder) ?? 0,
      },
    });
    return NextResponse.json({ ad }, { status: 201 });
  } catch (err) {
    console.error("[admin/ads] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
