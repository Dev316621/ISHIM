/**
 * iShim — Database seed script
 * Run: bunx tsx prisma/seed.ts  (or bun run prisma/seed.ts)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BLOCKS = [
  "Hungpung",
  "Viewland",
  "Phungyo",
  "Phungwamee",
  "Mini Veng",
  "Halisahar",
  "Dungrei",
  "Old Bazaar",
  "TNL Ward",
  "Nungshang",
];

const AMENITIES = [
  "Water Supply",
  "Parking",
  "Solar Heating",
  "Internet Ready",
  "Fully Furnished",
  "Semi Furnished",
  "Boundary Wall",
  "Garden",
  "Attached Bathroom",
  "Borewell",
];

const HOUSE_TYPES = ["ASSAM_TYPE", "RCC", "KUTCHA", "APARTMENT"];

async function main() {
  console.log("🌱 Seeding iShim…");

  // ─── Settings ──────────────────────────────────────────────
  await db.setting.upsert({
    where: { key: "successFee" },
    update: { value: "1000" },
    create: { key: "successFee", value: "1000" },
  });
  await db.setting.upsert({
    where: { key: "blocks" },
    update: { value: JSON.stringify(BLOCKS) },
    create: { key: "blocks", value: JSON.stringify(BLOCKS) },
  });
  await db.setting.upsert({
    where: { key: "amenities" },
    update: { value: JSON.stringify(AMENITIES) },
    create: { key: "amenities", value: JSON.stringify(AMENITIES) },
  });
  await db.setting.upsert({
    where: { key: "houseTypes" },
    update: { value: JSON.stringify(HOUSE_TYPES) },
    create: { key: "houseTypes", value: JSON.stringify(HOUSE_TYPES) },
  });

  // ─── Users ─────────────────────────────────────────────────
  const admin = await db.user.upsert({
    where: { phone: "9000000001" },
    update: {},
    create: {
      phone: "9000000001",
      name: "iShim Admin",
      role: "ADMIN",
      verified: true,
      whatsappNumber: "919000000001",
    },
  });

  const owner1 = await db.user.upsert({
    where: { phone: "9856001101" },
    update: {},
    create: {
      phone: "9856001101",
      name: "Ngathan Shimray",
      role: "OWNER",
      verified: true,
      idDoc: "Aadhaar XXXX-2231 / Ward member ref: Hungpung",
      whatsappNumber: "919856001101",
    },
  });

  const owner2 = await db.user.upsert({
    where: { phone: "9856001102" },
    update: {},
    create: {
      phone: "9856001102",
      name: "Ringkahao Kazingmei",
      role: "OWNER",
      verified: false,
      idDoc: "Voter ID UKH-4455 submitted, pending ward check",
      whatsappNumber: "919856001102",
    },
  });

  const agent = await db.user.upsert({
    where: { phone: "9856001103" },
    update: {},
    create: {
      phone: "9856001103",
      name: "Marcus Chonsinrao",
      role: "AGENT",
      verified: true,
      whatsappNumber: "919856001103",
    },
  });

  const client1 = await db.user.upsert({
    where: { phone: "9856001104" },
    update: {},
    create: {
      phone: "9856001104",
      name: "Grace Awungshi",
      role: "CLIENT",
      whatsappNumber: "919856001104",
    },
  });

  const client2 = await db.user.upsert({
    where: { phone: "9856001105" },
    update: {},
    create: {
      phone: "9856001105",
      name: "Tennyson Murry",
      role: "CLIENT",
      whatsappNumber: "919856001105",
    },
  });

  // ─── Properties ────────────────────────────────────────────
  const mkProp = async (data: Record<string, unknown>) => {
    const title = data.title as string;
    const existing = await db.property.findFirst({ where: { title, ownerId: data.ownerId as string } });
    if (existing) return existing;
    return db.property.create({ data: data as never });
  };

  const p1 = await mkProp({
    ownerId: owner1.id,
    title: "Sunny Assam-type house near Hungpung playground",
    description:
      "Classic Assam-type home on stilts with a large front garden and marigold beds. 10 min walk from Hungpung ground. Peaceful lane, water supply twice daily, evening breeze from the hills.",
    block: "Hungpung",
    houseType: "ASSAM_TYPE",
    rent: 6500,
    deposit: 13000,
    bedrooms: 2,
    bathrooms: 1,
    amenities: JSON.stringify(["Water Supply", "Garden", "Parking", "Boundary Wall"]),
    photos: JSON.stringify(["/images/prop-1.jpg", "/images/prop-3.jpg"]),
    status: "ACTIVE",
    featured: true,
    whatsappClicks: 12,
    views: 86,
  });

  const p2 = await mkProp({
    ownerId: owner1.id,
    title: "Modern 2BHK RCC with balcony — Viewland",
    description:
      "Newly built RCC house, first floor, 2 bedrooms with attached bathrooms, balcony facing the Shirui peak line. Borewell + municipal water. Family preferred.",
    block: "Viewland",
    houseType: "RCC",
    rent: 11000,
    deposit: 22000,
    bedrooms: 2,
    bathrooms: 2,
    amenities: JSON.stringify(["Water Supply", "Parking", "Attached Bathroom", "Internet Ready", "Boundary Wall"]),
    photos: JSON.stringify(["/images/prop-2.jpg", "/images/prop-8.jpg"]),
    status: "ACTIVE",
    featured: true,
    whatsappClicks: 7,
    views: 54,
  });

  const p3 = await mkProp({
    ownerId: owner2.id,
    title: "Hilltop wooden cottage — Dungrei sunrise view",
    description:
      "A rare hilltop cottage with wooden porch and sweeping valley views. Ideal for a small family or working couple. Solar heating backup installed.",
    block: "Dungrei",
    houseType: "ASSAM_TYPE",
    rent: 8500,
    deposit: 17000,
    bedrooms: 2,
    bathrooms: 1,
    amenities: JSON.stringify(["Solar Heating", "Water Supply", "Garden", "Semi Furnished"]),
    photos: JSON.stringify(["/images/prop-4.jpg", "/images/prop-6.jpg"]),
    status: "ACTIVE",
    featured: true,
    whatsappClicks: 21,
    views: 132,
  });

  const p4 = await mkProp({
    ownerId: owner2.id,
    title: "Compact 1BHK apartment above Old Bazaar shops",
    description:
      "Walk-to-everything location above the Old Bazaar row. Best for a working single or couple. Water 24×7, new kitchen platform.",
    block: "Old Bazaar",
    houseType: "APARTMENT",
    rent: 4500,
    deposit: 9000,
    bedrooms: 1,
    bathrooms: 1,
    amenities: JSON.stringify(["Water Supply", "Fully Furnished", "Internet Ready"]),
    photos: JSON.stringify(["/images/prop-7.jpg", "/images/prop-5.jpg"]),
    status: "ACTIVE",
    whatsappClicks: 4,
    views: 40,
  });

  const p5 = await mkProp({
    ownerId: owner1.id,
    title: "Family RCC ground floor — Phungwamee",
    description:
      "Ground floor of a friendly family house. 3 bedrooms, big kitchen, safe for kids, close to Phungwamee church and school route.",
    block: "Phungwamee",
    houseType: "RCC",
    rent: 9000,
    deposit: 18000,
    bedrooms: 3,
    bathrooms: 2,
    amenities: JSON.stringify(["Water Supply", "Parking", "Borewell", "Boundary Wall"]),
    photos: JSON.stringify(["/images/prop-9.jpg"]),
    status: "ACTIVE",
    whatsappClicks: 2,
    views: 25,
  });

  const p6 = await mkProp({
    ownerId: owner2.id,
    title: "Traditional Tangkhul house — Nungshang lane",
    description:
      "Old-style wooden house, newly re-roofed. Fireplace in the kitchen, chilli garden behind. For someone who loves the old Ukhrul feel.",
    block: "Nungshang",
    houseType: "KUTCHA",
    rent: 3500,
    deposit: 7000,
    bedrooms: 2,
    bathrooms: 1,
    amenities: JSON.stringify(["Water Supply", "Garden"]),
    photos: JSON.stringify(["/images/prop-6.jpg"]),
    status: "PENDING", // waiting in Admin approval queue
  });

  const p7 = await mkProp({
    ownerId: owner1.id,
    title: "Semi-furnished studio — Mini Veng",
    description:
      "Studio room with attached bathroom, small pantry corner. Bike parking inside gate. Landlord stays next door.",
    block: "Mini Veng",
    houseType: "APARTMENT",
    rent: 3800,
    deposit: 7600,
    bedrooms: 1,
    bathrooms: 1,
    amenities: JSON.stringify(["Semi Furnished", "Attached Bathroom", "Parking"]),
    photos: JSON.stringify(["/images/prop-3.jpg"]),
    status: "ACTIVE",
    whatsappClicks: 9,
    views: 61,
  });

  const p8 = await mkProp({
    ownerId: owner2.id,
    title: "Spacious 3BHK — Halisahar (rented via iShim)",
    description:
      "Rented in January 2025 through iShim. Success fee paid by owner. Kept for records.",
    block: "Halisahar",
    houseType: "RCC",
    rent: 12000,
    deposit: 24000,
    bedrooms: 3,
    bathrooms: 2,
    amenities: JSON.stringify(["Water Supply", "Parking", "Boundary Wall", "Attached Bathroom"]),
    photos: JSON.stringify(["/images/prop-2.jpg"]),
    status: "RENTED",
    feePaid: true,
    feeAmount: 1000,
    rentedAt: new Date("2025-01-20"),
  });

  const p9 = await mkProp({
    ownerId: agent.id,
    title: "Corner RCC duplex — TNL Ward (listed by Marcus)",
    description:
      "Duplex with small front lawn, corner plot. Routed through agent Marcus. Serious families only.",
    block: "TNL Ward",
    houseType: "RCC",
    rent: 14000,
    deposit: 28000,
    bedrooms: 3,
    bathrooms: 3,
    amenities: JSON.stringify(["Water Supply", "Parking", "Garden", "Boundary Wall", "Internet Ready"]),
    photos: JSON.stringify(["/images/prop-2.jpg", "/images/prop-9.jpg"]),
    status: "ACTIVE",
    contactRoute: "AGENT",
    listedByAgentId: agent.id,
    featured: true,
    whatsappClicks: 15,
    views: 95,
  });

  const p10 = await mkProp({
    ownerId: owner1.id,
    title: "Phungyo 2BHK near SH-2 (rented)",
    description: "Rented out in November. Kept as history — fee paid.",
    block: "Phungyo",
    houseType: "RCC",
    rent: 7500,
    deposit: 15000,
    bedrooms: 2,
    bathrooms: 1,
    amenities: JSON.stringify(["Water Supply", "Parking"]),
    photos: JSON.stringify(["/images/prop-9.jpg"]),
    status: "RENTED",
    feePaid: true,
    feeAmount: 1000,
    rentedAt: new Date("2024-11-05"),
  });

  // ─── Payment records ───────────────────────────────────────
  for (const prop of [p8, p10]) {
    const exists = await db.payment.findFirst({ where: { propertyId: prop.id } });
    if (!exists) {
      await db.payment.create({
        data: {
          propertyId: prop.id,
          payerId: prop.ownerId,
          amount: 1000,
          kind: "SUCCESS_FEE",
          method: "UPI",
        },
      });
    }
  }

  // ─── Saved homes (client1) ─────────────────────────────────
  for (const prop of [p1, p3]) {
    await db.savedHome.upsert({
      where: { userId_propertyId: { userId: client1.id, propertyId: prop.id } },
      update: {},
      create: { userId: client1.id, propertyId: prop.id },
    });
  }

  // ─── Contact history ───────────────────────────────────────
  if ((await db.contactLog.count()) === 0) {
    await db.contactLog.create({
      data: {
        userId: client1.id,
        propertyId: p3.id,
        message: "Hi, I saw your house listing in Dungrei on iShim. Is it still available?",
      },
    });
    await db.contactLog.create({
      data: {
        userId: client2.id,
        propertyId: p1.id,
        message: "Hi, I saw your house listing in Hungpung on iShim. Is it still available?",
      },
    });
  }

  // ─── Agent CRM ─────────────────────────────────────────────
  const link = await db.agentOwner.findFirst({
    where: { agentId: agent.id, ownerId: owner2.id },
  });
  if (!link) {
    const newLink = await db.agentOwner.create({
      data: { agentId: agent.id, ownerId: owner2.id, status: "ACTIVE" },
    });
    await db.ownerNote.create({
      data: {
        agentOwnerId: newLink.id,
        text: "Ringkahao prefers evening calls. Has 3 more plots coming up near Dungrei after harvest season.",
      },
    });
  }

  if ((await db.agentClient.count()) === 0) {
    await db.agentClient.createMany({
      data: [
        {
          agentId: agent.id,
          name: "Grace Awungshi",
          phone: "9856001104",
          budgetMin: 5000,
          budgetMax: 9000,
          preferredBlock: "Hungpung",
          preferredType: "ASSAM_TYPE",
          stage: "SITE_VISIT",
          notes: "Teacher at SKV. Needs before June session. Prefers ground floor.",
        },
        {
          agentId: agent.id,
          name: "Danny Shatsang",
          phone: "9856011220",
          budgetMin: 8000,
          budgetMax: 15000,
          preferredBlock: "Viewland",
          preferredType: "RCC",
          stage: "NEGOTIATING",
          notes: "Bargains hard. Offer P2 at 10.5k if he signs 11-month agreement.",
        },
        {
          agentId: agent.id,
          name: "Reina Luithui",
          phone: "9856033441",
          budgetMin: 3000,
          budgetMax: 5000,
          preferredBlock: "Old Bazaar",
          preferredType: "APARTMENT",
          stage: "NEW_LEAD",
          notes: "Newly posted nurse at DHS. Wants move-in this month.",
        },
        {
          agentId: agent.id,
          name: "Victor Worshang",
          phone: "9856055662",
          budgetMin: 10000,
          budgetMax: 18000,
          preferredBlock: "TNL Ward",
          preferredType: "RCC",
          stage: "CLOSED",
          notes: "Closed P9. Collected ₹2,000 commission. Refer 2 friends.",
        },
        {
          agentId: agent.id,
          name: "Precila Kayina",
          phone: "9856077883",
          budgetMin: 4000,
          budgetMax: 6000,
          preferredBlock: "Mini Veng",
          preferredType: "ANY",
          stage: "LOST",
          notes: "Moved to Imphal for work.",
        },
      ],
    });
  }

  // ─── Ads (home carousel banners) ───────────────────────────
  // Fixed ids keep re-seeds idempotent; admins can edit/add via God Mode.
  const ADS = [
    {
      id: "ad-own",
      kicker: "For homeowners",
      title: "Own a home in Ukhrul?",
      body: "List it free on iShim. Pay ₹1,000 only when it's rented — no brokerage, ever.",
      ctaLabel: "List your property",
      action: "LIST",
      actionUrl: "",
      image: "/images/banner-own.jpg",
      active: true,
      sortOrder: 0,
    },
    {
      id: "ad-fresh",
      kicker: "Just listed",
      title: "Fresh homes every week",
      body: "New verified listings across Hungpung, Viewland, TNL Ward and more.",
      ctaLabel: "Browse new homes",
      action: "SEARCH",
      actionUrl: "",
      image: "/images/banner-new.jpg",
      active: true,
      sortOrder: 1,
    },
    {
      id: "ad-direct",
      kicker: "Why iShim",
      title: "Zero brokerage. Ever.",
      body: "Chat directly with owners on WhatsApp and deal directly — no middlemen taking a cut.",
      ctaLabel: "Find your home",
      action: "SEARCH",
      actionUrl: "",
      image: "/images/banner-direct.jpg",
      active: true,
      sortOrder: 2,
    },
  ];
  for (const ad of ADS) {
    await db.adBanner.upsert({
      where: { id: ad.id },
      update: {},
      create: ad,
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Admin:  9000000001");
  console.log("   Owner:  9856001101 (verified) / 9856001102 (unverified)");
  console.log("   Agent:  9856001103");
  console.log("   Client: 9856001104 / 9856001105");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
