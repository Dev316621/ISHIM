import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  adminPropertyCard,
  cleanStr,
  getJsonBody,
  jsonError,
  optionalInt,
  ownerAdminInclude,
  PROPERTY_STATUSES,
  toBool,
} from "@/app/api/_lib/helpers";

/**
 * PATCH /api/admin/properties/[id] — role ADMIN. God-mode edit; only provided
 * fields are applied: {status?, featured?, feeWaived?, rejectionReason?,
 * rent?, block?, title?}.
 * Approve = PENDING→ACTIVE (clears rejectionReason). Reject = status REJECTED
 * + rejectionReason. feeWaived=true marks the success fee as waived (no
 * payment needed).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const property = await db.property.findUnique({ where: { id } });
    if (!property) return jsonError("Property not found", 404);

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const data: Record<string, unknown> = {};

    if ("status" in body) {
      const status = cleanStr(body.status).toUpperCase();
      if (!PROPERTY_STATUSES.includes(status)) {
        return jsonError(`status must be one of: ${PROPERTY_STATUSES.join(", ")}`, 400);
      }
      data.status = status;
      if (status === "ACTIVE") {
        // Approving clears any previous rejection reason.
        data.rejectionReason = null;
      }
    }

    if ("rejectionReason" in body) {
      const reason = body.rejectionReason === null ? "" : cleanStr(body.rejectionReason);
      if (reason) {
        data.rejectionReason = reason;
      } else if (!("status" in body) || data.status !== "ACTIVE") {
        data.rejectionReason = null;
      }
    }

    if ("featured" in body) {
      const featured = toBool(body.featured);
      if (featured === undefined) return jsonError("featured must be a boolean", 400);
      data.featured = featured;
    }

    if ("feeWaived" in body) {
      const feeWaived = toBool(body.feeWaived);
      if (feeWaived === undefined) return jsonError("feeWaived must be a boolean", 400);
      data.feeWaived = feeWaived;
    }

    if ("rent" in body) {
      const rent = optionalInt(body.rent);
      if (rent === undefined || rent <= 0) return jsonError("Rent must be a positive number", 400);
      data.rent = rent;
    }

    if ("block" in body) {
      const block = cleanStr(body.block);
      if (!block) return jsonError("Block cannot be empty", 400);
      data.block = block;
    }

    if ("title" in body) {
      const title = cleanStr(body.title);
      if (!title) return jsonError("Title cannot be empty", 400);
      data.title = title;
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update", 400);

    const updated = await db.property.update({
      where: { id },
      data,
      include: ownerAdminInclude,
    });

    return NextResponse.json({ property: adminPropertyCard(updated) });
  } catch (err) {
    console.error("[admin/properties/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
