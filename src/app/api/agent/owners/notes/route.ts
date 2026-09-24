import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";

/**
 * POST /api/agent/owners/notes — role AGENT. {agentOwnerId, text}
 * Adds a private note to one of the agent's own owner links.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["AGENT"]);
    if (guard.error) return guard.error;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const agentOwnerId = cleanStr(body.agentOwnerId);
    if (!agentOwnerId) return jsonError("agentOwnerId is required", 400);
    const text = cleanStr(body.text);
    if (!text) return jsonError("Note text is required", 400);

    const link = await db.agentOwner.findUnique({ where: { id: agentOwnerId } });
    if (!link) return jsonError("Owner link not found", 404);
    if (link.agentId !== guard.user.id) {
      return jsonError("You can only add notes to your own owner links", 403);
    }

    const note = await db.ownerNote.create({
      data: { agentOwnerId, text },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error("[agent/owners/notes] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
