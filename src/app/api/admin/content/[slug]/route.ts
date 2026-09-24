import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole, sanitizeUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import {
  DEFAULT_CONTENT,
  buildContentPayload,
  isHelpArticleKey,
} from "@/lib/default-content";

/**
 * PUT /api/admin/content/[slug] — role ADMIN. Upserts an override for one
 * content page: {title, data, banner?, visible?}. Validated per slug shape.
 * PATCH /api/admin/content/[slug] — role ADMIN. Toggles page visibility only:
 * {visible: boolean}. Creates a default-content row when hiding a page that
 * was never customized, so the flag persists.
 * DELETE — role ADMIN. Removes the override so the built-in default shows.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    if (!isHelpArticleKey(slug)) return jsonError("Unknown page", 404);

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);

    let payload;
    try {
      payload = buildContentPayload(slug, body);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Invalid content", 400);
    }

    const visible =
      typeof body.visible === "boolean" ? body.visible : undefined;
    const updatedBy = sanitizeUser(guard.user).name;

    const row = await db.contentPage.upsert({
      where: { slug },
      create: { slug, ...payload, ...(visible === undefined ? {} : { visible }), updatedBy },
      update: { ...payload, ...(visible === undefined ? {} : { visible }), updatedBy },
    });

    return NextResponse.json({
      page: {
        slug,
        title: row.title,
        banner: row.banner,
        data: JSON.parse(row.data),
        customized: true,
        visible: row.visible,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy,
      },
    });
  } catch (err) {
    console.error("[admin/content/[slug]] PUT failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    if (!isHelpArticleKey(slug)) return jsonError("Unknown page", 404);

    const body = await getJsonBody(req);
    if (!body || typeof body.visible !== "boolean")
      return jsonError("visible (boolean) is required", 400);

    const existing = await db.contentPage.findUnique({ where: { slug } });
    const updatedBy = sanitizeUser(guard.user).name;

    const row = existing
      ? await db.contentPage.update({
          where: { slug },
          data: { visible: body.visible, updatedBy },
        })
      : await db.contentPage.create({
          data: {
            slug,
            title: DEFAULT_CONTENT[slug].title,
            data: JSON.stringify(DEFAULT_CONTENT[slug].data),
            visible: body.visible,
            updatedBy,
          },
        });

    return NextResponse.json({
      page: {
        slug,
        visible: row.visible,
        customized: true,
      },
    });
  } catch (err) {
    console.error("[admin/content/[slug]] PATCH failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    if (!isHelpArticleKey(slug)) return jsonError("Unknown page", 404);

    await db.contentPage.deleteMany({ where: { slug } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/content/[slug]] DELETE failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
