import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createSession,
  sanitizeUser,
  requireRole,
  withSession,
  SESSION_COOKIE,
  SESSION_HEADER,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";

/**
 * POST /api/auth/impersonate  {userId}
 * Creates a session for the target user, sets the cookie to it and returns
 * `{token}` (target's session token). Also returns `restoreToken` — the
 * operator's own current session token (from the X-Session-Token header
 * first, then the httpOnly cookie) — so the panel can call
 * POST /api/auth/restore afterwards.
 *
 * Who may impersonate whom:
 *   ADMIN → any user (owners, agents, clients, other admins).
 *   AGENT → OWNER and CLIENT accounts only (the agent's partners and
 *           customers) — never ADMIN or AGENT accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN", "AGENT"]);
    if (guard.error) return guard.error;
    const actor = guard.user;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);
    const userId = cleanStr(body.userId);
    if (!userId) return jsonError("userId is required", 400);

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return jsonError("User not found", 404);
    if (target.id === actor.id) return jsonError("You are already signed in as this user", 400);
    if (target.banned) return jsonError("That account is banned", 403);

    if (actor.role === "AGENT" && !["OWNER", "CLIENT"].includes(target.role)) {
      return jsonError("Agents can only enter owner or client accounts", 403);
    }

    const targetToken = await createSession(target.id);

    const [h, store] = await Promise.all([headers(), cookies()]);
    const restoreToken =
      h.get(SESSION_HEADER)?.trim() ||
      store.get(SESSION_COOKIE)?.value ||
      null;

    return withSession(
      NextResponse.json({ token: targetToken, restoreToken, user: sanitizeUser(target) }),
      targetToken
    );
  } catch (err) {
    console.error("[auth/impersonate] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
