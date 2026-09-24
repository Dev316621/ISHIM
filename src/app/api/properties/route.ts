import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseQuery } from "@/lib/query-parse";
import { nearestBlocks } from "@/lib/blocks-near";
import {
  BUSINESS_TYPES,
  CANONICAL_HOUSE_TYPES,
  KITCHEN_TYPES,
  PROPERTY_MODES,
  cleanStr,
  fullProperty,
  getJsonBody,
  jsonError,
  optionalInt,
  ownerVerifiedInclude,
  publicPropertyCard,
  readSettings,
  stringArrayOrNull,
  toBool,
} from "@/app/api/_lib/helpers";
import { queueAreaRequest, resolveBlock } from "../_lib/area-requests";

/**
 * GET /api/properties
 * Filters: mode (HOME|BUSINESS — absent returns every vertical), block,
 * near=1 (expand block to the 3 nearest wards), houseType, minRent, maxRent
 * (inclusive), bedrooms (>=), q (natural language — "under 5000", "2 bhk",
 * "available" are parsed out and applied as filters; the rest matches
 * title/description/block/type/amenities AND owner/agent names), featured=1.
 * sort: newest (default) | featured | price_asc | price_desc.
 * Pagination: skip (offset, default 0) + limit (page size, default 24, clamped
 * 1..60). Response is a page envelope { items, total, hasMore } so clients can
 * render "Load more" without guessing.
 * Only ACTIVE listings.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const where: Prisma.PropertyWhereInput = { status: "ACTIVE" };

    const mode = cleanStr(sp.get("mode")).toUpperCase();
    if (mode) {
      if (!PROPERTY_MODES.includes(mode)) {
        return jsonError(`mode must be one of: ${PROPERTY_MODES.join(", ")}`, 400);
      }
      where.mode = mode;
    }

    const block = cleanStr(sp.get("block"));
    if (block) {
      // near=1 → hyper-local proximity: anchor block + its nearest wards.
      const near = sp.get("near") === "1";
      if (near) {
        const settings = await readSettings();
        const nearBlocks = nearestBlocks(block, settings.blocks).slice(0, 3);
        where.block = { in: [block, ...nearBlocks] };
      } else {
        where.block = block;
      }
    }

    const houseType = cleanStr(sp.get("houseType")).toUpperCase();
    if (houseType) where.houseType = houseType;

    const minRent = optionalInt(sp.get("minRent"));
    const maxRent = optionalInt(sp.get("maxRent"));
    const rentFilter: Prisma.IntFilter = {};
    if (minRent !== undefined) rentFilter.gte = minRent;
    if (maxRent !== undefined) rentFilter.lte = maxRent;
    if (minRent !== undefined || maxRent !== undefined) where.rent = rentFilter;

    const bedrooms = optionalInt(sp.get("bedrooms"));
    if (bedrooms !== undefined) where.bedrooms = { gte: bedrooms };

    // Natural-language keyword search: structured parts ("under 5000", "2 bhk",
    // "available") are stripped server-side too, so a raw API caller gets the
    // same engine behaviour the UI does.
    const rawQ = cleanStr(sp.get("q"));
    const parsed = rawQ ? parseQuery(rawQ) : null;
    const q = parsed?.tokens ?? "";
    if (parsed) {
      const rent: Prisma.IntFilter = { ...rentFilter };
      if (parsed.minRent !== undefined) rent.gte = parsed.minRent;
      if (parsed.maxRent !== undefined) rent.lte = parsed.maxRent;
      if (rent.gte !== undefined || rent.lte !== undefined) where.rent = rent;
      if (parsed.bedrooms !== undefined) where.bedrooms = { gte: parsed.bedrooms };
      // "available" → already ACTIVE-only; nothing extra to AND in.
    }
    if (q) {
      // Owner/agent names are searchable too — resolve matching people and
      // OR-in their listings (agents own nothing but list for owners).
      const listers = await db.user.findMany({
        where: { role: { in: ["OWNER", "AGENT"] }, banned: false, name: { contains: q } },
        select: { id: true },
        take: 20,
      });
      const listerIds = listers.map((u) => u.id);
      // Amenities are stored as a JSON string column — a raw contains() also
      // matches them ("parking" finds listings with the Parking amenity).
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { block: { contains: q } },
        { houseType: { contains: q } },
        { amenities: { contains: q } },
        ...(listerIds.length > 0
          ? [{ ownerId: { in: listerIds } }, { listedByAgentId: { in: listerIds } }]
          : []),
      ];
    }

    const featured = cleanStr(sp.get("featured"));
    if (featured === "1" || featured === "true") where.featured = true;

    const sort = cleanStr(sp.get("sort"));
    const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
      sort === "price_asc"
        ? [{ rent: "asc" }, { createdAt: "desc" }]
        : sort === "price_desc"
          ? [{ rent: "desc" }, { createdAt: "desc" }]
          : sort === "featured"
            ? [{ featured: "desc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }];

    // Offset pagination: limit clamped 1..60 (default 24), skip >= 0.
    const limitRaw = optionalInt(sp.get("limit"));
    const limit = Math.min(Math.max(limitRaw ?? 24, 1), 60);
    const skip = Math.max(optionalInt(sp.get("skip")) ?? 0, 0);

    const [properties, total] = await Promise.all([
      db.property.findMany({
        where,
        include: ownerVerifiedInclude,
        orderBy,
        skip,
        take: limit,
      }),
      db.property.count({ where }),
    ]);

    return NextResponse.json({
      items: properties.map(publicPropertyCard),
      total,
      hasMore: skip + properties.length < total,
    });
  } catch (err) {
    console.error("[properties] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * POST /api/properties — role OWNER or AGENT.
 * {mode?, title, description, block, houseType, rent, deposit?, bedrooms?,
 *  bathrooms?, amenities?, photos?, ownerPhone? (agent only)}
 * mode: HOME (residential houses/apartments — default) | BUSINESS (shops,
 * offices, cafes…). houseType must match the vertical. Creates a PENDING
 * property. Agents may list on behalf of an owner by phone (owner is created
 * when missing) and an AgentOwner link is ensured.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["OWNER", "AGENT"]);
    if (guard.error) return guard.error;
    const user = guard.user;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const mode = cleanStr(body.mode).toUpperCase() || "HOME";
    if (!PROPERTY_MODES.includes(mode)) {
      return jsonError(`mode must be one of: ${PROPERTY_MODES.join(", ")}`, 400);
    }

    const allowedTypes = mode === "BUSINESS" ? BUSINESS_TYPES : CANONICAL_HOUSE_TYPES;

    const title = cleanStr(body.title);
    if (!title) return jsonError("Title is required", 400);

    const description = typeof body.description === "string" ? body.description.trim() : "";

    const rawBlock = cleanStr(body.block);
    if (!rawBlock) return jsonError("Block is required", 400);
    // "viewland" → official "Viewland"; unknown areas are kept as typed
    // and queued (below) so the team can add them to the official list.
    const { block, known } = await resolveBlock(rawBlock);

    const houseType = cleanStr(body.houseType).toUpperCase();
    if (!houseType) return jsonError("House type is required", 400);
    if (!allowedTypes.includes(houseType)) {
      return jsonError(`House type must be one of: ${allowedTypes.join(", ")}`, 400);
    }

    const rent = optionalInt(body.rent);
    if (rent === undefined || rent <= 0) return jsonError("Rent must be a positive number", 400);

    const deposit = optionalInt(body.deposit) ?? 0;
    if (deposit < 0) return jsonError("Deposit cannot be negative", 400);

    const bedrooms = optionalInt(body.bedrooms) ?? 1;
    if (bedrooms < 0) return jsonError("Bedrooms cannot be negative", 400);

    const bathrooms = optionalInt(body.bathrooms) ?? 1;
    if (bathrooms < 0) return jsonError("Bathrooms cannot be negative", 400);

    let amenities: string[] = [];
    if ("amenities" in body) {
      const parsed = stringArrayOrNull(body.amenities);
      if (parsed === null) return jsonError("amenities must be an array of strings", 400);
      amenities = parsed;
    }
    let photos: string[] = [];
    if ("photos" in body) {
      const parsed = stringArrayOrNull(body.photos);
      if (parsed === null) return jsonError("photos must be an array of strings", 400);
      photos = parsed;
    }

    const negotiable = toBool(body.negotiable) ?? false;

    // Kitchen is a residential concept — business listings never store it.
    const kitchenRaw = cleanStr(body.kitchen).toUpperCase();
    const kitchen = mode === "HOME" && kitchenRaw && KITCHEN_TYPES.includes(kitchenRaw) ? kitchenRaw : "";
    const areaSqft = optionalInt(body.areaSqft);
    if (areaSqft !== undefined && areaSqft <= 0) {
      return jsonError("Size must be a positive number", 400);
    }
    const widthFt = optionalInt(body.widthFt);
    if (widthFt !== undefined && widthFt <= 0) {
      return jsonError("Width must be a positive number", 400);
    }

    let ownerId = user.id;
    let listedByAgentId: string | null = null;

    if (user.role === "AGENT") {
      const ownerPhone = cleanStr(body.ownerPhone);
      if (ownerPhone) {
        let owner = await db.user.findUnique({ where: { phone: ownerPhone } });
        if (!owner) {
          const ownerName = cleanStr(body.ownerName) || `Owner ${ownerPhone}`;
          owner = await db.user.create({
            data: {
              phone: ownerPhone,
              name: ownerName,
              role: "OWNER",
              whatsappNumber: ownerPhone,
            },
          });
        } else if (owner.role === "CLIENT") {
          // The phone belongs to an existing client — promote them to OWNER so
          // they can manage the listing that was just created for them.
          owner = await db.user.update({
            where: { id: owner.id },
            data: { role: "OWNER" },
          });
        }
        ownerId = owner.id;
        listedByAgentId = user.id;
        await db.agentOwner.upsert({
          where: { agentId_ownerId: { agentId: user.id, ownerId: owner.id } },
          update: { status: "ACTIVE" },
          create: { agentId: user.id, ownerId: owner.id, status: "ACTIVE" },
        });
      } else {
        // Agent listing their own property.
        listedByAgentId = user.id;
      }
    }

    const property = await db.property.create({
      data: {
        ownerId,
        listedByAgentId,
        mode,
        title,
        description,
        block,
        houseType,
        rent,
        deposit,
        bedrooms,
        bathrooms,
        amenities: JSON.stringify(amenities),
        photos: JSON.stringify(photos),
        negotiable,
        kitchen: kitchen || null,
        areaSqft: areaSqft ?? null,
        widthFt: widthFt ?? null,
        // Agent-listed homes are agent-handled: WhatsApp/call deep links reach
        // the agent's number first (falls back to the owner's when missing).
        contactRoute: listedByAgentId ? "AGENT" : "OWNER",
        status: "PENDING",
      },
    });

    if (!known) {
      await queueAreaRequest({
        name: block,
        mode,
        requesterName: user.name,
        requesterPhone: user.phone,
        note: `From listing “${title}”`,
        source: "LISTING",
      });
    }

    return NextResponse.json({ property: fullProperty(property) }, { status: 201 });
  } catch (err) {
    console.error("[properties] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
