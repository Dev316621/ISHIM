import type { NextResponse } from "next/server";
import type { Property, Tenancy } from "@prisma/client";
import { jsonError, parseJsonArray } from "@/app/api/_lib/helpers";

// ─── Shared validation + card shapes for the Tenancy feature ──────

export const TENANCY_STATUSES = ["STAYING", "MOVED_OUT"] as const;
export const REMARK_MAX = 500;

export interface TenancyPatch {
  status?: string;
  ownerRating?: number | null;
  remark?: string | null;
}

/**
 * Validates tenancy fields from a request body.
 * partial=false → all three fields must be present/valid.
 * partial=true  → only provided fields are validated and returned.
 */
export function parseTenancyFields(
  body: Record<string, unknown>,
  opts: { partial: boolean }
): { data: TenancyPatch } | { error: NextResponse } {
  const data: TenancyPatch = {};

  if (!opts.partial || "status" in body) {
    const status = typeof body.status === "string" ? body.status : "";
    if (!(TENANCY_STATUSES as readonly string[]).includes(status)) {
      return { error: jsonError("status must be STAYING or MOVED_OUT", 400) };
    }
    data.status = status;
  }

  if (!opts.partial || "ownerRating" in body) {
    const v = body.ownerRating;
    if (v === null || v === undefined || v === "") {
      data.ownerRating = null;
    } else {
      const n = typeof v === "number" ? Math.trunc(v) : Number(String(v).trim());
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        return { error: jsonError("ownerRating must be between 1 and 5 stars", 400) };
      }
      data.ownerRating = n;
    }
  }

  if (!opts.partial || "remark" in body) {
    const v = body.remark;
    if (v === null || v === undefined || v === "") {
      data.remark = null;
    } else if (typeof v !== "string") {
      return { error: jsonError("remark must be text", 400) };
    } else {
      const t = v.trim();
      if (t.length > REMARK_MAX) {
        return { error: jsonError(`Remark is too long — keep it under ${REMARK_MAX} characters`, 400) };
      }
      data.remark = t || null;
    }
  }

  return { data };
}

/** Compact property reference used inside tenancy cards / picker lists. */
export function propertyRef(p: Property, extra?: { contactedAt?: string }) {
  return {
    id: p.id,
    title: p.title,
    block: p.block,
    rent: p.rent,
    photos: parseJsonArray(p.photos),
    status: p.status,
    ...(extra?.contactedAt ? { contactedAt: extra.contactedAt } : {}),
  };
}

export type TenancyWithProperty = Tenancy & { property: Property };

/** Card shape returned to the client for each of the user's tenancies. */
export function tenancyCard(t: TenancyWithProperty) {
  return {
    id: t.id,
    status: t.status,
    ownerRating: t.ownerRating,
    remark: t.remark,
    updatedAt: t.updatedAt,
    property: propertyRef(t.property),
  };
}

/** Privacy-safe tenant display name: "Ringson M." / "Choro". */
export function maskTenantName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Tenant";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}
