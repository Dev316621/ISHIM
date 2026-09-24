import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({ select: { role: true, name: true, phone: true }, where: { banned: false } });
  const props = await db.property.findMany({ select: { title: true, status: true, mode: true, feePaid: true } });
  const payments = await db.payment.findMany({ select: { id: true, amount: true, method: true, createdAt: true } });
  const intents = await db.paymentIntent.findMany({ select: { id: true, status: true } });
  console.log("USERS:", users.length);
  for (const u of users.slice(0, 30)) console.log(" -", u.role, "|", u.name, "|", u.phone);
  console.log("PROPERTIES:", props.length, "| ACTIVE:", props.filter(p=>p.status==="ACTIVE").length, "| RENTED:", props.filter(p=>p.status==="RENTED").length, "| PENDING:", props.filter(p=>p.status==="PENDING").length);
  console.log("PAYMENTS:", payments.length, JSON.stringify(payments));
  console.log("INTENTS:", intents.length, JSON.stringify(intents.map(i=>i.status)));
}
main().finally(()=>db.$disconnect());
