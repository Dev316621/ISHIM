import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import Page from "@/app/page";

export const dynamic = "force-dynamic";

async function loadProperty(id: string) {
  try {
    return await db.property.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

function previewDescription(
  rent: number,
  bedrooms: number,
  block: string,
  description: string
): string {
  const parts = [`₹${rent.toLocaleString("en-IN")}/mo`];
  if (bedrooms > 0) parts.push(`${bedrooms} BHK`);
  parts.push(block);
  const flat = description.replace(/\s+/g, " ").trim();
  const snippet = flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
  return `${parts.join(" · ")}${snippet ? ` — ${snippet}` : ""}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const property = await loadProperty(id);
  if (!property) return {};

  const photos = JSON.parse(property.photos || "[]") as string[];
  const image = photos[0] || "/brand/og.png";
  const title = `${property.title} · iShim`;
  const description = previewDescription(
    property.rent,
    property.bedrooms,
    property.block,
    property.description
  );

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/p/${property.id}`,
      siteName: "iShim",
      type: "website",
      images: [{ url: image, alt: property.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharedPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await loadProperty(id);
  if (!property) notFound();
  return <Page initialPropertyId={id} />;
}
