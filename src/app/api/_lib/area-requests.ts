import { db } from "@/lib/db";
import { readSettings } from "./helpers";

/**
 * Shared plumbing for the "my area is not listed" flow.
 *
 * Guests (quick list) and owners/agents (full listing form) can type an
 * area/ward that isn't in the official Settings list. The lead/listing is
 * still accepted with the free-text block, and a row is queued in
 * AreaRequest so an agent or admin can add it to the official list with
 * one tap. Everything here is best-effort: a queue hiccup must never fail
 * the caller's main operation.
 */

/**
 * Canonicalize a client-supplied block: if it matches an official area
 * case-insensitively, return the official spelling. `known` tells the
 * caller whether the area is already on the list (no request needed).
 */
export async function resolveBlock(raw: string): Promise<{ block: string; known: boolean }> {
  const clean = raw.trim();
  if (!clean) return { block: "", known: false };
  const settings = await readSettings();
  const hit = settings.blocks.find((b) => b.toLowerCase() === clean.toLowerCase());
  return hit ? { block: hit, known: true } : { block: clean, known: false };
}

/**
 * Queue an AreaRequest for an area that isn't in Settings yet.
 * Dedupes case-insensitively while a NEW request for the same name is
 * already pending. Returns the created row id, or null when skipped
 * (known area / duplicate / failure — failures are logged, not thrown).
 */
export async function queueAreaRequest(meta: {
  name: string;
  mode?: string;
  note?: string;
  requesterName?: string;
  requesterPhone?: string;
  leadId?: string | null;
  source?: "FORM" | "LISTING" | "ADMIN";
}): Promise<{ id: string } | null> {
  try {
    const clean = meta.name.trim().slice(0, 60);
    if (!clean) return null;
    const nameKey = clean.toLowerCase();

    const settings = await readSettings();
    if (settings.blocks.some((b) => b.toLowerCase() === nameKey)) return null;

    const dupe = await db.areaRequest.findFirst({
      where: { nameKey, status: "NEW" },
      select: { id: true },
    });
    if (dupe) return null;

    const created = await db.areaRequest.create({
      data: {
        name: clean,
        nameKey,
        mode: meta.mode === "BUSINESS" ? "BUSINESS" : "HOME",
        note: (meta.note ?? "").slice(0, 300),
        requesterName: (meta.requesterName ?? "").slice(0, 80),
        requesterPhone: (meta.requesterPhone ?? "").replace(/[^0-9]/g, "").slice(0, 13),
        leadId: meta.leadId ?? null,
        source: meta.source ?? "FORM",
      },
      select: { id: true },
    });
    return created;
  } catch (err) {
    console.error("[area-requests] queue failed (non-fatal):", err);
    return null;
  }
}
