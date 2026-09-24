// ─── Client-side session token store ─────────────────────────────
// Cookies may be blocked when the app runs inside a cross-site preview
// iframe, so the auth layer keeps a mirror of the session token in
// localStorage and sends it as the `X-Session-Token` header on every
// request. Same-site/normal browsers keep using the httpOnly cookie —
// the server accepts either channel.

const TOKEN_KEY = "ishim_session_token";

export function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSessionToken(token: string | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable — cookie channel still works same-site
  }
}
