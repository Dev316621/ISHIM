import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, getJsonBody, jsonError } from "@/app/api/_lib/helpers";
import { deviceFromReq, recordEvent } from "@/app/api/insights/_lib/insights";
import { guard } from "@/lib/rate-limit";

/**
 * POST /api/properties/[id]/contact  {message?, method?: "WHATSAPP"|"CALL", route?: "OWNER"|"AGENT"}
 * Optional auth. Logs the touchpoint and returns the deep link:
 *  - WHATSAPP (default): wa.me link with the EXACT template
 *      "Hi, I saw your house listing in <block> on iShim. Is it still available?"
 *  - CALL: tel: link ("[Call] via iShim" logged, calls counter incremented).
 * Routing: the client may CHOOSE who to reach — route AGENT → listedByAgent's
 * number, route OWNER → owner's whatsappNumber. Missing number falls back to
 * the other party; no route given → the listing's default contactRoute.
 * The response always reports the effective `route` that was reached.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = guard(req, "contact", 30);
  if (limited) return limited;
  try {
    const { id } = await params;

    const property = await db.property.findUnique({
      where: { id },
      include: { owner: { select: { id: true, whatsappNumber: true } } },
    });
    if (!property) return jsonError("Property not found", 404);

    const body = await getJsonBody(req);
    const method = body && cleanStr(body.method).toUpperCase() === "CALL" ? "CALL" : "WHATSAPP";
    const customMessage = body ? cleanStr(body.message) : "";
    const message =
      customMessage ||
      (method === "CALL"
        ? `[Call] Hi, I saw your house listing in ${property.block} on iShim. Is it still available?`
        : `Hi, I saw your house listing in ${property.block} on iShim. Is it still available?`);

    // Who should we reach? Client's explicit choice wins, else the listing default.
    const requested = body ? cleanStr(body.route).toUpperCase() : "";
    let route: "OWNER" | "AGENT" =
      requested === "OWNER" || requested === "AGENT"
        ? requested
        : property.contactRoute === "AGENT"
          ? "AGENT"
          : "OWNER";

    const ownerNumber = property.owner.whatsappNumber?.trim() || null;
    let agentNumber: string | null = null;
    if (property.listedByAgentId) {
      const agent = await db.user.findUnique({
        where: { id: property.listedByAgentId },
        select: { whatsappNumber: true },
      });
      agentNumber = agent?.whatsappNumber?.trim() || null;
    }

    // Resolve the number for the chosen party; fall back to the other one
    // rather than dead-ending when a number is missing.
    let number: string | null = null;
    if (route === "AGENT") {
      number = agentNumber;
      if (!number) {
        route = "OWNER";
        number = ownerNumber;
      }
    } else {
      number = ownerNumber;
      if (!number) {
        route = "AGENT";
        number = agentNumber;
      }
    }
    if (!number) return jsonError("No contact number available for this listing", 400);

    const user = await getSessionUser();

    await db.$transaction([
      db.property.update({
        where: { id },
        data:
          method === "CALL"
            ? { calls: { increment: 1 } }
            : { whatsappClicks: { increment: 1 } },
      }),
      db.contactLog.create({
        data: {
          propertyId: id,
          userId: user?.id ?? null,
          message,
        },
      }),
    ]);

    const digits = number.replace(/[^0-9]/g, "");
    const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    const telLink = `tel:+${digits}`;

    // Habit analytics: contacting the owner is the strongest-intent signal.
    void recordEvent(
      { userId: user?.id ?? null, deviceId: deviceFromReq(req) },
      { kind: "CONTACT", propertyId: id }
    );

    return NextResponse.json({ waLink, telLink, method, message, route });
  } catch (err) {
    console.error("[properties/[id]/contact] POST failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
