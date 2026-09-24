/**
 * iShim — pre-launch check
 * Run: bunx tsx scripts/prelaunch.ts
 *
 * Prints a go-live report: env presence (never secret values), database
 * contents (users / listings / payments / pending payment intents), demo
 * residue that should be cleaned before real users arrive, and settings
 * sanity. Every line ends in PASS / WARN / FAIL so the report can be skimmed.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let fails = 0;
let warns = 0;

function line(status: "PASS" | "WARN" | "FAIL", msg: string) {
  if (status === "FAIL") fails += 1;
  if (status === "WARN") warns += 1;
  console.log(`${status}  ${msg}`);
}

function env(name: string): boolean {
  return Boolean(process.env[name]);
}

async function main() {
  console.log("\n──────── iShim pre-launch check ────────\n");

  // ── Environment ─────────────────────────────────────────────
  console.log("── Environment ──");
  if (env("DATABASE_URL")) line("PASS", "DATABASE_URL is set");
  else line("FAIL", "DATABASE_URL missing — the app cannot start");

  const cfPair = env("CASHFREE_APP_ID") && env("CASHFREE_SECRET_KEY");
  if (cfPair) {
    const mode = process.env.CASHFREE_MODE === "production" ? "production" : "sandbox";
    if (mode === "production") line("PASS", "Cashfree configured, mode=production");
    else line("WARN", "Cashfree configured but mode=sandbox — set CASHFREE_MODE=production for go-live");
    if (env("CASHFREE_WEBHOOK_SECRET")) line("PASS", "CASHFREE_WEBHOOK_SECRET set");
    else line("WARN", "CASHFREE_WEBHOOK_SECRET missing — webhook will reject unsigned events; set it in the Cashfree dashboard too");
  } else {
    line("WARN", "Cashfree not configured — payments show 'coming soon' (order API 501). OK for soft launch only.");
  }

  if (env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")) line("PASS", "Google OAuth configured");
  else line("WARN", "Google OAuth not configured — Google sign-in hidden (phone login still works)");

  console.log("");

  // ── Database ────────────────────────────────────────────────
  console.log("── Database ──");
  const [users, props, payments, intents] = await Promise.all([
    db.user.findMany({ select: { role: true, name: true, phone: true } }),
    db.property.findMany({ select: { status: true, feePaid: true } }),
    db.payment.count(),
    db.paymentIntent.findMany({ where: { status: "PENDING" }, select: { id: true } }),
  ]);

  const admins = users.filter((u) => u.role === "ADMIN");
  if (admins.length > 0) {
    line("PASS", `ADMIN present (${admins.length}) — phone(s): ${admins.map((a) => a.phone).join(", ")}`);
  } else {
    line("FAIL", "No ADMIN user — nobody can approve listings or manage the platform");
  }

  const active = props.filter((p) => p.status === "ACTIVE").length;
  const pendingProps = props.filter((p) => p.status === "PENDING").length;
  console.log(`    listings: ${props.length} total · ${active} active · ${pendingProps} pending approval`);
  if (active > 0) {
    line("PASS", `${active} active listing(s) will be visible on launch`);
  } else {
    line("WARN", "No active listings — the home page will look empty");
  }

  if (pendingProps > 0) line("WARN", `${pendingProps} listing(s) still PENDING — approve or reject them before launch`);
  if (intents.length > 0) line("WARN", `${intents.length} PENDING payment intent(s) — stale orders; safe to expire them in Admin → Payments`);
  console.log(`    payments recorded: ${payments}`);

  // ── Demo residue ────────────────────────────────────────────
  console.log("\n── Demo residue ──");
  const seedAdmin = users.find((u) => /^9000000001$/.test(u.phone));
  if (seedAdmin) line("WARN", `Admin account still uses the seed phone 9000000001 — set the real admin phone before launch`);
  const residue = users.filter((u) => /dev program/i.test(u.name));
  for (const u of residue) {
    line("WARN", `User '${u.name}' (${u.phone}) looks like test data — remove before real users sign up`);
  }

  // ── Settings ────────────────────────────────────────────────
  console.log("\n── Settings ──");
  const settings = await db.setting.findMany();
  const keys = new Set(settings.map((s) => s.key));
  for (const k of ["successFee", "blocks", "amenities", "houseTypes"]) {
    if (keys.has(k)) line("PASS", `setting '${k}' present`);
    else line("FAIL", `setting '${k}' missing — run prisma/seed.ts`);
  }

  console.log(`\n──────── ${fails === 0 && warns === 0 ? "ALL CLEAR" : `${fails} fail · ${warns} warn`} — fix FAILs before launch ────────\n`);
  process.exitCode = fails > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error("prelaunch check crashed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
