# iShim — Deploy Runbook (Day 3)

Everything needed to take iShim from this repo to a live server.
The production build was verified on Day 3: `next build` compiles clean
(standalone output) and the standalone `server.js` was smoke-tested against a
copy of the real database (home 200, `/api/properties` real data,
`/api/settings` pricing, login, payments 501-unconfigured path, `Secure` cookie
flag present).

---

## 1. What ships

- **Single Next.js 16 app** (App Router). The user-visible site is exactly one
  route (`/`) — all views are client-side state. API lives under `/api/**`.
- **SQLite database** via Prisma at `db/custom.db` (file DB — zero external DB
  to run; back it up by copying the file).
- **Standalone output**: `next build` produces `.next/standalone/server.js`
  (a self-contained Node server with its own node_modules).
- **Graceful integrations**: with no Cashfree or Google env vars set the site
  still runs — payments show "coming soon", Google sign-in hides, phone login
  keeps working.

## 2. Requirements on the server

- Linux box (2 GB RAM is plenty), Node.js ≥ 20 **or** Bun ≥ 1.1
- A domain with DNS pointed at the server (e.g. `ishim.in`)
- TLS in front — the runbook uses Caddy (automatic Let's Encrypt)

## 3. One-time setup

```bash
# 1. Get the code
git clone <your-repo-url> /srv/ishim && cd /srv/ishim

# 2. Install dependencies
bun install        # or: npm ci

# 3. Configure environment
cp .env.example .env
nano .env          # fill in every value — see the sections below

# 4. Create the database schema (idempotent)
bun run db:generate
bun run db:push

# 5. Optional — seed settings + demo listings (see §7 first!)
bun run prisma/seed.ts

# 6. Production build (also copies static/ + public/ into the bundle)
bun run build

# 7. Boot (this is what the systemd unit runs)
bun run start      # = NODE_ENV=production bun .next/standalone/server.js
```

Verify locally on the box before exposing it:

```bash
curl -s http://127.0.0.1:3000/api/properties?limit=1   # {"items":[…
curl -s http://127.0.0.1:3000/api/settings             # pricing JSON
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # 200
```

## 4. Environment variables

Full annotated list lives in **`.env.example`**. The pairs and their effects:

| Variable | Effect when missing | Get it from |
|---|---|---|
| `DATABASE_URL` | app cannot start | set to `file:/srv/ishim/db/custom.db` |
| `CASHFREE_APP_ID` + `CASHFREE_SECRET_KEY` | pay dialog shows "online payments coming soon", order API returns 501 | Cashfree Merchant Dashboard → Payment Gateway → API Keys |
| `CASHFREE_MODE` | defaults to `sandbox` checkout | set `production` when going live |
| `CASHFREE_WEBHOOK_SECRET` | webhook rejects unsigned events (checkout polling + return-URL still fulfill payments) | any long random string — same value in Cashfree dashboard |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google sign-in button hidden; phone login unaffected | Google Cloud Console → Credentials → OAuth client (Web) |

## 5. Cashfree webhook (do this once in the dashboard)

1. Cashfree Merchant Dashboard → **Payment Gateway → Webhooks** → Add.
2. URL: `https://ishim.in/api/payments/cashfree/webhook`
3. Events: **Payment events** (payment success / failed is enough).
4. Secret: paste the same `CASHFREE_WEBHOOK_SECRET` value from the server env.
5. The endpoint verifies the HMAC signature, then **re-verifies the order
   against the gateway API before fulfilling** — it never trusts the payload.
   Fulfillment is idempotent (atomic claim), so webhook + checkout polling +
   return-URL can all fire without double side effects.

Test after go-live: pay a real ₹1 sandbox order (or flip a sandbox order to
paid) and confirm the listing flips to Rented and one Payment row appears.

## 6. Google OAuth (do this once in the console)

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth
   client ID → Web application**.
2. Authorised redirect URI: `https://ishim.in/api/auth/google/callback`
3. Put the client ID/secret into `.env`, restart the server.
   (If a proxy mangles hosts, pin `GOOGLE_REDIRECT_URI` too.)

## 7. Go-live data checklist (before real users)

The seeded database is fine for a soft launch, but before *real* traffic:

- [ ] Remove test residue users (e.g. the `Dev Program` phone-login user and
      any e2e pending-Google rows from `scripts/seed-pending.ts` — that script
      is a dev/e2e helper, never run it in production).
- [ ] Decide: keep demo listings for the soft launch or wipe them
      (`bun run db:reset` then re-seed with real listings only).
- [ ] Set the real admin phone number (seed uses `9000000001`) — that account
      can approve listings, see all contact details and impersonate users.
- [ ] Review pricing in Admin → Settings (success fee, standard client fee,
      move-in fee, business fees, free-period dates).
- [ ] Replace any listing photos you don't own (`/images/prop-*.jpg` are
      generated placeholders).

## 8. systemd + Caddy (copy-paste)

**`/etc/systemd/system/ishim.service`**

```ini
[Unit]
Description=iShim (Next.js standalone)
After=network.target

[Service]
WorkingDirectory=/srv/ishim
EnvironmentFile=/srv/ishim/.env
ExecStart=/usr/local/bin/bun .next/standalone/server.js
Restart=always
RestartSec=3
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now ishim
```

**`/etc/caddy/Caddyfile`**

```caddy
ishim.in {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Caddy terminates TLS automatically. The app reads `x-forwarded-host` /
`x-forwarded-proto`, so OAuth redirects and absolute URLs resolve to the
public domain without extra config.

## 9. Updates (new deploy)

```bash
cd /srv/ishim
git pull
bun install
bun run db:generate && bun run db:push   # only when schema changed
bun run build
sudo systemctl restart ishim
```

`db:push` is additive for new columns/tables; review `prisma/schema.prisma`
changes before running it on production data.

## 10. Health & rollback

- **Health**: `GET /api/settings` (200 + pricing JSON) and
  `GET /api/properties?limit=1` (200 + envelope) are cheap liveness probes.
- **Logs**: `journalctl -u ishim -f`
- **DB backup**: `cp db/custom.db db/backups/custom-$(date +%F).db` (stop the
  service or use sqlite's `.backup` for a consistent copy).
- **Rollback**: keep the previous `.next/` build
  (`mv .next .next-$(date +%s)` before rebuilding); `systemctl restart` brings
  the old bundle back.

## 11. Known limitations at launch (accepted for v1)

- Phone-number login is passwordless OTP-free by design (hyper-local trust
  model) — consider rate-limit tightening if abuse appears.
- Sessions last 30 days; there is no admin-forced logout--all yet.
- Listing photos submitted by owners are external URLs; the server does not
  validate that they load. A future `next/image` proxy pass would harden this.
