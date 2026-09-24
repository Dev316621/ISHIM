import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ownerVerifiedInclude, publicPropertyCard } from "@/app/api/_lib/helpers";
import {
  bandLabel,
  buildProfile,
  identityWhere,
  resolveIdentity,
  scoreProperty,
  topLabels,
} from "../_lib/insights";

/**
 * GET /api/insights/recommend — public, personalized.
 * "For you" ranking: scores ACTIVE listings against the visitor's habit
 * profile (weighted + recency-decayed block / type / price-band affinities).
 * Returns { properties, profile } — profile is null until there is history,
 * properties is [] when anonymous with no events.
 */
export async function GET(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);

    // Vertical filter — the "For you" list never mixes homes with businesses.
    const mode = (req.nextUrl.searchParams.get("mode") ?? "").toUpperCase();
    if (mode && !["HOME", "BUSINESS"].includes(mode)) {
      return NextResponse.json({ error: "mode must be HOME or BUSINESS" }, { status: 400 });
    }

    const events = await db.habitEvent.findMany({
      where: {
        ...identityWhere(identity),
        createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const profile = buildProfile(events);

    if (!profile) {
      return NextResponse.json({
        properties: [],
        profile: null,
        hint: "Browse a few homes and we will tailor this list to you.",
      });
    }

    const actives = await db.property.findMany({
      where: { status: "ACTIVE", ...(mode ? { mode } : {}) },
      include: ownerVerifiedInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const properties = actives
      .map((p) => ({ p, score: scoreProperty(p, profile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ p }) => publicPropertyCard(p));

    const topBand = topLabels(profile.bands, 1)[0];

    return NextResponse.json({
      properties,
      profile: {
        events: profile.events,
        blocks: topLabels(profile.blocks, 3),
        houseTypes: topLabels(profile.types, 2),
        maxRent: profile.maxRentSeen || undefined,
        budget: topBand ? bandLabel(topBand) : undefined,
      },
    });
  } catch (err) {
    console.error("[insights/recommend] GET failed:", err);
    return jsonErrorHelper();
  }
}

function jsonErrorHelper() {
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
