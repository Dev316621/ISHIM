import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJsonBody, jsonError, parseJsonArray } from "@/app/api/_lib/helpers";

/** Lead rows carry photos as a JSON string — always ship parsed arrays. */
function withPhotos<T extends { photos: string }>(lead: T) {
  return { ...lead, photos: parseJsonArray(lead.photos) };
}

/**
 * PATCH /api/leads/listing/[id] — AGENT / ADMIN.
 * Actions on an intake lead:
 *   {action:"claim"}      — take over an unclaimed request (409 if taken)
 *   {action:"release"}    — put it back into the unclaimed pool
 *   {action:"discard"}    — junk / duplicate / owner changed their mind
 *   {action:"markListed", propertyId?} — the real listing is live
 *   {action:"reopen"}     — pull it back from LISTED/DISCARDED
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await requireRole(["AGENT", "ADMIN"]);
    if (guard.error) return guard.error;
    const user = guard.user;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);
    const action = typeof body.action === "string" ? body.action : "";

    const lead = await db.listingLead.findUnique({
      where: { id },
      include: { claimedBy: { select: { name: true, role: true } } },
    });
    if (!lead) return jsonError("Listing request not found", 404);

    const isAdmin = user.role === "ADMIN";

    switch (action) {
      case "claim": {
        if (lead.claimedById && lead.claimedById !== user.id) {
          return jsonError(
            `Already claimed by ${lead.claimedBy?.name ?? "another agent"} — coordinate with them`,
            409
          );
        }
        if (lead.status === "DISCARDED") {
          return jsonError("This request was discarded — reopen it first", 400);
        }
        const updated = await db.listingLead.update({
          where: { id },
          data: { claimedById: user.id, status: "CLAIMED" },
          include: { claimedBy: { select: { name: true, role: true } } },
        });
        return NextResponse.json({ lead: withPhotos(updated) });
      }

      case "release": {
        if (lead.claimedById && lead.claimedById !== user.id && !isAdmin) {
          return jsonError("Only the agent who claimed it (or an admin) can release it", 403);
        }
        const updated = await db.listingLead.update({
          where: { id },
          data: { claimedById: null, status: "NEW" },
          include: { claimedBy: { select: { name: true, role: true } } },
        });
        return NextResponse.json({ lead: withPhotos(updated) });
      }

      case "discard": {
        if (lead.claimedById && lead.claimedById !== user.id && !isAdmin) {
          return jsonError("Only the claiming agent (or an admin) can discard it", 403);
        }
        const updated = await db.listingLead.update({
          where: { id },
          data: { status: "DISCARDED" },
          include: { claimedBy: { select: { name: true, role: true } } },
        });
        return NextResponse.json({ lead: withPhotos(updated) });
      }

      case "markListed": {
        if (lead.claimedById && lead.claimedById !== user.id && !isAdmin) {
          return jsonError("Only the claiming agent (or an admin) can mark it listed", 403);
        }
        const propertyId =
          typeof body.propertyId === "string" && body.propertyId.trim()
            ? body.propertyId.trim()
            : null;
        if (propertyId) {
          const property = await db.property.findUnique({
            where: { id: propertyId },
            select: { id: true },
          });
          if (!property) return jsonError("No listing matches that propertyId", 400);
        }
        const updated = await db.listingLead.update({
          where: { id },
          data: {
            status: "LISTED",
            propertyId,
            claimedById: lead.claimedById ?? user.id,
          },
          include: { claimedBy: { select: { name: true, role: true } } },
        });
        return NextResponse.json({ lead: withPhotos(updated) });
      }

      case "reopen": {
        if (lead.claimedById && lead.claimedById !== user.id && !isAdmin) {
          return jsonError("Only the claiming agent (or an admin) can reopen it", 403);
        }
        const updated = await db.listingLead.update({
          where: { id },
          data: {
            status: "CLAIMED",
            claimedById: lead.claimedById ?? user.id,
          },
          include: { claimedBy: { select: { name: true, role: true } } },
        });
        return NextResponse.json({ lead: withPhotos(updated) });
      }

      default:
        return jsonError("action must be claim | release | discard | markListed | reopen", 400);
    }
  } catch (err) {
    console.error("[leads/listing/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
