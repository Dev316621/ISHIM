import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";

export const runtime = "nodejs";

/** GET /api/auth/google/status — { configured } for the auth sheet button. */
export async function GET() {
  return NextResponse.json({ configured: googleConfigured() });
}
