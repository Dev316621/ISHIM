import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProperty, jsonError, moveInFeeFor, readSettings } from "@/app/api/_lib/helpers";

/**
 * POST /api/properties/[id]/mark-rented
 * Owner / agent-of-owner / admin. Sets rentedAt=now but KEEPS status ACTIVE
 * (fee enforcement model — the listing stays live until the fee is paid).
 * Returns {fee, upiId:"ishim@upi", feePaid, feeWaived}.
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

    // First call stamps rentedAt (starts the 30-day fee window). Repeat calls
    // (used as the "pay later" entry point) must NOT reset the clock.
    const updated = await db.property.update({
      where: { id },
      data: property.rentedAt ? {} : { rentedAt: new Date() },
    });

    const settings = await readSettings();

    return NextResponse.json({
      fee: moveInFeeFor(settings, property.mode === "BUSINESS" ? "BUSINESS" : "HOME"),
      upiId: "ishim@upi",
      feePaid: updated.feePaid,
      feeWaived: updated.feeWaived,
    });
  } catch (err) {
    console.error("[properties/[id]/mark-rented] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
