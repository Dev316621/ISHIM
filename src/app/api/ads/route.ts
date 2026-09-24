import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/ads — public.
 * Active carousel banners ordered by sortOrder (asc), then createdAt.
 * Returns a bare JSON array.
 */
export async function GET() {
  try {
    const ads = await db.adBanner.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kicker: true,
        title: true,
        body: true,
        ctaLabel: true,
        action: true,
        actionUrl: true,
        image: true,
      },
    });
    return NextResponse.json(ads);
  } catch (err) {
    console.error("[ads] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
