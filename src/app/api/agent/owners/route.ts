import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, fullProperty, getJsonBody, jsonError } from "@/app/api/_lib/helpers";

type LinkItem = {
  link: { id: string; status: string; createdAt: Date };
  owner: ReturnType<typeof sanitizeUser>;
  properties: ReturnType<typeof fullProperty>[];
  notes: { id: string; text: string; createdAt: Date }[];
};

async function buildLinkItems(agentId: string | null): Promise<LinkItem[]> {
  const links = await db.agentOwner.findMany({
    where: agentId ? { agentId } : {},
    include: {
      owner: true,
      notes: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ownerIds = links.map((l) => l.ownerId);
  const properties = ownerIds.length
    ? await db.property.findMany({
        where: { ownerId: { in: ownerIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return links.map((link) => ({
    link: { id: link.id, status: link.status, createdAt: link.createdAt },
    owner: sanitizeUser(link.owner),
    properties: properties.filter((p) => p.ownerId === link.ownerId).map(fullProperty),
    notes: link.notes.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt })),
  }));
}

/** GET /api/agent/owners — role AGENT (admin sees all). Linked owners + their properties + notes. */
export async function GET() {
  try {
    const guard = await requireRole(["AGENT", "ADMIN"]);
    if (guard.error) return guard.error;

    const items = await buildLinkItems(guard.user.role === "ADMIN" ? null : guard.user.id);
    return NextResponse.json(items);
  } catch (err) {
    console.error("[agent/owners] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * POST /api/agent/owners — role AGENT. {phone, name?}
 * Finds the user by phone (creates an OWNER when missing) and ensures the
 * AgentOwner link. Returns the same enriched shape as GET.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["AGENT"]);
    if (guard.error) return guard.error;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);
    const phone = cleanStr(body.phone);
    if (!phone) return jsonError("Owner phone is required", 400);

    let owner = await db.user.findUnique({ where: { phone } });
    if (!owner) {
      const name = cleanStr(body.name) || `Owner ${phone}`;
      owner = await db.user.create({
        data: { phone, name, role: "OWNER", whatsappNumber: phone },
      });
    } else if (owner.role === "CLIENT") {
      // Promote client accounts to OWNER when an agent starts managing them.
      owner = await db.user.update({ where: { id: owner.id }, data: { role: "OWNER" } });
    }

    await db.agentOwner.upsert({
      where: { agentId_ownerId: { agentId: guard.user.id, ownerId: owner.id } },
      update: {},
      create: { agentId: guard.user.id, ownerId: owner.id, status: "ACTIVE" },
    });

    const items = await buildLinkItems(guard.user.id);
    const item = items.find((i) => i.owner.id === owner.id);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[agent/owners] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
