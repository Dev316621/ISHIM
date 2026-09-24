import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole, sanitizeUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/agent/users?q= — role AGENT (ADMIN sees the same list).
 * Finds OWNER and CLIENT accounts by name or phone so the agent can enter
 * an owner's or client's account ("log in as") to help them list, book or
 * follow up. ADMIN and AGENT accounts are never returned.
 * Returns at most 10 minimal profiles.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["AGENT", "ADMIN"]);
    if (guard.error) return guard.error;

    const q = cleanStr(req.nextUrl.searchParams.get("q"));
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await db.user.findMany({
      where: {
        role: { in: ["OWNER", "CLIENT"] },
        banned: false,
        OR: [{ name: { contains: q } }, { phone: { contains: q } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      users: users.map((u) => {
        const s = sanitizeUser(u);
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          role: s.role,
          verified: s.verified,
        };
      }),
    });
  } catch (err) {
    console.error("[agent/users] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
