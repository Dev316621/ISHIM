import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  adminPropertyCard,
  cleanStr,
  jsonError,
  optionalInt,
  ownerAdminInclude,
  PROPERTY_STATUSES,
} from "@/app/api/_lib/helpers";

/**
 * GET /api/admin/properties?status=&mode=&skip=&limit= — role ADMIN.
 * ALL properties (any status, optional exact status and vertical filter) with
 * full owner info {id, name, phone, verified} + parsed arrays, newest first.
 * Offset pagination: skip (default 0) + limit (default 50, clamped 1..100).
 * Response envelope { items, total, hasMore }.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const status = cleanStr(req.nextUrl.searchParams.get("status")).toUpperCase();
    if (status && !PROPERTY_STATUSES.includes(status)) {
      return jsonError(`status must be one of: ${PROPERTY_STATUSES.join(", ")}`, 400);
    }

    const mode = cleanStr(req.nextUrl.searchParams.get("mode")).toUpperCase();
    if (mode && mode !== "HOME" && mode !== "BUSINESS") {
      return jsonError("mode must be HOME or BUSINESS", 400);
    }

    const limit = Math.min(Math.max(optionalInt(req.nextUrl.searchParams.get("limit")) ?? 50, 1), 100);
    const skip = Math.max(optionalInt(req.nextUrl.searchParams.get("skip")) ?? 0, 0);

    const where: Prisma.PropertyWhereInput = {};
    if (status) where.status = status;
    if (mode) where.mode = mode;

    const [properties, total] = await Promise.all([
      db.property.findMany({
        where,
        include: ownerAdminInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.property.count({ where }),
    ]);

    return NextResponse.json({
      items: properties.map(adminPropertyCard),
      total,
      hasMore: skip + properties.length < total,
    });
  } catch (err) {
    console.error("[admin/properties] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
