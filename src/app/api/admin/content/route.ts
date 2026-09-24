import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";
import {
  CONTENT_KEYS,
  DEFAULT_CONTENT,
  type ContentData,
  type ContentPageDto,
} from "@/lib/default-content";

/**
 * GET /api/admin/content — role ADMIN. Lists all content pages merged with
 * their built-in defaults so the editor always has something to show:
 * `{ pages: ContentPageDto[] }` with `customized` per row.
 */
export async function GET(_req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const rows = await db.contentPage.findMany();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));

    const pages: ContentPageDto[] = CONTENT_KEYS.map((slug) => {
      const row = bySlug.get(slug);
      let data: ContentData = DEFAULT_CONTENT[slug].data;
      if (row) {
        try {
          data = JSON.parse(row.data) as ContentData;
        } catch {
          // fall back to default data
        }
      }
      return {
        slug,
        title: row?.title ?? DEFAULT_CONTENT[slug].title,
        banner: row?.banner ?? "",
        data,
        customized: Boolean(row),
        visible: row?.visible ?? true,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
        updatedBy: row?.updatedBy ?? "",
      };
    });

    return NextResponse.json({ pages });
  } catch (err) {
    console.error("[admin/content] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
