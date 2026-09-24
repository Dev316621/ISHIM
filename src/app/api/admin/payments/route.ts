import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/admin/payments?mode= — role ADMIN. All payments with property title
 * and payer info, newest first. Optional ?mode=HOME|BUSINESS vertical filter.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const mode = (req.nextUrl.searchParams.get("mode") ?? "").toUpperCase();
    if (mode && mode !== "HOME" && mode !== "BUSINESS") {
      return jsonError("mode must be HOME or BUSINESS", 400);
    }

    const payments = await db.payment.findMany({
      where: mode ? { property: { mode } } : {},
      include: {
        property: { select: { id: true, title: true, mode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Payment.payerId is a plain string (no Prisma relation) — resolve payers manually.
    const payerIds = Array.from(new Set(payments.map((p) => p.payerId)));
    const payers = await db.user.findMany({
      where: { id: { in: payerIds } },
      select: { id: true, name: true, phone: true },
    });
    const payerMap = new Map(payers.map((u) => [u.id, u]));

    return NextResponse.json(
      payments.map((p) => {
        const payer = payerMap.get(p.payerId);
        return {
          id: p.id,
          propertyId: p.propertyId,
          property: { id: p.property.id, title: p.property.title, mode: p.property.mode },
          payer: payer
            ? { id: payer.id, name: payer.name, phone: payer.phone }
            : { id: p.payerId, name: "Unknown", phone: "" },
          amount: p.amount,
          kind: p.kind,
          method: p.method,
          createdAt: p.createdAt,
        };
      })
    );
  } catch (err) {
    console.error("[admin/payments] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
