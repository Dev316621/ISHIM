import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PROPERTY_MODES, jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/properties/stats?mode=HOME|BUSINESS
 * Public: number of ACTIVE listings per community block (+ total), optionally
 * filtered to one vertical. Powers the "Browse by block" tiles with live
 * counts. Static route takes precedence over /api/properties/[id].
 */
export async function GET(req: NextRequest) {
  try {
    const mode = (req.nextUrl.searchParams.get("mode") ?? "").toUpperCase();
    const where: { status: string; mode?: string } = { status: "ACTIVE" };
    if (mode) {
      if (!PROPERTY_MODES.includes(mode)) {
        return jsonError(`mode must be one of: ${PROPERTY_MODES.join(", ")}`, 400);
      }
      where.mode = mode;
    }

    const grouped = await db.property.groupBy({
      by: ["block"],
      _count: { _all: true },
      where,
    });

    const counts: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      counts[g.block] = g._count._all;
      total += g._count._all;
    }

    return NextResponse.json({ counts, total });
  } catch (err) {
    console.error("[properties/stats] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
