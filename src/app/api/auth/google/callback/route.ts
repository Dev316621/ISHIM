import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, withSession } from "@/lib/auth";
import {
  exchangeGoogleCode,
  googleConfigured,
  googleRedirectUri,
  publicOrigin,
} from "@/lib/google";
import { guard } from "@/lib/rate-limit";

export const runtime = "nodejs";

const STATE_COOKIE = "ishim_gstate";
const PENDING_COOKIE = "ishim_gpending";
export const ERROR_COOKIE = "ishim_gerror";

function backToHome(origin: string, errorCode: string | null) {
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(PENDING_COOKIE);
  if (errorCode) {
    res.cookies.set({
      name: ERROR_COOKIE,
      value: errorCode,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 120,
    });
  }
  return res;
}

/**
 * GET /api/auth/google/callback — OAuth redirect target. STAFF-ONLY.
 * iShim is account-free for locals (clients & owners never sign in), so
 * Google sign-in is reserved for the iShim team: existing AGENT / ADMIN
 * users (matched by googleSub, or by email so the admin can pre-add an
 * agent's Google account). Everyone else — new emails, CLIENT and OWNER
 * accounts — is bounced back with a friendly "staff sign-in only" error.
 * Failures → home with a short-lived error cookie the sheet surfaces.
 */
export async function GET(req: NextRequest) {
  const limited = guard(req, "google-callback", 15);
  if (limited) return limited;

  const origin = await publicOrigin();

  if (!googleConfigured()) return backToHome(origin, "unconfigured");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;

  if (url.searchParams.get("error")) return backToHome(origin, "google");
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return backToHome(origin, "expired");
  }

  const profile = await exchangeGoogleCode(code, googleRedirectUri(origin));
  if (!profile) return backToHome(origin, "google");

  try {
    // 1) Already linked via Google?
    let user = await db.user.findUnique({ where: { googleSub: profile.sub } });

    // 2) Pre-added staff account with the same Google email → link it.
    //    (The admin adds agents by email; their first Google sign-in
    //    attaches the googleSub here.)
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        user = await db.user.update({
          where: { id: byEmail.id },
          data: { googleSub: profile.sub },
        });
      }
    }

    // 3) Staff-only. Locals never sign in — clients, owners and unknown
    //    emails all get the same friendly bounce.
    if (!user || !['AGENT', 'ADMIN'].includes(user.role)) {
      return backToHome(origin, "staff-only");
    }

    const res = backToHome(origin, null);
    if (user.banned) return backToHome(origin, "banned");
    const token = await createSession(user.id);
    withSession(res, token);
    return res;
  } catch (err) {
    console.error("[auth/google] callback failed:", err);
    return backToHome(origin, "server");
  }
}
