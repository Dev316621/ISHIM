import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/google";
import {
  cashfreeConfigured,
  cashfreeMode,
  createCashfreeOrder,
  getCashfreeOrder,
} from "@/lib/cashfree";
import { fulfillCashfreeOrder } from "../_lib/fulfill";
import { guard } from "@/lib/rate-limit";
import {
  canManageProperty,
  fullProperty,
  getJsonBody,
  jsonError,
  moveInFeeFor,
  readSettings,
} from "@/app/api/_lib/helpers";

/**
 * POST /api/payments/cashfree/order  — role OWNER / AGENT (of the listing) / ADMIN.
 * Body: { propertyId }
 * Server computes the phase-based success fee (never trusts the client),
 * creates a Cashfree order + local PaymentIntent, and returns the
 * payment_session_id for the hosted UPI/card checkout.
 * 501 with a clear message when CASHFREE_APP_ID/SECRET_KEY are not configured.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = guard(req, "cf-order", 20);
    if (limited) return limited;

    const cfg = await requireAuth();
    if (cfg.error) return cfg.error;

    if (!cashfreeConfigured()) {
      return NextResponse.json(
        {
          error:
            "Online payments are not configured yet — set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.",
          code: "CASHFREE_UNCONFIGURED",
        },
        { status: 501 }
      );
    }

    const body = await getJsonBody(req);
    if (!body) return jsonError("Invalid request body", 400);
    const propertyId = typeof body.propertyId === "string" ? body.propertyId : "";
    if (!propertyId) return jsonError("propertyId is required", 400);

    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property) return jsonError("Property not found", 404);

    const allowed = await canManageProperty(cfg.user, property);
    if (!allowed) return jsonError("You can only manage your own listings", 403);

    if (property.feePaid) return jsonError("Success fee already paid for this listing", 400);
    if (property.feeWaived) {
      return jsonError("This fee was waived by the admin — close the listing directly", 400);
    }

    const settings = await readSettings();
    const mode = property.mode === "BUSINESS" ? "BUSINESS" : "HOME";
    const amount = moveInFeeFor(settings, mode);
    if (amount < 1) {
      // Nothing to charge — the direct pay-fee route handles zero-amount closes.
      return jsonError("Nothing to pay for this listing", 400);
    }

    // One live intent per property: if a previous order exists, ask the
    // gateway what happened to it instead of blind-creating (Cashfree rejects
    // duplicate order_ids). Resume ACTIVE orders, fulfill PAID ones, retire
    // dead ones and mint a fresh order below.
    const existing = await db.paymentIntent.findFirst({
      where: { propertyId, kind: "SUCCESS_FEE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const customer = {
        customerId: cfg.user.id,
        customerName: cfg.user.name || "iShim user",
        customerPhone: cfg.user.whatsappNumber || cfg.user.phone,
        customerEmail: cfg.user.email || `${cfg.user.phone}@phone.ishim.in`,
      };
      const note = `iShim ${mode === "BUSINESS" ? "business" : ""} success fee — ${property.title}`.trim();

      let prior: Awaited<ReturnType<typeof getCashfreeOrder>> = null;
      try {
        prior = await getCashfreeOrder(existing.cfOrderId);
      } catch {
        // Gateway unreachable — let the create below surface the real error.
      }

      if (prior?.order_status === "ACTIVE" && prior.payment_session_id) {
        // Resume the open checkout with the same session.
        return NextResponse.json({
          orderId: prior.order_id,
          paymentSessionId: prior.payment_session_id,
          amount,
          mode: cashfreeMode(),
        });
      }
      if (prior?.order_status === "PAID") {
        // Money already arrived (customer paid, dialog closed early) — fulfill.
        const done = await fulfillCashfreeOrder(existing.cfOrderId);
        return NextResponse.json({ paid: true, property: done.property ?? null });
      }
      // EXPIRED / TERMINATED / unknown at the gateway — retire the intent and
      // fall through to create a fresh order.
      await db.paymentIntent
        .update({ where: { id: existing.id }, data: { status: "EXPIRED" } })
        .catch(() => undefined);
    }

    const cfOrderId = `ishim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const origin = await publicOrigin();
    const returnUrl = `${origin}/?cfPaid=${encodeURIComponent(cfOrderId)}`;

    const order = await createCashfreeOrder({
      orderId: cfOrderId,
      amount,
      customerId: cfg.user.id,
      customerName: cfg.user.name || "iShim user",
      customerPhone: cfg.user.whatsappNumber || cfg.user.phone,
      customerEmail: cfg.user.email || `${cfg.user.phone}@phone.ishim.in`,
      note: `iShim ${mode === "BUSINESS" ? "business" : ""} success fee — ${property.title}`.trim(),
      returnUrl,
    });

    await db.paymentIntent.create({
      data: {
        propertyId,
        payerId: cfg.user.id,
        amount,
        kind: "SUCCESS_FEE",
        cfOrderId: order.order_id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      amount,
      mode: cashfreeMode(),
      property: fullProperty(property),
    });
  } catch (err) {
    console.error("[payments/cashfree/order] POST failed:", err);
    return jsonError("Could not start the payment — please try again", 502);
  }
}
