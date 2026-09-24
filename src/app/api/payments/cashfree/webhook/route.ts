import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { guard } from "@/lib/rate-limit";
import { fulfillCashfreeOrder } from "../_lib/fulfill";

/**
 * POST /api/payments/cashfree/webhook — public, HMAC-SHA256 signature verified
 * against CASHFREE_WEBHOOK_SECRET. Cashfree posts order events here; we
 * re-verify the order directly with the gateway before fulfilling (never
 * trusting payload content alone). Always 200 after processing so Cashfree
 * stops retrying; non-2xx is reserved for rejected signatures.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = guard(req, "cf-webhook", 240);
    if (limited) return limited;

    const raw = await req.text();
    const signature = req.headers.get("x-webhook-signature");

    if (!verifyCashfreeWebhook(raw, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Payload shape varies across API versions — extract defensively.
    let orderId: string | undefined;
    let orderStatus: string | undefined;
    try {
      const body = JSON.parse(raw) as {
        type?: string;
        data?: {
          order?: { order_id?: string; order_status?: string };
          payment?: { order_id?: string; payment_status?: string };
        };
      };
      orderId = body.data?.order?.order_id || body.data?.payment?.order_id;
      orderStatus = body.data?.order?.order_status || body.data?.payment?.payment_status;
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ received: true, note: "no order id in payload" });
    }

    // Only act on signals that plausibly mean "money received" — the fulfill
    // step re-checks with the gateway anyway (defense in depth).
    const maybeMoney =
      orderStatus === "PAID" ||
      orderStatus === "SUCCESS" ||
      /paid|captured/i.test(raw);
    if (!maybeMoney) {
      return NextResponse.json({ received: true, note: "ignored non-paid event" });
    }

    const result = await fulfillCashfreeOrder(orderId);
    return NextResponse.json({ received: true, status: result.status });
  } catch (err) {
    console.error("[payments/cashfree/webhook] POST failed:", err);
    // 500 makes Cashfree retry — intentional for transient DB errors.
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
