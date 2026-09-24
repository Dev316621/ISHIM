import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  AGENT_CLIENT_STAGES,
  cleanStr,
  getJsonBody,
  jsonError,
  optionalInt,
} from "@/app/api/_lib/helpers";

/**
 * PATCH /api/agent/clients/[id] — role AGENT, own leads only.
 * Any of {name, phone, budgetMin, budgetMax, preferredBlock, preferredType,
 * notes, stage} may be provided; only provided fields are applied.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await requireRole(["AGENT"]);
    if (guard.error) return guard.error;

    const client = await db.agentClient.findUnique({ where: { id } });
    if (!client) return jsonError("Client not found", 404);
    if (client.agentId !== guard.user.id) {
      return jsonError("You can only edit your own leads", 403);
    }

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = cleanStr(body.name);
      if (!name) return jsonError("Client name cannot be empty", 400);
      data.name = name;
    }
    if ("phone" in body) {
      const phone = cleanStr(body.phone);
      if (!phone) return jsonError("Client phone cannot be empty", 400);
      data.phone = phone;
    }
    if ("budgetMin" in body) {
      const budgetMin = optionalInt(body.budgetMin);
      if (budgetMin === undefined || budgetMin < 0) {
        return jsonError("budgetMin must be a non-negative number", 400);
      }
      data.budgetMin = budgetMin;
    }
    if ("budgetMax" in body) {
      const budgetMax = optionalInt(body.budgetMax);
      if (budgetMax === undefined || budgetMax < 0) {
        return jsonError("budgetMax must be a non-negative number", 400);
      }
      data.budgetMax = budgetMax;
    }
    if ("preferredBlock" in body) data.preferredBlock = cleanStr(body.preferredBlock);
    if ("preferredType" in body) data.preferredType = cleanStr(body.preferredType).toUpperCase();
    if ("notes" in body) data.notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if ("stage" in body) {
      const stage = cleanStr(body.stage).toUpperCase();
      if (!AGENT_CLIENT_STAGES.includes(stage)) {
        return jsonError(`stage must be one of: ${AGENT_CLIENT_STAGES.join(", ")}`, 400);
      }
      data.stage = stage;
    }

    if (Object.keys(data).length === 0) return jsonError("Nothing to update", 400);

    const updated = await db.agentClient.update({ where: { id }, data });
    return NextResponse.json({ client: updated });
  } catch (err) {
    console.error("[agent/clients/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
