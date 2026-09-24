import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard } from "@/lib/rate-limit";
import { readSettings } from "@/app/api/_lib/helpers";
import { parseQuery, describeParsed } from "@/lib/query-parse";
import { findBlock, nearestBlocks } from "@/lib/blocks-near";

/**
 * GET /api/search/suggest — iShim's universal ("Google-style") search engine.
 *
 * One endpoint that searches EVERYTHING on iShim across both verticals:
 *   - PLACES   — community blocks / wards (with live listing counts)
 *   - NEARBY   — "near <block>" proximity search (nearest wards ranked)
 *   - LISTINGS — active homes & business spaces (title/block, description,
 *                amenities, type AND owner/agent name or phone matches)
 *   - PEOPLE   — owners & agents by name OR phone digits, or by role
 *                ("owners", "agents")
 *   - TYPES    — house types (Assam-type, RCC…) and business types (cafe…)
 *   - FILTERS  — structured quick-filters parsed out of natural language
 *                ("under 5000", "2 bhk", "available", "5000-8000")
 *   - PAGES    — site pages & actions (Pricing, Directory, How it works…)
 *
 * Query params:
 *   q     — the search text (1..80 chars)
 *   scope — ALL (default, both verticals) | HOME | BUSINESS
 *
 * Public; rate limited (typing drives many requests). Returns grouped
 * suggestions ranked with the strongest matches first.
 */

export const dynamic = "force-dynamic";

type Scope = "ALL" | "HOME" | "BUSINESS";

interface PageDef {
  key: string;
  title: string;
  subtitle: string;
  keywords: string[];
  action: { view?: "directory" | "pricing" | "profile"; help?: string; list?: boolean };
}

const PAGES: PageDef[] = [
  {
    key: "list",
    title: "List your property",
    subtitle: "Post a home, shop, office or cafe",
    keywords: ["list", "listing", "post", "add", "upload", "rent out", "landlord", "sell"],
    action: { list: true },
  },
  {
    key: "pricing",
    title: "Pricing & fees",
    subtitle: "Free period, plans and charges",
    keywords: ["pricing", "price", "fee", "fees", "cost", "free", "plan", "charge", "payment", "pay"],
    action: { view: "pricing" },
  },
  {
    key: "directory",
    title: "Know your Owners",
    subtitle: "Every owner & agent on iShim",
    keywords: ["directory", "owner", "owners", "agent", "agents", "people", "who", "landlords", "contacts"],
    action: { view: "directory" },
  },
  {
    key: "how",
    title: "How iShim works",
    subtitle: "Find and rent in three steps",
    keywords: ["how", "work", "works", "working", "guide", "help", "steps", "start", "begin", "use", "safe"],
    action: { help: "how" },
  },
  {
    key: "about",
    title: "About iShim",
    subtitle: "Why we built this",
    keywords: ["about", "ishim", "story", "team", "mission", "who we", "company"],
    action: { help: "about" },
  },
  {
    key: "business",
    title: "iShim Business",
    subtitle: "Shops, offices & cafes for rent",
    keywords: ["business", "businesses", "commercial", "shop", "shops", "office", "offices", "cafe", "cafes"],
    action: { help: "business" },
  },
  {
    key: "contact",
    title: "Contact & support",
    subtitle: "Talk to the iShim team",
    keywords: ["contact", "support", "phone", "call", "whatsapp", "email", "help me", "talk"],
    action: { help: "contact" },
  },
  {
    key: "faq",
    title: "FAQ",
    subtitle: "Common questions answered",
    keywords: ["faq", "faqs", "question", "questions", "answers"],
    action: { help: "support" },
  },
  {
    key: "saved",
    title: "Saved homes",
    subtitle: "Your shortlist",
    keywords: ["saved", "save", "favourite", "favorite", "favourites", "favorites", "heart", "shortlist", "bookmark"],
    action: { view: "profile" },
  },
  {
    key: "privacy",
    title: "Privacy policy",
    subtitle: "Your data on iShim",
    keywords: ["privacy", "data", "personal"],
    action: { help: "privacy" },
  },
  {
    key: "terms",
    title: "Terms of use",
    subtitle: "The rules of the platform",
    keywords: ["terms", "conditions", "legal", "rules"],
    action: { help: "terms" },
  },
];

const HOUSE_TYPE_LABELS: Record<string, string> = {
  ASSAM_TYPE: "Assam-type house",
  RCC: "RCC building",
  KUTCHA: "Kutcha house",
  APARTMENT: "Apartment",
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  SHOP: "Shop",
  OFFICE: "Office",
  CAFE: "Cafe",
  RESTAURANT: "Restaurant",
  WAREHOUSE: "Warehouse / Godown",
  SHOWROOM: "Showroom",
  WORKSHOP: "Workshop",
  KIOSK: "Stall / Kiosk",
  OTHER: "Other space",
};

function clampQuery(raw: string): string {
  return raw.trim().slice(0, 80);
}

export async function GET(req: NextRequest) {
  const limited = guard(req, "search-suggest", 120, 60_000);
  if (limited) return limited;

  try {
    const sp = req.nextUrl.searchParams;
    const q = clampQuery(sp.get("q") ?? "");
    const scopeRaw = (sp.get("scope") ?? "ALL").toUpperCase();
    const scope: Scope = scopeRaw === "HOME" || scopeRaw === "BUSINESS" ? scopeRaw : "ALL";
    const modeWhere = scope === "ALL" ? {} : { mode: scope };

    const empty = {
      q,
      scope,
      groups: { places: [], nearby: [], listings: [], people: [], types: [], filters: [], pages: [] },
    };
    if (!q) return NextResponse.json(empty);

    // ── Natural-language parse: pull structured filters out of the query ──
    const parsed = parseQuery(q);
    const tokens = parsed.tokens; // keyword text after "under 5000"-style parts
    const needle = tokens.toLowerCase(); // keyword matching only (never the raw q)

    const unit = scope === "BUSINESS" ? "spaces" : scope === "HOME" ? "homes" : "listings";
    const unitOne = scope === "BUSINESS" ? "space" : scope === "HOME" ? "home" : "listing";
    const hasFilterParts =
      parsed.minRent !== undefined || parsed.maxRent !== undefined ||
      parsed.bedrooms !== undefined || parsed.availability;

    // Phone detection: a run of 4+ digits searches people (owners/agents).
    const digitRun = q.match(/\d{4,}/)?.[0] ?? "";
    // Role keywords: "owners", "agents", "landlords" browse the directory.
    const wantsOwners = /\b(owners?|landlords?)\b/.test(needle) || (digitRun === "" && /\bowners?\b/.test(q.toLowerCase()));
    const wantsAgents = /\b(agents?)\b/.test(needle) || /\b(agents?)\b/.test(q.toLowerCase());
    const isRoleQuery = !digitRun && (wantsOwners || wantsAgents);

    // ── Block resolution for "near …" / block-named queries ──
    const s = await readSettings();
    const anchorBlock =
      (tokens && findBlock(tokens, s.blocks)) ||
      (parsed.nearText ? findBlock(parsed.nearText, s.blocks) : undefined) ||
      undefined;

    // Structured WHERE for the FILTER quick-search (price/beds within scope).
    const filterWhere: Record<string, unknown> = { status: "ACTIVE", ...modeWhere };
    if (parsed.minRent !== undefined || parsed.maxRent !== undefined) {
      // Price bands only make sense for residential rents — pin to HOME.
      filterWhere.mode = "HOME";
      const rent: Record<string, number> = {};
      if (parsed.minRent !== undefined) rent.gte = parsed.minRent;
      if (parsed.maxRent !== undefined) rent.lte = parsed.maxRent;
      filterWhere.rent = rent;
    }
    if (parsed.bedrooms !== undefined) filterWhere.bedrooms = { gte: parsed.bedrooms };

    // ── Owner/agent resolution: people named (or phoned) in the query ──
    const peopleByName =
      tokens || digitRun
        ? await db.user.findMany({
            where: {
              role: { in: ["OWNER", "AGENT"] },
              banned: false,
              OR: [
                ...(tokens ? [{ name: { contains: tokens } }] : []),
                ...(digitRun ? [{ phone: { contains: digitRun } }] : []),
              ],
            },
            orderBy: [{ verified: "desc" }, { name: "asc" }],
            take: 5,
            select: { id: true, name: true, role: true, verified: true, phone: true },
          })
        : [];

    // Their listings are relevant whether they were matched by name or phone.
    const listerIds = peopleByName.map((u) => u.id);

    // ── Strong listing match: keyword (title/block) OR lister identity ──
    const strongOr = [
      ...(tokens ? [{ title: { contains: tokens } }, { block: { contains: tokens } }] : []),
      ...(listerIds.length > 0
        ? [{ ownerId: { in: listerIds } }, { listedByAgentId: { in: listerIds } }]
        : []),
    ];

    // Run the independent searches in parallel.
    const [placesRaw, strongListings, weakListings, filterCount, cheapest, typeCounts, anchorCount] =
      await Promise.all([
        // ── Places: live counts per block (keyword only) ──
        tokens
          ? db.property
              .findMany({ where: { status: "ACTIVE", ...modeWhere }, select: { block: true } })
              .then((rows) => {
                const counts = new Map<string, number>();
                for (const r of rows) counts.set(r.block, (counts.get(r.block) ?? 0) + 1);
                for (const b of s.blocks) if (!counts.has(b)) counts.set(b, 0);
                return counts;
              })
          : Promise.resolve(new Map<string, number>()),
        // ── Listings: title / block / owner-name-or-phone match (strong) ──
        strongOr.length > 0
          ? db.property.findMany({
              where: { status: "ACTIVE", ...modeWhere, OR: strongOr },
              orderBy: [{ featured: "desc" }, { views: "desc" }, { createdAt: "desc" }],
              take: 6,
              select: {
                id: true, title: true, block: true, rent: true, mode: true,
                houseType: true, photos: true, status: true, featured: true,
                listedByAgentId: true,
                owner: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        // ── Listings: description / amenities / type match (weaker) ──
        tokens
          ? db.property.findMany({
              where: {
                status: "ACTIVE",
                ...modeWhere,
                OR: [
                  { description: { contains: tokens } },
                  { amenities: { contains: tokens } },
                  { houseType: { contains: tokens } },
                ],
              },
              orderBy: [{ featured: "desc" }, { views: "desc" }, { createdAt: "desc" }],
              take: 6,
              select: {
                id: true, title: true, block: true, rent: true, mode: true,
                houseType: true, photos: true, status: true, featured: true,
              },
            })
          : Promise.resolve([]),
        // ── Filter quick-search count ("under 5000" → N live homes) ──
        hasFilterParts
          ? db.property.count({ where: filterWhere })
          : Promise.resolve(0),
        // ── Pure-filter queries also preview the cheapest matches ──
        hasFilterParts
          ? db.property.findMany({
              where: filterWhere,
              orderBy: [{ rent: "asc" }, { createdAt: "desc" }],
              take: 3,
              select: {
                id: true, title: true, block: true, rent: true, mode: true,
                houseType: true, photos: true, status: true, featured: true,
              },
            })
          : Promise.resolve([]),
        // ── Types: live counts per type within scope ──
        db.property.groupBy({
          by: ["houseType", "mode"],
          where: { status: "ACTIVE", ...modeWhere },
          _count: { _all: true },
        }),
        // ── "Near <block>" count across anchor + 3 nearest wards ──
        anchorBlock
          ? db.property.count({
              where: {
                status: "ACTIVE",
                ...modeWhere,
                block: { in: [anchorBlock, ...nearestBlocks(anchorBlock, s.blocks).slice(0, 3)] },
              },
            })
          : Promise.resolve(0),
      ]);

    // Agent names for agent-listed strong hits (listedByAgentId is a bare FK).
    const agentIdNeed = strongListings
      .map((p) => p.listedByAgentId)
      .filter((id): id is string => !!id);
    const agentNames =
      agentIdNeed.length > 0
        ? await db.user.findMany({
            where: { id: { in: agentIdNeed } },
            select: { id: true, name: true },
          })
        : [];
    const agentNameById = new Map(agentNames.map((a) => [a.id, a.name]));

    // ── Places ──
    const places = [...placesRaw.entries()]
      .filter(([block]) => needle && block.toLowerCase().includes(needle))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([block, count]) => ({
        type: "PLACE" as const,
        id: `place:${block}`,
        title: block,
        subtitle:
          count > 0
            ? `${count} ${count === 1 ? unitOne : unit} in ${block}`
            : "No live listings yet",
        count,
        near: nearestBlocks(block, s.blocks).slice(0, 3),
      }));

    // ── Nearby ("near <block>" proximity search) ──
    const nearby = anchorBlock
      ? [
          {
            type: "NEARBY" as const,
            id: `near:${anchorBlock}`,
            title: `Near ${anchorBlock}`,
            subtitle:
              anchorCount > 0
                ? `${anchorCount} live ${anchorCount === 1 ? unitOne : unit} in ${anchorBlock} & the nearest wards`
                : `No live listings around ${anchorBlock} yet`,
            around: anchorBlock,
            count: anchorCount,
          },
        ]
      : [];

    // ── Listings (strong → cheapest → weak, deduped) ──
    const seen = new Set<string>();
    const mapListing = (p: {
      id: string; title: string; block: string; rent: number; mode: string;
      houseType: string; photos: string; status: string;
      owner?: { name: string } | null;
      listedByAgentId?: string | null;
    }) => {
      const typeLabel =
        p.mode === "BUSINESS"
          ? (BUSINESS_TYPE_LABELS[p.houseType] ?? p.houseType)
          : (HOUSE_TYPE_LABELS[p.houseType] ?? p.houseType);
      const lister = p.owner?.name ?? (p.listedByAgentId ? agentNameById.get(p.listedByAgentId) : undefined);
      const byLister = lister && listerIds.length > 0 ? ` · by ${lister}` : "";
      return {
        type: "PROPERTY" as const,
        id: p.id,
        title: p.title,
        subtitle: `${p.block} · ₹${p.rent.toLocaleString("en-IN")}/mo · ${typeLabel}${byLister}`,
        image: (JSON.parse(p.photos || "[]") as string[])[0] ?? "",
        rent: p.rent,
        mode: p.mode,
        status: p.status,
        houseType: p.houseType,
      };
    };
    const listings = [...strongListings, ...cheapest, ...weakListings]
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .slice(0, 6)
      .map(mapListing);

    // ── People ──
    let people: Array<{
      type: "PERSON";
      id: string;
      title: string;
      subtitle: string;
      role: string;
      verified: boolean;
      phone?: string;
      blocks: string[];
      listings: number;
    }> = [];
    let users = peopleByName;
    if (isRoleQuery && users.length === 0) {
      // "owners" / "agents" → top directory people regardless of name.
      users = await db.user.findMany({
        where: {
          role: wantsAgents && !wantsOwners ? "AGENT" : "OWNER",
          banned: false,
        },
        orderBy: [{ verified: "desc" }, { name: "asc" }],
        take: 4,
        select: { id: true, name: true, role: true, verified: true, phone: true },
      });
    }
    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      const props = await db.property.findMany({
        where: {
          // Agents list homes owned by others (listedByAgentId) — count both.
          OR: [{ ownerId: { in: ids } }, { listedByAgentId: { in: ids } }],
          status: { in: ["ACTIVE", "RENTED"] },
          ...modeWhere,
        },
        select: { ownerId: true, listedByAgentId: true, block: true, status: true },
      });
      const perUser = new Map<string, { total: number; blocks: Set<string> }>();
      const bump = (uid: string, block: string, live: boolean) => {
        const bucket = perUser.get(uid) ?? { total: 0, blocks: new Set<string>() };
        if (live) {
          bucket.total += 1;
          bucket.blocks.add(block);
        }
        perUser.set(uid, bucket);
      };
      for (const p of props) {
        const live = p.status === "ACTIVE";
        if (p.ownerId) bump(p.ownerId, p.block, live);
        if (p.listedByAgentId) bump(p.listedByAgentId, p.block, live);
      }
      people = users
        .map((u) => {
          const stat = perUser.get(u.id);
          const roleLabel = u.role === "AGENT" ? "Agent" : "Owner";
          return {
            type: "PERSON" as const,
            id: u.id,
            title: u.name,
            subtitle: `${roleLabel}${u.verified ? " · Verified" : ""}${
              stat && stat.total > 0
                ? ` · ${stat.total} live ${stat.total === 1 ? unitOne : unit}`
                : ""
            }${u.phone ? ` · ${u.phone}` : ""}`,
            role: u.role,
            verified: u.verified,
            phone: u.phone,
            blocks: stat ? [...stat.blocks].slice(0, 3) : [],
            listings: stat?.total ?? 0,
          };
        })
        .sort((a, b) => b.listings - a.listings);
    }

    // ── Types (label or key match, live counts) ──
    const countFor = (houseType: string, mode: string) =>
      typeCounts.find((t) => t.houseType === houseType && t.mode === mode)?._count._all ?? 0;

    const types = [
      ...Object.entries(HOUSE_TYPE_LABELS).map(([key, label]) => ({
        key, label, mode: "HOME" as const, count: countFor(key, "HOME"),
      })),
      ...Object.entries(BUSINESS_TYPE_LABELS).map(([key, label]) => ({
        key, label, mode: "BUSINESS" as const, count: countFor(key, "BUSINESS"),
      })),
    ]
      .filter(
        (t) =>
          needle &&
          (t.label.toLowerCase().includes(needle) ||
            t.key.toLowerCase().includes(needle.replace(/\s+/g, "_")))
      )
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 3)
      .map((t) => ({
        type: "TYPE" as const,
        id: `type:${t.mode}:${t.key}`,
        title: t.label,
        subtitle:
          t.count > 0
            ? `${t.count} ${t.mode === "BUSINESS" ? "business space" : "home"}${t.count === 1 ? "" : "s"} · ${t.mode === "BUSINESS" ? "Business" : "Homes"} panel`
            : "No live listings yet",
        houseType: t.key,
        mode: t.mode,
        count: t.count,
      }));

    // ── Filters (structured quick-filter parsed from the query) ──
    const filters =
      hasFilterParts
        ? [
            {
              type: "FILTER" as const,
              id: "filter:parsed",
              title: describeParsed(parsed) || "Available now",
              subtitle:
                filterCount > 0
                  ? `${filterCount} live ${filterCount === 1 ? unitOne : unit} match${filterCount === 1 ? "es" : ""} · tap to browse`
                  : `No live ${unit} match this — try a wider budget`,
              minRent: parsed.minRent,
              maxRent: parsed.maxRent,
              bedrooms: parsed.bedrooms,
              availability: parsed.availability,
              count: filterCount,
            },
          ]
        : [];

    // ── Pages ──
    const pages = PAGES.filter(
      (p) =>
        needle &&
        (p.title.toLowerCase().includes(needle) ||
          p.keywords.some((k) => k.includes(needle) || needle.includes(k)))
    )
      .slice(0, 4)
      .map((p) => ({
        type: "PAGE" as const,
        id: `page:${p.key}`,
        title: p.title,
        subtitle: p.subtitle,
        action: p.action,
      }));

    return NextResponse.json({
      q,
      scope,
      groups: { places, nearby, listings, people, types, filters, pages },
    });
  } catch (err) {
    console.error("[search/suggest] GET failed:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
