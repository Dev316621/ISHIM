import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError, optionalInt, toBool } from "@/app/api/_lib/helpers";

const AD_ACTIONS = ["SEARCH", "LIST", "URL"];

/**
 * PATCH /api/admin/ads/[id] — ADMIN. Partial update of any banner field.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;
    const { id } = await params;

    const existing = await db.adBanner.findUnique({ where: { id } });
    if (!existing) return jsonError("Banner not found", 404);

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const data: {
      title?: string;
      kicker?: string;
      body?: string;
      ctaLabel?: string;
      action?: string;
      actionUrl?: string;
      image?: string;
      active?: boolean;
      sortOrder?: number;
    } = {};

    if (body.title !== undefined) {
      const title = cleanStr(body.title);
      if (!title) return jsonError("Title cannot be empty", 400);
      data.title = title;
    }
    if (body.kicker !== undefined) data.kicker = cleanStr(body.kicker);
    if (body.body !== undefined) data.body = cleanStr(body.body);
    if (body.ctaLabel !== undefined) {
      data.ctaLabel = cleanStr(body.ctaLabel) || "Learn more";
    }
    if (body.action !== undefined) {
      const action = cleanStr(body.action).toUpperCase();
      if (!AD_ACTIONS.includes(action)) {
        return jsonError("action must be SEARCH, LIST or URL", 400);
      }
      data.action = action;
    }
    if (body.actionUrl !== undefined) data.actionUrl = cleanStr(body.actionUrl);
    if (body.image !== undefined) {
      const image = cleanStr(body.image);
      if (!image) return jsonError("Banner image cannot be empty", 400);
      data.image = image;
    }
    if (body.active !== undefined) {
      const active = toBool(body.active);
      if (active === undefined) return jsonError("active must be a boolean", 400);
      data.active = active;
    }
    if (body.sortOrder !== undefined) {
      const sortOrder = optionalInt(body.sortOrder);
      if (sortOrder === undefined) return jsonError("sortOrder must be a number", 400);
      data.sortOrder = sortOrder;
    }

    // Validate URL action after merging both fields (create or update path).
    const nextAction = data.action ?? existing.action;
    const nextUrl = data.actionUrl ?? existing.actionUrl;
    if (nextAction === "URL" && !/^https?:\/\/.+/.test(nextUrl)) {
      return jsonError("A valid https:// link is required for URL actions", 400);
    }

    const ad = await db.adBanner.update({ where: { id }, data });
    return NextResponse.json({ ad });
  } catch (err) {
    console.error("[admin/ads/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * DELETE /api/admin/ads/[id] — ADMIN. Removes a banner permanently.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;
    const { id } = await params;

    const existing = await db.adBanner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError("Banner not found", 404);

    await db.adBanner.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/ads/[id]] DELETE failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
