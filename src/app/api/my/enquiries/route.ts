import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, parseJsonArray } from "@/app/api/_lib/helpers";

/**
 * GET /api/my/enquiries — OWNER / AGENT (ADMIN sees all).
 * The handler's inbox with the property snapshot for context.
 *
 * OWNER  → enquiries routed to them (handledById).
 * AGENT  → the full picture across their book of business:
 *          · enquiries routed to them (handledById),
 *          · enquiries on any listing they listed for an owner (listedByAgentId),
 *          · enquiries on properties of owners linked to them (AgentOwner ACTIVE),
 *          · enquiries raised by their CRM clients (AgentClient phone match).
 * ADMIN  → every enquiry on the platform.
 */
export async function GET() {
  try {
    const guard = await requireRole(["OWNER", "AGENT", "ADMIN"]);
    if (guard.error) return guard.error;
    const user = guard.user;

    let where: Prisma.EnquiryWhereInput;

    if (user.role === "ADMIN") {
      where = {};
    } else if (user.role === "AGENT") {
      const [links, clients] = await Promise.all([
        db.agentOwner.findMany({
          where: { agentId: user.id, status: "ACTIVE" },
          select: { ownerId: true },
        }),
        db.agentClient.findMany({ where: { agentId: user.id }, select: { phone: true } }),
      ]);
      const linkedOwnerIds = links.map((l) => l.ownerId);
      // Enquiry phones are stored as typed by the enquirer (often 91-prefixed);
      // match the CRM client's digits against the common variants.
      const phoneVariants = Array.from(
        new Set(
          clients
            .map((c) => c.phone.replace(/[^0-9]/g, ""))
            .filter(Boolean)
            .flatMap((p) => [p, `91${p}`, `+91${p}`])
        )
      );

      where = {
        OR: [
          { handledById: user.id },
          { property: { listedByAgentId: user.id } },
          ...(linkedOwnerIds.length ? [{ property: { ownerId: { in: linkedOwnerIds } } }] : []),
          ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
        ],
      };
    } else {
      where = { handledById: user.id };
    }

    const rows = await db.enquiry.findMany({
      where,
      include: {
        property: {
          select: { id: true, title: true, block: true, photos: true, rent: true, status: true, mode: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      enquiries: rows.map((e) => ({
        id: e.id,
        kind: e.kind,
        channel: e.channel,
        name: e.name,
        phone: e.phone,
        message: e.message,
        visitAt: e.visitAt?.toISOString() ?? null,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        property: {
          id: e.property.id,
          title: e.property.title,
          block: e.property.block,
          photos: parseJsonArray(e.property.photos),
          rent: e.property.rent,
          status: e.property.status,
          mode: e.property.mode,
        },
      })),
    });
  } catch (err) {
    console.error("[my/enquiries] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
