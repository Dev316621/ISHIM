import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fullProperty, jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/my/properties — auth. All properties owned by the user or listed by
 * them as agent (any status), newest first, with parsed arrays.
 */
export async function GET() {
  try {
    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const properties = await db.property.findMany({
      where: {
        OR: [{ ownerId: guard.user.id }, { listedByAgentId: guard.user.id }],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(properties.map(fullProperty));
  } catch (err) {
    console.error("[my/properties] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
