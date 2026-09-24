import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";
import { maskTenantName } from "@/app/api/tenancies/_lib/tenancy";

/**
 * GET /api/properties/[id]/reviews — public.
 * Tenant feedback for this home: owner ratings + remarks ("notes for the
 * next tenants") with the reviewer's occupancy status. Names are masked
 * ("Ringson M."). Reviews without any rating or remark are hidden.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const property = await db.property.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!property) return jsonError("Property not found", 404);

    const rows = await db.tenancy.findMany({
      where: {
        propertyId: id,
        OR: [{ remark: { not: null } }, { ownerRating: { not: null } }],
      },
      include: { user: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });

    const rated = rows.filter((r) => typeof r.ownerRating === "number");
    const avg = rated.length
      ? Math.round((rated.reduce((sum, r) => sum + (r.ownerRating ?? 0), 0) / rated.length) * 10) / 10
      : null;

    return NextResponse.json({
      summary: {
        avg,
        count: rows.length,
        staying: rows.filter((r) => r.status === "STAYING").length,
      },
      reviews: rows.map((r) => ({
        id: r.id,
        status: r.status,
        ownerRating: r.ownerRating,
        remark: r.remark,
        updatedAt: r.updatedAt.toISOString(),
        tenant: maskTenantName(r.user.name),
      })),
    });
  } catch (err) {
    console.error("[properties/:id/reviews] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
