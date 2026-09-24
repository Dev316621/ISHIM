import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sanitizeUser, withSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";

/**
 * POST /api/auth/restore  {token}
 * Verifies the token belongs to an ADMIN or AGENT user (the only roles that
 * may impersonate), sets the cookie back to it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);
    const token = cleanStr(body.token);
    if (!token) return jsonError("Session token is required", 400);

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return jsonError("Invalid or expired session", 400);
    if (!["ADMIN", "AGENT"].includes(session.user.role)) {
      return jsonError("Only admin or agent sessions can be restored", 403);
    }

    return withSession(
      NextResponse.json({ user: sanitizeUser(session.user), token }),
      token
    );
  } catch (err) {
    console.error("[auth/restore] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
