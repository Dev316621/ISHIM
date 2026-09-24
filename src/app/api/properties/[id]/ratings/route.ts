import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError, optionalInt } from "@/app/api/_lib/helpers";
import { maskTenantName } from "@/app/api/tenancies/_lib/tenancy";
import { guard } from "@/lib/rate-limit";

const COMMENT_MAX = 500;

function avgOf(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * GET /api/properties/[id]/ratings — public.
 * Rating summaries for everything on the page:
 *  - property: Rating rows (targetType PROPERTY) with masked reviewer names
 *  - owner: aggregated from Tenancy.ownerRating (only real past tenants)
 *  - agent: Rating rows for the listing agent, when one exists
 * `mine` echoes the signed-in user's own rows so the UI can prefill.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const property = await db.property.findUnique({
      where: { id },
      select: { id: true, listedByAgentId: true },
    });
    if (!property) return jsonError("Property not found", 404);

    const [propertyRows, tenancies, agentRows, me] = await Promise.all([
      db.rating.findMany({
        where: { targetType: "PROPERTY", targetId: id },
        include: { user: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      db.tenancy.findMany({
        where: { propertyId: id, ownerRating: { not: null } },
        select: { ownerRating: true },
      }),
      property.listedByAgentId
        ? db.rating.findMany({
            where: { targetType: "AGENT", targetId: property.listedByAgentId },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]),
      getSessionUser(),
    ]);

    let agent: { avg: number | null; count: number; name: string } | null = null;
    if (property.listedByAgentId) {
      const agentUser = await db.user.findUnique({
        where: { id: property.listedByAgentId },
        select: { name: true },
      });
      agent = {
        avg: avgOf(agentRows.map((r) => r.rating)),
        count: agentRows.length,
        name: agentUser?.name ?? "Agent",
      };
    }

    const mine: {
      property: { rating: number; comment: string } | null;
      agent: { rating: number; comment: string } | null;
    } = { property: null, agent: null };
    if (me) {
      const mineProp = await db.rating.findUnique({
        where: {
          userId_targetType_targetId: { userId: me.id, targetType: "PROPERTY", targetId: id },
        },
      });
      mine.property = mineProp ? { rating: mineProp.rating, comment: mineProp.comment } : null;
      if (property.listedByAgentId) {
        const mineAgent = await db.rating.findUnique({
          where: {
            userId_targetType_targetId: {
              userId: me.id,
              targetType: "AGENT",
              targetId: property.listedByAgentId,
            },
          },
        });
        mine.agent = mineAgent ? { rating: mineAgent.rating, comment: mineAgent.comment } : null;
      }
    }

    return NextResponse.json({
      property: {
        avg: avgOf(propertyRows.map((r) => r.rating)),
        count: propertyRows.length,
        ratings: propertyRows.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          user: maskTenantName(r.user.name),
          createdAt: r.createdAt.toISOString(),
        })),
      },
      owner: {
        avg: avgOf(
          tenancies.map((t) => t.ownerRating).filter((v): v is number => typeof v === "number")
        ),
        count: tenancies.length,
      },
      agent,
      mine,
    });
  } catch (err) {
    console.error("[properties/:id/ratings] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * POST /api/properties/[id]/ratings — signed-in users rate the home or its
 * agent. {targetType: "PROPERTY"|"AGENT", rating: 1..5, comment?}
 * One rating per user per target — re-rating updates.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = guard(req, "rating", 30);
  if (limited) return limited;
  try {
    const { id } = await params;

    const user = await getSessionUser();
    if (!user) return jsonError("Please log in to rate", 401);

    const property = await db.property.findUnique({
      where: { id },
      select: { id: true, listedByAgentId: true },
    });
    if (!property) return jsonError("Property not found", 404);

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const targetType = cleanStr(body.targetType).toUpperCase();
    if (!["PROPERTY", "AGENT"].includes(targetType)) {
      return jsonError("targetType must be PROPERTY or AGENT", 400);
    }
    if (targetType === "AGENT" && !property.listedByAgentId) {
      return jsonError("This home is not handled by an agent", 400);
    }
    if (targetType === "AGENT" && property.listedByAgentId === user.id) {
      return jsonError("You cannot rate yourself", 400);
    }

    const rating = optionalInt(body.rating);
    if (rating === undefined || rating < 1 || rating > 5) {
      return jsonError("rating must be between 1 and 5", 400);
    }

    const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, COMMENT_MAX) : "";

    const targetId = targetType === "AGENT" ? property.listedByAgentId! : id;
    const row = await db.rating.upsert({
      where: {
        userId_targetType_targetId: { userId: user.id, targetType, targetId },
      },
      update: { rating, comment },
      create: { userId: user.id, targetType, targetId, rating, comment },
    });

    // Fresh summary for the rated target.
    const all = await db.rating.findMany({
      where: { targetType, targetId },
      select: { rating: true },
    });

    return NextResponse.json(
      {
        rating: {
          id: row.id,
          rating: row.rating,
          comment: row.comment,
          updatedAt: row.updatedAt.toISOString(),
        },
        summary: {
          avg: avgOf(all.map((r) => r.rating)),
          count: all.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[properties/:id/ratings] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
