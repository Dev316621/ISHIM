import { headers } from "next/headers";

/**
 * Minimal Google OAuth 2.0 (authorization-code) helper — hand-rolled so it
 * plugs straight into iShim's existing DB-backed session system (no NextAuth).
 *
 * Env: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (Google Cloud Console →
 * Credentials → OAuth client (Web). Authorised redirect URI must be
 * `<public-origin>/api/auth/google/callback`.)
 *
 * The id_token returned by the code exchange is trusted without signature
 * verification because it is fetched server-side, directly from Google's
 * token endpoint over TLS, authenticated with the client secret.
 */

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * The public origin the browser sees. Behind the Caddy gateway the internal
 * request URL may say localhost:3000, so forwarded headers win when present.
 */
export async function publicOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) {
      // Local dev hits the server directly on http://localhost:3000
      if (/^(localhost|127\.0\.0\.1)/.test(host) && !h.get("x-forwarded-proto")) {
        return `http://${host}`;
      }
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable — fall through
  }
  return "http://localhost:3000";
}

export function googleRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchanges an authorization code for the user's Google profile. */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleProfile | null> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) return null;

  const payloadPart = tokens.id_token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payloadPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!json.sub || !json.email || json.email_verified === false) return null;
    return {
      sub: json.sub,
      email: json.email.toLowerCase(),
      name: (json.name || json.email.split("@")[0] || "iShim neighbour").slice(0, 80),
      picture: json.picture || "",
    };
  } catch {
    return null;
  }
}
