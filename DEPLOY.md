# iShim — Deploy Runbook

Everything needed to take iShim from this repo to a live server.

**Current stack**: Next.js 16 (App Router, standalone output) + Prisma over
Supabase Postgres (cloud) + Supabase Storage for image uploads. The database
and all listing photos live in Supabase cloud — the server itself is
stateless beyond in-memory rate-limiting and caches.

---

## 1. What ships

- **Single Next.js 16 app** (App Router). The user-visible site is exactly one
  route (`/`) — all views are client-side state. API lives under `/api/**`.
- **Deep links**: `/p/[id]` serves any listing with per-property Open Graph /
  Twitter meta tags (title, ₹price + description, first photo) so shared links
  render a WhatsApp-style preview card. Opening one auto-opens that house's
  detail view.
- **Standalone output**: `next build` produces `.next/standalone/server.js`
  (a self-contained Node server with its own node_modules).
- **Staff sign-in is Google-only** (agents & admin). There is no phone login.
- **Graceful integrations**: with no Cashfree env vars the site still runs —
  payments show "coming soon". With no Google env vars the sign-in hides.

## 2. Requirements on the server

- Linux box (2 GB RAM is plenty), Node.js ≥ 20 **or** Bun ≥ 1.1
- A domain with DNS pointed at the server (e.g. `ishim.discoverukhrul.site`)
- TLS in front — the runbook uses Caddy (automatic Let's Encrypt)

## 3. One-time setup

```bash
# 1. Get the code
git clone <your-repo-url> /srv/ishim && cd /srv/ishim

# 2. Install dependencies
bun install        # or: npm install

# 3. Configure environment
nano .env          # fill in every value — see the table below (not in git)

# 4. Generate the Prisma client
bun run db:generate
# NOTE: do NOT run `db:push` against production — the Supabase schema is
# already applied. `db:push` uses --accept-data-loss.

# 5. Production build (also copies static/ + public/ into the bundle)
bun run build

# 6. Boot (this is what the systemd unit runs)
bun run start      # = NODE_ENV=production bun .next/standalone/server.js
```

Verify locally on the box before exposing it:

```bash
curl -s http://127.0.0.1:3000/api/properties?limit=1   # {"items":[…
curl -s http://127.0.0.1:3000/api/settings             # pricing JSON
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # 200
```

## 4. Environment variables

`.env` is git-ignored — recreate it on the server (never commit it):

| Variable | Effect when missing | Get it from |
|---|---|---|
| `DATABASE_URL` | app cannot start | Supabase → Project Settings → Database → Session pooler URI (`...pooler.supabase.com:5432/postgres?sslmode=require`) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | image uploads fall back to local disk | Supabase → Project Settings → API (service_role) |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | storage fallback | Supabase → Project Settings → API (anon) |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google sign-in button hidden | Google Cloud Console → Credentials → OAuth client (Web) |
| `CASHFREE_APP_ID` + `CASHFREE_SECRET_KEY` | pay dialog shows "online payments coming soon", order API returns 501 | Cashfree Merchant Dashboard → Payment Gateway → API Keys |
| `CASHFREE_MODE` | defaults to `sandbox` checkout | set `production` when going live |
| `CASHFREE_WEBHOOK_SECRET` | webhook rejects unsigned events (checkout polling + return-URL still fulfil payments) | any long random string — same value in Cashfree dashboard |

## 5. Cashfree webhook (do this once in the dashboard)

1. Cashfree Merchant Dashboard → **Payment Gateway → Webhooks** → Add.
2. URL: `https://ishim.discoverukhrul.site/api/payments/cashfree/webhook`
3. Events: **Payment events** (payment success / failed is enough).
4. Secret: paste the same `CASHFREE_WEBHOOK_SECRET` value from the server env.
5. The endpoint verifies the HMAC signature, then **re-verifies the order
   against the gateway API before fulfilling** — it never trusts the payload.
   Fulfillment is idempotent (atomic claim), so webhook + checkout polling +
   return-URL can all fire without double side effects.

## 6. Google OAuth (do this once in the console)

1. Google Cloud Console → APIs & Services → Credentials → the OAuth client.
2. Authorised JavaScript origin: `https://ishim.discoverukhrul.site`
3. Authorised redirect URI: `https://ishim.discoverukhrul.site/api/auth/google/callback`
4. Put the client ID/secret into `.env`, restart the server.
   (If a proxy mangles hosts, pin `GOOGLE_REDIRECT_URI` too.)

## 7. Go-live data checklist (before real users)

- [x] Demo/seed staff accounts removed (the seed `prisma/seed.ts` still
      contains them — never run the seed against production).
- [ ] Real staff sign in with Google; the admin account must carry the
      staff member's real Google email (added via the admin panel).
- [ ] Review pricing in Admin → Settings (success fee, standard client fee,
      move-in fee, business fees, free-period dates).
- [ ] Listing photos should be owner-supplied uploads (Supabase Storage
      public URLs); `/images/prop-*.jpg` are generated placeholders.
- [ ] Test the WhatsApp share preview: open a listing, tap Share, send the
      `https://ishim.discoverukhrul.site/p/<id>` link to yourself — the chat
      should show a card with photo, title and ₹price.

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
ishim.discoverukhrul.site {
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
bun run db:generate    # only when schema changed — never db:push on prod
bun run build
sudo systemctl restart ishim
```

## 10. Health & rollback

- **Health**: `GET /api/settings` (200 + pricing JSON) and
  `GET /api/properties?limit=1` (200 + envelope) are cheap liveness probes.
- **Logs**: `journalctl -u ishim -f`
- **DB backup**: Supabase → Database → Backups (cloud-managed).
- **Rollback**: keep the previous `.next/` build
  (`mv .next .next-$(date +%s)` before rebuilding); `systemctl restart` brings
  the old bundle back.

## 11. Known limitations at launch (accepted for v1)

- Staff sign-in is Google-only; there is no admin-forced logout-all yet.
- Rate limiting is in-memory (per process) — fine for a single-box deploy;
  on multi-instance/serverless platforms it is weaker by design.
- The AI assistant route uses the container-only `z-ai-web-dev-sdk`; outside
  that environment it fails gracefully with a friendly fallback message.
  Swap in a real LLM provider to enable the assistant in production.
- Listing photos are external URLs (Supabase CDN); the server does not
  validate that they load.
