import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProperty, fullProperty, jsonError, moveInFeeFor, readSettings } from "@/app/api/_lib/helpers";

/**
 * POST /api/properties/[id]/pay-fee
 * Owner / agent-of-owner / admin. Creates a Payment (amount = the phase-based
 * move-in fee — launch successFee during the 36-month free period,
 * standardMoveInFee after — or 0 with kind "WAIVED" when feeWaived), sets
 * feePaid=true and status="RENTED". Returns {property}.
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

    if (property.feePaid) {
      return jsonError("Success fee already paid for this listing", 400);
    }

    const settings = await readSettings();
    const waived = property.feeWaived;
    const amount = waived
      ? 0
      : moveInFeeFor(settings, property.mode === "BUSINESS" ? "BUSINESS" : "HOME");

    const [, updated] = await db.$transaction([
      db.payment.create({
        data: {
          propertyId: id,
          payerId: guard.user.id,
          amount,
          kind: waived ? "WAIVED" : "SUCCESS_FEE",
          method: "UPI",
        },
      }),
      db.property.update({
        where: { id },
        data: {
          feePaid: true,
          status: "RENTED",
          feeAmount: amount,
          rentedAt: property.rentedAt ?? new Date(),
        },
      }),
    ]);

    return NextResponse.json({ property: fullProperty(updated) });
  } catch (err) {
    console.error("[properties/[id]/pay-fee] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
