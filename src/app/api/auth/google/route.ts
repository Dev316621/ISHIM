import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildGoogleAuthUrl, googleConfigured, googleRedirectUri, publicOrigin } from "@/lib/google";
import { guard } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const GOOGLE_STATE_COOKIE = "ishim_gstate";

/**
 * GET /api/auth/google — starts the Google OAuth flow.
 * 501 with a clear message when GOOGLE_CLIENT_ID/SECRET are not configured.
 */
export async function GET(req: NextRequest) {
  const limited = guard(req, "google-start", 15);
  if (limited) return limited;

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured yet — ask the admin to add Google credentials." },
      { status: 501 }
    );
  }

  const origin = await publicOrigin();
  const state = randomBytes(16).toString("hex");
  const redirectUri = googleRedirectUri(origin);

  const res = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
  res.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to finish the Google round-trip
  });
  return res;
}
