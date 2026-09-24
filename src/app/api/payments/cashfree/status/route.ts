import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { guard } from "@/lib/rate-limit";
import { fullProperty } from "@/app/api/_lib/helpers";
import { fulfillCashfreeOrder } from "../_lib/fulfill";

/**
 * GET /api/payments/cashfree/status?orderId= — authenticated (the payer or an
 * admin). Polls Cashfree for the authoritative order status, fulfils the
 * payment when PAID (idempotent), and returns { status, property? } so the
 * client can close the loop without trusting the checkout modal alone.
 */
export async function GET(req: NextRequest) {
  try {
    const limited = guard(req, "cf-status", 120);
    if (limited) return limited;

    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
    if (!orderId) return jsonErr("orderId is required", 400);

    const intent = await db.paymentIntent.findUnique({ where: { cfOrderId: orderId } });
    if (!intent) return jsonErr("Unknown order", 404);
    if (intent.payerId !== auth.user.id && auth.user.role !== "ADMIN") {
      return jsonErr("You can only check your own payments", 403);
    }

    const result = await fulfillCashfreeOrder(orderId);

    return NextResponse.json({
      status: result.status,
      amount: intent.amount,
      property:
        result.status === "PAID" && result.property
          ? fullProperty(result.property as never)
          : null,
    });
  } catch (err) {
    console.error("[payments/cashfree/status] GET failed:", err);
    return jsonErr("Something went wrong", 500);
  }
}

function jsonErr(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
