import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireRole, sanitizeUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, jsonError } from "@/app/api/_lib/helpers";

/**
 * GET /api/admin/users?q= — role ADMIN. All users with propertiesCount +
 * contactsCount, filtered by q (contains on name/phone), newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const q = cleanStr(req.nextUrl.searchParams.get("q"));
    const where: Prisma.UserWhereInput = q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : {};

    const users = await db.user.findMany({
      where,
      include: { _count: { select: { properties: true, contacts: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      users.map((u) => ({
        ...sanitizeUser(u),
        createdAt: u.createdAt,
        propertiesCount: u._count.properties,
        contactsCount: u._count.contacts,
      }))
    );
  } catch (err) {
    console.error("[admin/users] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{6,15}$/;

/**
 * POST /api/admin/users — role ADMIN. Add a staff member (AGENT or ADMIN)
 * by their Google account email. iShim sign-in is Google-only for staff,
 * so the admin pre-registers the person here; on their first
 * "Continue with Google" the callback matches the email, attaches the
 * googleSub and they're in. No invite email needed — just tell them.
 * Body: {name, phone, email, role: "AGENT"|"ADMIN"} → 201 {user}
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError("Invalid request body", 400);

    const name = cleanStr(body.name).slice(0, 80);
    const phoneRaw = cleanStr(body.phone);
    const email = cleanStr(body.email).toLowerCase().slice(0, 200);
    const role = cleanStr(body.role).toUpperCase() === "ADMIN" ? "ADMIN" : "AGENT";

    if (name.length < 2) return jsonError("Enter the person's full name", 400);
    const phone = phoneRaw.replace(/[^0-9]/g, "");
    if (phone.length < 10 || phone.length > 13) {
      return jsonError("Enter a valid contact phone number", 400);
    }
    if (!EMAIL_RE.test(email)) {
      return jsonError("Enter the Google email they will sign in with", 400);
    }
    if (!PHONE_RE.test(phoneRaw)) return jsonError("Please enter a valid phone number", 400);

    if (await db.user.findUnique({ where: { email } })) {
      return jsonError("That Google email is already on iShim", 409);
    }
    if (await db.user.findUnique({ where: { phone } })) {
      return jsonError("That phone number already belongs to a user", 409);
    }

    const user = await db.user.create({
      data: {
        name,
        phone,
        email,
        role,
        whatsappNumber: phone,
      },
    });

    return NextResponse.json(
      { ...sanitizeUser(user), createdAt: user.createdAt, propertiesCount: 0, contactsCount: 0 },
      { status: 201 }
    );
  } catch (err) {
    console.error("[admin/users] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
