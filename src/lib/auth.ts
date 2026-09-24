import { randomBytes, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "ishim_session";
export const SESSION_HEADER = "x-session-token"; // token fallback (blocked-cookie contexts)
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = User;

/** Shape returned to the frontend for a user — never includes sessions. */
export function sanitizeUser(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    address: user.address,
    name: user.name,
    role: user.role,
    verified: user.verified,
    banned: user.banned,
    whatsappNumber: user.whatsappNumber,
    idDoc: user.idDoc,
  };
}

/**
 * Reads the raw session token: `X-Session-Token` / `Authorization: Bearer`
 * header first (preview panels / iframes may block third-party cookies),
 * then the `ishim_session` cookie.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const h = await headers();
    const bearer = h.get("authorization");
    if (bearer?.toLowerCase().startsWith("bearer ")) {
      const t = bearer.slice(7).trim();
      if (t) return t;
    }
    const headerToken = h.get(SESSION_HEADER);
    if (headerToken) return headerToken.trim() || null;
  } catch {
    // headers() unavailable (static context) — fall through to cookies
  }
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the logged-in user from the session token (header or cookie).
 * Banned users are still returned — callers enforce role/banned themselves.
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const token = await getSessionToken();
    if (!token) return null;
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    return session?.user ?? null;
  } catch (err) {
    console.error("[auth] getSessionUser failed:", err);
    return null;
  }
}

/** Creates a Session row for the user and returns the raw token. */
export async function createSession(userId: string): Promise<string> {
  const token = `${randomUUID()}.${randomBytes(24).toString("hex")}`;
  await db.session.create({ data: { token, userId } });
  return token;
}

/**
 * Sets the httpOnly session cookie (path "/", sameSite lax, 30 days) on a
 * response. `secure` is enabled automatically in production builds so the
 * token never travels over plain HTTP once the site is served behind TLS.
 */
export function withSession<T>(response: NextResponse<T>, token: string): NextResponse<T> {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

/** Deletes the current Session row (header or cookie token) and clears the cookie. */
export async function clearSession(): Promise<void> {
  try {
    const token = await getSessionToken();
    if (token) {
      await db.session.deleteMany({ where: { token } });
    }
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  } catch (err) {
    console.error("[auth] clearSession failed:", err);
  }
}

export type AuthGuardResult =
  | { user: User; error?: undefined }
  | { user?: undefined; error: NextResponse };

/** 401 when not logged in, 403 when banned. */
export async function requireAuth(): Promise<AuthGuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Please log in to continue" }, { status: 401 }),
    };
  }
  if (user.banned) {
    return {
      error: NextResponse.json(
        { error: "Your account has been suspended. Contact support." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/** 401 when not logged in, 403 when banned or role not allowed. */
export async function requireRole(roles: string[]): Promise<AuthGuardResult> {
  const result = await requireAuth();
  if (result.error) return result;
  if (!roles.includes(result.user.role)) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission to do that" },
        { status: 403 }
      ),
    };
  }
  return { user: result.user };
}
