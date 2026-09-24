import { db } from "@/lib/db";
import { getCashfreeOrder, getCashfreeOrderPayments } from "@/lib/cashfree";

/**
 * Idempotent fulfillment for a Cashfree order:
 *   1. Load the local PaymentIntent.
 *   2. Ask Cashfree for the authoritative order status (never trust client
 *      or even webhook payload content alone).
 *   3. When PAID → create the completed Payment row + mark the property
 *      feePaid/RENTED inside a transaction, guarded by feePaid=false so a
 *      webhook and a poll racing together can never double-charge.
 *
 * Returns the intent's latest status + the fresh property when paid.
 */
export async function fulfillCashfreeOrder(cfOrderId: string): Promise<{
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "MISSING";
  property?: Record<string, unknown>;
}> {
  const intent = await db.paymentIntent.findUnique({
    where: { cfOrderId },
    include: { property: true },
  });
  if (!intent) return { status: "MISSING" };
  if (intent.status === "PAID") {
    const fresh = await db.property.findUnique({ where: { id: intent.propertyId } });
    return { status: "PAID", property: fresh ?? undefined };
  }

  let order;
  try {
    order = await getCashfreeOrder(cfOrderId);
  } catch (e) {
    console.error("[cashfree] order lookup failed:", e);
    return { status: intent.status as "PENDING" };
  }
  if (!order) {
    await db.paymentIntent
      .update({ where: { cfOrderId }, data: { status: "EXPIRED" } })
      .catch(() => undefined);
    return { status: "EXPIRED" };
  }

  if (order.order_status === "EXPIRED" || order.order_status === "TERMINATED") {
    const updated = await db.paymentIntent.update({
      where: { cfOrderId },
      data: { status: "EXPIRED" },
    });
    return { status: updated.status as "EXPIRED" };
  }

  if (order.order_status !== "PAID") {
    return { status: intent.status as "PENDING" };
  }

  // PAID — capture the successful payment id (best effort, not critical).
  const payments = await getCashfreeOrderPayments(cfOrderId).catch(() => []);
  const success = payments.find((p) => p.payment_status === "SUCCESS");

  // Atomic claim: only ONE caller gets feePaid=false → true.
  const claimed = await db.property.updateMany({
    where: { id: intent.propertyId, feePaid: false },
    data: {
      feePaid: true,
      status: "RENTED",
      feeAmount: intent.amount,
      rentedAt: intent.property.rentedAt ?? new Date(),
    },
  });

  if (claimed.count > 0) {
    await db.$transaction([
      db.payment.create({
        data: {
          propertyId: intent.propertyId,
          payerId: intent.payerId,
          amount: intent.amount,
          kind: intent.kind,
          method: "UPI",
        },
      }),
      db.paymentIntent.update({
        where: { cfOrderId },
        data: {
          status: "PAID",
          cfPaymentId: success ? String(success.cf_payment_id) : null,
          paidAt: new Date(),
        },
      }),
    ]);
  } else {
    // Already paid through another path (pay-fee route / earlier fulfillment) —
    // reconcile the intent without creating a second Payment.
    await db.paymentIntent.update({
      where: { cfOrderId },
      data: {
        status: "PAID",
        cfPaymentId: success ? String(success.cf_payment_id) : null,
        paidAt: intent.paidAt ?? new Date(),
      },
    });
  }

  const fresh = await db.property.findUnique({ where: { id: intent.propertyId } });
  return { status: "PAID", property: fresh ?? undefined };
}
