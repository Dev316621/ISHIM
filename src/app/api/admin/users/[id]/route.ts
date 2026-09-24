import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole, sanitizeUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError, toBool, USER_ROLES } from "@/app/api/_lib/helpers";

/**
 * PATCH /api/admin/users/[id] — role ADMIN. {role?, verified?, banned?, name?}
 * Only provided fields are applied. An admin cannot ban or demote themselves.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return jsonError("User not found", 404);

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const data: Record<string, unknown> = {};

    if ("role" in body) {
      const role = cleanStr(body.role).toUpperCase();
      if (!USER_ROLES.includes(role)) {
        return jsonError(`role must be one of: ${USER_ROLES.join(", ")}`, 400);
      }
      if (id === guard.user.id && role !== "ADMIN") {
        return jsonError("You cannot demote your own account", 400);
      }
      data.role = role;
    }

    if ("verified" in body) {
      const verified = toBool(body.verified);
      if (verified === undefined) return jsonError("verified must be a boolean", 400);
      data.verified = verified;
    }

    if ("banned" in body) {
      const banned = toBool(body.banned);
      if (banned === undefined) return jsonError("banned must be a boolean", 400);
      if (id === guard.user.id && banned) {
        return jsonError("You cannot ban your own account", 400);
      }
      data.banned = banned;
    }

    if ("name" in body) {
      const name = cleanStr(body.name);
      if (!name) return jsonError("Name cannot be empty", 400);
      data.name = name;
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update", 400);

    const updated = await db.user.update({ where: { id }, data });
    return NextResponse.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error("[admin/users/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
