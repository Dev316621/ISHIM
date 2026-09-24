import crypto from "crypto";

/**
 * Cashfree Payment Gateway (UPI-first) — thin server-side client.
 *
 * Credentials come from env (set them in production, e.g. in the hosting
 * dashboard):
 *   CASHFREE_APP_ID          — Cashfree "App ID" from the dashboard
 *   CASHFREE_SECRET_KEY      — Cashfree "Secret Key"
 *   CASHFREE_API_BASE        — default https://api.cashfree.com
 *   CASHFREE_API_VERSION     — default 2025-01-01
 *   CASHFREE_MODE            — "sandbox" (default) | "production" (checkout UI)
 *   CASHFREE_WEBHOOK_SECRET  — webhook signature secret (optional but advised)
 *
 * When APP_ID/SECRET_KEY are missing the app degrades gracefully: the order
 * endpoint answers 501 and the UI falls back to a clear "not configured yet"
 * state (plus the dev-only simulate path in development builds).
 */

export interface CashfreeOrder {
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string; // ACTIVE | PAID | EXPIRED | TERMINATED ...
  payment_session_id: string;
  order_note?: string;
}

export interface CashfreePayment {
  cf_payment_id: number | string;
  order_id: string;
  payment_status: string; // SUCCESS | FAILED | PENDING ...
  payment_method?: { upi?: { upi_id?: string } } & Record<string, unknown>;
  payment_amount?: number;
  payment_time?: string;
}

const API_BASE = process.env.CASHFREE_API_BASE?.replace(/\/$/, "") || "https://api.cashfree.com";
const API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

export function cashfreeConfigured(): boolean {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

export function cashfreeMode(): "sandbox" | "production" {
  return process.env.CASHFREE_MODE === "production" ? "production" : "sandbox";
}

function authHeaders(): Record<string, string> {
  return {
    "x-client-id": process.env.CASHFREE_APP_ID ?? "",
    "x-client-secret": process.env.CASHFREE_SECRET_KEY ?? "",
    "x-api-version": API_VERSION,
    "content-type": "application/json",
  };
}

export interface CreateOrderInput {
  orderId: string; // <= 45 chars, [A-Za-z0-9_-]
  amount: number; // INR
  customerId: string;
  customerName: string;
  customerPhone: string; // 10-digit Indian number, no country code
  customerEmail: string; // Cashfree requires a valid email format
  note?: string;
  returnUrl?: string;
}

/** Create a Cashfree order and return its payment session for checkout. */
export async function createCashfreeOrder(input: CreateOrderInput): Promise<CashfreeOrder> {
  const res = await fetch(`${API_BASE}/pg/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: Number(input.amount.toFixed(2)),
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail,
      },
      order_meta: input.returnUrl ? { return_url: input.returnUrl } : undefined,
      order_note: input.note,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as CashfreeOrder & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || `Cashfree order failed (${res.status})`);
  }
  return data;
}

/** Fetch the authoritative order status from Cashfree. */
export async function getCashfreeOrder(orderId: string): Promise<CashfreeOrder | null> {
  const res = await fetch(`${API_BASE}/pg/orders/${encodeURIComponent(orderId)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const data = (await res.json().catch(() => ({}))) as CashfreeOrder & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || `Cashfree order lookup failed (${res.status})`);
  }
  return data;
}

/** List payments for an order (used to capture the successful payment id). */
export async function getCashfreeOrderPayments(orderId: string): Promise<CashfreePayment[]> {
  const res = await fetch(
    `${API_BASE}/pg/orders/${encodeURIComponent(orderId)}/payments`,
    { headers: authHeaders(), cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as CashfreePayment[];
  return Array.isArray(data) ? data : [];
}

/**
 * Verify a Cashfree webhook signature: base64(HMAC-SHA256(rawBody, secret))
 * in the x-webhook-signature header. Constant-time compare.
 */
export function verifyCashfreeWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
