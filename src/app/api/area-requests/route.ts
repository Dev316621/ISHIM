import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError, optionalInt } from "@/app/api/_lib/helpers";
import { guard } from "@/lib/rate-limit";
import { queueAreaRequest } from "../_lib/area-requests";

/**
 * POST /api/area-requests — PUBLIC.
 * The "my area is not listed" escape hatch: someone listing a home or
 * shop types the area/ward they couldn't find and it lands in the staff
 * queue (agent intake tab + admin Settings) to be added to the official
 * list. Best-effort dedupe: same pending area → 200 {duplicate:true}.
 * Body: {name, mode?, note?, requesterName?, requesterPhone?, leadId?}
 */
export async function POST(req: NextRequest) {
  const limited = guard(req, "area-request", 5);
  if (limited) return limited;
  try {
    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const name = cleanStr(body.name).slice(0, 60);
    if (name.length < 2) return jsonError("Type the area or ward name (at least 2 characters)", 400);
    const mode = cleanStr(body.mode).toUpperCase() === "BUSINESS" ? "BUSINESS" : "HOME";
    const note = cleanStr(body.note).slice(0, 300);
    const requesterName = cleanStr(body.requesterName).slice(0, 80);
    const requesterPhone = cleanStr(body.requesterPhone).replace(/[^0-9]/g, "").slice(0, 13);
    const leadId = typeof body.leadId === "string" && body.leadId.trim() ? body.leadId.trim() : null;

    const created = await queueAreaRequest({
      name,
      mode,
      note,
      requesterName,
      requesterPhone,
      leadId,
      source: "FORM",
    });
    if (!created) {
      // Known area or identical pending request — nothing to queue.
      return NextResponse.json({ request: null, duplicate: true }, { status: 200 });
    }
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    console.error("[area-requests] POST failed:", err);
    return jsonError("Something went wrong — please try again", 500);
  }
}

/**
 * GET /api/area-requests — AGENT / ADMIN. The request queue.
 * ?status=NEW (default) | ADDED | DISCARDED | ALL. Envelope {items,total}.
 */
const STATUSES = ["NEW", "ADDED", "DISCARDED"] as const;

export async function GET(req: NextRequest) {
  try {
    const guardRes = await requireRole(["AGENT", "ADMIN"]);
    if (guardRes.error) return guardRes.error;

    const sp = req.nextUrl.searchParams;
    const statusRaw = (sp.get("status")?.trim().toUpperCase() || "NEW");
    const limit = Math.min(Math.max(optionalInt(sp.get("limit")) ?? 100, 1), 200);

    const where =
      statusRaw === "ALL"
        ? {}
        : (STATUSES as readonly string[]).includes(statusRaw)
          ? { status: statusRaw }
          : { status: "NEW" };

    const [total, items] = await Promise.all([
      db.areaRequest.count({ where }),
      db.areaRequest.findMany({ where, orderBy: [{ createdAt: "desc" }], take: limit }),
    ]);

    return NextResponse.json({ items, total });
  } catch (err) {
    console.error("[area-requests] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
