import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, parseJsonArray } from "@/app/api/_lib/helpers";
import type { TenancyStatus } from "@/lib/types";

/**
 * GET /api/owner/move-ins — the signed-in OWNER's successful move-ins: every
 * tenant stay recorded on their homes (by tenants themselves, or marked on
 * their behalf by admins / agents). Feeds the owner dashboard's
 * "Successful move-ins" section. Admins pass through and see everything.
 */
export async function GET() {
  try {
    const guard = await requireRole(["OWNER", "ADMIN"]);
    if (guard.error) return guard.error;
    const user = guard.user;

    const tenancies = await db.tenancy.findMany({
      where: user.role === "ADMIN" ? {} : { property: { ownerId: user.id } },
      include: {
        // Schema relation for the tenant is `user` — mapped to `tenant` in the
        // response below to keep the API contract the dashboard expects.
        user: { select: { name: true, phone: true } },
        property: {
          select: {
            id: true,
            title: true,
            block: true,
            photos: true,
            rent: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      tenancies.map((t) => ({
        id: t.id,
        status: t.status as TenancyStatus,
        ownerRating: t.ownerRating,
        remark: t.remark,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        tenant: { name: t.user.name, phone: t.user.phone },
        property: {
          id: t.property.id,
          title: t.property.title,
          block: t.property.block,
          photos: parseJsonArray(t.property.photos),
          rent: t.property.rent,
          status: t.property.status,
        },
      }))
    );
  } catch (err) {
    console.error("[owner/move-ins] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
