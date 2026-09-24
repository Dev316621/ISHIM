import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getJsonBody,
  jsonError,
  optionalInt,
  publicSettings,
  readSettings,
  stringArrayOrNull,
  upsertSettings,
  CANONICAL_HOUSE_TYPES,
  type AppSettings,
} from "@/app/api/_lib/helpers";

/**
 * GET /api/settings — public.
 * {successFee, freeModelStartAt, freeModelMonths, standardClientFee,
 *  standardMoveInFee, agentHelpFee, bizSuccessFee, bizStandardClientFee,
 *  bizStandardMoveInFee, bizAgentHelpFee, blocks, amenities, houseTypes,
 *  phase: "FREE"|"STANDARD", freeUntil, daysLeft}
 */
export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(publicSettings(settings));
  } catch (err) {
    console.error("[settings] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

/**
 * PATCH /api/settings — admin-only. Accepts a partial body:
 * {successFee?, freeModelStartAt?, freeModelMonths?, standardClientFee?,
 *  standardMoveInFee?, agentHelpFee?, bizSuccessFee?, bizStandardClientFee?,
 *  bizStandardMoveInFee?, bizAgentHelpFee?, blocks?, amenities?, houseTypes?}
 * — only provided fields are applied.
 */
export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    const patch: Partial<AppSettings> = {};

    if ("successFee" in body) {
      const fee = optionalInt(body.successFee);
      if (fee === undefined || fee < 0) {
        return jsonError("successFee must be a non-negative number", 400);
      }
      patch.successFee = fee;
    }

    if ("freeModelStartAt" in body) {
      const raw = typeof body.freeModelStartAt === "string" ? body.freeModelStartAt : "";
      const ms = Date.parse(raw);
      if (!raw || !Number.isFinite(ms)) {
        return jsonError("freeModelStartAt must be a valid date", 400);
      }
      patch.freeModelStartAt = new Date(ms).toISOString();
    }

    if ("freeModelMonths" in body) {
      const months = optionalInt(body.freeModelMonths);
      if (months === undefined || months < 1 || months > 240) {
        return jsonError("freeModelMonths must be between 1 and 240", 400);
      }
      patch.freeModelMonths = months;
    }

    for (const key of ["standardClientFee", "standardMoveInFee", "agentHelpFee", "webListingCharge", "commissionFee"] as const) {
      if (key in body) {
        const fee = optionalInt(body[key]);
        if (fee === undefined || fee < 0) {
          return jsonError(`${key} must be a non-negative number`, 400);
        }
        patch[key] = fee;
      }
    }

    if ("postTrialNote" in body) {
      const note = typeof body.postTrialNote === "string" ? body.postTrialNote.trim().slice(0, 500) : "";
      patch.postTrialNote = note;
    }

    // BUSINESS vertical pricing (shops, offices, cafes…) — admin-set, same window.
    for (const key of ["bizSuccessFee", "bizStandardClientFee", "bizStandardMoveInFee", "bizAgentHelpFee"] as const) {
      if (key in body) {
        const fee = optionalInt(body[key]);
        if (fee === undefined || fee < 0) {
          return jsonError(`${key} must be a non-negative number`, 400);
        }
        patch[key] = fee;
      }
    }

    if ("blocks" in body) {
      const blocks = stringArrayOrNull(body.blocks);
      if (blocks === null) return jsonError("blocks must be an array of strings", 400);
      patch.blocks = blocks;
    }

    if ("amenities" in body) {
      const amenities = stringArrayOrNull(body.amenities);
      if (amenities === null) return jsonError("amenities must be an array of strings", 400);
      patch.amenities = amenities;
    }

    if ("houseTypes" in body) {
      const houseTypes = stringArrayOrNull(body.houseTypes);
      if (houseTypes === null) return jsonError("houseTypes must be an array of strings", 400);
      if (houseTypes.some((t) => !CANONICAL_HOUSE_TYPES.includes(t))) {
        return jsonError(`houseTypes must be one of: ${CANONICAL_HOUSE_TYPES.join(", ")}`, 400);
      }
      patch.houseTypes = houseTypes;
    }

    if ("langOverrides" in body) {
      const raw = body.langOverrides;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return jsonError("langOverrides must be an object keyed by string key", 400);
      }
      const clean: Record<string, { TK?: string; MN?: string }> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
        const rec = v as Record<string, unknown>;
        const entry: { TK?: string; MN?: string } = {};
        for (const lang of ["TK", "MN"] as const) {
          const val = rec[lang];
          if (typeof val === "string" && val.trim()) {
            entry[lang] = val.trim().slice(0, 300);
          }
        }
        if (entry.TK || entry.MN) clean[k] = entry;
      }
      patch.langOverrides = clean;
    }

    // Ward/area photos (name → image url) — edited in the Areas tab.
    if ("wardImages" in body) {
      const raw = body.wardImages;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return jsonError("wardImages must be an object keyed by ward name", 400);
      }
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const key = k.trim().slice(0, 60);
        if (!key) continue;
        if (typeof v === "string" && v.trim() && v.length <= 500) clean[key] = v.trim();
      }
      patch.wardImages = clean;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("Nothing to update", 400);
    }

    const settings = await upsertSettings(patch);
    return NextResponse.json(publicSettings(settings));
  } catch (err) {
    console.error("[settings] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
