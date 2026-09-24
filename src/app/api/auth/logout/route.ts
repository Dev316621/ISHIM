import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { jsonError } from "@/app/api/_lib/helpers";

/** POST /api/auth/logout — deletes the Session row and clears the cookie. */
export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/logout] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
