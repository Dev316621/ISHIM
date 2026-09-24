import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import {
  parseTenancyFields,
  propertyRef,
  tenancyCard,
  type TenancyPatch,
} from "./_lib/tenancy";

/**
 * GET /api/tenancies — auth. The signed-in user's stays (with property
 * summaries) plus "contacted" candidates: homes they reached out to on
 * WhatsApp that they have not marked as a stay yet — used by the
 * "Add a stay" picker in the client profile.
 */
export async function GET() {
  try {
    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const tenancies = await db.tenancy.findMany({
      where: { userId: guard.user.id },
      include: { property: true },
      orderBy: { updatedAt: "desc" },
    });

    const markedIds = new Set(tenancies.map((t) => t.propertyId));

    const contactLogs = await db.contactLog.findMany({
      where: { userId: guard.user.id },
      orderBy: { createdAt: "desc" },
      distinct: ["propertyId"],
      take: 30,
    });

    const candidateIds = contactLogs
      .map((c) => c.propertyId)
      .filter((id) => !markedIds.has(id));

    const candidates = candidateIds.length
      ? await db.property.findMany({ where: { id: { in: candidateIds } } })
      : [];
    const byId = new Map(candidates.map((p) => [p.id, p]));

    const contacted = contactLogs
      .filter((c) => byId.has(c.propertyId))
      .map((c) =>
        propertyRef(byId.get(c.propertyId)!, { contactedAt: c.createdAt.toISOString() })
      );

    return NextResponse.json({ tenancies: tenancies.map(tenancyCard), contacted });
  } catch (err) {
    console.error("[tenancies] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * POST /api/tenancies {propertyId, status?, ownerRating?, remark?} — auth.
 * Creates the user's stay for a property, or updates it when one already
 * exists (idempotent "mark where I live" action). Returns the tenancy card.
 */
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

    const parsed = parseTenancyFields(body, { partial: true });
    if ("error" in parsed) return parsed.error;
    const data: TenancyPatch = parsed.data;

    const tenancy = await db.tenancy.upsert({
      where: {
        userId_propertyId: { userId: guard.user.id, propertyId },
      },
      create: {
        userId: guard.user.id,
        propertyId,
        status: data.status ?? "STAYING",
        ownerRating: data.ownerRating ?? null,
        remark: data.remark ?? null,
      },
      update: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerRating !== undefined ? { ownerRating: data.ownerRating } : {}),
        ...(data.remark !== undefined ? { remark: data.remark } : {}),
      },
      include: { property: true },
    });

    return NextResponse.json(tenancyCard(tenancy), { status: 201 });
  } catch (err) {
    console.error("[tenancies] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
