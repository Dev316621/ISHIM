import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canManageProperty,
  cleanStr,
  getJsonBody,
  jsonError,
} from "@/app/api/_lib/helpers";

/** Accepts 10-digit Indian mobiles, with optional +91/91 prefix. */
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/**
 * POST /api/move-ins — ADMIN or AGENT record a successful move-in on a home.
 * Body: { propertyId, tenantPhone (10-digit), tenantName? }
 *
 * Creates (or re-marks) the tenant's Tenancy with status STAYING so it shows
 * in the owner's dashboard "Successful move-ins" section. The tenant user is
 * found by phone and created on the spot when they've never signed up — the
 * platform keeps one identity per number. Agents may only mark homes they
 * manage (own listing, own home, or linked via AgentOwner); admins any home.
 * This intentionally does NOT flip the listing to RENTED — that stays with the
 * owner-driven "Mark as rented" success-fee flow.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN", "AGENT"]);
    if (guard.error) return guard.error;
    const user = guard.user;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const propertyId = cleanStr(body.propertyId);
    if (!propertyId) return jsonError("propertyId is required", 400);

    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, ownerId: true, listedByAgentId: true, status: true },
    });
    if (!property) return jsonError("Property not found", 404);

    if (user.role !== "ADMIN") {
      const allowed = await canManageProperty(user, property);
      if (!allowed) {
        return jsonError("You can only mark move-ins on homes you manage", 403);
      }
    }

    const phone = normalizePhone(cleanStr(body.tenantPhone));
    if (!phone) {
      return jsonError("Enter a valid 10-digit tenant phone number", 400);
    }
    const tenantName = cleanStr(body.tenantName);

    let tenant = await db.user.findUnique({ where: { phone } });
    if (!tenant) {
      tenant = await db.user.create({
        data: {
          phone,
          name: tenantName || `Tenant ${phone}`,
          role: "CLIENT",
          whatsappNumber: phone,
        },
      });
    }

    const tenancy = await db.tenancy.upsert({
      where: { userId_propertyId: { userId: tenant.id, propertyId } },
      update: { status: "STAYING" },
      create: { userId: tenant.id, propertyId, status: "STAYING" },
    });

    return NextResponse.json(
      {
        tenancy: { id: tenancy.id, status: tenancy.status },
        tenant: { name: tenant.name, phone: tenant.phone },
        property: { id: property.id, title: property.title },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[move-ins] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
