import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cleanStr,
  getJsonBody,
  jsonError,
  optionalInt,
  parseJsonArray,
  stringArrayOrNull,
} from "@/app/api/_lib/helpers";
import { guard } from "@/lib/rate-limit";
import { queueAreaRequest, resolveBlock } from "../../_lib/area-requests";

/**
 * POST /api/leads/listing — PUBLIC (no account needed).
 * The "quick list" intake form: a local sends what they have and an iShim
 * agent does the rest. Deliberately tiny + forgiving — 4 required taps.
 * Body: {name, phone, mode?, block?, rent?, details?, photos?} → 201 {lead:{id,name}}
 * An unknown area/ward is accepted as free text AND queued in AreaRequest
 * so the team can add it to the official list.
 */
export async function POST(req: NextRequest) {
  const limited = guard(req, "lead-create", 5);
  if (limited) return limited;
  try {
    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const name = cleanStr(body.name).slice(0, 80);
    const rawPhone = cleanStr(body.phone);
    const phone = rawPhone.replace(/[^0-9]/g, "");
    const mode = cleanStr(body.mode).toUpperCase() === "BUSINESS" ? "BUSINESS" : "HOME";
    const rawBlock = cleanStr(body.block).slice(0, 60);
    const details = cleanStr(body.details).slice(0, 2000);

    let photos: string[] = [];
    if ("photos" in body) {
      const parsed = stringArrayOrNull(body.photos);
      if (parsed === null) return jsonError("photos must be an array of image urls", 400);
      photos = parsed
        .filter((p) => p.length > 0 && p.length <= 300)
        .slice(0, 3); // quick-list stays light — the agent takes the rest
    }

    const rentRaw = body.rent;
    const rent =
      typeof rentRaw === "number" && Number.isFinite(rentRaw) && rentRaw > 0
        ? Math.min(Math.round(rentRaw), 10_000_000)
        : typeof rentRaw === "string" && rentRaw.trim() !== "" && Number.isFinite(Number(rentRaw))
          ? Math.min(Math.round(Number(rentRaw)), 10_000_000)
          : null;

    if (name.length < 2) return jsonError("Tell us your name so the agent knows who to call", 400);
    if (phone.length < 10 || phone.length > 13) {
      return jsonError("Enter a valid WhatsApp phone number", 400);
    }

    // "viewland" → official "Viewland" when it exists; unknown areas stay
    // as typed (and are queued for the team to add).
    const { block, known } = await resolveBlock(rawBlock);

    const lead = await db.listingLead.create({
      data: {
        name,
        phone,
        mode,
        block,
        rent,
        details,
        photos: JSON.stringify(photos),
        source: "FORM",
      },
      select: { id: true, name: true },
    });

    if (block && !known) {
      await queueAreaRequest({
        name: block,
        mode,
        requesterName: name,
        requesterPhone: phone,
        leadId: lead.id,
        source: "FORM",
      });
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error("[leads/listing] POST failed:", err);
    return jsonError("Something went wrong — please try again", 500);
  }
}

/**
 * GET /api/leads/listing — AGENT / ADMIN. The intake worklist.
 * Agents see every unclaimed request plus their own claimed ones;
 * admins see everything. ?status=NEW|CLAIMED|LISTED|DISCARDED|ALL
 * (default "OPEN" = NEW + CLAIMED). Envelope {items,total,hasMore}.
 */
const LEAD_STATUSES = ["NEW", "CLAIMED", "LISTED", "DISCARDED"] as const;

export async function GET(req: NextRequest) {
  try {
    const guardRes = await requireRole(["AGENT", "ADMIN"]);
    if (guardRes.error) return guardRes.error;
    const user = guardRes.user;

    const sp = req.nextUrl.searchParams;
    const statusRaw = (sp.get("status")?.trim().toUpperCase() || "OPEN");
    const limit = Math.min(Math.max(optionalInt(sp.get("limit")) ?? 50, 1), 100);
    const skip = Math.max(optionalInt(sp.get("skip")) ?? 0, 0);

    const statusWhere =
      statusRaw === "ALL"
        ? {}
        : statusRaw === "OPEN"
          ? { status: { in: ["NEW", "CLAIMED"] } }
          : (LEAD_STATUSES as readonly string[]).includes(statusRaw)
            ? { status: statusRaw }
            : {};

    // Agents: unclaimed + mine. Admin: everything.
    const scopeWhere =
      user.role === "ADMIN"
        ? {}
        : { OR: [{ claimedById: null }, { claimedById: user.id }] };

    const where = { AND: [statusWhere, scopeWhere] };

    const [total, leads] = await Promise.all([
      db.listingLead.count({ where }),
      db.listingLead.findMany({
        where,
        orderBy: [{ createdAt: "asc" }],
        skip,
        take: limit,
        include: { claimedBy: { select: { name: true, role: true } } },
      }),
    ]);

    return NextResponse.json({
      items: leads.map((l) => ({ ...l, photos: parseJsonArray(l.photos) })),
      total,
      hasMore: skip + leads.length < total,
    });
  } catch (err) {
    console.error("[leads/listing] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
