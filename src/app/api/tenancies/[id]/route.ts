import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import { parseTenancyFields, tenancyCard } from "../_lib/tenancy";

/**
 * PATCH /api/tenancies/[id] — auth, own tenancy only.
 * Any of {status, ownerRating, remark} may be provided; only provided
 * fields are applied (ownerRating/remark accept null to clear).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const tenancy = await db.tenancy.findUnique({ where: { id } });
    if (!tenancy) return jsonError("Tenancy not found", 404);
    if (tenancy.userId !== guard.user.id) {
      return jsonError("You can only edit your own stays", 403);
    }

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const parsed = parseTenancyFields(body, { partial: true });
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;
    if (!Object.keys(data).length) return jsonError("Nothing to update", 400);

    const updated = await db.tenancy.update({
      where: { id },
      data,
      include: { property: true },
    });

    return NextResponse.json(tenancyCard(updated));
  } catch (err) {
    console.error("[tenancies/:id] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/** DELETE /api/tenancies/[id] — auth, own tenancy only. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireAuth();
    if (guard.error) return guard.error;

    const tenancy = await db.tenancy.findUnique({ where: { id } });
    if (!tenancy) return jsonError("Tenancy not found", 404);
    if (tenancy.userId !== guard.user.id) {
      return jsonError("You can only remove your own stays", 403);
    }

    await db.tenancy.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tenancies/:id] DELETE failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
