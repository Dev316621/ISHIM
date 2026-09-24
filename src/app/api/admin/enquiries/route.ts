import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, optionalInt, parseJsonArray } from "@/app/api/_lib/helpers";

const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED"] as const;
const ENQUIRY_KINDS = ["GENERAL", "VISIT"] as const;

/**
 * GET /api/admin/enquiries — ADMIN only.
 * Every lead on the platform: client → owner / agent enquiries, visit
 * bookings and contact reveals, with the property and both parties attached.
 *
 * Query: status? kind? mode? q? (name / phone / message / property title)
 *        skip=0 limit=50 (1..100)
 * Response envelope: { items, total, hasMore }
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const sp = req.nextUrl.searchParams;

    const status = sp.get("status")?.trim().toUpperCase() ?? "";
    if (status && !(ENQUIRY_STATUSES as readonly string[]).includes(status)) {
      return jsonError(`status must be one of: ${ENQUIRY_STATUSES.join(", ")}`, 400);
    }
    const kind = sp.get("kind")?.trim().toUpperCase() ?? "";
    if (kind && !(ENQUIRY_KINDS as readonly string[]).includes(kind)) {
      return jsonError(`kind must be one of: ${ENQUIRY_KINDS.join(", ")}`, 400);
    }
    const mode = sp.get("mode")?.trim().toUpperCase() ?? "";
    if (mode && !["HOME", "BUSINESS"].includes(mode)) {
      return jsonError("mode must be HOME or BUSINESS", 400);
    }
    const q = sp.get("q")?.trim() ?? "";
    const limit = Math.min(Math.max(optionalInt(sp.get("limit")) ?? 50, 1), 100);
    const skip = Math.max(optionalInt(sp.get("skip")) ?? 0, 0);

    const where = {
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
      ...(mode ? { property: { mode } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { message: { contains: q } },
              { property: { title: { contains: q } } },
              { property: { block: { contains: q } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.enquiry.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              block: true,
              photos: true,
              rent: true,
              status: true,
              mode: true,
              ownerId: true,
              listedByAgentId: true,
              owner: { select: { id: true, name: true, phone: true, verified: true } },
            },
          },
          handler: { select: { id: true, name: true, role: true, phone: true } },
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.enquiry.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map((e) => ({
        id: e.id,
        kind: e.kind,
        channel: e.channel,
        name: e.name,
        phone: e.phone,
        message: e.message,
        visitAt: e.visitAt?.toISOString() ?? null,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        property: {
          id: e.property.id,
          title: e.property.title,
          block: e.property.block,
          photos: parseJsonArray(e.property.photos),
          rent: e.property.rent,
          status: e.property.status,
          mode: e.property.mode,
          owner: e.property.owner,
          handledByAgent: Boolean(e.property.listedByAgentId),
        },
        handler: e.handler,
        requester: e.user,
      })),
      total,
      hasMore: skip + rows.length < total,
    });
  } catch (err) {
    console.error("[admin/enquiries] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
