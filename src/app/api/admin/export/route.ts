// ─── Admin data backup — one Excel workbook with everything ──────────
// GET /api/admin/export  (ADMIN only)
// Sheets: Listings · People · Leads · Enquiries · Payments · Settings
// A JSON row-count summary is echoed in the X-Export-Counts header so the
// client can show "12 listings · 7 people · …" without parsing the file.

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { readSettings } from "../../_lib/helpers";

export const dynamic = "force-dynamic";

type Cell = string | number | boolean | null;

const HEADER_FILL = "FF0F766E"; // teal-700 — iShim staff colour
const dateStr = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "";

function sheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; width: number }[],
  rows: Cell[][]
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  ws.getRow(1).height = 22;
  ws.getRow(1).alignment = { vertical: "middle" };
  for (const row of rows) ws.addRow(row);
  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
  return ws;
}

const yesNo = (b: boolean | null | undefined) => (b ? "Yes" : "No");

export async function GET(_req: NextRequest) {
  const guard = await requireRole(["ADMIN"]);
  if (guard.error) return guard.error;

  const [properties, users, leads, enquiries, payments, settings] = await Promise.all([
    db.property.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: true },
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { properties: true } } } }),
    db.listingLead.findMany({
      orderBy: { createdAt: "desc" },
      include: { claimedBy: true },
    }),
    db.enquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: { property: true, user: true },
    }),
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: { property: true },
    }),
    readSettings(),
  ]);

  // listedByAgentId / lead.propertyId / payment.payerId are plain IDs — resolve names locally.
  const userById = new Map(users.map((u) => [u.id, u]));
  const titleById = new Map(properties.map((p) => [p.id, p.title] as const));

  const wb = new ExcelJS.Workbook();
  wb.creator = "iShim";
  wb.created = new Date();

  // ── Listings ──────────────────────────────────────────────────────
  sheet(
    wb,
    "Listings",
    [
      { header: "ID", width: 26 },
      { header: "Mode", width: 10 },
      { header: "Title", width: 30 },
      { header: "Block", width: 14 },
      { header: "House type", width: 12 },
      { header: "Rent (₹)", width: 10 },
      { header: "Deposit (₹)", width: 11 },
      { header: "Bedrooms", width: 9 },
      { header: "Bathrooms", width: 10 },
      { header: "Area (sq ft)", width: 11 },
      { header: "Status", width: 10 },
      { header: "Featured", width: 9 },
      { header: "Negotiable", width: 10 },
      { header: "Amenities", width: 34 },
      { header: "Views", width: 8 },
      { header: "WhatsApp clicks", width: 15 },
      { header: "Calls", width: 8 },
      { header: "Owner", width: 18 },
      { header: "Owner phone", width: 14 },
      { header: "Owner WhatsApp", width: 15 },
      { header: "Listed by agent", width: 20 },
      { header: "Contact route", width: 12 },
      { header: "Fee paid", width: 9 },
      { header: "Fee waived", width: 10 },
      { header: "Fee amount (₹)", width: 12 },
      { header: "Rented at", width: 17 },
      { header: "Created at", width: 17 },
    ],
    properties.map((p) => {
      let amenities: string[] = [];
      try {
        const parsed = JSON.parse(p.amenities || "[]");
        if (Array.isArray(parsed)) amenities = parsed.map(String);
      } catch {
        /* keep empty */
      }
      return [
        p.id,
        p.mode,
        p.title,
        p.block,
        p.houseType,
        p.rent,
        p.deposit,
        p.bedrooms,
        p.bathrooms,
        p.areaSqft ?? null,
        p.status,
        yesNo(p.featured),
        yesNo(p.negotiable),
        amenities.join(", "),
        p.views,
        p.whatsappClicks,
        p.calls,
        p.owner?.name ?? "",
        p.owner?.phone ?? "",
        p.owner?.whatsappNumber ?? p.owner?.phone ?? "",
        p.listedByAgentId ? userById.get(p.listedByAgentId)?.name ?? "" : "",
        p.contactRoute,
        yesNo(p.feePaid),
        yesNo(p.feeWaived),
        p.feeAmount ?? null,
        dateStr(p.rentedAt),
        dateStr(p.createdAt),
      ] as Cell[];
    })
  );

  // ── People ────────────────────────────────────────────────────────
  sheet(
    wb,
    "People",
    [
      { header: "ID", width: 26 },
      { header: "Name", width: 22 },
      { header: "Phone", width: 14 },
      { header: "WhatsApp", width: 15 },
      { header: "Email", width: 28 },
      { header: "Role", width: 9 },
      { header: "Verified", width: 9 },
      { header: "Banned", width: 8 },
      { header: "Listings", width: 9 },
      { header: "Address", width: 26 },
      { header: "Joined", width: 17 },
    ],
    users.map((u) => [
      u.id,
      u.name,
      u.phone,
      u.whatsappNumber ?? "",
      u.email ?? "",
      u.role,
      yesNo(u.verified),
      yesNo(u.banned),
      u._count.properties,
      u.address ?? "",
      dateStr(u.createdAt),
    ] as Cell[])
  );

  // ── Leads (quick-list requests from locals) ──────────────────────
  sheet(
    wb,
    "Leads",
    [
      { header: "ID", width: 26 },
      { header: "Name", width: 20 },
      { header: "Phone", width: 14 },
      { header: "Mode", width: 10 },
      { header: "Block", width: 14 },
      { header: "Budget rent (₹)", width: 14 },
      { header: "Details", width: 40 },
      { header: "Status", width: 10 },
      { header: "Source", width: 10 },
      { header: "Claimed by", width: 20 },
      { header: "Listed as", width: 28 },
      { header: "Created", width: 17 },
    ],
    leads.map((l) => [
      l.id,
      l.name,
      l.phone,
      l.mode,
      l.block,
      l.rent ?? null,
      l.details,
      l.status,
      l.source,
      l.claimedBy?.name ?? "",
      l.propertyId ? titleById.get(l.propertyId) ?? "" : "",
      dateStr(l.createdAt),
    ] as Cell[])
  );

  // ── Enquiries ─────────────────────────────────────────────────────
  sheet(
    wb,
    "Enquiries",
    [
      { header: "ID", width: 26 },
      { header: "Property", width: 28 },
      { header: "Name", width: 20 },
      { header: "Phone", width: 14 },
      { header: "Kind", width: 10 },
      { header: "Channel", width: 10 },
      { header: "Status", width: 11 },
      { header: "Visit slot", width: 17 },
      { header: "Message", width: 40 },
      { header: "Created", width: 17 },
    ],
    enquiries.map((e) => [
      e.id,
      e.property?.title ?? "",
      e.user?.name || e.name,
      e.user?.phone || e.phone,
      e.kind,
      e.channel,
      e.status,
      dateStr(e.visitAt),
      e.message,
      dateStr(e.createdAt),
    ] as Cell[])
  );

  // ── Payments ──────────────────────────────────────────────────────
  sheet(
    wb,
    "Payments",
    [
      { header: "ID", width: 26 },
      { header: "Property", width: 28 },
      { header: "Payer", width: 20 },
      { header: "Payer phone", width: 14 },
      { header: "Amount (₹)", width: 11 },
      { header: "Kind", width: 13 },
      { header: "Method", width: 10 },
      { header: "Created", width: 17 },
    ],
    payments.map((p) => [
      p.id,
      p.property?.title ?? "",
      p.payerId ? userById.get(p.payerId)?.name ?? "" : "",
      p.payerId ? userById.get(p.payerId)?.phone ?? "" : "",
      p.amount,
      p.kind,
      p.method,
      dateStr(p.createdAt),
    ] as Cell[])
  );

  // ── Settings ──────────────────────────────────────────────────────
  sheet(
    wb,
    "Settings",
    [
      { header: "Key", width: 24 },
      { header: "Value", width: 60 },
    ],
    Object.entries(settings).map(([k, v]) => [k, JSON.stringify(v)] as Cell[])
  );

  const counts = {
    listings: properties.length,
    people: users.length,
    leads: leads.length,
    enquiries: enquiries.length,
    payments: payments.length,
  };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ishim-backup-${today}.xlsx"`,
      "X-Export-Counts": encodeURIComponent(JSON.stringify(counts)),
      "Cache-Control": "no-store",
    },
  });
}
