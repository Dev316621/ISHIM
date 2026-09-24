import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import { readSettings, upsertSettings } from "../../_lib/helpers";

/**
 * PATCH /api/area-requests/[id] — AGENT / ADMIN.
 * Actions on a typed "my area is not listed" request:
 *   {action:"add"}     — append the area to the official Settings blocks
 *                        list (canonical spelling wins) and mark ADDED.
 *                        Returns {request, settings} so the client can
 *                        refresh the whole app's area lists instantly.
 *   {action:"discard"} — junk / typo / duplicate request.
 *   {action:"reopen"}  — pull it back into NEW.
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

    const request = await db.areaRequest.findUnique({ where: { id } });
    if (!request) return jsonError("Area request not found", 404);

    const handled = { handledById: user.id, handledByName: user.name };

    switch (action) {
      case "add": {
        // Canonical spelling: if the area is already listed under different
        // casing, reuse the official spelling; otherwise append the typed name.
        const settings = await readSettings();
        const typed = request.name.trim();
        const existing = settings.blocks.find((b) => b.toLowerCase() === typed.toLowerCase());
        const canonical = existing ?? typed;
        let nextSettings = settings;
        if (!existing) {
          nextSettings = await upsertSettings({ blocks: [...settings.blocks, canonical] });
        }
        const updated = await db.areaRequest.update({
          where: { id },
          data: { status: "ADDED", blockName: canonical, ...handled },
        });
        return NextResponse.json({ request: updated, settings: nextSettings });
      }

      case "discard": {
        const updated = await db.areaRequest.update({
          where: { id },
          data: { status: "DISCARDED", ...handled },
        });
        return NextResponse.json({ request: updated });
      }

      case "reopen": {
        const updated = await db.areaRequest.update({
          where: { id },
          data: { status: "NEW", handledById: null, handledByName: null, blockName: null },
        });
        return NextResponse.json({ request: updated });
      }

      default:
        return jsonError("action must be add | discard | reopen", 400);
    }
  } catch (err) {
    console.error("[area-requests/[id]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
