import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  jsonError,
  ownerVerifiedInclude,
  publicPropertyCard,
} from "@/app/api/_lib/helpers";

/**
 * GET /api/directory — public "Know your Owners" directory (footer link).
 *
 * Every non-banned OWNER / AGENT profile with:
 *  - contact: phone + WhatsApp number (raw; the client normalizes for wa.me / tel:),
 *  - blocks: the community blocks / wards they currently list in,
 *  - stats: how many listings they have, how many are available, how many
 *    were successfully rented (their track record),
 *  - managedBy: for owners, the iShim agent who onboarded/maintains them
 *    (owners are added by agents — never self-serve),
 *  - listings: their visible rentals (ACTIVE + RENTED) as public cards.
 *
 * Owners contribute homes they own; agents additionally contribute homes they
 * listed on behalf of owners (listedByAgentId has no Prisma relation, so those
 * come from one extra query grouped by agent id). PENDING / HIDDEN / REJECTED
 * listings never appear. An admin-owned property would only surface through an
 * agent link, never through the ADMIN user itself (role filter excludes admins).
 */
export async function GET() {
  type DirectoryListing = ReturnType<typeof publicPropertyCard>;

  try {
    const users = await db.user.findMany({
      where: { role: { in: ["OWNER", "AGENT"] }, banned: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        verified: true,
        phone: true,
        whatsappNumber: true,
        createdAt: true,
        properties: {
          where: { status: { in: ["ACTIVE", "RENTED"] } },
          include: ownerVerifiedInclude,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Agent-listed homes (listedByAgentId) — one query, grouped by agent.
    const agentListed = await db.property.findMany({
      where: {
        listedByAgentId: { not: null },
        status: { in: ["ACTIVE", "RENTED"] },
      },
      include: ownerVerifiedInclude,
      orderBy: { createdAt: "desc" },
    });
    const byAgent = new Map<string, typeof agentListed>();
    for (const p of agentListed) {
      if (!p.listedByAgentId) continue;
      const bucket = byAgent.get(p.listedByAgentId);
      if (bucket) bucket.push(p);
      else byAgent.set(p.listedByAgentId, [p]);
    }

    // propertyId → the agent who put it live (for the "Managed by" chip on
    // owner profiles — every owner here was onboarded by an agent).
    const agentNames = new Map(
      await db.user.findMany({
        where: { role: "AGENT" },
        select: { id: true, name: true, verified: true },
      }).then((rows) => rows.map((r) => [r.id, r] as const))
    );
    const managerOf = new Map<string, { name: string; verified: boolean }>();
    for (const p of agentListed) {
      if (!p.listedByAgentId) continue;
      const agent = agentNames.get(p.listedByAgentId);
      if (agent && !managerOf.has(p.id)) {
        managerOf.set(p.id, { name: agent.name, verified: agent.verified });
      }
    }

    const profiles = users.map((u) => {
      // Owned (visible) + agent-listed, deduped by id (an agent's own home
      // would otherwise appear twice).
      const seen = new Set<string>();
      const listings: DirectoryListing[] = [];
      for (const p of [...u.properties, ...(byAgent.get(u.id) ?? [])]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        listings.push(publicPropertyCard(p));
      }
      const available = listings.filter((p) => p.status === "ACTIVE").length;
      // The agent who onboarded them (first agent-listed home wins).
      const managedBy =
        listings.map((p) => managerOf.get(p.id)).find(Boolean) ?? null;
      return {
        id: u.id,
        name: u.name,
        role: u.role === "AGENT" ? ("AGENT" as const) : ("OWNER" as const),
        verified: u.verified,
        phone: u.phone,
        whatsapp: u.whatsappNumber ?? u.phone,
        memberSince: u.createdAt,
        blocks: [...new Set(listings.map((p) => p.block))],
        stats: {
          total: listings.length,
          available,
          rented: listings.length - available,
        },
        managedBy,
        listings,
      };
    });

    // Busiest profiles first, then alphabetical.
    profiles.sort(
      (a, b) => b.stats.total - a.stats.total || a.name.localeCompare(b.name)
    );

    const summary = {
      owners: profiles.filter((p) => p.role === "OWNER").length,
      agents: profiles.filter((p) => p.role === "AGENT").length,
      listings: profiles.reduce((n, p) => n + p.stats.total, 0),
      available: profiles.reduce((n, p) => n + p.stats.available, 0),
      successes: profiles.reduce((n, p) => n + p.stats.rented, 0),
    };

    return NextResponse.json({ summary, profiles });
  } catch (err) {
    console.error("[directory] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
