import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ContentData } from "@/lib/default-content";

/**
 * GET /api/content — public. Returns the admin-customized content pages:
 * `{ pages: { [slug]: { title, banner, data } }, hidden: string[] }`.
 * Slugs without a row are simply absent — clients fall back to the built-in
 * DEFAULT_CONTENT. Pages the admin toggled off appear in `hidden` so clients
 * can remove them from menus (their overrides are not returned).
 */
export async function GET(_req: NextRequest) {
  try {
    const rows = await db.contentPage.findMany();
    const pages: Record<string, { title: string; banner: string; data: ContentData }> = {};
    const hidden: string[] = [];
    for (const r of rows) {
      if (!r.visible) {
        hidden.push(r.slug);
        continue;
      }
      try {
        pages[r.slug] = {
          title: r.title,
          banner: r.banner,
          data: JSON.parse(r.data) as ContentData,
        };
      } catch {
        // Skip rows with corrupt data — default content will be used.
      }
    }
    return NextResponse.json({ pages, hidden });
  } catch (err) {
    console.error("[content] GET failed:", err);
    return NextResponse.json({ pages: {}, hidden: [] });
  }
}
