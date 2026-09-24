import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ERROR_COOKIE = "ishim_gerror";

/**
 * GET /api/auth/google/pending — the auth sheet calls this on mount.
 *  - An OAuth error cookie (redirected back after a failure) →
 *    { error: "<code>", message } so the sheet can toast it.
 *    "staff-only" covers locals/unknowns bounced by the staff-only gate.
 *  - Neither → 204, quietly.
 * The error cookie is consumed (cleared) when present.
 */
export async function GET(req: NextRequest) {
  const limited = guard(req, "google-pending", 60);
  if (limited) return limited;

  const errorCode = req.cookies.get(ERROR_COOKIE)?.value;
  if (errorCode) {
    const res = NextResponse.json({});
    res.cookies.delete(ERROR_COOKIE);
    const messages: Record<string, string> = {
      unconfigured: "Google sign-in is not configured yet.",
      expired: "The Google sign-in attempt expired — please try again.",
      google: "Google didn't verify that account — try another one.",
      banned: "That account has been suspended. Contact support.",
      server: "Something went wrong with Google sign-in — please try again.",
      "staff-only":
        "Google sign-in is for iShim agents & admin only. Everyone else can browse, save homes and contact agents without an account — no sign-in needed!",
    };
    return NextResponse.json({
      error: errorCode,
      message: messages[errorCode] ?? "Google sign-in failed — please try again.",
    });
  }

  return new NextResponse(null, { status: 204 });
}
