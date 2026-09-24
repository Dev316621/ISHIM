import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/admin/stats?mode= — role ADMIN.
 * {users:{total,byRole}, properties:{total,byStatus}, revenueTotal,
 *  paymentsCount, whatsappClicks, feeDueCount}
 * feeDue = rentedAt set && !feePaid && !feeWaived.
 * Optional `?mode=HOME|BUSINESS` scopes property/revenue/click/fee stats to
 * one vertical (users are cross-vertical and always reported globally).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const rawMode = (req.nextUrl.searchParams.get("mode") ?? "").toUpperCase();
    if (rawMode && rawMode !== "HOME" && rawMode !== "BUSINESS") {
      return jsonError("mode must be HOME or BUSINESS", 400);
    }
    const mode = rawMode || null;
    const propWhere = mode ? { mode } : {};

    const [usersByRole, propsByStatus, totalUsers, totalProperties, revenue, paymentsCount, clicks, feeDueCount] =
      await Promise.all([
        db.user.groupBy({ by: ["role"], _count: { _all: true } }),
        db.property.groupBy({ by: ["status"], _count: { _all: true }, where: propWhere }),
        db.user.count(),
        db.property.count({ where: propWhere }),
        db.payment.aggregate({
          _sum: { amount: true },
          where: mode ? { property: { mode } } : {},
        }),
        db.payment.count({ where: mode ? { property: { mode } } : {} }),
        db.property.aggregate({
          _sum: { whatsappClicks: true },
          where: propWhere,
        }),
        db.property.count({
          where: {
            ...propWhere,
            rentedAt: { not: null },
            feePaid: false,
            feeWaived: false,
          },
        }),
      ]);

    const byRole: Record<string, number> = { CLIENT: 0, OWNER: 0, AGENT: 0, ADMIN: 0 };
    for (const row of usersByRole) byRole[row.role] = row._count._all;

    const byStatus: Record<string, number> = {
      PENDING: 0,
      ACTIVE: 0,
      RENTED: 0,
      HIDDEN: 0,
      REJECTED: 0,
    };
    for (const row of propsByStatus) byStatus[row.status] = row._count._all;

    return NextResponse.json({
      users: { total: totalUsers, byRole },
      properties: { total: totalProperties, byStatus },
      revenueTotal: revenue._sum.amount ?? 0,
      paymentsCount,
      whatsappClicks: clicks._sum.whatsappClicks ?? 0,
      feeDueCount,
    });
  } catch (err) {
    console.error("[admin/stats] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
