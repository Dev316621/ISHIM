import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";

export const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED"] as const;

/**
 * PATCH /api/enquiries/[id] — Admin, the routed handler, or (for AGENTs)
 * the managing agent with visibility of the lead: agent-listed properties,
 * properties of linked owners (AgentOwner ACTIVE) and CRM-client matches.
 * {status?, visitAt? (ISO or null to clear — reschedule a visit)}
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireAuth();
    if (guard.error) return guard.error;
    const user = guard.user;

    const enquiry = await db.enquiry.findUnique({
      where: { id },
      include: { property: { select: { ownerId: true, listedByAgentId: true } } },
    });
    if (!enquiry) return jsonError("Enquiry not found", 404);

    let allowed = user.role === "ADMIN" || enquiry.handledById === user.id;
    if (!allowed && user.role === "AGENT") {
      const [links, clients] = await Promise.all([
        db.agentOwner.findMany({
          where: { agentId: user.id, status: "ACTIVE" },
          select: { ownerId: true },
        }),
        db.agentClient.findMany({ where: { agentId: user.id }, select: { phone: true } }),
      ]);
      const linkedOwnerIds = links.map((l) => l.ownerId);
      const digits = enquiry.phone.replace(/[^0-9]/g, "");
      const crmDigits = new Set(clients.map((c) => c.phone.replace(/[^0-9]/g, "")));
      allowed =
        enquiry.property.listedByAgentId === user.id ||
        linkedOwnerIds.includes(enquiry.property.ownerId) ||
        (digits.length > 0 && crmDigits.has(digits));
    }
    if (!allowed) {
      return jsonError("Only the handler can manage this enquiry", 403);
    }

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const data: { status?: string; visitAt?: Date | null } = {};

    if ("status" in body) {
      const status = cleanStr(body.status).toUpperCase();
      if (!(ENQUIRY_STATUSES as readonly string[]).includes(status)) {
        return jsonError(`status must be one of: ${ENQUIRY_STATUSES.join(", ")}`, 400);
      }
      data.status = status;
    }

    if ("visitAt" in body) {
      if (body.visitAt === null || cleanStr(body.visitAt) === "") {
        data.visitAt = null;
      } else {
        const d = new Date(cleanStr(body.visitAt));
        if (Number.isNaN(d.getTime())) return jsonError("Invalid visit date", 400);
        data.visitAt = d;
      }
    }

    if (!Object.keys(data).length) return jsonError("Nothing to update", 400);

    const updated = await db.enquiry.update({ where: { id }, data });

    return NextResponse.json({
      enquiry: {
        id: updated.id,
        status: updated.status,
        visitAt: updated.visitAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[enquiries/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
