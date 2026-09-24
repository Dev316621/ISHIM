import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth, } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordEvent, resolveIdentity } from "@/app/api/insights/_lib/insights";
import {
  BUSINESS_TYPES,
  CANONICAL_HOUSE_TYPES,
  KITCHEN_TYPES,
  canManageProperty,
  cleanStr,
  fullProperty,
  getJsonBody,
  jsonError,
  optionalInt,
  ownerVerifiedInclude,
  publicPropertyCard,
  stringArrayOrNull,
  toBool,
} from "@/app/api/_lib/helpers";
import { queueAreaRequest, resolveBlock } from "../../_lib/area-requests";

/**
 * GET /api/properties/[id] — public detail. Same card shape as the list
 * (owner: {verified} only, privacy). Increments `views`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await db.property.findUnique({
      where: { id },
      include: ownerVerifiedInclude,
    });
    if (!existing) return jsonError("Property not found", 404);

    const property = await db.property.update({
      where: { id },
      data: { views: { increment: 1 } },
      include: ownerVerifiedInclude,
    });

    // Habit analytics: a detail open counts as a VIEW event.
    void recordEvent(await resolveIdentity(req), { kind: "VIEW", propertyId: id });

    return NextResponse.json(publicPropertyCard(property));
  } catch (err) {
    console.error("[properties/[id]] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * PATCH /api/properties/[id] — owner / agent-of-owner edit their own listing
 * (only while status is PENDING / ACTIVE / HIDDEN). Admin can edit any.
 * Status itself is NOT editable here — use the dedicated actions
 * (relist / pay-fee / admin PATCH).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireAuth();
    if (guard.error) return guard.error;
    const user = guard.user;

    const property = await db.property.findUnique({ where: { id } });
    if (!property) return jsonError("Property not found", 404);

    const isAdmin = user.role === "ADMIN";
    if (!isAdmin) {
      const allowed = await canManageProperty(user, property);
      if (!allowed) return jsonError("You can only edit your own listings", 403);
      if (!["PENDING", "ACTIVE", "HIDDEN"].includes(property.status)) {
        return jsonError("This listing can no longer be edited", 400);
      }
    }

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = cleanStr(body.title);
      if (!title) return jsonError("Title cannot be empty", 400);
      data.title = title;
    }
    if ("description" in body) {
      data.description = typeof body.description === "string" ? body.description.trim() : "";
    }
    if ("block" in body) {
      const rawBlock = cleanStr(body.block);
      if (!rawBlock) return jsonError("Block cannot be empty", 400);
      const { block, known } = await resolveBlock(rawBlock);
      data.block = block;
      if (!known && block !== property.block) {
        // Editing a listing onto an area that isn't official yet — queue it
        // so the team adds it to the browse lists (best-effort, non-fatal).
        await queueAreaRequest({
          name: block,
          mode: property.mode,
          requesterName: user.name,
          requesterPhone: user.phone,
          note: `From listing “${property.title}” (edit)`,
          source: "LISTING",
        });
      }
    }
    if ("houseType" in body) {
      const houseType = cleanStr(body.houseType).toUpperCase();
      if (!houseType) return jsonError("House type cannot be empty", 400);
      // Validate against the listing's own vertical — business spaces use
      // SHOP/OFFICE/… types, residential uses ASSAM_TYPE/RCC/…
      const allowedTypes = property.mode === "BUSINESS" ? BUSINESS_TYPES : CANONICAL_HOUSE_TYPES;
      if (!allowedTypes.includes(houseType)) {
        return jsonError(`House type must be one of: ${allowedTypes.join(", ")}`, 400);
      }
      data.houseType = houseType;
    }
    if ("rent" in body) {
      const rent = optionalInt(body.rent);
      if (rent === undefined || rent <= 0) return jsonError("Rent must be a positive number", 400);
      data.rent = rent;
    }
    if ("deposit" in body) {
      const deposit = optionalInt(body.deposit);
      if (deposit === undefined || deposit < 0) {
        return jsonError("Deposit cannot be negative", 400);
      }
      data.deposit = deposit;
    }
    if ("bedrooms" in body) {
      const bedrooms = optionalInt(body.bedrooms);
      if (bedrooms === undefined || bedrooms < 0) {
        return jsonError("Bedrooms cannot be negative", 400);
      }
      data.bedrooms = bedrooms;
    }
    if ("bathrooms" in body) {
      const bathrooms = optionalInt(body.bathrooms);
      if (bathrooms === undefined || bathrooms < 0) {
        return jsonError("Bathrooms cannot be negative", 400);
      }
      data.bathrooms = bathrooms;
    }
    if ("kitchen" in body) {
      const kitchen = cleanStr(body.kitchen).toUpperCase();
      if (kitchen && !KITCHEN_TYPES.includes(kitchen)) {
        return jsonError(`kitchen must be one of: ${KITCHEN_TYPES.join(", ")}`, 400);
      }
      data.kitchen = kitchen || null;
    }
    if ("areaSqft" in body) {
      const areaSqft = optionalInt(body.areaSqft);
      if (areaSqft !== undefined && areaSqft <= 0) {
        return jsonError("Size must be a positive number", 400);
      }
      data.areaSqft = areaSqft ?? null;
    }
    if ("widthFt" in body) {
      const widthFt = optionalInt(body.widthFt);
      if (widthFt !== undefined && widthFt <= 0) {
        return jsonError("Width must be a positive number", 400);
      }
      data.widthFt = widthFt ?? null;
    }
    if ("amenities" in body) {
      const amenities = stringArrayOrNull(body.amenities);
      if (amenities === null) return jsonError("amenities must be an array of strings", 400);
      data.amenities = JSON.stringify(amenities);
    }
    if ("photos" in body) {
      const photos = stringArrayOrNull(body.photos);
      if (photos === null) return jsonError("photos must be an array of strings", 400);
      data.photos = JSON.stringify(photos);
    }
    if ("contactRoute" in body) {
      const contactRoute = cleanStr(body.contactRoute).toUpperCase();
      if (!["OWNER", "AGENT"].includes(contactRoute)) {
        return jsonError("contactRoute must be OWNER or AGENT", 400);
      }
      data.contactRoute = contactRoute;
    }
    if ("negotiable" in body) {
      const negotiable = toBool(body.negotiable);
      if (negotiable === undefined) return jsonError("negotiable must be a boolean", 400);
      data.negotiable = negotiable;
    }
    if ("status" in body) {
      return jsonError(
        "Status cannot be changed here — use mark-rented, pay-fee or relist (admin: PATCH /api/admin/properties/[id])",
        400
      );
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update", 400);

    const updated = await db.property.update({ where: { id }, data });
    return NextResponse.json({ property: fullProperty(updated) });
  } catch (err) {
    console.error("[properties/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
