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
 * GET /api/agent/clients — role AGENT (admin sees all). Bare array, newest first.
 */
export async function GET() {
  try {
    const guard = await requireRole(["AGENT", "ADMIN"]);
    if (guard.error) return guard.error;

    const where = guard.user.role === "ADMIN" ? {} : { agentId: guard.user.id };
    const clients = await db.agentClient.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients);
  } catch (err) {
    console.error("[agent/clients] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * POST /api/agent/clients — role AGENT only.
 * {name, phone, budgetMin?, budgetMax?, preferredBlock?, preferredType?, notes?, stage?}
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["AGENT"]);
    if (guard.error) return guard.error;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const name = cleanStr(body.name);
    if (!name) return jsonError("Client name is required", 400);
    const phone = cleanStr(body.phone);
    if (!phone) return jsonError("Client phone is required", 400);

    const budgetMin = optionalInt(body.budgetMin) ?? 0;
    if (budgetMin < 0) return jsonError("budgetMin cannot be negative", 400);
    const budgetMax = optionalInt(body.budgetMax) ?? 0;
    if (budgetMax < 0) return jsonError("budgetMax cannot be negative", 400);

    const preferredBlock = cleanStr(body.preferredBlock);
    const preferredType = cleanStr(body.preferredType).toUpperCase();
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    let stage = "NEW_LEAD";
    if ("stage" in body) {
      stage = cleanStr(body.stage).toUpperCase();
      if (!AGENT_CLIENT_STAGES.includes(stage)) {
        return jsonError(`stage must be one of: ${AGENT_CLIENT_STAGES.join(", ")}`, 400);
      }
    }

    const client = await db.agentClient.create({
      data: {
        agentId: guard.user.id,
        name,
        phone,
        budgetMin,
        budgetMax,
        preferredBlock,
        preferredType,
        notes,
        stage,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    console.error("[agent/clients] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
