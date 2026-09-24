import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import { recordEvent, resolveIdentity } from "../_lib/insights";
import { guard } from "@/lib/rate-limit";

/**
 * POST /api/insights/track — public.
 * Records a SEARCH (query/filters) event. VIEW / SAVE / CONTACT events are
 * recorded server-side inside their own routes; the client only tracks
 * searches here. Identity = session user, else the X-Device-Id header.
 * Body: { query?, block?, houseType?, minRent?, maxRent? }
 */
export async function POST(req: NextRequest) {
  const limited = guard(req, "track", 240);
  if (limited) return limited;
  try {
    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const identity = await resolveIdentity(req);
    await recordEvent(identity, {
      kind: "SEARCH",
      block: typeof body.block === "string" ? body.block : "",
      houseType: typeof body.houseType === "string" ? body.houseType : "",
      rent: typeof body.maxRent === "number" ? body.maxRent : typeof body.minRent === "number" ? body.minRent : 0,
      query: typeof body.query === "string" ? body.query : "",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[insights/track] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
