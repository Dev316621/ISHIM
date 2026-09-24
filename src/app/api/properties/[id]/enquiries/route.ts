import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import { guard } from "@/lib/rate-limit";

const MESSAGE_MAX = 500;
const NAME_MAX = 80;

/**
 * POST /api/properties/[id]/enquiries — public (name + phone required).
 * Tracked enquiry from the property page:
 *  {kind: "GENERAL"|"VISIT", name, phone, message?, visitAt? (ISO, VISIT only),
 *   route?: "OWNER"|"AGENT" — client's choice of who should handle it}
 * route AGENT → handled by the listing agent; route OWNER → handled by the
 * owner themself (even on agent-listed homes); no route → agent when one
 * exists, otherwise the owner. The handler manages it from the Enquiries
 * inbox in their dashboard.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = guard(req, "enquiry", 15);
  if (limited) return limited;
  try {
    const { id } = await params;

    const property = await db.property.findUnique({
      where: { id },
      select: { id: true, ownerId: true, listedByAgentId: true, status: true },
    });
    if (!property) return jsonError("Property not found", 404);

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const kind = cleanStr(body.kind).toUpperCase() === "VISIT" ? "VISIT" : "GENERAL";
    // Client's choice of handler — owner or listing agent.
    const requestedRoute = cleanStr(body.route).toUpperCase();

    const me = await getSessionUser();

    const name = (me && !cleanStr(body.name) ? me.name : cleanStr(body.name)).slice(0, NAME_MAX);
    const rawPhone =
      me && !cleanStr(body.phone) ? me.whatsappNumber || me.phone : cleanStr(body.phone);
    const phone = rawPhone.replace(/[^0-9+]/g, "").slice(0, 15);

    if (!name) return jsonError("Please tell us your name", 400);
    if (!phone || phone.replace(/[^0-9]/g, "").length < 10) {
      return jsonError("Please enter a valid phone number", 400);
    }

    const message = (typeof body.message === "string" ? body.message.trim() : "").slice(0, MESSAGE_MAX);

    let visitAt: Date | null = null;
    if (kind === "VISIT") {
      const raw = cleanStr(body.visitAt);
      if (!raw) return jsonError("Please pick a date and time for the visit", 400);
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return jsonError("Invalid visit date", 400);
      if (d.getTime() < Date.now() - 60_000) {
        return jsonError("Visit date must be in the future", 400);
      }
      visitAt = d;
    }

    // Decide the handler: explicit client route wins, else agent-if-listed.
    let handledById: string;
    let channel: "AGENT" | "OWNER";
    if (requestedRoute === "OWNER") {
      handledById = property.ownerId;
      channel = "OWNER";
    } else if (requestedRoute === "AGENT" && property.listedByAgentId) {
      handledById = property.listedByAgentId;
      channel = "AGENT";
    } else {
      handledById = property.listedByAgentId ?? property.ownerId;
      channel = property.listedByAgentId ? "AGENT" : "OWNER";
    }

    const enquiry = await db.enquiry.create({
      data: {
        propertyId: id,
        userId: me?.id ?? null,
        handledById,
        kind,
        channel,
        name,
        phone,
        message,
        visitAt,
      },
    });

    return NextResponse.json(
      {
        enquiry: {
          id: enquiry.id,
          kind: enquiry.kind,
          status: enquiry.status,
          visitAt: enquiry.visitAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[properties/:id/enquiries] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
