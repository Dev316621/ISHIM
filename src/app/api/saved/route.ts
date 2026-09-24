import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deviceFromReq, recordEvent } from "@/app/api/insights/_lib/insights";
import {
  cleanStr,
  getJsonBody,
  jsonError,
  ownerVerifiedInclude,
  publicPropertyCard,
} from "@/app/api/_lib/helpers";

/**
 * GET /api/saved — auth. Array of full property cards the user saved
 * (any status), newest saves first. `status` is included additively so the
 * client can badge saved homes that got rented/hidden.
 */
export async function GET() {
  try {
    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const saved = await db.savedHome.findMany({
      where: { userId: guard.user.id },
      include: { property: { include: ownerVerifiedInclude } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      saved.map((s) => ({ ...publicPropertyCard(s.property), status: s.property.status }))
    );
  } catch (err) {
    console.error("[saved] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/** POST /api/saved {propertyId} — auth. Toggle. Returns {saved:boolean}. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);
    const propertyId = cleanStr(body.propertyId);
    if (!propertyId) return jsonError("propertyId is required", 400);

    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) return jsonError("Property not found", 404);

    const existing = await db.savedHome.findUnique({
      where: { userId_propertyId: { userId: guard.user.id, propertyId } },
    });

    if (existing) {
      await db.savedHome.delete({ where: { id: existing.id } });
      return NextResponse.json({ saved: false });
    }

    await db.savedHome.create({
      data: { userId: guard.user.id, propertyId },
    });

    // Habit analytics: saving a home is a strong-intent signal.
    void recordEvent(
      { userId: guard.user.id, deviceId: deviceFromReq(req) },
      { kind: "SAVE", propertyId }
    );

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error("[saved] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
