import { NextResponse } from "next/server";
import { getSessionToken, getSessionUser, sanitizeUser } from "@/lib/auth";
import { jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/auth/me — {user, token} or {user:null}. `token` echoes the active
 * session token so cookie-blocked clients can adopt the header channel.
 */
export async function GET() {
  try {
    const [user, token] = await Promise.all([getSessionUser(), getSessionToken()]);
    return NextResponse.json({
      user: user ? sanitizeUser(user) : null,
      token: token ?? null,
    });
  } catch (err) {
    console.error("[auth/me] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
