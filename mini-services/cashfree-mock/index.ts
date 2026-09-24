/**
 * Mock Cashfree PG for local end-to-end testing of the iShim payment flow.
 * Endpoints mirror the small slice of api.cashfree.com/pg that iShim uses:
 *   POST /pg/orders                       → create order (returns payment_session_id)
 *   GET  /pg/orders/:id                   → order status (ACTIVE until flipped)
 *   GET  /pg/orders/:id/payments          → payments list (SUCCESS once paid)
 *   POST /__test/paid/:orderId            → simulate the customer completing UPI
 *   POST /__test/reset                    → wipe all orders
 *
 * Run: bun run dev  (port 3030, --hot for reload)
 */
const orders = new Map<
  string,
  { order_id: string; order_amount: number; order_status: string; payment_session_id: string; created: number }
>();
const payments = new Map<string, Array<{ cf_payment_id: number; order_id: string; payment_status: string; payment_amount: number }>>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Bun.serve({
  port: 3030,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "POST" && path === "/pg/orders") {
      const body = (await req.json()) as {
        order_id: string;
        order_amount: number;
        order_note?: string;
      };
      orders.set(body.order_id, {
        order_id: body.order_id,
        order_amount: body.order_amount,
        order_status: "ACTIVE",
        payment_session_id: `mock_session_${body.order_id}`,
        created: Date.now(),
      });
      payments.set(body.order_id, []);
      console.log(`[mock-cashfree] order created: ${body.order_id} ₹${body.order_amount} (${body.order_note ?? ""})`);
      return json({
        order_id: body.order_id,
        order_amount: body.order_amount,
        order_currency: "INR",
        order_status: "ACTIVE",
        payment_session_id: `mock_session_${body.order_id}`,
      });
    }

    const orderMatch = path.match(/^\/pg\/orders\/([^/]+)$/);
    if (req.method === "GET" && orderMatch) {
      const o = orders.get(decodeURIComponent(orderMatch[1]));
      if (!o) return json({ message: "order not found" }, 404);
      return json(o);
    }

    const payMatch = path.match(/^\/pg\/orders\/([^/]+)\/payments$/);
    if (req.method === "GET" && payMatch) {
      const id = decodeURIComponent(payMatch[1]);
      return json(payments.get(id) ?? []);
    }

    if (req.method === "POST" && path.startsWith("/__test/paid/")) {
      const id = decodeURIComponent(path.replace("/__test/paid/", ""));
      const o = orders.get(id);
      if (!o) return json({ error: "unknown order" }, 404);
      o.order_status = "PAID";
      payments.set(id, [
        {
          cf_payment_id: Math.floor(Math.random() * 1e9),
          order_id: id,
          payment_status: "SUCCESS",
          payment_amount: o.order_amount,
        },
      ]);
      console.log(`[mock-cashfree] order PAID: ${id}`);
      return json({ ok: true, order_id: id, order_status: "PAID" });
    }

    if (req.method === "POST" && path === "/__test/reset") {
      orders.clear();
      payments.clear();
      return json({ ok: true });
    }

    return json({ error: `no route: ${req.method} ${path}` }, 404);
  },
});

console.log("[mock-cashfree] listening on http://localhost:3030");
