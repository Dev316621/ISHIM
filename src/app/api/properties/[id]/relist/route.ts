import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProperty, fullProperty, jsonError } from "@/app/api/_lib/helpers";

/**
 * POST /api/properties/[id]/relist
 * Owner / agent-of-owner / admin. RENTED or ACTIVE → PENDING for re-listing;
 * clears rentedAt and feePaid. Returns {property}.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const property = await db.property.findUnique({ where: { id } });
    if (!property) return jsonError("Property not found", 404);

    const allowed = await canManageProperty(guard.user, property);
    if (!allowed) return jsonError("You can only manage your own listings", 403);

    if (!["RENTED", "ACTIVE"].includes(property.status)) {
      return jsonError("Only rented or active listings can be re-listed", 400);
    }

    const updated = await db.property.update({
      where: { id },
      data: {
        status: "PENDING",
        rentedAt: null,
        feePaid: false,
      },
    });

    return NextResponse.json({ property: fullProperty(updated) });
  } catch (err) {
    console.error("[properties/[id]/relist] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
