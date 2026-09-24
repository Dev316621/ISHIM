import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cleanStr,
  jsonError,
  ownerVerifiedInclude,
  publicPropertyCard,
} from "@/app/api/_lib/helpers";

/**
 * GET /api/agent/match?clientId= — role AGENT (admin: any client).
 * ACTIVE properties filtered by the client's budget range (inclusive,
 * 0 = open), preferredBlock (empty = any) and preferredType ("ANY"/empty = any),
 * scored by budget closeness + block match. Returns {client, matches}.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["AGENT", "ADMIN"]);
    if (guard.error) return guard.error;

    const clientId = cleanStr(req.nextUrl.searchParams.get("clientId"));
    if (!clientId) return jsonError("clientId query parameter is required", 400);

    const client = await db.agentClient.findUnique({ where: { id: clientId } });
    if (!client) return jsonError("Client not found", 404);
    if (guard.user.role !== "ADMIN" && client.agentId !== guard.user.id) {
      return jsonError("You can only match your own clients", 403);
    }

    const where: Prisma.PropertyWhereInput = { status: "ACTIVE" };

    const rentFilter: Prisma.IntFilter = {};
    if (client.budgetMin > 0) rentFilter.gte = client.budgetMin;
    if (client.budgetMax > 0) rentFilter.lte = client.budgetMax;
    if (client.budgetMin > 0 || client.budgetMax > 0) where.rent = rentFilter;

    if (client.preferredBlock) where.block = client.preferredBlock;
    if (client.preferredType && client.preferredType !== "ANY") {
      where.houseType = client.preferredType;
    }

    const properties = await db.property.findMany({
      where,
      include: ownerVerifiedInclude,
      orderBy: { createdAt: "desc" },
    });

    const hasBudget = client.budgetMin > 0 || client.budgetMax > 0;
    const mid =
      client.budgetMin > 0 && client.budgetMax > 0
        ? (client.budgetMin + client.budgetMax) / 2
        : client.budgetMin || client.budgetMax || 0;

    const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

    const scored = properties.map((p) => {
      let score = 0;
      const reasons: string[] = [];

      if (client.preferredBlock && p.block === client.preferredBlock) {
        score += 100;
        reasons.push(`In preferred block ${p.block}`);
      }
      if (client.preferredType && client.preferredType !== "ANY" && p.houseType === client.preferredType) {
        score += 20;
        reasons.push(`${p.houseType.replace("_", "-")} matches preference`);
      }
      if (hasBudget && mid > 0) {
        // Closer to the middle of the budget range scores higher.
        score += Math.max(0, 50 - Math.abs(p.rent - mid) / 100);
        const lo = client.budgetMin > 0 ? inr(client.budgetMin) : null;
        const hi = client.budgetMax > 0 ? inr(client.budgetMax) : null;
        reasons.push(
          `${inr(p.rent)} rent fits budget ${lo && hi ? `${lo}–${hi}` : lo ? `above ${lo}` : `under ${hi}`}`
        );
      } else {
        score += 25;
        reasons.push("Budget open");
      }

      return {
        ...publicPropertyCard(p),
        score: Math.round(score * 10) / 10,
        reason: reasons.join(" · "),
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({ client, matches: scored });
  } catch (err) {
    console.error("[agent/match] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
