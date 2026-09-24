# iShim — Project Worklog

**Project**: iShim — hyper-local rental platform for Ukhrul, Manipur (Tenants / Owners / Agents / Admin)
**Tagline**: "Find your home in Ukhrul."
**Stack**: Next.js 16 App Router (single visible route `/`), TypeScript, Tailwind CSS 4, shadcn/ui (New York), Prisma + SQLite (`db/custom.db`), Zustand, Lucide icons.

## CRITICAL ARCHITECTURE RULES

- The user can ONLY see the `/` route. ALL UI views are client-side state-driven inside `src/app/page.tsx` (+ components imported by it). NO other page routes.
- All backend logic lives in Route Handlers under `src/app/api/**` (NOT server actions).
- Prisma client: `import { db } from "@/lib/db"`. Schema at `prisma/schema.prisma`, already pushed + seeded.
- Auth = custom session cookie. No NextAuth. See contract below.
- Photos/amenities are stored as JSON **strings** in DB; APIs MUST return them **parsed as arrays**.

## Brand / Design System (FRONTEND + BACKEND MUST MATCH)

- Colors (defined in `globals.css`):
  - `--primary`: Deep Forest Green `oklch(0.38 0.07 155)` → all primary buttons, active states, branding
  - `--secondary` / sage surfaces: `oklch(0.93 0.035 145)`, mint accent `oklch(0.90 0.06 150)`
  - Background crisp white; foreground dark gray `oklch(0.22 0.01 150)`
  - NO blue/indigo anywhere.
- Apple-premium: generous whitespace, rounded-2xl/3xl cards, subtle shadows, glass-morphism hero search (`bg-white/70 backdrop-blur-xl`), hover zoom on listing photos.
- Footer: sticky bottom via `min-h-screen flex flex-col` root + `mt-auto` footer (must respect bottom safe area on mobile via `pb-[env(safe-area-inset-bottom)]`).
- Mobile: bottom tab bar with 3 icons (Home / Search / Profile) — Apple minimalist. Desktop: top nav (logo left; search icon, menu, green "List your Property" button right). Responsive mandatory.

## Assets (already in /public/images)

`hero.jpg` (wide hero), `prop-1.jpg`…`prop-9.jpg` (Assam-type, RCC ext, living room, cottage, kitchen, traditional house, apartment, bedroom, RCC single-storey). Missing images gracefully replaced by a sage placeholder div.

## DEMO ACCOUNTS (seeded)

- Admin: `9000000001`
- Owner (verified): `9856001101` — Owner (unverified): `9856001102`
- Agent: `9856001103`
- Clients: `9856001104`, `9856001105`
- Login = phone only. If phone unknown → register with name + role. No passwords.

## API CONTRACT (v1 — binding for all agents)

### Auth (cookie `ishim_session`, httpOnly)
- `POST /api/auth/login` `{phone, name?, role?}` → existing user: create Session; new user: require name+role (CLIENT default), create user+session. Banned user → 403 `{error:"Your account has been suspended. Contact support."}`. Returns `{user}`.
- `POST /api/auth/logout` → clears session.
- `GET /api/auth/me` → `{user}` or `{user:null}`. User shape: `{id, phone, name, role, verified, banned, whatsappNumber, idDoc}`.
- `POST /api/auth/impersonate` **admin-only** `{userId}` → sets cookie to target session, returns `{token}` (the target's session token).
- `POST /api/auth/restore` `{token}` → verify token belongs to an ADMIN user, set cookie to it, return `{user}`.

### Public
- `GET /api/settings` → `{successFee:number, blocks:string[], amenities:string[], houseTypes:string[]}` (houseTypes: ASSAM_TYPE|RCC|KUTCHA|APARTMENT).
- `GET /api/properties?block=&houseType=&minRent=&maxRent=&bedrooms=&q=&featured=1` → only `status==="ACTIVE"`, newest first. Card shape: `{id, title, description, block, houseType, rent, deposit, bedrooms, bathrooms, amenities:string[], photos:string[], featured, whatsappClicks, views, contactRoute, createdAt, owner:{verified}}`.
- `GET /api/properties/[id]` → same shape + `owner:{verified}` only (privacy). Increments `views`.
- `POST /api/properties/[id]/contact` `{message?}` → increments `whatsappClicks`, logs ContactLog (userId if logged in), returns `{waLink}` where waLink = `https://wa.me/<number>?text=<urlencoded "Hi, I saw your house listing in <block> on iShim. Is it still available?">`. Number = owner.whatsappNumber if contactRoute==="OWNER" else listing agent's (listedByAgentId) whatsappNumber; fallback owner. 400 if no number.

### Client
- `GET /api/saved` (auth) → array of full property cards (ACTIVE + others user saved).
- `POST /api/saved` `{propertyId}` → toggle. Returns `{saved:boolean}`.

### Owner (auth, role OWNER or AGENT for own props)
- `GET /api/my/properties` → all own properties (any status) + parsed arrays.
- `POST /api/properties` `{title, description, block, houseType, rent, deposit, bedrooms, bathrooms, amenities:string[], photos:string[], ownerPhone?}` → property status `PENDING`. If role AGENT and ownerPhone provided: find/create OWNER by phone (name optional → "Owner "+phone), ensure AgentOwner link, set `listedByAgentId=agent.id`. If role AGENT without ownerPhone → owner = self. Response `{property}`.
- `PATCH /api/properties/[id]` → owner/agent-of-owner edits own listing (PENDING/ACTIVE/HIDDEN only; admin any).
- `POST /api/properties/[id]/mark-rented` → sets `rentedAt=now` but KEEPS status ACTIVE (fee enforcement model: listing stays live until fee paid). Returns `{fee, upiId:"ishim@upi", feePaid, feeWaived}`. fee = Settings.successFee.
- `POST /api/properties/[id]/pay-fee` → creates Payment{amount:fee}, sets `feePaid=true, status="RENTED"`. Returns `{property}`.
- `POST /api/properties/[id]/relist` → RENTED/ACTIVE back to PENDING, clears rentedAt/feePaid (re-list flow).

### Agent CRM (auth role AGENT; also admin can read)
- `GET /api/agent/clients` → my leads.
- `POST /api/agent/clients` `{name, phone, budgetMin?, budgetMax?, preferredBlock?, preferredType?, notes?}`.
- `PATCH /api/agent/clients/[id]` → any fields incl. `stage` (NEW_LEAD|SITE_VISIT|NEGOTIATING|CLOSED|LOST).
- `GET /api/agent/owners` → linked owners with their properties + notes (`{link:{id,status}, owner:{...}, properties:[...], notes:[{text,createdAt}]}`).
- `POST /api/agent/owners` `{phone}` → find user by phone (create OWNER if missing; name optional), create AgentOwner link, return link data.
- `POST /api/agent/owners/notes` `{agentOwnerId, text}` → agent-only, own links.
- `GET /api/agent/match?clientId=` → matchmaking: ACTIVE properties filtered by client budget range (rent within budgetMin..budgetMax, inclusive, 0 = open), preferredBlock (empty = any), preferredType ("ANY" or empty = any), sorted by score (budget closeness + block match). Returns `{client, matches:[propertyCard + {reason}]}`.

### Admin god-mode (auth role ADMIN)
- `GET /api/admin/stats` → `{users:{total, byRole:{CLIENT,OWNER,AGENT,ADMIN}}, properties:{total, byStatus:{PENDING,ACTIVE,RENTED,HIDDEN,REJECTED}}, revenueTotal, paymentsCount, whatsappClicks, feeDueCount}` where feeDue = rentedAt set && !feePaid && !feeWaived.
- `GET /api/admin/users?q=` → all users + `{propertiesCount, contactsCount}`.
- `PATCH /api/admin/users/[id]` `{role?, verified?, banned?, name?}`.
- `GET /api/admin/properties?status=` → ALL properties any status with owner `{id,name,phone,verified}` + parsed arrays.
- `PATCH /api/admin/properties/[id]` → `{status?, featured?, feeWaived?, rejectionReason?, rent?, block?, title?}` — approve = PENDING→ACTIVE; reject = status REJECTED + reason; force RENTED; HIDDEN. If feeWaived set true while status RENTED/ACTIVE, mark feeWaived (no payment needed).
- `GET /api/admin/payments` → payments + property title + payer.
- `PATCH /api/admin/settings` `{successFee?, blocks?, amenities?, houseTypes?}` → upserts.

### Error shape
All errors: `{error: string}` with proper status (400/401/403/404). 401 when not logged in; 403 when role forbids/banned.

### Next.js 16 gotchas (MANDATORY for backend agent)
- Route handler dynamic params: `export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; }`
- `cookies()` from `next/headers` is async: `const store = await cookies()`.
- Use `NextRequest`/`NextResponse` from `next/server`. Export handlers as named functions (GET/POST/PATCH/DELETE).
- JSON body via `await req.json()` inside try/catch.

## Seed data snapshot (for frontend demo states)
- 7 ACTIVE properties (3 featured), 1 PENDING (admin queue), 2 RENTED w/ payments (₹2,000 revenue), agent with 5 CRM leads across all pipeline stages, 1 agent-owner link w/ private note.
- Blocks: Hungpung, Viewland, Phungyo, Phungwamee, Mini Veng, Halisahar, Dungrei, Old Bazaar, TNL Ward, Nungshang.
- Amenities: Water Supply, Parking, Solar Heating, Internet Ready, Fully Furnished, Semi Furnished, Boundary Wall, Garden, Attached Bathroom, Borewell.

---

---
Task ID: 4-a
Agent: full-stack-developer (backend)
Task: Build all iShim API routes per contract

Work Log:
- Read worklog.md contract + prisma/schema.prisma + prisma/seed.ts (Setting rows are keyed `successFee` [plain string], `blocks`, `amenities`, `houseTypes` [JSON string arrays]).
- Built `src/lib/auth.ts`: getSessionUser (async cookies(), token lookup incl. user; banned users still returned), createSession (randomUUID+randomBytes token), withSession (httpOnly cookie `ishim_session`, path "/", sameSite lax, maxAge 30d), clearSession (deletes row + clears cookie), sanitizeUser ({id,phone,name,role,verified,banned,whatsappNumber,idDoc}), requireAuth (401/403-banned), requireRole.
- Built shared helpers at `src/app/api/_lib/helpers.ts` (underscore folder = not routed): parseJsonArray (safe JSON → string[]), getJsonBody, cleanStr/optionalInt/toBool coercion, settings read/upsert, three serializers (publicPropertyCard = exact contract card shape with owner:{verified}; fullProperty = all fields + parsed arrays for owner/agent views; adminPropertyCard = full + owner{id,name,phone,verified}), canManageProperty (admin | owner | listedByAgent | AgentOwner link).
- Implemented every contract endpoint (26 route files, listed below). All handlers: try/catch → `{error}` with 400/401/403/404, 500 "Something went wrong" fallback; Next 16 patterns (await params, await cookies(), named exports).
- Smoke-tested with curl against the running dev server: public list/filters/q/featured, settings, login (existing/new/banned→403), me, saved toggle+list, contact (exact wa.me template verified, anon + logged-in), full property lifecycle (agent create-for-owner → admin approve → mark-rented {fee:1000, upiId:"ishim@upi"} → pay-fee (RENTED, feePaid) → relist (PENDING)), agent CRM (clients/owners/notes-link reads, match scoring), admin (stats numbers match seed: 6 users/10 props/₹2000 revenue, users q-filter, properties status filter, payments with payer resolved manually since Payment.payerId has no Prisma relation, self-ban/self-demote → 400, impersonate → restore round-trip verified).
- Type-check `bunx tsc --noEmit`: zero errors in src/app/api/** and src/lib/**. ESLint on backend files: clean. dev.log: no runtime errors.
- Cleaned up all smoke-test data afterwards; DB verified back at exact seed snapshot (6 users, 10 properties, 2 payments, 2 contact logs, 1 agent-owner link, 4 settings).

Endpoints created (files under src/app/api/):
- auth/login (POST), auth/logout (POST), auth/me (GET), auth/impersonate (POST), auth/restore (POST)
- settings (GET public, PATCH admin) + admin/settings (re-exports same GET/PATCH — both contract paths work)
- properties (GET list + POST create), properties/[id] (GET detail + PATCH), properties/[id]/contact, properties/[id]/mark-rented, properties/[id]/pay-fee, properties/[id]/relist (all POST)
- saved (GET + POST toggle), my/properties (GET)
- agent/clients (GET/POST), agent/clients/[id] (PATCH), agent/owners (GET/POST), agent/owners/notes (POST), agent/match (GET ?clientId=)
- admin/stats (GET), admin/users (GET ?q=), admin/users/[id] (PATCH), admin/properties (GET ?status=), admin/properties/[id] (PATCH), admin/payments (GET)

Stage Summary:
- LIST ENDPOINTS RETURN BARE JSON ARRAYS (frontend: `const list = await res.json()` directly): GET /api/properties, /api/saved, /api/my/properties, /api/agent/clients, /api/agent/owners, /api/admin/users, /api/admin/properties, /api/admin/payments. Single-object endpoints use wrappers ({user}, {property}, {client}, {note}, {saved}, {waLink}, settings/stats flat).
- Impersonate returns `{token, restoreToken, user}` — `token` is the TARGET's session token per contract; `restoreToken` (additive) is the ADMIN's own current token, needed because the cookie is httpOnly; pass it to POST /api/auth/restore {token: restoreToken} to get back.
- Public property card = exact contract shape (owner:{verified} only). GET detail increments views and is NOT status-restricted (contract doesn't require ACTIVE-only for detail; list is ACTIVE-only, newest first, featured=1 supported). Saved cards additionally carry `status` (additive, lets client badge rented/hidden saved homes).
- POST /api/properties requires role OWNER/AGENT; agent + ownerPhone → finds/creates OWNER ("Owner <phone>" default name, whatsappNumber=phone), ensures AgentOwner link ACTIVE, sets listedByAgentId. If the phone belongs to an existing CLIENT user, that user is promoted to OWNER (deliberate, documented). Contact route validation: contactRoute ∈ OWNER|AGENT; AGENT routes to listedByAgent's whatsappNumber, falls back to owner; 400 if none.
- Owner/agent PATCH /api/properties/[id] edits only PENDING/ACTIVE/HIDDEN listings, does NOT accept `status` (400 — status changes flow through mark-rented/pay-fee/relist/admin). Admin edits anything. Empty title/block/houseType rejected with 400; all numeric fields coerced to ints and validated.
- pay-fee rejects double-payment (400 "already paid"), writes Payment (kind SUCCESS_FEE amount=successFee, or WAIVED amount=0 when feeWaived) and sets rentedAt if unset. relist only from RENTED/ACTIVE → PENDING, clears rentedAt/feePaid, leaves feeWaived/feeAmount (waiver persists by design).
- Agent CRM: GETs allow ADMIN (admin sees all rows, agents see own); mutations AGENT-only and ownership-checked. Match: ACTIVE + budget inclusive (0 = open) + block exact (empty = any) + type exact ("ANY"/empty = any); score = block match 100 + type 20 + budget closeness (50 − |rent−mid|/100) + 25 open-budget baseline; sorted desc; each match = public card + {score, reason}.
- Admin: stats groupBy with zero-filled byRole/byStatus; feeDue = rentedAt && !feePaid && !feeWaived; PATCH users blocks self-ban/self-demote (400); PATCH properties applies only provided fields, ACTIVE clears rejectionReason, REJECTED may carry it; settings PATCH partial upsert (houseTypes validated to ASSAM_TYPE|RCC|KUTCHA|APARTMENT).
- No deviations from the binding contract; additions are strictly additive fields (restoreToken, saved.status, match.score/reason, contact.message, fullProperty fields on {property} responses).

Task ID: 4-b (completion) + 5 (integration)
Agent: Z.ai Code (main orchestrator)
Task: Finish frontend after 4-b agent timeout — agent-dashboard, admin-dashboard, page.tsx composition; fix lint; images

Work Log:
- 4-b agent completed types.ts, api.ts, store.ts, feedback.ts + 17 components before timing out; profile-view referenced missing AgentDashboard/AdminDashboard and page.tsx was still the scaffold.
- Built src/components/ishim/agent-dashboard.tsx — Tabs Pipeline (5-stage kanban, stage dropdown moves, Add Lead dialog), Owners (link owner by phone, private notes), Listings (shared ListingsList), Matchmaking (client select → /api/agent/match with score badges + WhatsApp CTA + View).
- Built src/components/ishim/admin-dashboard.tsx ("God Mode") — Tabs Overview (stats tiles incl. fee-due amber), Approvals (photo previews, Approve / Reject dialog with polite preset reasons), Users (debounced search, verify/ban/role select/impersonate storing restoreToken in sessionStorage), Properties (status filter chips, status override, featured star, waive fee), Financials (payments + revenue), Settings (successFee input, blocks/amenities/houseTypes chip editors).
- Composed src/app/page.tsx — boot sequence (auth/me + settings parallel → hydrate saved ids), splash, AnimatePresence view switching (home/search/detail/profile), NavBar+MobileTopBar, Footer (mt-auto sticky), BottomNav, AuthSheet, ListingFormDialog, ImpersonationPill.
- Updated authApi.impersonate type to include restoreToken.
- Fixed 9 react-hooks lint errors (set-state-in-effect, refs-in-render) by restructuring loaders to setState only in promise callbacks; search-view now derives `loading` from a filterKey/loadedKey comparison; removed unused eslint-disable directives.
- Generated all 10 brand images via z-ai CLI (hero required 1440x768 — sizes must be multiples of 32; 1440x720 rejected by API).
- tsc --noEmit clean (only pre-existing examples/skills errors outside app), bun run lint clean.

Stage Summary:
- Full frontend complete: Home (hero + glass search + featured + block chips + how-it-works), Search (filters + results grid), Detail (gallery, WhatsApp CTA, save), Profile (role dashboards: Client/Owner/Agent/Admin), auth sheet with demo one-tap logins, impersonation pill, sticky footer, mobile bottom nav.
- App is served on port 3000 and GET / returns 200.

---
Task ID: 6 + 7 (integration & verification)
Agent: Z.ai Code (main orchestrator)
Task: Browser self-verification of all golden paths + fixes

Work Log:
- Verified in agent-browser (desktop 1440x900 + mobile 390x844):
  - Home: hero + glass search + featured grid + block chips + how-it-works + sticky footer — render OK, no console errors.
  - Detail: adaptive gallery (2-up for 2 photos), WhatsApp CTA as guest → auth sheet; logged-in contact opened REAL wa.me with exact blueprint message "Hi, I saw your house listing in Dungrei on iShim. Is it still available?" to +91 98560 01102; click counters increment.
  - Search: filters (block/type/rent/beds) live-filter (RCC → 3 results), mobile Filters sheet + "Show N homes" CTA.
  - Client: saved homes + contact history + housing status toggle.
  - Owner: stats (views/clicks/active), verified strip, created listing end-to-end (PENDING "Awaiting approval"), Mark as Rented → ₹1,000 success-fee dialog (QR + ishim@upi) → simulated payment → RENTED + Fee paid badges + Re-list.
  - Agent CRM: 5-stage kanban with live stage moves (Reina → Site Visit), Owners tab (link/notes), Listings tab, Matchmaking (client → scored match with reason + WhatsApp CTA).
  - Admin God Mode: Overview stats accurate (₹3,000 revenue, 71 clicks, fee-due 0), Approvals (approved Tangkhul house → live, queue clear), Users (search/verify/ban/role), Impersonation round-trip (pill + sessionStorage restoreToken + restore), Properties (status override/feature/waive), Financials (payments + revenue), Settings (success fee, added block "Chalong" persisted, then removed).
- Bugs found & FIXED during verification:
  1. Auth sheet cleared pendingAuth before consuming it → post-login WhatsApp action never fired (reordered finish()).
  2. Matchmaking crashed: API returns flat property cards + score/reason; frontend expected {property, reason} (fixed MatchResult type + component).
  3. Desktop NavBar visible on mobile (duplicate header) — hidden md:block.
  4. Desktop gallery left sage pads for 2/3-photo listings — adaptive layouts now.
- Fixed 9 react-hooks lint errors (set-state-in-effect / refs-in-render) by restructuring loaders; search-view derives loading from filterKey/loadedKey.
- Generated all 10 AI images (hero needed 1440x768 — API requires multiples of 32).
- Cleaned all test artifacts (DB back to seed state: 6 users, 10 properties, 2 payments, 10 blocks); verified banned login → 403 "Your account has been suspended."

Stage Summary:
- iShim is LIVE on port 3000, lint-clean, type-clean, browser-verified across all 4 roles on desktop + mobile. Demo logins: Admin 9000000001, Owner 9856001101/9856001102, Agent 9856001103, Clients 9856001104/9856001105.

---
Task ID: 8 (final re-verification & handover)
Agent: Z.ai Code (main orchestrator)
Task: Full golden-path re-verification after continuation + DB restore to seed snapshot

Work Log:
- Confirmed dev server healthy (GET / → 200), `bun run lint` clean, `bunx tsc --noEmit` clean for app code.
- Browser re-verification (desktop 1440x900 + mobile 390x844), all golden paths PASS with zero console errors:
  - Guest: home render (hero glass search, featured grid, block chips, how-it-works, sticky footer) → detail → WhatsApp CTA as guest → auth sheet appeared.
  - Auth→action continuity: one-tap Client login from auth sheet auto-completed the pending WhatsApp action → real wa.me URL with exact blueprint message ("Hi, I saw your house listing in TNL Ward on iShim. Is it still available?").
  - Search: filters live (RCC → 3 results), count updates.
  - Client: saved homes + contact history + Looking/Found status toggle all render.
  - Owner: "List your Property" as guest → auth → listing form auto-opened → filled (Hungpung / Assam-type / ₹7,200) → submitted → toast "Listing submitted … as soon as the iShim team approves it" (PENDING). Mark as Rented → ₹1,000 success-fee dialog (QR + ishim@upi + "No brokerage, ever") → Simulate payment → RENTED + Fee paid badges + Re-list.
  - Agent: 5-stage kanban (New Lead/Site Visit/Negotiating/Closed/Lost), moved Reina → Site Visit live; Matchmaking for Grace → match score 165 with reason box + WhatsApp CTA.
  - Admin: Overview stats exact vs DB (₹3,000 revenue, 72 clicks, 3 payments, 11 properties); Users search → Impersonate Ngathan → owner dashboard + pill → Exit impersonation → God Mode restored. Created PENDING listing via API (agent for owner 9856001102) → Approvals queue showed it with photo/owner/unverified info → Reject dialog with 3 polite preset reasons → rejected → queue "Queue is clear" state.
  - Mobile: 3-icon bottom nav, stacked glass search hero, detail with swipe gallery + dots, sticky bottom WhatsApp CTA bar, footer correct.
- Restored DB to exact seed snapshot via one-off Prisma script (deleted 2 test properties + ₹1,000 test payment + duplicate/extra contact logs incl. one leftover from prior session, reset Reina stage → NEW_LEAD, reset all view/click counters to seed values, cleared 6 verification sessions). Temp script removed after run.
- Final snapshot: users=6 properties=10 payments=2 contactLogs=2 agentOwnerLinks=1 agentLeads=5 settings=4 ✅

Stage Summary:
- iShim remains LIVE on port 3000, lint/type clean, all four role journeys browser-verified end-to-end in this session. DB back at pristine seed state. Demo logins unchanged: Admin 9000000001 · Owner 9856001101 (verified) / 9856001102 (unverified) · Agent 9856001103 · Clients 9856001104/9856001105.

---
Task ID: 9 (ads carousel)
Agent: Z.ai Code (main orchestrator)
Task: Add a carousel ads banner section to the iShim home view

Work Log:
- Placement decision: inserted the ads carousel directly below the Hero on HomeView (before Featured homes) — the highest-visibility slot in marketplace UX, after the search hero and before core content.
- Generated 3 brand-consistent banner images via z-ai SDK (CLI allowlist rejects 1440x768, so used a one-off bun script with zai.images.generations.create; 32-multiple sizes only): public/images/banner-own.jpg (Assam-type house on misty hillside — owner/supply-side promo), banner-new.jpg (hill-view living room — fresh listings), banner-direct.jpg (keys handover — zero brokerage). Temp script removed after use.
- Built src/components/ishim/ads-carousel.tsx: 3 self-promo slides (For homeowners → "List your property" CTA wired to listing flow; Just listed → "Browse new homes" → goSearch(); Why iShim → "Find your home" → goSearch()). Features: 5.5s autoplay (paused on hover/focus/drag; respects prefers-reduced-motion), direction-aware framer-motion slide transitions, Ken Burns image zoom, swipe/drag with 56px + velocity thresholds, desktop hover-reveal glass arrows, Apple-minimal dot pagination (24px hit areas, elongated active bar), sage-gradient fallback if banner fails to load, full a11y (aria-roledescription=carousel, labelled arrows/dots, 44px CTA). Brand: rounded-3xl, ring-black/5, black gradient left overlay, white pill CTA — no blue anywhere.
- Extracted shared hook src/components/ishim/use-list-property.ts (guest → requireAuth → role checks → openListing+setView(profile), CLIENT/ADMIN polite toast) and refactored nav-bar.tsx to use it (deduped ~30 lines, behavior identical).
- Wired <AdsCarousel /> into home-view.tsx between <Hero /> and <FeaturedSection />.
- BUG FOUND & FIXED during browser verification: carousel rendered 0px wide. Root cause: `mx-auto` on a flex-column item switches it from stretch to fit-content sizing, and since all carousel content is absolutely positioned its intrinsic width was 0 (only px-6 padding = 48px showed). Hero/Featured only stretched because their in-flow content was intrinsically wide. Fix: `w-full` on the section.
- Browser-verified (desktop 1440x900 + mobile 390x844), zero console/page errors: autoplay advance, Previous arrow wrap 3→1, dot navigation, slide-1/2/3 visuals, guest CTA → auth sheet → one-tap Owner login → "Add a listing" dialog auto-opened, "Browse new homes" CTA → Search view, mobile swipe left advances slides, layout/footer/bottom-nav intact. ESLint + tsc clean.

Stage Summary:
- New: src/components/ishim/ads-carousel.tsx, src/components/ishim/use-list-property.ts; public/images/banner-{own,new,direct}.jpg. Modified: home-view.tsx, nav-bar.tsx. No API/schema/DB changes — DB remains at pristine seed state.
- To change ads later: edit the SLIDES array in ads-carousel.tsx (image, kicker, title, body, cta, action). Autoplay interval = AUTOPLAY_MS const.

---
Task ID: 10 (admin-managed ads)
Agent: Z.ai Code (main orchestrator)
Task: Make the ads carousel dynamic — DB-backed banners managed from Admin God Mode

Work Log:
- Prisma: added AdBanner model (kicker, title, body, ctaLabel, action SEARCH|LIST|URL, actionUrl, image, active, sortOrder, timestamps) → bun run db:push.
- Seed: prisma/seed.ts now upserts the 3 launch banners with fixed ids (ad-own/ad-fresh/ad-direct, sortOrder 0/1/2) — idempotent re-seed. Ran seed; DB verified.
- API (all smoke-tested with curl): GET /api/ads (public, active only, bare array, sortOrder asc); GET/POST /api/admin/ads (ADMIN; POST validates title+image required, action enum, https:// URL required for URL action); PATCH/DELETE /api/admin/ads/[id] (ADMIN; partial update incl. merged action+actionUrl validation, 404 unknown id, delete verified). Tests: 401 unauth, 400 bad action/URL/empty title, hide→excluded from public, create+delete round-trip, final state = 3 seeded ads.
- Frontend: types.ts +AdBanner; api.ts publicApi.getAds + adminApi.getAds/createAd/updateAd/deleteAd.
- ads-carousel.tsx now fetches /api/ads on mount and maps banners to slides (icon derived from action: LIST→KeyRound, SEARCH→Sparkles, URL→Globe); URL action opens in new tab; falls back to built-in FALLBACK_SLIDES on API failure/empty (banner never goes blank); arrows/dots hidden when ≤1 slide; autoplay respects n≤1.
- Admin: new src/components/ishim/admin-ads-tab.tsx ("Ads" tab in God Mode between Financials and Settings) — banner list (thumb, kicker·CTA·order·action, Hidden badge, Live switch, Edit, Delete w/ confirm dialog), Add/Edit dialog (kicker/title/body/CTA label/action select/conditional URL field, image URL input + 13-thumb quick-pick gallery with selected ring + live preview, sort order, active switch), optimistic-free reload after save, toasts on every mutation.
- Ops note: dev server restart was required after prisma generate (stale client in long-lived process → db.adBanner undefined). Kill by PID (lsof missed it); EADDRINUSE in old dev.log was a crashed duplicate start, harmless once the stale process was killed.
- Browser-verified (desktop 1440x900 + mobile 390x844): /api/ads fetch 200 from home; Ads tab lists 3 seeded banners; created "New block: Chadong listings are live" (order 3) via dialog → appeared as home slide 4 of 4 with dots; hid it via switch → "Hidden" badge + public back to 3 dots; deleted via confirm → list + public restored to 3 seeded banners. Zero console/page errors. Logout clean. ESLint + tsc clean.

Stage Summary:
- Ads are now fully admin-managed: create/edit/hide/reorder/delete banners in God Mode → home carousel reflects instantly. Public fallback keeps built-in slides if DB is empty or API fails.
- New files: src/app/api/ads/route.ts, src/app/api/admin/ads/route.ts, src/app/api/admin/ads/[id]/route.ts, src/components/ishim/admin-ads-tab.tsx. Modified: prisma/schema.prisma, prisma/seed.ts, src/lib/types.ts, src/lib/api.ts, src/components/ishim/ads-carousel.tsx, src/components/ishim/admin-dashboard.tsx.
- DB: +AdBanner table, 3 seeded rows (ad-own, ad-fresh, ad-direct); all other tables untouched at seed snapshot. To add a banner image permanently, drop it in /public/images and pick it in the Ads dialog (or paste any URL).

---
Task ID: 10
Agent: Z.ai Code (main)
Task: Redesign "Browse by block" section into a premium bordered carousel (user request with screenshot of the old plain pill list)

Work Log:
- Added public endpoint `GET /api/properties/stats` (src/app/api/properties/stats/route.ts): Prisma `groupBy` on block with `_count._all` where `status = ACTIVE`; returns `{ counts: Record<string, number>, total: number }`. Static segment resolves before `/api/properties/[id]`.
- Extended `publicApi` in src/lib/api.ts with `getBlockStats()`.
- Rewrote `BlocksSection` in src/components/ishim/home-view.tsx as a premium bordered carousel:
  - Apple-style card: `rounded-3xl border bg-card p-5 md:p-7 shadow-sm ring-1 ring-black/[0.03]` + two soft mint radial glows (blur-3xl, pointer-events-none).
  - Header: "NEIGHBORHOODS" eyebrow chip (MapPin, bg-secondary), title, subtitle "Every corner of Ukhrul, one tap away."; glass prev/next circle arrows on md+ with disabled states.
  - Tiles upgraded from plain pills to 136/152px cards: mint MapPin badge that inverts to solid primary on hover, truncate()d block name, live count ("1 home" / "No homes yet"), hover -translate-y-1 lift + primary border tint + shadow-md.
  - Carousel: native overflow-x snap-proximity scroller (no-scrollbar), conditional edge fade gradients (from-card), scroll progress bar (thumb width = client/scroll ratio, translate = progress*(1-thumb)/thumb).
  - Arrow paging steps by 3 tiles (first-child width + 12px gap, capped at 85% clientWidth); respects prefers-reduced-motion; ArrowLeft/ArrowRight keys supported via bubbling onKeyDown.
  - Footer row: hairline divider, BadgeCheck + "N verified homes across M blocks" (live total), "View all" ghost button -> goSearch().
  - Loading: 8 tile-shaped skeletons; empty state: dashed "No community blocks yet" card.
- Verified with agent-browser (1440x900 + 390x844): arrows page 3 tiles with correct disabled states at edges, progress thumb tracks, tile click -> "Homes in Dungrei · 1 result", View all -> 8 homes, mobile swipe + truncation ("Phungwam…"), zero console/page errors, ESLint clean.

Stage Summary:
- "Browse by block" is now a premium bordered carousel card with live per-block listing counts (new stats API), edge fades, scroll progress, keyboard/arrow/swipe navigation — consistent with Deep Forest Green design system. No schema/DB changes; one new public API route + api client method + BlocksSection rewrite only.

---
Task ID: 11
Agent: Z.ai Code (main)
Task: User feedback on Task 10 — bordered carousel for "Browse by block" felt inconvenient (arrows needed to see all 10 blocks) and not premium (text-only tiles). Redesign as premium photo-card section.

Work Log:
- Generated 10 unique AI photos (1152x864, ~100-240KB each) via z-ai SDK batch script (temp script deleted): one per Ukhrul block, consistent warm-green hillside travel-photography style. Saved to public/images/blocks/{slug}.jpg (hungpung, viewland, phungyo, phungwamee, mini-veng, halisahar, dungrei, old-bazaar, tnl-ward, nungshang).
- Rewrote BlocksSection in src/components/ishim/home-view.tsx — dropped the boxed carousel entirely:
  - Desktop (md+): full 5x2 grid — ALL blocks visible at once, zero clicks (convenience fix).
  - Mobile/tablet: edge-to-edge snap-proximity horizontal photo-card row (native swipe; 190/220px cards, -mx-4/px-4 full-bleed).
  - Cards: photo bg + black gradient scrim + white block name + live count ("1 home" / "No homes yet"); hover = -translate-y-1 lift + img scale 1.06 + shadow-xl + white arrow chip slide-in (all behind Tailwind v4's @media(hover:hover) — touch-safe).
  - BLOCK_IMAGES map for seeded blocks; admin-added blocks fall back to viewland.jpg; img onError hides gracefully (gradient fallback bg on card).
  - Header: title + dynamic subtitle "N verified homes across M neighborhoods." (from /api/properties/stats) + "View all" ghost button (hidden on xs).
  - Removed arrows/progress/scroller state (no more ResizeObserver); component much simpler; cleaned unused imports (useRef, useCallback, ChevronLeft/Right, MapPin).
- Kept /api/properties/stats endpoint and counts from Task 10.
- Verified with agent-browser: desktop 1440 (5x2 grid renders, all photos load, click Dungrei -> "Homes in Dungrei . 1 result"), mobile 390 (edge-to-edge cards, swipe advances, truncation OK), full-page screenshot cohesive, zero page errors, ESLint clean.
- Note: headless agent-browser context emulates coarse pointer ((hover:none) true) so Tailwind v4 hover variants are inert there — verified rules exist in compiled CSS (lines 3731-3771, 4124) and :hover matches; hover effects will work on real pointer devices.

Stage Summary:
- "Browse by block" is now an Airbnb-style photo-card neighborhood section: full grid on desktop (convenience), swipe row on mobile, 10 unique generated block photos, live counts, dynamic header stats. Homepage feels magazine-premium. Only BlocksSection rewritten + 10 static images added; stats API from Task 10 reused unchanged.

---
Task ID: 12
Agent: Z.ai Code (main)
Task: User feedback — featured homes cards and browse-by-block cards get clipped at the phone screen edge; make them fit the mobile viewport like the ads banner.

Work Log:
- Diagnosed a REAL layout bug via agent-browser geometry probes (getBoundingClientRect forensics):
  1. MAIN already provides page padding (px-4 sm:px-6) — every section ALSO carried px-4/px-6, double-padding content to 32px insets and shrinking the carousel percentage basis (358 -> 326px).
  2. HomeView root is flex-col; sections used mx-auto — auto cross-axis margins DISABLE align-items:stretch for flex items, so sections fell back to fit-content sizing. The featured section (w-full cards) ballooned to 669px (document scrollWidth 685 = horizontal page overflow on phones); block tiles resolved against the wrong basis (157px).
- Fixes in src/components/ishim/home-view.tsx + src/components/ishim/ads-carousel.tsx + src/app/globals.css:
  - Removed duplicate px-4/px-6 from Featured/Blocks/HowItWorks/Ads sections + home trust strip (main is the single source of page padding). Sections are `mx-auto w-full min-w-0 max-w-6xl` now (w-full restores definite cross size; min-w-0 guards flex min-size).
  - Featured homes mobile: exactly 1 card per swipe page (w-full snap-start, snap-mandatory, scroll-pl-4/6) -> card footprint [16,374] identical to the ads banner.
  - Browse by block mobile: exactly 2 cards per page — .block-card-w utility switched to calc(50% - 8px) with gap-4 so the third card starts EXACTLY at the viewport edge at ANY width (zero clipped-card sliver); snap lands each page with clean 16px margins.
- Verified with agent-browser 390x844: docScrollWidth 390 (no overflow), ads banner [16,374], featured card [16,374], block cards [16,187]+[203,374] with card 3 at [390,...]; swipe pages land aligned (c4 [16,187]); desktop 1440 5x2 grid intact; zero console errors; ESLint clean.

Stage Summary:
- Mobile carousels are now page-fit: one full property card and two full block cards per swipe, all content aligned to the same 16/24px page margins as the ads banner, no clipped cards, no horizontal page scroll. Root cause (double padding + mx-auto-vs-stretch in flex column) documented for future sections: never add horizontal padding to children of padded containers, and never rely on mx-auto alone inside flex-col parents.

---
Task ID: 13
Agent: Z.ai Code (main)
Task: Add a floating, movable "?" help button that opens a floating panel containing Contact, Support, About, Privacy, T&C, Policy and How iShim Works; remove the "How iShim works" section from the homepage and relocate it into the widget.

Work Log:
- Added help state to the zustand store (src/lib/store.ts): HelpArticle union ("how"|"about"|"contact"|"support"|"privacy"|"terms"|"policy"), helpOpen/helpArticle, openHelp(article?)/closeHelp()/setHelpArticle() so any component (e.g. footer) can deep-open a specific article.
- Created src/components/ishim/help-widget.tsx:
  - Draggable FAB: 56px primary circle with "?" glyph, pointer-capture based drag (touch-safe via touch-none), 6px tap-vs-drag threshold, viewport clamping (12px edges), magnetic snap to nearest horizontal edge on release, spring-ish CSS transition on transform (disabled while dragging), scale-1.08 while dragging. SSR-safe: rests at CSS bottom-right (right-4 bottom-[5.75rem] md:bottom-6) until first drag captures getBoundingClientRect.
  - Floating panel: z-46 (backdrop z-45, FAB z-47). Mobile (<md): bottom sheet inset-x-3 above bottom nav (bottom = safe-area + 4.75rem), dimmed blur backdrop, FAB hidden (max-md:invisible). Desktop: card anchored above/beside the FAB (side = nearest half), clamped to viewport with max-h min(600px, vh-96); transparent click-outside catcher; transform-origin follows the anchor side.
  - Panel has two levels: topic menu (7 rows with icons + descriptions) and article view with back chevron; ESC closes, panel is focus()ed on open, aria role=dialog with labels.
  - Articles: How iShim works (the 3 STEPS + "Free to list • ₹1,000 only on success" note, moved from home), About, Contact (WhatsApp deep link wa.me/919000000001, mailto hello@ishim.in, location, hours), Support (shadcn Accordion with 5 FAQs + WhatsApp CTA), Privacy, Terms & Conditions, Listing & refund policy.
  - FAB doubles as × toggle while open on desktop ("?" rotates 45°); aria-label swaps Open/Close help.
- Removed HowItWorks section + STEPS from src/components/ishim/home-view.tsx (unused icon imports pruned: BadgeIndianRupee, KeyRound, MessageCircle).
- Footer (src/components/ishim/footer.tsx): About/Contact/Privacy buttons now openHelp(about|contact|privacy) instead of "coming soon" toasts.
- Mounted <HelpWidget /> globally in src/app/page.tsx (visible on every view).
- Fixed lint error react-hooks/set-state-in-effect by eliminating the mount-positioning effect (CSS default position + lazy rect capture on first pointerdown instead).
- Fixed a11y/hit-test bug found in browser testing: hidden mobile FAB (opacity-0) duplicated the "Close help" a11y name -> added max-md:invisible while sheet is open.
- Verified via agent-browser: desktop 1440x900 (menu, article, back, ESC, footer deep-link opens About directly, FAQ accordion expands, FAB drag 1360->edge-snap x=12, panel re-anchors to LEFT side when FAB on left, FAB x-toggle closes, transparent-backdrop click closes); mobile 390x844 (fresh default x=318 y=696 = above bottom nav, drag+snap works, bottom sheet above nav with dimmed backdrop, FAB hidden while open, close via header X); homepage no longer contains "How iShim works"; zero console errors; ESLint clean.

Stage Summary:
- iShim now has a global, draggable help widget ("?") whose panel hosts How iShim Works, About, Contact, Support (FAQs), Privacy, T&C and Listing & refund policy; the homepage section is gone (lighter home scroll) and footer links deep-open their articles. Widget anchors to whichever side the FAB rests on, snaps magnetically to edges, and degrades to a bottom sheet above the mobile nav.

---
Task ID: 14
Agent: Z.ai Code (main)
Task: Search page overhaul (For you / Featured / Newest / Everything + easy filters + place search) and a renter-habit detection algorithm with reports for the admin dashboard and agent dashboard.

Work Log:
- Prisma: added HabitEvent model (kind SEARCH|VIEW|SAVE|CONTACT, optional user + deviceId identity, denormalized block/houseType/rent/query, indexes on userId/deviceId/kind/block+createdAt) and relations on User + Property. db:push done.
- Shared algorithm lib (src/app/api/insights/_lib/insights.ts): identity resolution (session user OR X-Device-Id header), recordEvent (denormalizes from property, never throws into caller), habit profile builder (kind weights VIEW=1/SEARCH=2/SAVE=3/CONTACT=5 x recency decay 7d=1.0/30d=0.5/older=0.2), scoreProperty (block aff x3 + type aff x2 + price-band aff x1.5 + featured x1.5 + freshness <=14d), demand tally helpers, shared PRICE_BANDS (<5k / 5-10k / 10-20k / 20k+).
- New routes: POST /api/insights/track (public, SEARCH events); GET /api/insights/recommend (public, "For you": top-12 scored ACTIVE listings + profile {events, top blocks, types, maxRent, budget band}); GET /api/insights/report (ADMIN: 30d totals, 14-day daily activity, top blocks/types/queries, budget bands, demand-vs-supply per block with Unmet/Undersupplied signals, most-active searchers with masked phones / anonymized guest devices); GET /api/insights/agent (AGENT+ADMIN: anonymized demand snapshot + "where you're missing demand" gaps vs the agent's own ACTIVE listings).
- Server-side event capture in existing routes (zero client code): GET /api/properties/[id] -> VIEW; POST /api/saved (saved=true) -> SAVE; POST /api/properties/[id]/contact -> CONTACT.
- GET /api/properties: added sort=newest|featured|price_asc|price_desc and block match in the q keyword search (title/description/block).
- Client plumbing: src/lib/device.ts (localStorage UUID), api() now sends X-Device-Id on every request; types RecommendResponse/InsightsReport/AgentInsights/DemandSlice + PropertyFilters.sort; publicApi.getRecommended, insightsApi.trackSearch, adminApi.getInsights, agentApi.getDemand.
- Search view rework (src/components/ishim/search-view.tsx): prominent place-search input (q matches block/title/description -> "searchable by common place"), place chips with live ACTIVE counts, one-tap chips for rent bands / BHK / house types, segments For you | Featured | Newest | Everything, sort select on Everything (newest / price asc / price desc), collapsible "More filters" advanced panel (desktop) + bottom sheet (mobile), personalization note ("Based on N recent actions - Block - Budget"), friendly fallback to newest when no habit history yet, fire-and-forget SEARCH tracking only for non-empty intents.
- Dashboards: new shared module src/components/ishim/insights.tsx -> AdminInsightsTab (new admin "Insights" tab) + AgentInsightsTab (new agent "Demand" tab) with KPI stat cards, CSS bar lists, 14-day activity chart, demand/supply table with click-to-search blocks, searcher table, gap cards with "See homes"/"List here" actions.
- Fixed during build: react-hooks/set-state-in-effect in both insight tabs (moved setError(false) into async callbacks; retry handler resets sync), duplicate import mishap in admin-dashboard cleaned, "For you" empty-profile fallback so a fresh visitor sees newest homes instead of an empty state.
- Dev server restarted once so Prisma client picks up the habitEvent model (first recommend call failed with db.habitEvent undefined before restart).
- Verified end-to-end: curl track -> recommend ranks the Dungrei ASSAM_TYPE cottage first for a device that searched Dungrei/wooden/<10k; admin report totals/tops/daily/demandVsSupply/topSearchers populated (guest threshold >=3 events); agent gaps list Dungrei+Viewland with none-of-yours; sort order price_desc/price_asc correct; browser: search segments, chips, keyword search (wooden -> 2 homes), detail view records VIEW (admin totals views: 1), For you flips to "Picked for you" after interaction, Everything price sort renders 8 homes ascending, Featured shows 4, admin Insights + agent Demand tabs render on mobile 390px; zero console errors after fresh reload; ESLint clean.

Stage Summary:
- iShim search is now a discovery surface: For you (habit-ranked), Featured, Newest and Everything with sort control, plus place chips, budget/BHK/type quick chips and full advanced filters. Every search/view/save/contact feeds the HabitEvent store; an affinity algorithm (intent weights x recency decay over block/type/price-band) powers personalized ranking and two reports: admin Insights (demand vs supply, unmet-demand signals, top searchers) and agent Demand (what renters want + where the agent lacks listings, with one-tap actions).

---
Task ID: 15
Agent: Z.ai Code (main)
Task: In the client profile, add a feature to rate the owner, leave remarks for the next tenants, and declare tenancy status (still staying vs moved out).

Work Log:
- Prisma: new Tenancy model (userId+propertyId @@unique, status STAYING|MOVED_OUT, ownerRating Int? 1-5, remark String? <=500 chars, indexes propertyId+status / userId+updatedAt) with relations on User and Property. db:push done.
- Shared API lib src/app/api/tenancies/_lib/tenancy.ts: parseTenancyFields (partial/full validation: status enum, rating 1..5 or null, remark trim <=500 or null), propertyRef/tenancyCard shapes, maskTenantName ("Grace Awungshi" -> "Grace A.").
- Routes: GET /api/tenancies (auth: own tenancy cards + "contacted" picker candidates = distinct ContactLog properties not yet marked, newest first); POST /api/tenancies (auth, upsert by userId_propertyId — idempotent "mark where I live", create defaults STAYING, update only provided fields); PATCH/DELETE /api/tenancies/[id] (auth, own tenancy only, 403 otherwise); GET /api/properties/[id]/reviews (public: avg/count/staying summary + reviews with masked tenant name, occupancy status, rating, remark, date; hides tenancies without rating AND remark; static /api/properties/stats still resolves first).
- Client: types TenancyStatus/Tenancy/TenancyPropertyRef/TenanciesResponse/PropertyReviews; clientApi.getTenancies/createTenancy/updateTenancy/deleteTenancy; publicApi.getPropertyReviews.
- UI shared module src/components/ishim/tenancy-ui.tsx: TenancyStatusPill ("Living here" green dot / "Moved out" muted with DoorOpen) + StarsDisplay (amber, read-only, aria).
- Client profile (profile-view.tsx): new "My stays" section (between housing status and saved homes) — MyStays loads /api/tenancies (skeleton/error/empty states; empty CTA opens picker or browse); StayCard per stay: photo/title/block/rent header (click -> property detail), remove button, "Do you still live here?" Still staying/Moved out segmented toggle (instant PATCH + toast), "Rate the owner" tappable 1-5 star radiogroup with hover preview (instant PATCH), "A note for the next tenants" textarea (500 char cap + counter + dirty-tracked Save note button), "Add a stay" outline button + Dialog picker listing contacted homes with "I live here" (dialog empty state -> browse homes).
- Property detail (detail-view.tsx): lazy public reviews fetch; "What tenants say" card (avg stars + "owner rated by N tenants" + "N living here now", review rows: masked name, occupancy pill, stars, remark, date) after Amenities; subtle "No tenant notes yet — lived here? Share from My stays" hint when no reviews.
- Fixed during work: (1) `hover || value ?? 0` mixed-operator parse error -> parens; (2) missing @@unique([userId,propertyId]) broke upsert (PrismaClientValidationError) -> added + db:push + dev server restart (recurring Prisma-client-cache issue); (3) REAL UX bug found in browser testing: StayCard key included updatedAt so any status/rating save remounted the card and WIPED an unsaved remark draft -> key=id only + remark kept as draft-override state (draft ?? server), dirty recomputed against fresh server value; verified draft survives status toggle + star tap.
- Verified end-to-end: curl flow (contact -> picker candidate -> POST stay -> PATCH rating 4/remark -> PATCH MOVED_OUT -> re-POST upsert keeps rating -> public reviews avg 4/count 1/staying 1, name "Grace A."); validations (rating 0/6 -> 400, bad status -> 400, 501-char remark -> 400, remark null clears); authz (cross-user PATCH/DELETE -> 403, anon -> 401); browser 390x844 + 1440x900: login via mobile Profile -> Guest card, My stays renders with server state, Moved out toggle + 5-star rating + remark edit + save all live-updating, Add a stay dialog adds Dungrei cottage (picker excludes already-marked), detail page shows "What tenants say" (5.0 - 1 tenant - 1 living here now - Grace A. - pill - remark - date), no-review home shows the hint, scrollWidth 390 (no overflow), toast-cover click retries, fresh reload has zero console/page errors, ESLint clean.

Stage Summary:
- Tenants can now declare occupancy per home ("Still staying" / "Moved out"), rate their owner 1-5 stars, and leave up-to-500-char remarks for the next tenants from a new "My stays" section in the client profile; stays are seeded from WhatsApp contact history via an "Add a stay" picker. Ratings+remarks are public on the home's detail page ("What tenants say") with masked names and live-occupancy badges, giving future tenants honest signals before they contact an owner. New Tenancy table + 4 API endpoints (3 auth, 1 public); profile and detail views updated; draft-loss-on-remount bug caught and fixed in browser testing.
---
Task ID: 16
Agent: Z.ai Code (main)
Task: Integrate the two uploaded brand files (horizontal brand logo 1600x800 + app icon 1254x1254) as the official iShim branding across the app.

Work Log:
- Built scripts/build-brand.mjs (sharp): converts the uploaded JPEGs into production assets.
  - White-background removal via border BFS flood fill; per-image flag after discovering the app icon's cream house is near-pure-white (min 246-253) but ENCLOSED by the green square — global white-pocket pass is only applied to the logo (letter counters), never the icon; alpha feather pass kills anti-aliased halos. Verified by compositing over dark green.
- Generated assets: public/brand/{logo.png (trimmed, transparent bg, h120), icon-192.png, icon-512.png, icon-48.png, icon-maskable-512.png (opaque), og.png (1200x630 logo on white), manifest.webmanifest}; src/app/icon.png (favicon via Next file convention) + src/app/apple-icon.png (180x180 opaque for iOS mask). Brand green sampled: #023c2e.
- layout.tsx: removed placeholder /logo.svg icon, icons now auto-served from src/app/icon.png + apple-icon.png (verified <link rel="icon"> / apple-touch-icon injected); added manifest link, openGraph image /brand/og.png, metadataBase, and viewport themeColor #023c2e.
- Component swaps: nav-bar Logo now renders /brand/logo.png (h-8 desktop / h-7 mobile, wordmark inside image so text span removed); home hero uses /brand/icon-192.png in the glass chip; footer brand row gains icon-48 mark; auth-sheet shows icon-192 above "Welcome to iShim"; boot splash in page.tsx uses icon-192. Deleted stale public/logo.svg (zero remaining references).
- Verified via agent-browser (1440x900 + 390x844): header logo renders 89x32 with correct aspect on white/75 blur bar, hero icon shows transparent corners on glass chip, auth dialog icon + footer mark look right, /icon.png + /apple-icon.png + /brand/manifest.webmanifest all 200, OG image visually clean, zero page errors; ESLint clean.

Stage Summary:
- iShim now wears its real brand everywhere: transparent-background horizontal logo in the nav bars, app icon as favicon/apple-touch-icon/PWA icons (with webmanifest + #023c2e theme color), in the hero, auth sheet, footer and loading splash, plus a 1200x630 OG image for link sharing. Placeholder logo.svg removed; assets reproducible via `bun scripts/build-brand.mjs`.
---
Task ID: 17
Agent: Z.ai Code (main)
Task: Replace the stark-white page background (wide empty side gutters on desktop) with a soft, smooth green ambience that is easy on the eyes and more visually attractive.

Work Log:
- globals.css: light-mode --background changed from pure white oklch(1 0 0) to a soft sage mist oklch(0.978 0.012 150); --card/--popover stay pure white so cards, dialogs and sheets now gently float above the tint (better hierarchy).
- Added fixed body::before ambient wash: two large radial gradients in brand greens at 9%/7% alpha (top-right + bottom-left, z -1, pointer-events none) — barely-there glow, smooth, never loud; also works over the dark theme.
- nav-bar.tsx: desktop header + MobileTopBar switched from bg-white/75 to bg-background/75 so the sticky glass bars blend with the tint instead of reading as white stripes.
- Footer (bg-secondary/50) and all views (search/profile/dashboards) inherit the tint automatically via bg-background.
- Verified via agent-browser at 1920x1080 (the user's own viewport): side gutters now show the sage tint with subtle glow, white property cards pop, sticky header blends, block tiles + trust line + footer all consistent; mobile 390x844 clean; zero page errors; ESLint clean.

Stage Summary:
- iShim's canvas is now a calm sage-green field instead of clinical white: background tint (--background), two whisper-quiet brand glows, and glass headers that pick the tint up. White surfaces (cards/dialogs) deliberately kept pure white for elevation. Single-variable tweak means any future theme change propagates everywhere.
---
Task ID: 18
Agent: Z.ai Code (main)
Task: Admin god-mode completion — (1) admin can edit/publish every site content page (Privacy, T&C, refund policy, About, Contact, Support, How iShim works), (2) real image uploads, (3) swap into any agent/user account and act on their behalf to maintain the platform.

Work Log:
- Prisma: new ContentPage model (slug @id among the 7 help keys, title, data JSON blob validated per slug, banner, updatedBy, updatedAt). db:push + dev restart (recurring Prisma-client cache issue: first admin/content GET 500 with db.contentPage undefined until a clean restart; also a stray duplicate dev process on :3000 had to be killed — use setsid + verify port).
- Shared content lib src/lib/default-content.ts: HelpArticleKey/ContentData types (HowData steps+note, AboutData lead/bullets/outro, ContactData lead + whatsapp{label,sub,number}/email{address}/location/hours, FaqData, SectionsData), DEFAULT_CONTENT porting every hardcoded article verbatim, validateContentData per slug (row counts, required fields, wa number 10-15 digits, email @), buildContentPayload for PUT.
- APIs: GET /api/content (public overrides map, corrupt rows skipped); GET /api/admin/content (ADMIN, 7 pages merged with defaults + customized flag); PUT/DELETE /api/admin/content/[slug] (ADMIN upsert validated / reset-to-default); POST /api/upload (any signed-in user; multipart `file`, JPEG/PNG/WebP/GIF ≤2MB, saved to public/uploads/<ts>-<uuid>.<ext>, returns {url}).
- help-widget.tsx rewritten data-driven: removed the 8 hardcoded article components; new ArticleBody renders HowBody (step cards + icons by index + note), AboutBody (BadgeCheck bullets), ContactBody (wa.me from editable number, mailto, location, hours rows), SupportBody (FAQ accordion + WhatsApp CTA), SectionsBody (h/p). Fetches /api/content fresh each panel open, merges overrides (title too), shows optional banner image; falls back to DEFAULT_CONTENT on error/missing slug so the site never breaks.
- New admin "Content" tab (admin-content-tab.tsx): 7 rows with icon, Customized/Default badge, editor + last-editor line; type-aware editor dialogs (Sections/FAQs/Steps+note/About/Contact field-rows with add-remove), title, optional banner with UploadButton + preview + remove, Publish (toast) and Reset-to-default (only when customized); validation errors surface as toasts.
- New shared UploadButton component; wired into the ads dialog ("Upload banner image"), the listing form photo picker (Upload → adds /uploads url to photos) and the content banner picker.
- Client: api.ts adds adminApi.listContent/upsertContent/resetContent, uploadImage() (FormData, no JSON content-type), contentApi.getOverrides; types re-exported from lib/default-content.
- Impersonation (already existed from earlier work) verified end-to-end this session: admin → Users → Impersonate a CLIENT (Dev Program) → client profile with My stays renders, pill "Now viewing as…" shown; exit → admin session restored ("Welcome back, iShim Admin"); re-impersonate AGENT 9856001103 (Marcus Chonsinrao) → full agent dashboard (Pipeline/Owners/Listings/Matchmaking/Demand) works under his identity; as the impersonated agent opened the listing form and uploaded a real photo. Exit restores admin both times.
- Browser-verified: content edit → publish → widget shows override text; reset → public API back to {}; banner upload → preview → published → banner renders at top of About article; ads dialog shows upload; listing form upload adds photo chip; validation PUT with empty heading → 400 "Every section needs a heading and text" toast; anon POST /api/upload → 401; final state {"pages":{}} (all test overrides reset); ESLint clean; dev.log clean 200s/401/400s only.
- Fixed during work: 3 lint issues (unused eslint-disable ×2; react-hooks/set-state-in-effect in ContentTab load — moved setState into promise callbacks and used useEffect(load, []) reference pattern like insights.tsx). False alarm noted: grep output visually ate "[m" as ANSI escape making `const [manualUrl,` look like a syntax error — file was fine.

Stage Summary:
- iShim now has a real mini-CMS: admins can rewrite any help/legal page (including per-section structured editing, WhatsApp number, FAQs, steps), attach banner images, publish instantly to every visitor, and reset to the built-in copy — the help widget renders admin content live with graceful default fallback. Real image uploads (≤2MB) now exist for listing photos, ad banners and content banners via /api/upload. Combined with the existing Users-tab impersonation (act as any client/owner/agent with one-tap exit), the admin can truly maintain any part of the platform as any role.

---
Task ID: 18 (re-verification)
Agent: Z.ai Code (main)
Task: Post-context-reset final sanity pass of the completed Admin god-mode work (CMS + uploads + impersonation).

Work Log:
- Confirmed dev server healthy (all 200s in dev.log) and ESLint clean.
- Browser-verified end-to-end at 390x844: admin login 9000000001 -> God Mode -> Content tab renders 7 pages -> edited "How iShim works" step 1 to "Search smart" -> Publish -> public /api/content returns override AND help widget article renders it live -> Reset to default -> /api/content back to {"pages":{}}.
- Impersonation re-verified: Users tab -> Impersonate "Dev Program" (Tenant) -> profile switches, "Now viewing as" toast + "Viewing as" exit pill -> exit -> admin session fully restored (God Mode back).
- Zero console/page errors; worklog Task 18 entry from previous session confirmed complete.

Stage Summary:
- Task 18 stands verified and complete: admin mini-CMS (edit/publish/reset all 7 help+legal pages with banner uploads), real image uploads site-wide, and act-as impersonation with one-tap exit all work in the live app.

---
Task ID: 19
Agent: Z.ai Code (main)
Task: Footer rebrand (remove About/Contact/Privacy links, add "iShim by eX Holdings", "© 2026", "Developed by eX") + in the privacy/content side add a Business page with on/off toggles per page.

Work Log:
- Prisma: ContentPage.visible Boolean @default(true); db:push + clean dev restart (recurring Prisma-client cache issue: first PATCH 500 "Unknown argument visible" until full port-kill restart).
- default-content.ts: added "business" slug (8th key) — default sections copy (iShim by eX Holdings / owners with many homes / for agents / partner with eX), added to CONTENT_KEYS + validation (sections case) + ContentPageDto.visible.
- APIs: GET /api/content now returns hidden: string[] and omits hidden pages' overrides; GET /api/admin/content includes visible per row; PUT accepts optional visible; NEW PATCH /api/admin/content/[slug] {visible} — toggles visibility only, auto-creates a default-content row when hiding a never-customized page; anon PATCH → 401 verified.
- Admin Content tab: per-row shadcn Switch ("Hide/Show <title> on the site") with optimistic update + toast + rollback on error, destructive "Off" badge on hidden rows, Business row (Building2 icon) with SectionsEditor; header copy mentions the switch.
- help-widget.tsx: MENU gains Business ("iShim by eX Holdings — for agents & partners."); menu filters by hidden list from /api/content.
- footer.tsx: About/Contact/Privacy nav removed (help FAB remains the reading surface); brand block gains "iShim by eX Holdings" (Building2 icon); bottom line now "© 2026 eX Holdings. All rights reserved. · Developed by eX."
- Browser-verified (390x844 + 1440x900): admin toggles Privacy OFF → public API {"pages":{},"hidden":["privacy"]} → help menu shows 7 topics without Privacy; Business article renders eX Holdings sections; toggle back ON → privacy row back in pages, menu shows 8; footer shows new branding at both widths, sticky, no nav links; fresh reload zero page errors; ESLint clean.

Stage Summary:
- Footer is now pure eX Holdings branding (iShim by eX Holdings, © 2026, Developed by eX) with the old About/Contact/Privacy links removed; a new Business help page introduces the company; and every CMS page (incl. Privacy and Business) has an admin on/off switch that instantly removes/restores it from the public help menu.

---
Task ID: 20
Agent: Z.ai Code (main)
Task: Fix site-wide "Couldn't load listings / Please log in to continue" — login returned 200 but every authed API call 401'd immediately after.

Root Cause:
- Auth relied solely on the httpOnly `ishim_session` cookie. The app runs inside the preview panel's cross-site iframe, where modern Chrome's third-party-cookie blocking refuses to store/send `SameSite=Lax` cookies → server set the cookie fine (login 200) but the browser never sent it back → every guarded route 401'd ("Please log in to continue"), dashboards showed "Couldn't load listings". Server-side flow verified healthy via curl (cookie set + cookie-authed call 200), isolating the fault to the client cookie channel.

Fix — dual-channel auth (cookie + header):
- src/lib/auth.ts: new getSessionToken() reads X-Session-Token / Authorization: Bearer header FIRST, falls back to cookie; getSessionUser() and clearSession() use it. SESSION_HEADER exported.
- Auth routes: login/me/restore now also return the active `token` in the JSON body; impersonate reads restoreToken from header first then cookie; logout deletes the header-token session too. Cookie still set for same-site browsers (unchanged behavior).
- New src/lib/session.ts: localStorage-backed token (ishim_session_token) with get/set/clear.
- src/lib/api.ts: api() attaches X-Session-Token on every request; login stores the token, logout clears it; uploadImage sends it too. authApi type updates (me → {user, token}, restore → {user, token}).
- page.tsx boot: adopts echoed token when signed in, clears stored token when signed out.
- admin-dashboard.tsx impersonate(): setSessionToken(res.token) — acting user's token becomes active on the header channel. impersonation-pill.tsx exit(): setSessionToken(res.token) — admin token restored.

Verified:
- curl: login → token in body; X-Session-Token-only calls to /api/my/properties + /api/agent/clients → 200; logout via header deletes session (token dead → 401).
- Browser (fresh context, localStorage wiped): agent login 9856001103 → Agent CRM renders (pipeline/leads), Listings tab OK (previously broken), reload → session survives via me() token adoption; logout clears token; admin login → impersonate "Dev Program" → acting as tenant with swapped token → exit → admin session + original token restored (God Mode back).
- Zero page errors, ESLint clean, dev.log all 200s.

Stage Summary:
- Auth now works everywhere — same-site browsers keep the httpOnly cookie, and cookie-blocked contexts (preview iframe) run entirely on the X-Session-Token header with a localStorage mirror. Login, session persistence across reloads, logout, and the full admin impersonation round-trip (token swap + restore) all verified end-to-end.

---
Task ID: 21
Agent: Z.ai Code (main)
Task: Property-page commerce layer — (1) enquiry actions on property detail (WhatsApp / Call / let-an-agent-handle-it), (2) ratings for owner + property + agent, (3) inspection-visit ("checkup") booking, (4) full photo carousel, (5) rent negotiable on/off.

Work Log:
- Prisma: Property += negotiable (Bool), calls (Int); new Rating {userId, targetType PROPERTY|AGENT, targetId, rating 1..5, comment, @@unique(userId,targetType,targetId)}; new Enquiry {propertyId, userId?, handledById, kind GENERAL|VISIT, channel AGENT|OWNER, name, phone, message, visitAt?, status NEW|CONTACTED|SCHEDULED|CLOSED}; User relations ratings/enquiries/handledEnquiries. db:push + full port-kill restart (logs restored to >> dev.log).
- APIs: publicPropertyCard/fullProperty += negotiable (+ listedByAgentId exposed publicly so the UI can detect agent-handled homes); POST/PATCH /api/properties accept negotiable; contact route now takes method WHATSAPP|CALL (CALL → tel:+ link, calls counter, "[Call]" ContactLog, same agent/owner routing); NEW GET+POST /api/properties/[id]/ratings (public summaries: property Rating rows w/ masked names, owner avg from Tenancy.ownerRating, agent rows + name; POST upserts per user+target, 401 anon, "cannot rate yourself" guard, fresh summary returned); NEW POST /api/properties/[id]/enquiries (anon OK — name+10-digit phone required, VISIT requires future visitAt, routed handledById = listedByAgentId ?? ownerId); NEW GET /api/my/enquiries (handler inbox w/ parsed photos); NEW PATCH /api/enquiries/[id] (handler/admin only; status + visitAt reschedule).
- Client: types PropertyRatings/MyEnquiry/EnquiryKind/EnquiryStatus/ENQUIRY_STATUS_LABELS; api.ts publicApi.getPropertyRatings/createEnquiry + contactProperty(method), clientApi.rateProperty, enquiryApi.getInbox/update; ListingPayload.negotiable.
- detail-view.tsx rewritten: single PhotoCarousel (new photo-carousel.tsx — scroll-snap swipe, prev/next glass arrows, dots, n/m counter, fullscreen lightbox Dialog w/ keyboard arrows) replaces the old mobile gallery + desktop mosaic on BOTH breakpoints; price block gains "Rent negotiable" (primary tint) / "Fixed price" (muted) badge; new EnquiryActions (WhatsApp+Call half-buttons, "Let the agent handle it"/"Send an enquiry", "Book an inspection visit") in the desktop sidebar AND a mobile in-flow "Interested? Reach out" card; mobile sticky bar = heart + WhatsApp + call + calendar with right padding so the draggable help FAB never covers the calendar; new "Ratings & reviews" section (Home/Owner/Agent star chips + counts, "Rate this home"/"Rate <agent>" buttons gated by requireAuth, property rating list w/ masked reviewers) while the existing tenancy "What tenants say" section stays.
- New enquiry-dialog.tsx (Ask a question ⇄ Book a visit pill switch, date input + time-slot select for visits, name/phone prefilled from session, anonymous allowed, contextual owner/agent copy); new rating-dialog.tsx (5 big stars radio group, optional comment ≤500, update-aware labels).
- New enquiries-inbox.tsx (shared): rows with status badge, Visit·slot chip or Enquiry chip, property snapshot + thumb, requester name/phone, message quote, tel:/wa.me quick actions, status Select w/ optimistic update + rollback toast; wired into owner-dashboard ("Enquiries & visit bookings" section above listings) and agent-dashboard (new "Enquiries" tab after Pipeline).
- listing-form-dialog: "Rent negotiable" Switch row (HandCoins icon, helper text); prefill on edit. property-card: green "Negotiable" chip in the meta row.
- Verified curl: ratings GET (owner 5 from tenancy, agent Marcus detected), rate 4→5 upsert, mine prefill; enquiry VISIT future-date + phone validation 400s; agent inbox shows both enquiries; PATCH SCHEDULED by agent, 403 for tenant; CALL returns tel:+919856001103 (agent-routed); owner PATCH negotiable true.
- Browser (390×844 + 1440×900): carousel counter 1/2→2/2 + dots + lightbox w/ keyboard; visit booked as Grace (prefilled identity, slot 11:30) → toast "Visit requested!" → appears in Marcus's Enquiries tab → status changed to Contacted via Select; "Update your home rating" dialog prefilled 4★+comment → updated to 5★ → chips all 5.0; anonymous/agent/owner routing all correct; owner dashboard shows owner-routed visit; "Rent negotiable" on card + detail, listing-form switch toggles; footer sticky; zero page errors; ESLint clean; dev.log clean.

Stage Summary:
- Property pages are now a full contact-and-trust hub: swipeable photo carousel with lightbox, WhatsApp AND call deep links (both logged + agent-routed), agent-handled enquiries, inspection-visit booking with slots, star ratings for home/owner/agent with public summaries, and an explicit negotiable-or-fixed price badge — with every enquiry landing in a manageable inbox for the routed owner or agent.

---
Task ID: 21-b
Agent: Z.ai Code (main)
Task: Follow-up on user feedback "you missed to add inquire, available, book, whatsApp, inquire agent if whatsapp" — surface the enquiry/booking/availability layer on the listing CARDS themselves, add availability display, and make WhatsApp fall back to an agent/owner enquiry instead of dead-ending.

Work Log:
- Diagnosis: the Task-21 detail view already had WhatsApp/Call/agent-enquiry/visit-booking, but (a) nothing anywhere said a home was "Available", (b) listing CARDS in home/search had no quick actions at all, (c) WhatsApp on a listing with no contact number just toasted an error, (d) new agent-listed homes defaulted contactRoute OWNER so WhatsApp reached the owner, not the agent. Also chased two red herrings: prisma schema "corruption" and a "const essage" syntax error — both turned out to be terminal-display artifacts that eat "[h"/"[m" sequences; raw bytes + `bunx tsc` + `prisma validate` prove files are fine. The only real tsc error was store.ts openHelp typing.
- store.ts: openHelp param typing fixed (HelpArticle | undefined → coalesced to null).
- helpers.ts: publicPropertyCard now includes status (cast PropertyStatus) so cards can show availability.
- POST /api/properties: agent-created listings now auto-set contactRoute "AGENT" (agent-handled homes reach the agent on WhatsApp/call, falling back to owner's number when missing).
- property-card.tsx: green pulse "Available" chip / muted "Rented" chip on the photo; quick-action row on every available card — WhatsApp (auth-gated, wa.me deep link, logs ContactLog + whatsappClicks, routed agent-first), "Inquire" (opens EnquiryDialog GENERAL) and "Book" (opens EnquiryDialog VISIT) with no auth wall; rented cards render a muted note instead and hide actions/dialog.
- detail-view.tsx: "Available now" / "Currently rented" pill added to the title badge row; rented homes hide the enquiry card (mobile), sidebar actions (desktop) and the sticky action bar, replaced by a "Currently rented out — save the home and check back" note; WhatsApp failure now falls back to the enquiry dialog with a contextual toast ("Inquire with the agent/owner instead") instead of a dead-end error.
- Critical bug found via browser repro: EnquiryDialog is a React portal INSIDE the clickable card <article> — clicks on dialog buttons bubble through the REACT tree and hit the card onClick, silently navigating to the detail view after Inquire/Book/Cancel/submit. Fixed by wrapping the dialog in a stopPropagation div (documented in-code).
- Demo data: added a MOVED_OUT tenancy for Grace (9856001104) on "Spacious 3BHK — Halisahar (rented)" so rented-home UX is reachable from Profile → My stays; learned Prisma stores DateTime as epoch-ms ints after a raw ISO-string insert broke /api/tenancies (P2023) — fixed the row to epoch ms.
- Temporarily emptied an owner's whatsappNumber to verify the fallback end-to-end (API 400 "No contact number available" → toast + enquiry dialog), then restored the number.
- Verified: card WhatsApp opens wa.me to the AGENT's number (919856001103 Marcus) on the agent-listed duplex; Inquire/Book dialogs open from cards with prefilled identity and submit stays on the page ("Enquiry sent!" / "Visit requested!" toasts); both card enquiries landed in Marcus's agent inbox via curl (VISIT 2026-10-15 11:30 + GENERAL); rented detail shows "Currently rented" pill, no enquiry UI, no sticky bar, footer sticky; search view desktop grid shows Available chips + full action row on every card; logged-out card WhatsApp shows the login sheet; ESLint clean; only historical (self-inflicted, fixed) tenancies 500s in dev.log.

Stage Summary:
- Every listing card is now a mini contact hub: Available/Rented status at a glance plus one-tap WhatsApp (agent-routed), Inquire, and Book-visit — the enquiry dialog can be used without ever opening the detail page; WhatsApp never dead-ends (falls back to an in-app enquiry routed to the agent or owner); agent-listed homes route WhatsApp/call to the agent by default; and rented homes clearly say so instead of offering bookings.

---
Task ID: 21-c
Agent: Z.ai Code (main)
Task: User follow-up — "there isnt a contact owner, enquire, agent etc in here... it has to be convenient so everyone can easy contact it".

Work Log:
- Identified two real convenience gaps: (1) rented-home details were a contact DEAD END (Task 21-b hid all actions there, showing only a note), most likely the surface the user was on via Profile → My stays → rented home; (2) WhatsApp/Call sat behind a login wall even though the contact API is anonymous-safe.
- detail-view.tsx: removed requireAuth from onWhatsApp/onCall — one-tap contact for every visitor, logged-in or not (ContactLog still records the touchpoint with userId null when anonymous). Mobile enquiry card header now reads literally "Contact the owner" / "Contact the listing agent" depending on who handles the home. Rented homes (mobile card + desktop sidebar) now get a "Currently rented out" card with an "Inquire with the owner/agent" button (opens the GENERAL enquiry — ask when it's free again or about similar homes) instead of the dead-end note; Book/WhatsApp/Call stay hidden for rented homes since they're meaningless while occupied.
- property-card.tsx: card WhatsApp no longer wraps in requireAuth — same one-tap behavior with the no-number → enquiry-dialog fallback intact.
- Verified in browser: anonymous (fresh storage) card WhatsApp opens wa.me straight to the agent's number with no login sheet; Grace → My stays → rented Halisahar home shows "Currently rented out" + "Inquire with the owner" → dialog opens with owner-routing note; owner-listed detail shows "Contact the owner" header with WhatsApp/Call/Send an enquiry/Book an inspection visit plus the sticky action bar; zero page errors; tsc + ESLint clean.

Stage Summary:
- Contact is now frictionless everywhere: every visitor (no login) can one-tap WhatsApp or call any available home from a card or the detail page, enquire or book visits anonymously, and even rented homes offer a direct "Inquire with the owner/agent" path instead of a dead end.

---
Task ID: 22
Agent: Z.ai Code (main)
Task: User feedback — "add the whatsApp, inquire, booked etc inside not outside" — embed the contact actions inside the page content at every width instead of only in side rails / floating bars.

Work Log:
- Diagnosed the real bug behind the contact complaints: the detail view's in-flow contact card was `md:hidden` while the desktop sidebar was `hidden lg:block`, so the 768–1023px band (typical preview-panel width) rendered NO contact UI at all; on mobile/desktop the actions also lived only in a floating sticky bar / side rail ("outside" the content).
- detail-view.tsx rework:
  - EnquiryActions simplified to a breakpoint-proof 2×2 grid (WhatsApp · Call · Inquire/"Ask the agent" · "Book a visit"); dropped the stack/grid layout prop.
  - New universal "Contact the listing" <section> embedded in the main content column right after the beds/baths chip — rendered at EVERY width; rented homes get the "Currently rented out" + "Inquire with the owner/agent" variant in the same in-flow spot.
  - Desktop sidebar slimmed to Save home + trust/listing info (no duplicated contact buttons); mobile sticky bar kept as a scroll convenience only.
- Verified in agent-browser: 820×1000 (formerly dead zone) detail shows the in-flow contact section; "Ask the agent" dialog opens with prefilled identity and submits ("Enquiry sent!"); WhatsApp opens wa.me to agent Marcus (919856001103) confirming agent-first routing; rented Halisahar home at 820 + 390 shows the in-flow Inquire card and its dialog opens/cancels staying on the page; 390×844 and 1440×900 screenshots confirm layout and sticky footer; zero page errors; dev.log clean; ESLint clean; tsc clean for app source.

Stage Summary:
- WhatsApp / Call / Inquire / Book now live INSIDE the property page content at every screen size — the 768–1023px dead zone is gone, side-rail-only placement is gone, rented homes keep an in-flow inquiry path, and the mobile sticky bar remains purely as a bonus while scrolling.

---
Task ID: 23
Agent: Z.ai Code (main)
Task: User request — "delete the outside showing contacts whatsapp, inquire and book. and inside add a feature to contact agents too. so the clients can choose which to inquire in their wants."

Work Log:
- Deleted the OUTSIDE contact surfaces: property-card.tsx no longer renders the WhatsApp/Inquire/Book action row (nor the card-level EnquiryDialog — all related handlers/imports removed; cards are now informational: photo, price, Available/Rented badge, save heart, rented note); detail-view.tsx mobile floating sticky action bar removed (container padding reduced accordingly).
- Owner-vs-agent CHOICE inside the detail contact section:
  - contact API accepts route: "OWNER"|"AGENT" (client choice wins; falls back to the other party's number instead of dead-ending; response reports the effective route).
  - enquiries API accepts route — OWNER routes handledById to the owner (channel OWNER) even on agent-listed homes; AGENT routes to the listing agent; absent = previous auto behavior.
  - detail-view contact section shows an Owner/Agent pill tablist when the home has a listing agent (default = listing's contactRoute); WhatsApp/Call/Inquire/Book all follow the choice; caption says who you'll reach ("You'll reach Marcus Chonsinrao directly…"); enquiry button label flips Ask-the-agent ↔ Inquire; EnquiryDialog got a route prop (note text + POST payload).
  - Fixed a chooser-reset bug: post-contact load() re-ran the route initialization and snapped the choice back to the default — now initialized once per property via a ref.
- Demo data: the TNL duplex had Marcus as BOTH owner and agent (identical numbers); reassigned its ownerId to Ngathan Shimray (9856001101) so the choice is real: OWNER → wa.me 919856001101, AGENT → wa.me 919856001103.
- Verified via curl: contact route OWNER/AGENT/default + fallback (owner-listed studio + route AGENT → OWNER) — all correct; enquiries POSTed with route land with channel OWNER→Ngathan / AGENT→Marcus (test rows deleted).
- Verified in agent-browser (820/390/1440): feed cards show NO contact buttons; duplex detail shows chooser (Agent pre-selected) — WhatsApp opens Marcus, switch to Owner → WhatsApp opens Ngathan, choice STICKS after post-contact refresh; UI enquiry submitted with Owner selected → DB row channel OWNER handledById Ngathan (then cleaned); dialog note reads "Routed to the listing owner/agent…"; owner-listed studio shows NO toggle; rented Halisahar home keeps the in-flow "Inquire with the owner"; zero page errors; ESLint + tsc clean.

Stage Summary:
- Contact is now single-sourced INSIDE the property page: no floating bars, no card buttons. On agent-listed homes the client explicitly chooses Owner or Agent and WhatsApp, Call, Inquire and Book-visit all follow that choice — enquiries land in the chosen party's iShim inbox (channel + handledById), with number-missing fallbacks so no choice dead-ends.

---
Task ID: 24
Agent: Z.ai Code (main)
Task: User request — "in the footer add know your Owners and when clicked a new page showing all owners and agents registered profiles with contact, block. and all its listed rentals. overall"

Work Log:
- New public API GET /api/directory (src/app/api/directory/route.ts): every non-banned OWNER/AGENT profile with phone + WhatsApp (raw), verified flag, memberSince, derived blocks (unique blocks of their visible listings), per-profile stats (total/available/rented) and their listings (ACTIVE + RENTED only; PENDING/HIDDEN/REJECTED never leak). Owners contribute owned homes; agents additionally get homes via listedByAgentId (no Prisma relation — one extra grouped query, deduped by id, so an agent's own home never appears twice). Profiles sorted busiest-first then name; response also carries a site summary {owners, agents, listings, available}.
- Client plumbing: types.ts += DirectoryProfile/DirectoryResponse + normalizePhoneE164 (10-digit → 91-prefixed for wa.me/tel:) + formatPhoneDisplay (+91 XXXXX XXXXX); api.ts publicApi.getDirectory(); store View union += "directory"; page.tsx renders DirectoryView in the AnimatePresence chain (single-route architecture preserved — no new URL routes).
- footer.tsx: "Know your Owners" pill button (Users icon + arrow, hover slide) on the brand row with caption "Every registered owner & agent — contacts and listings."; navigates via store setView("directory").
- New directory-view.tsx: Back button + hero header, 4-tile summary strip (Owners/Agents/Listings/Available now), All/Owners/Agents pill tabs + name-or-block search, responsive card grid (md:grid-cols-2). Each profile card: initials avatar (dark for agents), name + BadgeCheck verified, Owner/Agent role badge, "On iShim since …", blocks line ("New on iShim — no live listings yet" when empty), contact strip (+91 display, WhatsApp deep link with prefilled "Hi <name>, I found you on iShim…" message, tel: call button), "Listed rentals (N)" scrollable list (max-h-72 thin-scrollbar) of mini rows — photo/house placeholder, title, block · type · BHK · "agent-listed" hint, rent/mo, pulsing Available / muted Rented pill; row click → openProperty detail. Skeleton loading, retry EmptyState on error, filtered-empty state.
- Fixed a real mobile bug found in browser: the directory grid blew out to 604px on 390px viewports — truncate rows inside grid items don't reduce intrinsic min-content; adding min-w-0 to the article card fixed it (scrollWidth 604 → 390).
- Verified via curl: directory JSON correct (Ngathan 6 listings incl. agent-listed duplex + rented; Ringkahao 4 incl. rented Halisahar; Marcus gets the TNL duplex only via listedByAgentId; admins/clients excluded).
- Verified in agent-browser (390/820/1440): footer pill on all widths → directory opens; stats 2 Owners · 1 Agent · 11 Listings · 9 Available; wa.me hrefs correct per profile (wa.me/919856001101 Ngathan, 919856001103 Marcus) with prefilled message; tel:+ links; Agents tab → only Marcus; Owners tab → the two owners; block search "Halisahar" → Ringkahao only, name search "marcus" → Marcus only, clearing restores 3 (note: agent-browser fill(""/Backspace) doesn't dispatch React events — real keystrokes verified working, no app bug); listing row click opens the property detail view; no horizontal overflow at any width; footer sticky; zero page errors; dev.log only clean 200s; ESLint + tsc clean.

Stage Summary:
- The footer now has a "Know your Owners" entrance to a full public directory: every registered owner & agent on iShim with verified badge, direct phone/WhatsApp/call contact, the blocks they operate in, and ALL their listed rentals (available + rented) in one scrollable card — each rental one tap away from its full page. Single-route architecture intact, mobile-overflow bug fixed, all widths verified.

---
Task ID: 25
Agent: Z.ai Code (main)
Task: User request — "(1) in owner add a listings add kitchen and bed same room or different, size, width, listing should be convenient. (2) add a listing: if the owner can't use internet or doesn't want to do it manually they can ask an agent to do it for them — option with contact, call, WhatsApp — and then the agent will list it for them and maintain it for them."

Work Log:
- Prisma Property += kitchen (String? — "SEPARATE" | "SAME_ROOM"), areaSqft (Int?), widthFt (Int?). db:push (additive nullable columns, zero downtime) + full port-kill dev-server restart.
- APIs: KITCHEN_TYPES constant in helpers; publicPropertyCard + fullProperty expose the three fields; POST /api/properties accepts them (kitchen whitelisted, size/width must be positive ints) and persists; PATCH /api/properties/[id] accepts them (empty/absent → null so owners can clear values). curl-verified: PATCH persisted, public GET returns them, kitchen:"MODULAR" → 400, areaSqft:-5 → 400, POST create with SAME_ROOM/350/18 works (test row deleted).
- Client: types Property += kitchen/areaSqft/widthFt + KITCHEN_LABELS {SEPARATE: "Separate kitchen", SAME_ROOM: "Kitchen + bed same room"}; ListingPayload += the three (all optional — the form stays convenient, nothing new is mandatory).
- listing-form-dialog.tsx: Kitchen Select + Size (sq ft) + Width (ft) number inputs in the details grid (placeholders "e.g. 900"/"e.g. 30", kitchen placeholder "Select (optional)"); full prefill on edit; blank payload includes them.
- detail-view.tsx: the facts bar is now flex-wrap with conditional chips — existing beds/baths plus CookingPot "Separate kitchen"/"Kitchen + bed same room", Ruler "1,200 sq ft" (en-IN grouping), MoveHorizontal "22 ft wide" — only rendered when the owner filled them.
- NEW ask-agent-dialog.tsx: "Ask an agent to list for you" — fetches /api/directory, lists every registered agent (initials avatar, verified badge, "Agent · N available · block"), each with Call (tel:+) and WhatsApp (wa.me) buttons; WhatsApp message prefilled WITH the owner's identity: "Hi Marcus, I'm Ngathan Shimray (9856001101). I'd like to list my home on iShim but can't do it online — please list it for me and maintain it. Thank you!"; falls back to the iShim Agent Desk (+91 90000 00001) row when no agents are reachable; footer note explains agents confirm before anything goes live. Loading spinner via useCallback load() (react-hooks/set-state-in-effect compliant).
- Entry points (both roles OWNER only, agents never see it): (1) owner-dashboard "Can't list it yourself?" banner card (Handshake icon, explainer copy, "Ask an agent" button); (2) inside the Add/Edit listing form footer: "Can't fill this yourself? Ask an agent to list & maintain it for you →" — opens the dialog LAYERED over the form (portal order keeps it on top), Escape/cancel returns to the form.
- Browser-found + fixed 3 layout bugs: (a) mobile 390 agent row squeezed the name to zero width → rows now always stack (avatar+name+meta line, buttons row below); (b) at sm the inline row clipped the dialog — root cause: shadcn DialogContent is a CSS grid whose auto track sized to the row's min-content (460px > 448px max-w-md) → fixed with [&>*]:min-w-0 on the DialogContent (kids 398px, zero clip); (c) since the dialog width is capped at 448 regardless of viewport, the inline buttons row is always cramped → stacked layout at every width (matches the great 390 look).
- Browser verified (820 + 390): owner login → "Add a listing" shows Kitchen/Size/Width; ask-agent link in form opens layered dialog; dashboard banner button opens same dialog; wa.me href exact (wa.me/919856001103?text=Hi%20Marcus%20Chonsinrao%2C%20I'm%20Ngathan%20Shimray%20(9856001101)...), tel:+919856001103; studio edit prefills Separate kitchen / 480 / 22, Save changes persists (GET: SEPARATE|480|22); detail facts bar shows "1 Bedroom · 1 Bathroom · Separate kitchen · 480 sq ft · 22 ft wide" wrapping cleanly at 390 (no overflow, scrollW=390); zero page errors; dev.log clean; ESLint + tsc clean.

Stage Summary:
- Listings now capture kitchen arrangement (same room vs separate), built-up size and frontage width — optional fields so listing stays effortless — and show them on the property page. Owners who can't or won't fill the form get a one-tap hand-over: an "Ask an agent" dialog with every registered agent's Call/WhatsApp (prefilled intro carrying the owner's name + number), backed by the iShim Agent Desk — the agent then lists and maintains the home with the existing agent tooling (linked-agent edit rights, enquiries inbox, mark-rented).

---
Task ID: 26
Agent: Z.ai Code (main)
Task: User request — business model: "36 months free for everything except ₹1,000 for successful move-in (owner fee). After: (1) clients pay ₹249 to contact an owner or to list, (2) owners pay ₹699 per successful move-in. Start of the 36-month window set by admin. Charges for every agent help all set by admin god mode."

Work Log:
- Model encoded in AppSettings (Setting key/value rows — no schema migration needed): successFee (₹1,000 move-in fee DURING the window), freeModelStartAt (ISO, admin-set), freeModelMonths (36), standardClientFee (₹249, clients: per owner contact OR per listing), standardMoveInFee (₹699, owners per move-in), agentHelpFee (0 = free, always admin-set). Defaults: start 2025-01-01 → free until 2028-01-01.
- helpers.ts: settingInt() parser, extended readSettings/upsertSettings (scalar upsert loop), pricing helpers freeUntilDate() (start + months via setUTCMonth), pricingPhase() (FREE before freeUntil, STANDARD after), moveInFeeFor() (successFee during FREE / standardMoveInFee after), publicSettings() adds {phase, freeUntil, daysLeft}.
- GET /api/settings now returns the computed pricing snapshot (phase/freeUntil/daysLeft) publicly; PATCH (admin) validates + persists all new fields (freeModelStartAt must parse → ISO; freeModelMonths 1–240; fees ≥ 0). /api/admin/settings aliases automatically.
- Phase-aware money path: mark-rented and pay-fee now charge moveInFeeFor(settings) — curl-proven ₹1,000 during FREE, ₹699 after switching start to 2020-01-01 (phase STANDARD), restored. Validation verified: bad date → 400, negative fee → 400, non-admin PATCH → 403.
- Client: types.ts AppSettings extended + client moveInFeeFor() mirror (phase from server, fallback local computation); store View += "pricing"; page.tsx renders PricingView in the AnimatePresence chain.
- NEW pricing-view.tsx (footer "Pricing" pill → view): hero "36 months free. Everything."; phase status card (FREE: green "Launch offer active", "Free until 1 January 2028", "N days left" chip, started-date caption / STANDARD: "The 36-month free period has ended"); "Right now" tiles (FREE: browse/list/agent help Free + move-in ₹1,000 highlighted; STANDARD: contact ₹249, list ₹249, agent help, move-in ₹699 highlighted); plan cards "For clients ₹249 / For owners ₹699 / Agent help (admin-set, Free at 0)" with From-/Active-since chip; no-brokerage reassurance strip. View paints from store then ALWAYS re-fetches /api/settings on mount so a long-lived session never shows a stale phase (found via browser: stale STANDARD settings lingered after curl restore).
- Admin god mode: SettingsTab "Business model — 36 months free" card replaces the old single fee input — date input (free-period start), months, move-in fee during window, and an "After the free period" section (client contact/listing ₹, owner move-in ₹, agent help ₹); live phase badge ("Free · 479 days left") + preview sentence recompute from unsaved inputs; single "Save business model" PATCH. Browser-proven: prefilled from settings, save 499 persisted (GET confirms), revert to 0, toast, zero errors.
- Phase-aware copy: listing-form dialog note (FREE "Free to list — ₹1,000 only when rented." / STANDARD "Listing costs ₹249 per listing." — both branches seen live in browser), ask-agent-dialog (agentHelpFee-aware), move-in-dialog (dynamic fee), listings-list overdue-fee text (dynamic amount), help-widget + admin-content-tab labels, ads fallback slide, default-content.ts how/about/FAQ/terms/policy/business strings now describe the 36-month model with ₹1,000 launch / ₹699 after.
- Pre-existing bug found & fixed en route: GET /api/owner/move-ins included a nonexistent `tenant` relation (schema relation is `user`) — Prisma would reject the query at runtime; rewrote include to user+property and mapped to the same `tenant`/`property` response contract. tsc now fully clean for app source.
- Verified: lint + tsc clean; dev.log all 200s, zero errors; agent-browser (390/820/1440) — pricing view both phases pixel-checked (scrollWidth == clientWidth everywhere), footer pills row, admin settings save flow, listing form notes; screenshots in .shots/t26-*.

Stage Summary:
- The iShim business model is now live and admin-controlled: 36 everything-free months from an admin-set start date (only ₹1,000 owner move-in fee), then ₹249 per client contact/listing + ₹699 per owner move-in + an admin-set agent-help charge — every amount editable in god mode with a live preview, the public Pricing page (footer → "Pricing") always shows the current phase and upcoming fees, and the actual charged move-in fee flips automatically with the phase.

---
Task ID: 27
Agent: Z.ai Code (main)
Task: User request — "check everything, suggest what's missing, rate real market possibility, and 10,000s-of-customers capacity."

Work Log:
- Ran full codebase audit via Explore agent: 48 API routes, 83 components, ~23.4k LOC inventoried; auth/security, pagination, rate-limiting, payments, uploads, resilience all reviewed with file-level evidence.
- DB state confirmed via Prisma: 7 seed users (1 admin/1 agent/2 owners/3 clients), 10 properties (8 ACTIVE/2 RENTED), 76 HabitEvents, 47 Sessions, 2 Payments; business-model settings live (free until 2028-01-01, ₹1000/₹249/₹699).
- CRITICAL FIX: /api/upload did not exist — the listing photo picker, ad banner editor and CMS banner editor all 404'd (photo uploads broken app-wide). Built src/app/api/upload/route.ts: requireAuth, multipart `file` field, 8 MB cap, magic-byte sniffing (JPEG/PNG/WebP), sharp resize to ≤1600px JPEG q80 (EXIF-rotated) with fallback to original bytes, timestamp+random filename under public/uploads/, returns { url } per the existing client contract (lib/api.ts uploadImage).
- Verified upload end-to-end with curl (401 unauth, 400 fake-image, 200 real 2000x1500 PNG → 27.5KB resized JPEG served 200) and agent-browser (real File via DataTransfer → change event → chip appears in listing form, zero page errors). Test files cleaned up.
- Removed leftover scaffold src/app/api/route.ts ("Hello, world!").
- Scalability fix: Property model had ZERO indexes. Added @@index([status, createdAt], [status, rent], [block, status], [ownerId], [listedByAgentId]) + db:push (additive) — confirmed in sqlite_master.
- Restarted dev server; browser-verified home (zero errors), search results, property detail (photos/contact/ratings), pricing view ("36 months free. Everything.", FREE phase, freeUntil 2028-01-01). dev.log clean. ESLint clean; tsc: 0 errors in src/ (remaining errors are pre-existing examples//skills/ scaffolding, not app code).

Stage Summary:
- The app-wide photo-upload flow is FIXED and browser-proven (was 404 on every upload attempt). Property table now has the 5 hot-path indexes. Audit + market + scalability findings delivered to the user: blocking-before-launch list (real auth/OTP, demo-chip removal, real payment capture, pagination, rate limiting, error boundaries), market feasibility rating (~4/10 near-term TAM but strong no-competition wedge), and 10k-user capacity verdict (SQLite+current code OK to ~1-2k MAU; Postgres+object storage+pagination needed beyond).

---
Task ID: 28
Agent: Z.ai Code (main)
Task: User request — "(1) make the uploaded 404 poster the 404 error page, (2) fix rate limiting, (3) add Google sign-in → then ask phone no, name, address — no OTP system."

Work Log:
- 404 page: cropped the uploaded poster (1536x1024) to the top 730px (public/images/404-art.jpg) so the baked-in buttons/dim text are removed; new src/app/not-found.tsx (client) renders the art full-width on a near-black radial-gradient page with REAL accessible HTML below: "Looks like this page has moved out." + subtext + green "Go Home" (link /) and outline "Search Properties" (sessionStorage hand-off ishim.nav.search consumed in page.tsx boot → setView("search")). sr-only h1, min-h-11 touch targets, alt text on the art.
- Rate limiting: new src/lib/rate-limit.ts — in-memory fixed-window limiter keyed name:client-IP (x-forwarded-for aware), bucket pruning at 10k keys, guard() returns 429 + Retry-After with the standard {error} envelope. Wired into 6 hot/public write paths: POST /api/auth/login (15/min), properties/[id]/contact (30/min), enquiries (15/min), ratings POST (30/min), insights/track (240/min), upload (20/min) + the 4 new google routes (15-60/min). Curl-proven: 16 rapid logins → 400×15 then 429 on the 16th.
- Google OAuth (hand-rolled authorization-code flow, plugs into existing DB sessions — no NextAuth): schema User += email? (unique), googleSub? (unique), address?; new PendingGoogleUser model (token, sub, email, name, picture, TTL-pruned) — db:pushed. src/lib/google.ts: config check, publicOrigin() (x-forwarded-host aware), auth-url builder, code→profile exchange (server-side token call over TLS; email_verified enforced). Routes: GET /api/auth/google (state cookie + redirect; 501 with clear message when GOOGLE_CLIENT_ID/SECRET unset), /callback (state check; existing user by googleSub or email→link→session; banned→error cookie; new email→pending row + httpOnly ishim_gpending cookie; all failures→ishim_gerror cookie), /pending (sheet on mount: returns pending profile or OAuth error, consumes cookie, 204 when nothing), /complete (phone+name+address → creates CLIENT with whatsappNumber=phone, 409 on phone clash, session cookie), /status. sanitizeUser += email/address.
- Auth sheet: "Continue with Google" (official G svg) above an "or use phone" divider; google-profile step (avatar chip, Phone/Name-prefilled/Address required, "Create my account", escape hatch back to phone); startGoogle checks /status first → graceful toast when unconfigured (browser-proven); demo account chips now render ONLY in development (IS_DEV) — gone from production builds.
- Fixed a race found in browser: the authOpen effect reset gStep to "idle" in the same batch that the pending-signup effect opened the sheet → profile step was stomped; guarded with !gPending and clear google state in finish(). Also cleaned dead code in api.ts googleComplete.
- E2E-proven the post-OAuth half in the browser: seeded PendingGoogleUser row + set ishim_gpending cookie → reload → sheet auto-opened "One last step" with prefilled name → filled phone 9856777123 + address → "Create my account" → user created (email/googleSub/address persisted, role CLIENT, whatsappNumber=phone), pending row consumed, session cookie live (/api/auth/me returned the new user), duplicate-phone retry → 409 with "log in with your phone instead". Test user + pending rows cleaned up after.
- Mobile 390 404 page: scrollWidth 390 (no overflow), buttons stack full-width. Desktop 1280 verified visually. Lint clean; tsc 0 errors in src/; dev.log clean; / → 200, /missing → 404 (custom page).

Stage Summary:
- Unknown URLs now land on the branded iShim 404 with the lost-house poster and working Go Home / Search Properties actions (search hand-off opens the search view). All sensitive public endpoints are rate limited with 429+Retry-After. Google sign-in is fully implemented (OAuth start/callback/pending/complete/status) with account linking by email, profile completion asking phone+name+address (no OTP, per user), duplicate-phone protection, graceful behavior both when unconfigured (toast) and on failures (error cookies) — production-ready once GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars are added (redirect URI <origin>/api/auth/google/callback). Demo login chips no longer ship to production builds.

---
Task ID: 29
Agent: Z.ai Code (main)
Task: User request — "fix admin panel to a good phone and desktop convenient layout with a descretion of iShim and iShim Business panels god mod. and for agents too and owners. make it cool effects on changing footer homes and business"

Work Log:
- New src/components/ishim/vertical-switch.tsx — shared framer-motion segmented control: sliding gradient pill (layoutId + spring, emerald for Homes / amber-orange for iShim Business), icon pop-rotate micro-animation, optional live counts, sm/md/lg sizes. All four panel switchers (footer, admin, owner, agent) share it, so flipping verticals looks and feels identical everywhere.
- Footer rebuilt around the switcher: brand line and tagline crossfade (AnimatePresence) between "iShim / Find your home in Ukhrul." and "iShim Business / Find a shop, office or cafe in Ukhrul."; big lg-size switch under a "You are browsing" caption.
- page.tsx: ModeSweep — full-screen gradient wipe (emerald ⇄ amber, 130vw band, 0.75s expo sweep, keyed by mode so it replays every flip) + ModeGlow — fixed top ambient radial glow that crossfades emerald ↔ amber with the vertical. Footer wrapped z-10 above the glow.
- Admin API mode discretion: /api/admin/stats?mode= (property counts, revenue, payments, clicks, fee-due all scoped via property.mode; users stay global), /api/admin/properties?status=&mode=, /api/admin/payments?mode= (property select now returns mode), /api/my/enquiries now returns property.mode (mapper was dropping it — found live in browser) + fixed its "[my/enquiries]" log typo. All validated: bad mode → 400.
- api.ts client: getStats(mode), getProperties(status, mode), getPayments(mode). types.ts: MyEnquiry.property.mode, Payment.property.mode.
- AdminDashboard redesigned: gradient God-mode header (badge + admin chip, title/subtitle crossfade "iShim control centre" ↔ "iShim Business control centre", emerald/amber wash follows the panel); sticky panel switcher bar (top-14 mobile with blur + border, rounded card on desktop) showing per-vertical listing counts — reachable anywhere on the long page; tabs are a 3-col grid on phones and a pill row on sm+; Overview/Approvals/Properties/Financials/Settings all take mode and refetch per panel, each content remounts with a soft rise-in keyed by mode. Settings split into: shared "Free window" card + "iShim — Homes pricing" and "iShim Business pricing" cards with ring highlight + "Active panel" badge on the live one, single "Save pricing" (applies both verticals) with the full preview sentence.
- OwnerDashboard: panel-discretion header card ("iShim ⇄ iShim Business — Owner dashboard") with count-bearing switcher; stats cards now per-panel (Panel views / WhatsApp clicks / Active homes-spaces); listings + EnquiriesInbox filtered by the active panel; "Add Home"/"Add Business" labels; removed dead move-ins fetch (loaded, never rendered) and unused imports.
- AgentDashboard: same discretion header ("iShim — Agent CRM" with counts 1 listing/0 listings); listings fetch lifted into the shell (one source for counts + ListingsTab props); Listings, Matchmaking (client-side mode filter on matches + "Find spaces/homes for client" wording) and Enquiries all panel-scoped; Pipeline/Owners stay shared; mobile grid tabs.
- EnquiriesInbox accepts optional mode prop (filters by e.property.mode with HOME fallback); ListingsList empty state now vertical-aware ("No business listings yet — add your first shop, office or cafe…").
- Browser-proven (agent-browser): 390px footer sweep both directions + localStorage persistence; admin god mode at 390 (grid tabs, sticky switcher, per-panel overview 10 vs 5, approvals empty state, settings panels with Active-panel badge) and 1440; owner dashboard business→homes flip (enquiries reappear only under Homes — needed the my/enquiries mapper fix); agent CRM business listings empty state + "Add Business" opens the form pre-set to Business with the ₹1,500 business fee note; matchmaking shows "No business matches right now" with "Find spaces for client". No console/page errors; scrollWidth==clientWidth at 390; curl-verified stats/payments mode scoping (HOME 10 props ₹2,000 rev, BUSINESS 5 props) and 400 on bad mode.

Stage Summary:
- God mode is now two clean panels — iShim and iShim Business — with mode-scoped stats, approvals, listings, financials and pricing (highlighted per panel, one save for both). Owners and agents get the same two-panel discretion in their (unchanged, shared) dashboards with live counts, and the footer Homes ⇄ Business flip got the full effects package: spring sliding pill with per-vertical gradient glow, brand crossfade, full-screen color sweep and ambient page glow. Everything is phone-first (grid tabs, sticky switcher, 44px targets) and desktop-polished; lint + tsc clean, dev.log clean.

---
Task ID: 30
Agent: Z.ai Code (main)
Task: User request — "turn this into a google like search bar engine to search about everything on ishim for ishim both in homes and business"

Work Log:
- NEW /api/search/suggest (public, rate-limited 120/min/IP with Retry-After): the universal engine — one endpoint searching EVERYTHING on iShim across both verticals. Groups: PLACES (admin blocks + live-listing blocks, counts scoped), LISTINGS (strong pass on title/block first, then weak pass on description/amenities/houseType, deduped, featured+views ranked, photo+mode+rent per row), PEOPLE (owners & agents by name, live listing counts via ownerId OR listedByAgentId so agent-listed homes count for the agent), TYPES (house types + business types with live counts per vertical), PAGES (11 curated entries with keyword matching and machine-readable actions: List your property, Pricing, Directory, How it works, About, iShim Business, Contact, FAQ, Saved, Privacy, Terms). Param q (1..60 chars) + scope=ALL|HOME|BUSINESS; five parallel Prisma queries.
- /api/properties GET: q now also matches houseType and amenities (JSON string contains) — "parking" finds listings with the Parking amenity; curl-proven.
- Client contract: types.ts += SearchScope ("" | HOME | BUSINESS), SearchFiltersView.scope, SCOPE_LABELS, SuggestItem/SuggestGroups/SuggestResponse/SuggestAction; api.ts publicApi.searchSuggest; store += omniOpen/setOmniOpen (global overlay), directoryQuery/setDirectoryQuery (person→directory deep-link), EMPTY_FILTERS.scope.
- NEW omni-search.tsx: Google-style OmniSearchPanel (3 variants: hero on the home glass card, page on the search view, overlay) + OmniSearchOverlay (centered card over blurred backdrop, body scroll lock, document-level Escape, autofocus) + OmniSearchTrigger (desktop navbar pill with ⌘K kbd hint). Features: debounced (160ms) abortable live suggestions, Google-style bold match highlighting, grouped sections with icons/photo thumbs/initials avatars/verified badges, Home/Business chips on listing rows, scope tabs Everything·Homes·Business (under the bar on mobile, inside the pill on desktop — controlled from the search view so chips stay in sync), Recent searches (localStorage ishim_recent_searches, per-row remove + Clear, read-persist-set pattern after finding the updater-side-effect+unmount bug), Trending places (busiest blocks, live counts), Jump-to quick links, full keyboard navigation (↑↓ across a flattened list incl. the "See all results" row, Enter activates, scrollIntoView), Escape (clears → closes → overlay closes), ARIA combobox/listbox/option semantics.
- Integrations: hero replaces the old block-select+button form ("Search everything on iShim…"); search view uses the page-variant omnibox keyed by filters.q with initialQuery hand-off; desktop navbar swaps the search icon for the Google pill; page.tsx mounts the overlay + global hotkeys (⌘K/Ctrl+K anywhere, "/" outside fields); directory view consumes directoryQuery (prefilled name search) once on mount.
- Search view rework for the universal engine: scope "" = Everything (both verticals) is the new default — API calls drop the mode filter, results mix homes & business with showMode chips on cards, headings ("Results for "q"", "Everything on iShim", "Everything in {block}"), counts in "results"; explicit q always lists matches (For-you personalization only when no query); segment auto-switches to Everything when arriving with a query; type chips cover both verticals in Everything scope (clicking a business type scopes to Business); advanced type select uses grouped Homes/Business labels; bedroom chips/select hidden in Business scope.
- PropertyCard += showMode prop (amber Business / emerald Home chip top-left next to Featured).
- Browser-found + fixed bugs: (a) For-you segment ignored the query (recommendations shown for "cafe") → q now always fetches listing matches; (b) recents never persisted (side-effect inside a state updater dropped when the panel unmounted on selection) → read-persist-set; (c) overlay Escape dead when focus outside (autoFocus prop was never wired) → input autoFocus + document-level Escape listener; (d) people counts missed agent-listed homes → listedByAgentId OR-branch; (e) hero placeholder truncated awkwardly at md widths → shortened.
- Verified by curl: "dun"→Dungrei place+cottage listing, "cafe"→Cafe type(1)+BUSINESS listing+iShim Business page, "marcus"→Agent·Verified·1 live listing·TNL Ward, "shop"+scope=HOME→home-only results, "parking"→3 amenity matches, "price"→Pricing page action, 429+Retry-After at the 121st request in a minute.
- Verified in agent-browser (1440 + 390): hero dropdown groups with bold highlighting; listing click→detail; person click→directory prefilled to Marcus with his card + WhatsApp/call links; place click→"Everything in Phungwamee"; Ctrl+K and "/" open the overlay, autofocus, Escape closes; ArrowDown×2+Enter keyboard-selects the cottage; Enter submit→"Results for "cafe"" with segment auto-switch, recents persisted ([\"cafe\"]) and re-shown; Business scope chip→business-only results; mobile hero chips row + bottom-nav search view + recents/trending/jump-to dropdown; scrollWidth==clientWidth at 390 and 1440; business-mode hero switch intact; zero console/page errors; dev.log clean; ESLint + tsc clean.

Stage Summary:
- iShim now has a real search engine: one Google-style omnibox (hero + search page + ⌘K overlay + navbar pill) that searches everything — homes, business spaces, places, owners & agents, listing types and site pages — across both verticals by default, with an Everything/Homes/Business scope toggle, live grouped suggestions with counts and photos, recent searches, trending places, keyboard navigation and full-screen results with Home/Business badges on mixed listings. Public API /api/search/suggest is rate-limited; the main listing search now also matches amenities and types.

---
Task ID: 31
Agent: Z.ai Code (main)
Task: User clarification — "when i say search engine i mean for everything like, names, nearest, available, owners agents etc" — extend the universal search to truly cover people (names/phones), proximity ("nearest"), availability, and role browsing.

Work Log:
- NEW src/lib/query-parse.ts (isomorphic natural-language parser): extracts price ranges ("5000-8000", "5000 to 8000"), ceilings ("under/below/less than/up to/within 5000", "5k", "₹5,000"), floors ("above/over/more than"), bare prices ("₹4000", "around 4000"), bedrooms ("2 bhk", "3 bedrooms"), availability words ("available", "vacant", "ready to move", "immediately") and proximity ("near/nearby/close to <block>"). Returns leftover keyword tokens + human-readable parts (["Under ₹5,000","2 BHK","Available now"]) via describeParsed. Never throws; used by BOTH the suggest API and the client so behaviour can't drift.
- NEW src/lib/blocks-near.ts: Ukhrul-town block proximity map (10 canonical wards, nearest-first) + findBlock (case-insensitive resolution) + nearestBlocks (falls back to settings order for admin-added custom blocks). Powers all "nearest" features.
- /api/search/suggest upgraded: parses q first, then keyword-groups run on the leftover tokens only. New groups: NEARBY ("Near Dungrei — N live listings in Dungrei & the nearest wards", counting anchor + 3 closest wards) and FILTERS (the parsed query as one tappable row with a live count, e.g. "Under ₹5,000 · 2 BHK+ · Available now — 2 live listings match"; pure-filter queries also preview the 3 cheapest matching listings ordered by rent asc). PEOPLE now matches by name OR phone digits (4+ digit run) OR role keywords ("owners"/"agents"/"landlords" browse top directory people, agents-only for "agents"); rows show phone + live counts. LISTINGS match owner/agent identity too — typing "ngathan" or a phone surfaces that person's/agent's listings with "· by <name>" subtitles (agent names resolved separately since listedByAgentId is a bare FK). PLACES rows carry near[] (3 closest wards) for the UI.
- /api/properties GET upgraded: parseQuery applied server-side too (raw API callers get engine behaviour); owner/agent names are searchable (resolved users OR-ed into the where as ownerId/listedByAgentId in); new near=1 param expands a block filter to the anchor + 3 nearest wards (Prisma block in [...]).
- Client: PropertyFilters.near + publicApi.getProperties serializes near=1; SearchFiltersView.near + EMPTY_FILTERS.near=false; store untouched otherwise.
- omni-search.tsx: flattenGroups now places→nearby→filters→listings→people→types→pages; NEARBY rows (Navigation icon) activate proximity search (block + near:true), FILTER rows (SlidersHorizontal icon) apply parsed min/max/beds as real filters; runQuery parses the query client-side so Enter/"See all results" also turns "2 bhk under 8000 near Dungrei" into real filters (near resolved against store settings blocks); "See all results" row shows the engine interpretation line ("Under ₹8,000 · 2 BHK+"); PLACE/TYPE activations reset stale filters (incl. near); empty-state copy now suggests near/budget/phone examples.
- search-view.tsx: near flows to the API (base.near + filterKey); headings near-aware ("Homes near Dungrei" / "Everything near …" when segment=all); new "Nearby wards" toggle chip appears in the places row whenever a block is selected; NEW "Nearby · <ward1> · <ward2>" strip under the results (3 cards from the 2 closest wards, hidden in proximity mode and during loading/error) so a narrow block never dead-ends.
- Verified by curl: "under 5000"→3 cheapest + filter row (3 live), "near dungrei"→NEARBY row (5 live incl. wards), "available"→"Available now · 12 live", "9856"→Ngathan/Ringkahao/Marcus with phones, "ngathan"→person + 6 listings "by Ngathan Shimray", "agents"→Marcus; /api/properties "2 bhk under 8000"→2 correct rows, block=Dungrei&near=1→5 rows across 4 wards vs 1 without, q=ngathan→7 rows (owner name private on cards by contract, match still works).
- Verified in agent-browser (desktop 1440 + mobile 390): "under 5000" dropdown shows the Smart-filter row + interpretation subtitle, activating it → results page with 4 ≤₹5,000 listings; "near dungrei" → "Near Dungrei — 5 live listings" row → proximity results with the "Nearby wards" chip present; "ngathan" → listings with "by Ngathan Shimray" chips + People row → directory prefilled to Ngathan's profile with WhatsApp/call links; full phone 9856001103 in the ⌘K overlay → Marcus + his listing; combined "2 bhk under 8000 available" → one Smart filter row ("2 live listings match") → 2 correct results; "cafe" on mobile → listing (Business chip) + Cafe type row + iShim Business page row, activating the type switched the site into Business mode (footer radio checked, "Business spaces in Ukhrul"); 11 screenshots in .shots/t31-*; zero console/page errors; all suggest calls 200 in dev.log (the one logged PrismaClientValidationError predates the rewrite and no longer reproduces); ESLint + tsc clean.

---
Task ID: 32
Agent: Z.ai Code (main)
Task: User request — "now check for any unfinished and finished and ready for launch in 4 days" — full launch-readiness audit.

Work Log:
- Health: dev server up on 3000 (200 on /), ESLint clean, tsc 0 errors in src/, dev.log all 200s with zero runtime errors.
- DB via Prisma: 7 users (1 admin / 1 agent / 2 owners / 3 clients), 15 properties (8 HOME-ACTIVE, 2 HOME-RENTED, 4 BUSINESS-ACTIVE, 1 BUSINESS-PENDING), 10 enquiries, 2 payments, 57 sessions, 0 pending Google signups.
- API smoke via curl: /api/settings returns full dual-vertical pricing (free window + business fees), /api/properties returns listings, /api/search/suggest "near dungrei" returns NEARBY group (5 live), /missing-page-test → 404 custom page.
- Browser E2E (agent-browser, zero console/page errors): home renders both verticals; omnibox NL query "under 5000" → smart-filter row + 3 matching listings; Enter → results "4 results · homes & business"; property detail (title/availability/WhatsApp/amenities/reviews); footer Homes→Business flip re-skins hero + featured spaces; auth sheet shows "Continue with Google" + phone; admin god mode ("iShim control centre" ⇄ "iShim Business control centre", 9 tabs); owner dashboard ("iShim Business — Owner dashboard", panel switcher Homes 6 / Business 3, verified badge, enquiries empty state); scrollWidth==clientWidth at 390 and 1440. Screenshots .shots/audit-owner-mobile.png, audit-home-desktop.png.
- Investigated one false alarm: after raw-fetch logins the UI showed the admin panel while /api/auth/me said OWNER — root cause was the localStorage X-Session-Token mirror overriding the cookie (testing artifact, unreachable via real UI flows); after clearing the mirror the navbar correctly shows "Dashboard" for the owner and role guards hold.
- Production gaps confirmed: payment-dialog still "Simulate payment success" (no real gateway); /api/properties has take:20 with NO skip/cursor pagination (listings beyond 20 silently hidden once inventory grows); no error.tsx/global-error.tsx boundary; .env contains only DATABASE_URL (GOOGLE_CLIENT_ID/SECRET unset — Google sign-in degrades gracefully with a toast until configured); payments/admin rely on simulated flows; sessions have no expiry.

Stage Summary:
- Everything shipped through Task 31 re-verified working end-to-end today (search engine, business mode, god-mode panels, auth, uploads, 404, rate limiting, pricing). Remaining pre-launch work: pagination (real blocker once >20 listings), branded error boundary, real payment capture or explicit "pay on move-in" launch policy, Google OAuth env vars, deploy pipeline (never yet run a production build), and demo-data cleanup decision.

---
Task ID: 33
Agent: Z.ai Code (main)
Task: Day 1 of the 4-day launch plan — pagination everywhere + branded error boundary.

Work Log:
- Pagination contract: /api/properties GET now takes skip (default 0) + limit (default 24, clamped 1..60) and returns an envelope { items, total, hasMore } with the total from a parallel Prisma count; /api/admin/properties GET takes the same params (default limit 50, clamp 1..100) and returns the same envelope. Both verified by curl: default page (12/12/no-more), limit=3&skip=3 (3 of 12, more), near+block combo (2 of 5), limit=0 clamped to 1, admin with token (4 of 15, more).
- Client contract: types.ts += PropertyPage + skip/limit on PropertyFilters; api.ts publicApi.getProperties → PropertyPage (serializes skip/limit), adminApi.getProperties(status, mode, skip=0, limit?).
- Search view: results state now carries total/hasMore/loadingMore; loadMore() fetches the next offset page with the same active filters and appends id-deduped; "Load more listings" button (min-h-11, rounded-full, spinner while loading) + "Showing X of Y" caption under the grid; exhausted state shows "That's every listing — N matches on iShim."; heading count now reads "5 of 12 results · homes & business" whenever more pages remain (fixed en route: count used to show the raw total while the grid held fewer cards); For-you fallback and the Nearby-wards strip updated to .items (strip fetches limit:3 per ward).
- Admin: ApprovalsTab queue fetches envelope .items with limit 100 (pending volume cap); PropertiesTab gained total/hasMore/loadingMore + loadMore() (append, dedup) and a footer row "Showing X of Y" + "Load more" button under the scrollable list. home-view featured uses .items.
- Branded error boundaries: src/app/error.tsx (client) — card on the page background with amber warning tile, "Something went wrong", recovery copy, optional monospace digest line, "Try again" (reset) + "Go Home" (link), min-h-11 targets; src/app/global-error.tsx — self-contained <html>/<body> with inline styles matching the 404 palette (dark radial gradient, #17603e accent, ⌂ glyph, iShim · Find · Rent · Belong footer) for root-layout failures.
- Tooling note: discovered the Bash/rg tool output display silently swallows "[m" sequences (file content was always correct — verified with od -c); switched to python-scripted edits for exact-match safety.
- Browser-proven (agent-browser): with a temporary default page size of 5, search view showed "5 of 12 results · homes & business" + Load more; click → "10 of 12", click → "12 results" with the every-listing note (screenshots d1-pagination-end.png); error boundary exercised by a temporary unconditional throw in HomeView — branded card rendered, Try again re-entered the boundary, Go Home navigated, screenshot d1-error-boundary.png (the injected throw's console line confirms it was handled by the error boundary); after cleanup home renders clean, 390px has no overflow (d1-home-mobile-final.png). Admin-tab Load more button itself not browser-clicked (15 listings < default 50 page size) — its API path is curl-proven and the logic mirrors the browser-verified search-view flow.
- Cleanup: test throw removed from home-view, default page size restored to 24, ESLint + tsc clean, /api/properties back to 12/12/no-more.

Stage Summary:
- Day 1 complete: iShim now paginates the public search and the admin properties tab with a real total and Load-more (no silent 20/50-item caps as inventory grows), and any render/data crash lands on a branded, on-brand recovery page instead of the raw Next.js error screen — both flows browser-verified. Remaining launch items (Day 2-4): real payment capture or explicit pay-on-move-in policy, Google OAuth env vars, production build/deploy, demo-data cleanup.

---
Task ID: 34
Agent: Z.ai Code (main)
Task: Day 2 of the 4-day launch plan — real UPI payments via Cashfree (cashfree.com), replacing the simulated payment button.

Work Log:
- Schema: new PaymentIntent model (propertyId, payerId, amount snapshot, kind, cfOrderId unique, status PENDING|PAID|FAILED|EXPIRED, cfPaymentId, paidAt) + relations on Property/User; db:pushed (additive).
- src/lib/cashfree.ts: server-side gateway client — env-driven config (CASHFREE_APP_ID/SECRET_KEY/API_BASE default https://api.cashfree.com/API_VERSION 2025-01-01/MODE sandbox|production/WEBHOOK_SECRET), cashfreeConfigured(), createCashfreeOrder() (order_id, INR amount, customer_details with phone-fallback email `${phone}@phone.ishim.in`, return_url), getCashfreeOrder(), getCashfreeOrderPayments(), verifyCashfreeWebhook() (constant-time HMAC-SHA256/base64).
- Routes (all rate-limited): POST /api/payments/cashfree/order (requireAuth + canManageProperty + feePaid/feeWaived guards; fee computed SERVER-SIDE from settings via moveInFeeFor — client amount never trusted; creates/mints cfOrderId + PaymentIntent; 501 CASHFREE_UNCONFIGURED when creds missing; resume logic: existing PENDING intent → GET gateway → ACTIVE returns same session, PAID fulfills immediately and returns {paid:true}, EXPIRED/unknown retires intent and mints a fresh order — fixes the duplicate-order_id bug Cashfree would reject); GET /api/payments/cashfree/status (payer-or-admin; polls gateway and fulfills); POST /api/payments/cashfree/webhook (public, HMAC-verified, ignores non-paid events, re-verifies order with the gateway before fulfilling — defense in depth).
- _lib/fulfill.ts: idempotent fulfillment — gateway-verified PAID → atomic property.updateMany({feePaid:false→RENTED/feePaid/feeAmount/rentedAt}) claim so webhook+poll+status races can never double-charge; one Payment row on claim, intent reconciled otherwise.
- Client: paymentsApi in api.ts (createOrder/status); payment-dialog.tsx rewritten — "Pay via UPI" primary → lazily loads the official SDK (sdk.cashfree.com/js/v3) → cashfree.checkout modal (_modal redirect target) → status polling every 2.5s (up to ~2min) → PAID closes with success toast + onPaid; handles {paid:true} shortcut; 501 → graceful "payments coming very soon / team can confirm manually" state with the simulate button only in dev builds; removed the fake QR + fake "ishim@upi" ID; page.tsx boot consumes the ?cfPaid= return param (strips it, calls status → fulfillment + toast + bumpListings) for UPI-app redirect flows.
- tsconfig: mini-services + examples excluded from app tsc scope.
- E2E against a mock Cashfree PG (mini-services/cashfree-mock on :3030 — /pg/orders, /pg/orders/:id, /payments, /__test/paid flip, /__test/reset): with test env, browser "Pay via UPI" created a real order (mock logged ₹499 iShim success fee — server-computed), official SDK modal opened; flipping the mock to PAID + status → PAID with property RENTED/feePaid (DB: 1 PaymentIntent PAID with gateway payment id + exactly 1 ₹499 UPI Payment row). Webhook: wrong signature → 401; valid signature while gateway says ACTIVE → 200 {status:PENDING} (payload NOT trusted — verified against gateway); after gateway PAID → fulfilled; webhook replay → still exactly 1 payment row (idempotent). Return-URL boot handler: /?cfPaid=<paid-at-gateway order> → param stripped, fulfillment ran, property RENTED. Verified unconfigured state: 501 + browser dialog shows "Online payments are coming very soon…", simulate visible only in dev.
- Cleanup: mock service stopped; demo DB restored (3 test ₹499 payments + intents removed, 3 properties back to ACTIVE/unpaid → 3 payments remain as before); dev server restarted clean WITHOUT Cashfree env (501 graceful path is the production-correct state until real creds are added); turbopack .next cache panic fixed by full restart with cache wipe; ESLint + tsc clean; /api/properties 12/12 healthy.

Stage Summary:
- iShim now has a real, launch-ready UPI payment path (Cashfree PG): server-authoritative phase-based amounts, hosted checkout with UPI intent + cards, three converging fulfillment channels (checkout poll, signed webhook, return-URL), atomic idempotent claiming, and a graceful not-configured state. To go live the operator only sets CASHFREE_APP_ID, CASHFREE_SECRET_KEY (+ optional CASHFREE_MODE=production, CASHFREE_WEBHOOK_SECRET) and points the Cashfree dashboard webhook at /api/payments/cashfree/webhook. Day 3 remains: production build/deploy, Google OAuth env vars, real listing seed data.

---
Task ID: 35
Agent: Z.ai Code (main)
Task: Day 3 of the 4-day launch plan — production build verification, deploy pipeline, env template, pre-launch tooling, and go-live hardening.

Work Log:
- Session start: verified Task 34 (Day 2 Cashfree) fully intact — all payment files present (src/lib/cashfree.ts, api/payments/cashfree/{order,status,webhook}/route.ts, _lib/fulfill.ts), PaymentIntent schema pushed, dev server healthy, src/ tsc-clean, ESLint clean.
- Production hardening: src/lib/auth.ts withSession() now sets `secure: true` on the session cookie when NODE_ENV=production (dev unaffected — verified Secure flag appears in prod smoke test, absent in dev).
- next.config.ts: added `distDir: process.env.NEXT_DIST_DIR || ".next"` so production builds can target an isolated dir and never clobber the running dev server's Turbopack cache.
- Production build verification: `NEXT_DIST_DIR=.next-prod bunx next build` compiled clean — `/` prerendered static, all 40+ API routes dynamic, standalone bundle produced (server.js + node_modules). Then mirrored the real deploy steps: copied static/ + public/ into the bundle, booted it on a throwaway port with real DATABASE_URL, and smoke-tested: home 200, /api/properties real envelope data, /api/settings pricing JSON, phone login issued token, POST /api/payments/cashfree/order correctly returned 501 CASHFREE_UNCONFIGURED, Set-Cookie showed Secure+HttpOnly+SameSite=lax. Cleaned up (server killed, .next-prod deleted, dev server re-verified 200).
- .env.example: full annotated launch template — DATABASE_URL, CASHFREE_APP_ID/SECRET_KEY/MODE/WEBHOOK_SECRET (+optional API_BASE/API_VERSION), GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI, NODE_ENV/PORT; documents each pair's graceful-degradation behavior when missing.
- DEPLOY.md runbook: what ships, server requirements, one-time setup (install → env → db:push → seed → build → start), env table with per-var effects, Cashfree webhook dashboard steps (endpoint /api/payments/cashfree/webhook, HMAC secret, re-verify-against-gateway + idempotent-claim guarantees), Google OAuth console steps with exact redirect URI, go-live data checklist, copy-paste systemd unit + Caddyfile (auto-TLS), update procedure, health probes (/api/settings, /api/properties?limit=1), DB backup + rollback via kept .next builds, accepted v1 limitations.
- scripts/prelaunch.ts + `bun run prelaunch`: go-live report with PASS/WARN/FAIL lines — env presence (never secret values), Cashfree mode check (warns if sandbox at go-live), Google OAuth, ADMIN presence, listing counts (active/pending), stale PENDING payment intents, demo-residue detection (seed admin phone, Dev Program test user, pending Google staging rows), settings keys sanity; exit code 1 on FAIL. Run against dev DB: 0 fail · 4 warn (all expected pre-launch states). Fixed print bug (payments count) and lint ternary warnings.
- package.json: added `prelaunch` script.
- Seed data audit: prisma/seed.ts is already launch-quality — real Ukhrul ward names, Manipuri names, local /images/prop-*.jpg photos all exist in public/images, no external/placeholder URLs; only residue is the Dev Program test user (created during testing, not in seed) — flagged by prelaunch for the operator.
- Browser self-verification (agent-browser): desktop home renders clean (hero/omnibox/featured, zero console errors); 390px mobile no horizontal overflow with bottom tab bar; UI login as owner works; Mark as Rented → Success fee dialog (₹499 server-computed) opens; "Pay via UPI" in unconfigured state shows the graceful toast + "coming very soon" dialog fallback (Day 2 regression PASS after auth/config changes); Re-list restored the test property (re-verified ACTIVE via API, total back to 12); logged out; dev.log clean.

Stage Summary:
- Day 3 complete: the production build is proven (compile + standalone smoke test incl. auth/payments/cookie behavior), deployment is documented to the copy-paste level (DEPLOY.md with systemd + Caddy + Cashfree webhook + Google OAuth), the environment contract is codified (.env.example), and `bun run prelaunch` gives the operator a one-command go-live report. Nothing app-facing changed visually; the only behavior change is the Secure cookie in production. Day 4 remains: point DNS/domain, set real env vars (Cashfree, Google, admin phone), wipe-or-keep demo data decision, and full regression on the live URL.

---
Task ID: 36
Agent: Z.ai Code (main)
Task: Day 4 of the 4-day launch plan — full launch regression across all four roles, fixes, cleanup, and the re-runnable go-live checklist.

Work Log:
- Baseline gates: server healthy, ESLint clean, src/ tsc-clean, prelaunch 0 FAIL.
- Guest regression (browser, desktop 1280×900): home (hero/omnibox/carousel/featured/10-ward browse) ✓; search "house" → "5 results · homes & business", ward+text filters compose correctly (verified 0-result case is legitimate, not a bug), rent chips narrow, clear resets ✓; Business mode → business-only quick filters + "spaces" wording ✓; listing detail (gallery counter/arrows/dots, price/deposit, amenities, Owner/Agent contact tabs, views) ✓; branded 404 ✓. Empty-state "empty paragraphs" in one snapshot turned out to be an agent-browser a11y quirk — DOM text confirmed correct (no bug).
- REAL BUG FOUND & FIXED: desktop nav had NO sign-in entry for logged-out visitors (button only rendered when user exists; mobile had the Profile tab but desktop had nothing). nav-bar.tsx now renders a "Sign in" ghost button (→ profile view) when logged out; browser-verified it appears and routes to the sign-in sheet.
- Client regression: login, save home (toast + button flip + Saved homes list), Book a visit (Radix Select needed click-to-pick; native date input needed native value setter + input event — form then submits) → enquiry (VISIT kind, correct date/slot/message) verified in DB AND in the owner's dashboard inbox; enquiry status New→Visit scheduled persisted (API: status SCHEDULED) ✓; logout ✓.
- Owner regression: manual typed phone login (9856001102) ✓; enquiries inbox with status dropdown ✓; Add Home form → full listing submission → status PENDING (API-verified) ✓.
- Admin regression: Approvals queue listed 2 PENDING → Approve went live instantly (public total 12→13) ✓; Users (roles/ban/verified) ✓; Properties (status dropdown, Feature) ✓; Financials (Revenue ₹2,000 + UPI rows; earlier "empty panel" was a selector artifact — active panel had data) ✓; Ads ✓; Content (8 pages) ✓; Settings (free window, per-vertical pricing) ✓.
- Mobile pass (390×844): home/detail render, no horizontal overflow, bottom tab bar, footer flush at page end (footerBottom == scrollHeight on long pages; every view exceeds one viewport so the short-page case cannot occur with seeded content) ✓. Console: zero page errors; only benign Radix controlled/uncontrolled dev warnings.
- Cleanup (scripted, verified): deleted the regression test listing + its enquiries/saves, deleted the test VISIT enquiry + saved-home row, deleted regression sessions; FIXED leftover Day-3 residue — "Phungyo 2BHK near SH-2 (rented)" had been flipped to PENDING by the Day-3 Re-list click (it hit the first Re-list button, not the property under test) — restored to RENTED. Final DB: 15 properties (12 ACTIVE / 3 RENTED / 0 PENDING), 2 saved homes, 3 payments, 0 intents, 7 users — exact demo baseline. Temp script removed.
- LAUNCH-CHECKLIST.md written: re-runnable go-live regression (curl one-liners for the live URL + per-role browser passes + cross-cutting checks + pre-announce list), annotated with Day-4 findings (sign-in fix, Radix/date-input test notes).
- Final gates re-run after all changes: ESLint clean, tsc clean, /api/properties healthy (12 active).

Stage Summary:
- Day 4 complete: the entire launch regression passed end-to-end in the pre-launch environment — guest search/detail/404, client save+visit-booking (verified through to the owner's inbox), owner listing submission (verified through to the admin approval), admin approvals/financials/settings, mobile layout, footer, and console cleanliness. One real UX bug was found and fixed (desktop sign-in entry), one hidden Day-3 data residue was found and corrected, and all regression residue was removed. The only remaining launch blockers are operator-side: real Cashfree + Google env vars, real admin phone, demo-data decision, DNS/domain, then re-run LAUNCH-CHECKLIST.md on the live URL. iShim is launch-ready.

---
Task ID: 37
Agent: Z.ai Code (main)
Task: User request — "admin, agent panel sucks for mobile" + impersonation expansion (admin → anyone; agents → any owner/client) + full lead/message visibility for admin and agents.

Work Log:
- Impersonation backend: POST /api/auth/impersonate now allows ADMIN (any target) and AGENT (OWNER/CLIENT targets only; ADMIN/AGENT targets refused; self- and banned-target refused). POST /api/auth/restore accepts ADMIN **and** AGENT original sessions so agents can exit too.
- Lead visibility: GET /api/my/enquiries for AGENT now returns enquiries routed to them OR on any listing they listed (property.listedByAgentId) — the agent sees the full client ↔ owner activity across their portfolio (verified: agent inbox went from only self-handled rows to all 8 enquiries on the agent-listed Corner RCC duplex).
- New GET /api/admin/enquiries (ADMIN): every platform lead with property + owner + handler + requester attached; filters status/kind/mode/q; envelope {items,total,hasMore} with skip/limit (default 50, clamp 1..100).
- New GET /api/agent/users?q= (AGENT/ADMIN): finds OWNER/CLIENT accounts by name/phone (max 10, banned excluded) for the agent "log in as" flow.
- Shared client helper src/lib/impersonate.ts (impersonateUser) used by both panels — stores the restore token in sessionStorage (ishim_admin_token), flips the session header + cookie, sets store user + home view; pill exits via /api/auth/restore.
- Admin dashboard: NEW Leads tab (2nd position) — search + 3 horizontally-scrollable filter chip rows (vertical / status / kind), lead cards with photo, status/kind/visit-slot badges, requester ("Tenant on iShim" role badge), message, handler line (name + role + agent-listed marker), Call/WhatsApp actions, admin status control (PATCH /api/enquiries/[id] already allows admin), Load-more pagination. UsersTab impersonate rewritten onto the shared helper (authApi import dropped).
- Mobile-first polish (both dashboards): TabsList is now a single-row horizontal scroll pill strip on mobile (was a 3×3 grid); admin Users rows use a 2-col action grid on mobile (role select full-width, Verify/Ban side-by-side, Impersonate full row); Properties rows likewise (status select full-width, feature/waive in grid); Approvals actions stacked full-width; all touch targets bumped to min-h-10/44px-ish; Agent tabs same treatment.
- Agent dashboard Owners tab: "Log in as" button on every linked-owner card + a "Help any owner or client" account search (debounced, min 2 chars) listing OWNER/CLIENT matches with role + phone; fixed a react-hooks/set-state-in-effect lint error by moving the reset inside the debounce callback.
- Browser verification: admin Leads tab shows all 10 leads with working filters (kind=VISIT → 4) and status update (verified via API, then reverted); admin impersonation regression-passed (Users tab → acting as client, pill visible); agent account search found CLIENT Grace and "Log in as" entered her account (pill + nav flip verified), exit restored the agent session; agent inbox API shows all 8 portfolio enquiries; mobile 390px passes for admin (tabs/leads/users) and agent (owners) with zero horizontal overflow. Screenshots in .shots/d4b-*.png.
- Cleanup: demo enquiry status reverted to NEW, 5 test sessions deleted, property count intact (15). ESLint + tsc clean.

Stage Summary:
- Panels are now mobile-first (scrollable tab strips, grid actions, 44px targets, no overflow at 390px), admin has god-view over every lead/message/visit on the platform plus one-tap entry into any account, and agents can see every lead on the listings they manage and can enter any owner's or client's account to help them (safely scoped: never admin/agent accounts, banned targets refused, one-tap exit pill). Note for the operator: agent impersonation is powerful by design — vetted agents only; consider an audit log of impersonations if abuse ever becomes a concern.

---
Task ID: 38
Agent: Z.ai Code (main)
Task: Follow-up to user feedback "admin, agent panel sucks for mobile view and uses" + reiteration of visibility requirements — replace Task 37's horizontally-scrolling tab strips (active tab still ended up hidden off-screen on phones) with an always-visible mobile section grid, extend agent lead visibility to linked owners' properties and CRM clients, and align the enquiry PATCH guard.

Work Log:
- Browser-tested both panels at 390px BEFORE changes: confirmed the 9-tab (admin) / 6-tab (agent) overflow-x TabsList hides tabs off-screen (Leads sat invisible left of the scroll window; Radix tab clicks on hidden triggers were unreliable), active tab never auto-scrolled into view, touch targets ~36px. Admin Leads/Users content and agent pipeline/inbox/owners content were already mobile-OK — the tab strip was the core "uses" problem.
- NEW shared component src/components/ishim/panel-tab-grid.tsx (PanelTabGrid + PanelTab type): mobile-only (sm:hidden) grid of icon tiles (grid-cols-3, min-h-[4.5rem] ≈ 72px touch targets, rounded-2xl, active tile fills primary green, role=tablist/tab with aria-selected, whileTap feedback). Desktop (sm+) keeps the pill TabsList — now hidden sm:flex, static (no overflow scroll needed), min-h-9 px-4.
- Admin dashboard: Tabs converted to controlled (value + onValueChange); PANEL_TABS module const with Lucide icons (LayoutDashboard/MessagesSquare/ShieldCheck/Users/Building2/IndianRupee/Image/FileText/Settings); switchTab() scrolls window to top smoothly on every section change so phones always land at the top of the new section.
- Agent dashboard: same conversion (KanbanSquare/Inbox/Handshake/Building2/Sparkles/TrendingUp); tabs useMemo replaced by module-level PANEL_TABS; removed unused useMemo import.
- Enquiries inbox (owner + agent): status Select now full-width on mobile (w-full sm:w-[10.5rem], h-10 mobile / h-9 desktop) instead of a fixed-width control crammed beside Call/WhatsApp.
- Agent visibility extension GET /api/my/enquiries (AGENT branch): now ORs in (a) enquiries on ANY property of ACTIVE AgentOwner-linked owners (property.ownerId in linkedOwnerIds) and (b) enquiries raised by the agent's CRM clients via phone match — enquiry phone digits matched against AgentClient phones with 91/+91 variants (Prisma EnquiryWhereInput typed where). Verified E2E: created a client enquiry on linked owner Ringkahao's "Hilltop wooden cottage" (routed to the owner, not the agent) → it appeared in agent Marcus's inbox (8 → 9 rows) → test row deleted afterwards.
- Guard alignment PATCH /api/enquiries/[id]: previously only ADMIN or the routed handler could update; now an AGENT with visibility of the lead (agent-listed property, linked-owner property, or CRM-client phone match) may also manage it. Negative test: unrelated CLIENT PATCH → 403 "Only the handler can manage this enquiry".
- Browser verification (390px): admin 3×3 tile grid renders all 9 sections at once (Overview→Leads→Users switches verified, auto-scroll-to-top working); agent 3×2 grid all 6 sections visible; agent Owners tab "Log in as" → entered Tennyson Murry (CLIENT) account with pill + toast, exit restored Marcus's Agent CRM session; admin Users tab Impersonate → entered owner Ringkahao's account, exit restored God-mode panel; admin Leads tab shows "10 of 10 leads" with filter chips and full lead cards on mobile; Business vertical switch + Settings forms render cleanly; agent Enquiries status select full-width. Desktop (1280px) regression: pill tab rows intact for both panels, Leads/Users switching verified. Screenshots in .shots/d5-*.png.
- DB hygiene: test enquiry deleted (enquiries back to 10), 9 test sessions from verification logins pruned (67 remain, all pre-existing), property counts untouched.
- ESLint clean, tsc clean (src/ only; skills/ scaffold noise filtered as before).

Stage Summary:
- Mobile panel UX rebuilt: the overflowing scroll strips are gone — phones now show the entire section map as a big-tile icon grid with top-reset on switch; desktop unchanged. Agents now see every enquiry/visit/message touching their book of business (own listings + linked owners' properties + CRM-client leads) and can act on them, not just look; admin already had platform-wide lead view from Task 37 and it remains intact. Impersonation matrix stands: ADMIN → anyone (except other admins, by design); AGENT → OWNER/CLIENT only; both one-tap exit via the pill.

---
Task ID: 39
Agent: Z.ai Code (main)
Task: Post-context-reset re-verification of Tasks 37/38 (mobile panel redesign + impersonation expansion + lead/message visibility) — confirm every claim on disk and in the browser before reporting done.

Work Log:
- Static audit: all Task 37/38 artifacts confirmed on disk (src/lib/impersonate.ts, panel-tab-grid.tsx, /api/admin/enquiries, /api/agent/users, admin Leads tab, impersonation-pill.tsx). ESLint clean; tsc clean (src/); DB at exact demo baseline (15 properties, 10 enquiries, 7 users, 3 payments).
- Fresh 390px browser pass (agent-browser): admin login → mobile 3×3 PanelTabGrid visible with all 9 sections (desktop pill strip confirmed hidden via classList check), Leads tab shows "10 of 10 leads" with vertical/status/kind filter chips (Messages filter → "6 of 6"), Users tab has Impersonate buttons.
- Admin impersonation round-trip: Users tab → Impersonate (Dev Program, CLIENT) → client home view with "Viewing as Dev Program" floating pill + exit button (screenshot), exit → "iShim control centre" restored with God Mode badge and Overview stats.
- Agent pass: login 9856001103 → Agent CRM heading, 3×2 tile grid (Pipeline/Enquiries/Owners/Listings/Matchmaking/Demand) visible, pill strip hidden; Enquiries inbox shows 8 rows (tel/WhatsApp links and full-width status selects, 324px of 390 viewport); Owners tab has linked-owner card with "Log in as" + account search input.
- Agent impersonation round-trip: "Log in as" (Ringkahao Kazingmei, OWNER) → "iShim — Owner dashboard" with Viewing-as pill (screenshot), exit → Agent CRM restored, pill gone.
- Desktop 1280px regression: agent grid hidden, pill TabsList visible with 6 tabs, kanban pipeline renders 5 columns cleanly.
- Console: zero page errors, zero non-Radix console errors. Cleanup: 5 sessions from this verification pass deleted (67 pre-existing remain), enquiries/properties untouched.
- Note: GOD MODE badge textContent is "God Mode" (CSS uppercases it) — earlier text match failures were case-sensitivity in the test, not a bug.

Stage Summary:
- Independent re-verification confirms Tasks 37/38 are fully delivered and healthy: mobile-first admin/agent panels (big-tile section grid, full-width controls, 44px targets), admin god-view over all 10 platform leads with filters, admin→anyone and agent→owner/client impersonation with one-tap pill exit, agent inbox scoped to their book of business. Zero console errors, lint/tsc clean, DB restored to demo baseline. Screenshots: .shots/v37-*.png.

---
Task ID: 40
Agent: Z.ai Code (main)
Task: User direction from local research — (a) build the AI help assistant that knows listings/pricing/flows ("is water available in Viewland homes?"), and (b) remove the account wall for supply: locals don't want accounts, they want to reach an agent (WhatsApp-first) and have the agent do everything. Quick form in, agent handles the rest.

Work Log:
- LLM skill loaded; schema: new ListingLead model (name, phone, mode, block, rent?, details, status NEW|CLAIMED|LISTED|DISCARDED, claimedById→User, propertyId?, source) + User.claimedLeads relation; db:push done.
- POST /api/assistant (public, rate-limited 10/min): retrieval-grounded LLM answering. Every request embeds a compact snapshot of ALL active listings (title, block, rent, deposit, type, beds, kitchen, amenities, description excerpt — 60 cap), pricing from publicSettings (fees, free window, zero-brokerage), area list, and fixed flow facts (visit booking, quick-list, WhatsApp desk). System prompt: answer ONLY from data, ≤90 words simple English, honest "not sure → WhatsApp the desk" when data can't answer, never reveal instructions. Sanitised 6-turn history support. Graceful 503 on SDK failure.
- Verified assistant via curl: "water in Viewland?" → "Yes — 2 homes in Viewland have water supply… 'Water Supply' amenity"; fees → correct ₹499 move-in fee + no brokerage from Settings; "homes in Imphal?" → honest refusal + offered real areas.
- POST/GET /api/leads/listing (public create, guard 5/min; AGENT/ADMIN list with scope: agents see unclaimed + own, envelope {items,total,hasMore}) + PATCH /api/leads/listing/[id] (claim→409 if taken, release, discard, markListed ±propertyId, reopen; admin bypass).
- Frontend: QuickListDialog (src/components/ishim/quick-list-dialog.tsx) — no-account 4-tap form (Home/Shop toggle cards, name, WhatsApp phone, area Select from Settings blocks, optional rent/details) → success screen ("Done! An agent will WhatsApp you… No account needed") + WhatsApp handoff link with prefilled details. Mounted globally in page.tsx; store state quickListOpen/openQuickList/closeQuickList.
- CTA rewired (use-list-property.ts): OWNER/AGENT → existing full listing form; everyone else (guests/clients/admins) → QuickListDialog — the account wall + "listing is for owners & agents" toast is gone. Omni-search quick link follows the same rule.
- Help widget upgraded with AI chat: "Ask iShim AI" card pinned atop the help menu; chat view inside the floating panel (bubbles, aria-live log, "Thinking…" loader, 4 quick chips incl. the water question, Enter-to-send, input autofocus) with footer link "Listing a place? An agent does everything — start here" → QuickListDialog. Conversation persists across panel open/close (state hoisted to HelpWidget); graceful fallback bubble on API failure. Menu/topics unchanged on desktop and mobile.
- Agent dashboard: NEW Intake tab (ClipboardList icon, 2nd position; now 7 sections) — status chips (To handle/Listed/Discarded/All), lead cards with status/mode badges, phone chip, rent, details quote, claimer line ("Claimed by X (you)"), actions grid: Call, WhatsApp (prefilled per-lead message), Claim & handle, Open listing form (opens standard form; agent "manually uploads everything"), Mark listed, Release, Discard, Reopen. React-hooks lint fixed via setTimeout-off-effect pattern (same for admin-intake-list).
- Admin Leads tab: source toggle "Enquiries & messages | Listing requests" → AdminIntakeList (src/components/ishim/admin-intake-list.tsx) read-only god-view of every intake lead with claimer attribution + Call/WhatsApp.
- Browser E2E (390px): guest CTA → quick-list → filled (native setters; Radix click-to-pick for Viewland) → submitted → success screen → DB row correct (name/phone/block/rent/details/status NEW). Agent login → Intake tab shows lead → Claim & handle → buttons flip + "Claimed by Marcus Chonsinrao (you)" → Mark listed → drops from OPEN, appears under Listed. Admin login → Leads → Listing requests shows lead with "Handled by Marcus Chonsinrao". Help chat chip → grounded answer in UI; desktop 1280px: chat persisted, follow-up "cheapest 2bhk?" → "₹11,000/month in Viewland…" (correct live data). Console clean.
- Ops note: dev server had cached the pre-push Prisma Client (lsof couldn't see the old process; killed by PID from ps) — restarted and everything compiled+ran. Cleanup: test lead + 2 sessions deleted; DB back to baseline (10 enquiries, 15 properties, 7 users, 0 leads). ESLint + tsc clean. Screenshots .shots/v40-*.png.

Stage Summary:
- iShim now has an AI concierge that answers real inventory questions instantly and honestly (grounded in live listings + Settings pricing, with WhatsApp handoff when unsure), and the supply funnel no longer requires an account: "List it — we'll do the rest" hands every quick-list/WhatsApp submission to the agent Intake queue, where agents claim, call, photograph, list and mark done — exactly the behaviour the local research asked for. Owner/agent self-serve dashboards remain for power users; guests and clients now get the zero-friction path instead of a block.

---
Task ID: 41
Agent: Z.ai Code (continuation session)
Task: Session continuation after context loss — independently re-verify Task 40 (grounded AI assistant + no-account assisted-listing funnel) is fully on disk and working; confirm server health, lint/tsc, browser E2E golden paths, and data cleanliness.

Work Log:
- Read worklog + code: confirmed Task 40 fully implemented (src/app/api/assistant/route.ts grounding engine, /api/leads/listing POST+GET, /api/leads/listing/[id] PATCH claim/release/discard/markListed/reopen, quick-list-dialog.tsx, intake-tab.tsx, admin-intake-list.tsx, help-widget.tsx AI chat, use-list-property.ts CTA rewire).
- Server recovery: stale next-server (pid 3783) from previous session held port 3000 (lsof blind, ss found it; first restart attempt hit EADDRINUSE) — killed stale process, started one fresh dev server; GET / 200.
- bun run lint: clean. bunx tsc --noEmit (skills/ excluded): clean.
- API smoke: POST /api/assistant "is water available in Viewland homes?" → grounded answer naming 3 real Viewland listings + "Water Supply" amenity quotes; "what are your fees? any brokerage?" → ₹499 homes / ₹599 business move-in fee, no brokerage (from Settings).
- API smoke: POST /api/leads/listing (curl, no auth) → 201; Prisma row verified (name/phone/mode/block/rent/status NEW/source FORM).
- Browser E2E 390px: guest CTA "List your Property" → QuickListDialog (Home/Shop toggle, name, WhatsApp tel input, Radix area Select → Viewland, details) → submit → "Done, Browser!" success + "Continue on WhatsApp" handoff link (.shots/v40b-quicklist-done.png).
- Agent login (9856001103) → Agent CRM Intake tab → 3 leads listed → "Claim & handle" → badge flips to Claimed, "Claimed by Marcus Chonsinrao (you)", actions become Call/WhatsApp/Open listing form/Mark listed/Release.
- Help widget → "Ask iShim AI" card → typed the water question in chat → grounded answer in UI bubbles (.shots/v40b-ai-answer.png). Console: zero errors (only pre-existing benign Radix uncontrolled→controlled Select warning).
- Desktop 1280px: renders clean (.shots/v40b-desktop.png); long page → footer pushed below fold and flush at scroll-end (verified bottom===viewportH).
- Cleanup: deleted 3 test leads (Smoke Test ×2 + Browser Verify) → 0 remaining; removed agent test sessions; dev.log's only error line is the already-resolved EADDRINUSE from the stale-process restart.

Stage Summary:
- Task 40 stands independently re-verified after the context break: the LLM concierge answers live-inventory questions in under a second (grounded, no invention, WhatsApp handoff when unsure), and the no-account funnel works end-to-end — guest quick form → agent intake → claim → publish path — with zero console errors and a clean database. No code changes were required this session; only ops (stale server) recovery and verification.

---
Task ID: 42
Agent: Z.ai Code
Task: Auth model overhaul per user direction — no sign-up/sign-in for clients & owners anywhere, Google-only sign-in for AGENT/ADMIN (admin pre-adds staff Google accounts), plus a user-friendliness pass on the admin/agent panels.

Work Log:
- Backend gates: /api/auth/google/callback is now STAFF-ONLY — matches by googleSub or email (so admin-pre-added staff link their Google automatically on first sign-in), bounces CLIENT/OWNER/unknown emails with a friendly "staff-only" error cookie; PendingGoogleUser hand-off removed. Deleted /api/auth/google/complete + the PendingGoogleUser model (db:push done) and scripts/seed-pending.ts; /api/auth/google/pending now only maps error codes incl. "staff-only". /api/auth/login is now dev-only (404 in production), never creates accounts, and admits only existing AGENT/ADMIN (CLIENT phone login → 403 "iShim is account-free…"). POST /api/admin/users (ADMIN) creates staff by Google email {name, phone, email, role} with uniqueness checks.
- Auth sheet rewritten: "iShim team sign-in" — single Continue with Google, helper card telling locals they don't need an account, no phone/register UI, dev-only Admin/Agent shortcuts retained for panel testing.
- Zero-login saves: savedIds now live on the DEVICE (localStorage ishim_saved_homes, hydrated on boot, write-through on toggle). Hearts work for guests everywhere (property-card + detail-view) with optimistic local state; signed-in users additionally server-sync. requireAuth/pendingAuth/authMode machinery deleted from the store and all call sites; page.tsx no longer clears guest saves on boot.
- Guest profile (profile-view GuestCard → full device profile): account-free welcome card with "Find a home" + "List yours — an agent handles it" (opens QuickListDialog), device-saved homes list (publicApi.getProperty cards with photo/rent/unsave + "no longer available" fallback), device contact history, and a quiet "iShim agent or admin? Sign in with Google" link. Desktop nav "Sign in" button → neutral "Profile"; bottom-nav already account-free.
- Admin adds staff: People tab gets "Add staff" dialog (name, WhatsApp phone, Google email, role AGENT/ADMIN) + explainer line; user rows now show email; adminApi.addStaff added.
- Panels UX pass: friendlier labels — admin: Overview/Inbox/To review/People/Listings/Payments/Ads/Pages/Settings; agent: Clients/New homes/Inbox/Owners/Listings/Matches/Insights (keys unchanged). PanelTabGrid + PanelTab gained a badge; agent dashboard fetches NEW intake count on mount and shows a red count badge on the New homes tile (mobile grid + desktop pill). Rating CTA now renders only for signed-in users (guests can't rate).
- Copy: AI assistant FLOW_FACTS rewritten for the account-free model (verified live: "do I need an account to list?" → "No accounts needed! …quick form… WhatsApp an agent"); support FAQ "How do I list my home?" updated + new "Do I need to create an account?" entry.
- Verification: lint + tsc clean (skills/ excluded); curl gates (client login 403, google status); browser E2E 390px — guest heart→localStorage(1)→toast, guest profile renders saved card + contact history + staff link, auth sheet Google-only (no phone field), agent dev-login shows new tabs + "1" badge on New homes after curl lead, admin dev-login → People → Add staff → created user visible with Google email (DB: role AGENT, googleSub null); desktop 1280px + sticky footer flush; console zero errors. Cleanup: test staff/lead/sessions removed → baseline 7 users, 0 leads. Screenshots .shots/v42-*.png.

Stage Summary:
- iShim is now genuinely account-free for locals: clients and owners never see a sign-up/sign-in — they browse, save homes on their device, contact agents on WhatsApp/call, and list via the quick form (agent does the rest). Sign-in exists only for the team, is Google-only, and the admin provisions each agent/admin by adding their Google email in the People tab — their first "Continue with Google" links automatically. Legacy phone accounts remain in the DB untouched (properties, tenancies, impersonation all intact) but have no login path in production. Admin/agent panels speak friendlier language with attention badges on what needs action.

---
Task ID: 43
Agent: Z.ai Code
Task: Profile tab → "More" hub (wishlist / list-a-property-to-contact-agent / important features), pricing model flattened to ₹499 during the free trial with post-trial charges (web listing + agent help + commission) as admin-set "to be announced" values, and "Know your Owners" enriched with agent-onboarding + success track record.

Work Log:
- Settings model: AppSettings gained webListingCharge, commissionFee, postTrialNote (server helpers.ts + client types.ts; defaults 0/0/""), readSettings/upsertSettings wire them, PATCH /api/settings accepts them (postTrialNote ≤500 chars). DB: bizSuccessFee flattened 599→499 so homes & business share one flat trial fee. Verified via GET /api/settings.
- Pricing page rewritten (pricing-view.tsx): hero "One flat ₹499. That's it." — no client/owner split, no Homes/Business tabs; Right-now tiles (Browse free / List free / Agent help free / flat success fee highlighted); "After the free trial" section with three PlanCards — Web listing charge, Agent help, Commission — each showing the admin-set amount or "To be announced" (0 = TBA), plus the admin's postTrialNote paragraph; reassurance strip updated.
- Admin Settings tab reworked: old per-vertical Homes/Business pricing cards replaced by a "Flat move-in success fee" card (one input writes successFee + bizSuccessFee together) and an "After the free trial" card (web listing / agent help / commission inputs + details Textarea → postTrialNote; agent help input writes agentHelpFee + bizAgentHelpFee). Preview text + savePricing() updated; SettingsTab no longer needs the mode prop.
- AI assistant PRICING block rewritten (flat trial fee, TBA post-trial fields, optional official note) — verified live: "is it different for owners and clients?" → "one-time ₹499 move-in success fee… same for everyone". default-content: all ₹1,000/₹699 mentions updated to flat ₹499.
- Profile → More: bottom-nav and desktop nav label "Profile" → "More" (LayoutGrid icon). Guest profile is now a More hub: welcome card + six tiles — Wishlist (scrolls to the wishlist section, shows saved count), "List a home or business — contact an agent" (opens QuickListDialog), Find a home, Pricing (flat ₹499 subtitle), Know your Owners, Help & contact — followed by the Wishlist (device saved homes) and contact-history sections. Staff dashboards unchanged.
- Know your Owners: /api/directory now returns per-profile managedBy {name, verified} (the agent who onboarded/put the owner's listings live, derived from listedByAgentId) and summary.successes; DirectoryCard got a track-record grid (Listed / Available / Rented ✓ with badge) and a "Managed by X" chip; header explains agents onboard every owner; summary tile swapped to "Successfully rented".
- Verification: lint + tsc clean; browser E2E 390px — More hub tiles all render, Owners tile → directory shows track-record tiles + "Managed by Marcus Chonsinrao" chips + "Successfully rented" summary, Pricing tile → flat page (hero/trial/TBA counts correct), List tile → quick-list dialog opens; admin Settings round-trip: filled 249/499/note → Save pricing → GET /api/settings confirms → pricing page shows announced amounts (₹249/₹499/note) → reset to 0/0/"" (TBA) for the real admin to fill later; desktop 1280px + footer flush + zero console errors. Admin test sessions removed. Screenshots .shots/v43-*.png.

Stage Summary:
- The pricing story is now one sentence: "Flat ₹499 during the free trial — that's it" — with post-trial web listing / agent help / commission shown as "To be announced" until the admin fills the amounts + details in Settings (they then appear on the pricing page instantly, and the AI assistant quotes them). The Profile tab is a "More" hub putting the three things locals need one tap away — wishlist, list-your-property-via-agent, and the key info pages — and Know your Owners now proves the agent-driven model with per-owner "Managed by" attribution and rented-success track records.
---
Task ID: 44
Agent: Z.ai Code
Task: Admin data backup — one-tap Excel export of the whole platform (listings, people, leads, enquiries, payments, settings) from the admin panel.

Work Log:
- Installed exceljs@4.4.0 (server-side workbook generation with styling).
- New route GET /api/admin/export (ADMIN-only via requireRole): builds a styled workbook with 6 sheets — Listings (27 cols incl. owner contact, agent name, fees, views/clicks, rented/created dates), People (role, verified/banned, listing count, joined), Leads (status, source, claimed-by, linked listing), Enquiries (property, requester, kind/channel/status, visit slot), Payments (property, payer, amount, kind, method), Settings (key/value JSON). Teal header row, frozen top row, autofilter, sized columns; iShim-safe name resolution for plain-ID fields (listedByAgentId, lead.propertyId, payment.payerId) via local user/title maps — schema has no relations on those.
- Response: xlsx binary + Content-Disposition ishim-backup-YYYY-MM-DD.xlsx + X-Export-Counts header (JSON counts) so the client can toast a summary without parsing the file.
- Client: adminApi.downloadBackup() — authenticated fetch (X-Session-Token), blob → download link with auto-revoke, returns counts; typed ApiError passthrough for failures.
- UI: Settings tab gets a "Data backup" card (teal Download button, spinner while busy) with success toast "Backup downloaded — 15 listings · 7 people · 0 leads · 10 enquiries · 3 payments".
- Verification: tsc + eslint clean; curl smoke — admin 200 with valid xlsx (file: "Microsoft Excel 2007+", skill validator: 0 issues, all 6 sheets + ₹ headers confirmed via sharedStrings), agent 403, anonymous 401; browser E2E 390px (dev admin login → Settings → Data backup card → Download → toast with exact DB-matching counts, GET /api/admin/export 200, console clean) and 1280px (card renders, second download OK, footer flush).
- Cleanup: test admin/agent sessions deleted (23), tmp scripts removed → baseline users=7, leads=0 intact. Screenshots .shots/v44-backup-card.png, v44-backup-desktop.png.

Stage Summary:
- The admin now has a real off-platform backup: one tap in Admin → Settings → "Data backup" produces a single filterable Excel workbook of every listing, person, lead, enquiry, payment and setting — ready for records or sharing with the team over WhatsApp/email. Access is strictly ADMIN (agents 403), and the toast reports exact row counts so the admin can trust the file at a glance.
---
Task ID: 45
Agent: Z.ai Code
Task: WhatsApp follow-up templates for staff — agents & admins get ready, prefilled, editable messages for every lead and enquiry instead of a blank chat.

Work Log:
- New src/lib/wa-templates.ts: two context-aware template sets — LEAD_TEMPLATES (First hello / Photo visit / Now live / Gentle nudge — filled with name, home vs shop, block, agent name) and ENQUIRY_TEMPLATES (First reply / Fix a visit / More options / Follow-up — filled with property title, block, agent name); LEAD_DEFAULT_KEY maps lead status → sensible starting template (NEW→hello, CLAIMED→photos, LISTED→live, DISCARDED→nudge); ENQUIRY_DEFAULT_KEY by kind (GENERAL→reply, VISIT→visit); waHref() normalizes any phone to wa.me/91<10digits>?text=<encoded>.
- New src/components/ishim/wa-template-dialog.tsx: shared picker dialog — template chips (aria-pressed), editable textarea with the rendered message, one "Open WhatsApp with this message" button. Conditionally mounted (only while open) so state resets per conversation — no effects, passes the new react-hooks/set-state-in-effect rule.
- Wired into all 4 staff WhatsApp touchpoints (previously hardcoded/no-prefill links): agent intake-tab (New homes), admin-intake-list (Listing requests), agent enquiries-inbox (Inbox), admin-dashboard LeadsTab (Inbox enquiries). Sender name = signed-in staff name ("Marcus Chonsinrao" / "iShim Admin"), fallback "iShim".
- Verification: lint + tsc clean; browser E2E 390px — agent → New homes → test lead "Chat Test Local" (curl-created) → WhatsApp → dialog opens with "First hello" prefilled ("Hi Chat Test Local, this is Marcus Chonsinrao from iShim. You asked us to list your home in Viewland — when is a good time to talk?"), wa.me/919856999888 href verified encoded; chip switch → "Photo visit" text renders correctly; agent Inbox → enquiry dialog with "First reply" + property title; admin → Inbox → enquiry + Listing requests paths both render dialogs with admin name; desktop 1280px dialog centered; console zero errors.
- Cleanup: test lead + staff test sessions deleted → baseline 7 users / 0 leads / 10 enquiries. Screenshots .shots/v45-wa-dialog.png, v45-admin-lead-wa.png, v45-desktop.png.

Stage Summary:
- Staff never open a blank WhatsApp chat anymore: every lead and enquiry card now offers four ready follow-up messages that prefill with the person's name, their home/shop, area and the agent's own name — pick, tweak, send. Defaults are smart (new lead → hello, claimed → photo visit, listed → now live; visit enquiry → fix a visit), and the whole flow works identically in agent and admin panels.
---
Task ID: 46
Agent: Z.ai Code
Task: Language toggle (English / Tangkhul / Meiteilon) — translation-ready infrastructure with an admin-managed string editor; guests switch languages in the More tab, admin supplies translations without code changes.

Work Log:
- New src/lib/i18n.ts: Lang type + LANGS metadata; CORE_STRINGS catalog of 86 core guest-facing strings (nav, hero, featured, blocks, vertical switch, footer, property card, detail CTAs, quick-list dialog, More hub, pricing) with English baselines and {param} templating; translate() resolves admin override (TK/MN) → English fallback (never half-broken); useT() hook reactive to store lang + settings.langOverrides; coverage() helper for progress counts.
- Store: lang/setLang persisted at localStorage ishim_lang (mirrors the mode pattern); hydrated on boot.
- Settings: langOverrides (key → {TK?, MN?}) added to AppSettings (client types.ts + server helpers.ts), DEFAULT_SETTINGS, readSettings (JSON-parse with corrupt-row fallback), upsertSettings (upserted like blocks/houseTypes), and PATCH /api/settings guard (object of key → strings ≤300 chars, empty entries dropped).
- Toggle UI: More hub gets an "App language" section with English/Tangkhul/Meiteilon chips + "Untranslated text stays in English" note; language persists per device.
- t() wired into 9 guest surfaces: bottom-nav (Home/Search/More), home-view (hero titles/subs, featured + blocks sections), vertical-switch (brand/sub labels), footer (taglines, "You are browsing", Pricing/Know your Owners pills), property-card (Featured/Rented/Available/Negotiable/Home/Business/save aria/rented note), detail-view (WhatsApp/Call/Book a visit/Save/Saved/status badges/Deposit/negotiable/About/Amenities/brokerage note), quick-list-dialog (title, subtitle, radio labels, all field labels, submit, footnote), profile-view More hub (welcome, 6 tiles, wishlist/history headings), pricing-view (hero {fee} templated, Right now / After the free trial, Free, To be announced).
- Admin editor: Settings tab "App language — Tangkhul & Meiteilon" card — coverage badges (X/86 per language), search filter, scrollable list (max-h-96) of English string + key + TK/MN inputs, Save translations → PATCH; instantly live site-wide.
- Verification: lint + tsc clean; API round-trip (admin PATCH 4 TK overrides → GET confirms); browser E2E 390px — ishim_lang=TK flips bottom nav + hero to TK strings with untranslated keys ("More", section headers) staying English; More hub language card switches back to English live; admin Settings editor renders 86 rows with prefilled TK values, coverage badges "Tangkhul 4/86 · Meiteilon 0/86"; UI edit → Save → GET shows MN added with all TK preserved; fresh reload console clean. Earlier stale console error was the (fixed) duplicate-import state.
- Cleanup: langOverrides reset to {}, test sessions removed → baseline intact (7 users, 0 leads).

Stage Summary:
- iShim is now community-translatable: the entire core guest experience reads through an 86-string dictionary, guests can pick English/Tangkhul/Meiteilon from the More tab (choice persists on device), and the admin — the native speaker — fills translations in Admin → Settings with live progress counts; every untranslated string gracefully stays English. No fabricated translations shipped: Tangkhul/Meiteilon start empty and are filled by the team, so only real, reviewed language ever reaches locals.
---
Task ID: 47+48
Agent: Z.ai Code
Task: Two listing-flow upgrades — (47) "my area/ward is not listed" escape hatch: requester types the area, it lands in a staff queue, agent/admin adds it to the official list with one tap; (48) optional photo upload when listing a home or business (guest quick-list + full form).

Work Log:
- Schema (db:push done): new AreaRequest model (name, nameKey for SQLite-safe dedupe, mode, note, requesterName/Phone, leadId, source FORM|LISTING|ADMIN, status NEW|ADDED|DISCARDED, handledById/Name, blockName) + ListingLead.photos JSON-string column.
- New src/app/api/_lib/area-requests.ts: resolveBlock() canonicalizes typed areas against Settings (case-insensitive → official spelling) and queueAreaRequest() (best-effort, never fails the main op; dedupes by nameKey while a NEW request is pending).
- Routes: POST/GET /api/area-requests (public submit w/ rate-limit + staff list) and PATCH /api/area-requests/[id] (add → appends to Settings.blocks via upsertSettings and returns fresh settings; discard; reopen). POST /api/leads/listing now accepts photos (≤3, validated), canonicalizes block, and auto-queues an area request for unknown areas; GET serializes photos as arrays (PATCH actions too via withPhotos). POST/PATCH /api/properties canonicalize block and auto-queue LISTING-source requests (note carries the listing title).
- NEW /api/upload (existed in client + UploadButton component but the route was MISSING — full-form upload was broken): formData → public/uploads, image-type allowlist, 6MB cap, generated filename, IP rate-limit, returns /api/files/<name>; GET /api/files/[name] streams files with correct content-type + immutable cache (works in dev AND standalone prod, unlike static /uploads paths).
- Client: areaApi + AreaRequestItem in api.ts; submitQuick gains photos; 6 new i18n keys (quick.area.other/type/note/back, quick.photos*) → catalog 92 strings.
- Quick-list dialog: area Select ends with "My area is not listed" (forced typed-input when no blocks exist) with back-link; "Photos (optional)" section — UploadButton + thumbnails with remove, max 3; success screen adapts when photos attached.
- Listing form dialog: same "My area is not listed" sentinel (auto-on when editing a listing whose block left the official list); selected-photos chip list upgraded to real thumbnails.
- New shared area-requests-card.tsx: staff queue with count badge, requester context (who, phone, home/shop, note), Add (writes Settings + pushes fresh settings into the store — every selector updates live) and Dismiss. Mounted at the top of agent IntakeTab and in admin Settings above the blocks editor.
- Lead cards (agent intake + admin god-view) now render the requester's photo thumbnails (tap → full) and an amber "New area" badge when the lead's block isn't official — badge clears itself the moment the area is added (live settings).
- Verification: lint + tsc clean; curl — upload→serve (201, image/png), lead w/ unknown block+photo → area request queued w/ requester + leadId, agent add → ADDED + settings.blocks appended, casing dedupe ("zoveng TEST" → canonical, no duplicate), owner/agent property POST w/ unknown block → LISTING-source request with title note, anon 401; browser E2E 390px — guest quick-list: option → typed input ("Langdang Hills") → real photo upload → submit → "Your photos are attached" success; agent intake: card shows queue rows + lead photo thumbs + "New area — add it above" badge, Add → toast "Langdang Hills added to areas", badge auto-clears, /api/settings confirms; agent full form: typed block "Phalei Test" + photo → PENDING listing + LISTING request; admin Settings: card + blocks editor co-exist, Dismiss Phalei Test → DISCARDED (handledByName "iShim Admin"); desktop 1280px dialog renders new option + upload, footer pushed naturally on long pages; console only the pre-existing benign Radix Select warning.
- Cleanup: test leads/requests/properties deleted, blocks restored to the original 10 wards, staff test sessions purged, 3 test uploads removed → baseline 7 users / 0 leads / 10 enquiries / 15 listings / 0 area requests. Screenshots .shots/v47-quick-area.png, v47-agent-intake.png, v47-listing-form.png, v47-admin-settings.png, v47-admin-desktop.png.

Stage Summary:
- An area that isn't on the list is no longer a dead end: any local listing a home or shop can pick "My area is not listed", type the name (and optionally attach up to 3 photos), and the request flows to the team automatically — the agent sees it at the top of New homes with a one-tap "Add" that makes the area selectable everywhere instantly (admins get the same queue in Settings, with dismiss for typos). Guests' photos now ride along with quick-list requests so agents see the place before they even call, and the previously-missing /api/upload route is live, fixing the upload button in the full listing form (plus banner/content uploads) with device-safe serving via /api/files.
---
Task ID: 49
Agent: Z.ai Code
Task: Post-cutoff re-verification of Tasks 47+48 (area/ward escape hatch + optional photo upload) — confirm both features are live and interactive end-to-end after the session that implemented them ran out of context.

Work Log:
- Read worklog: confirmed Tasks 46 (language toggle) and 47+48 (area requests + photo upload) were fully implemented, verified and cleaned up in the prior session before the summary was generated; this session's job was a fresh live-state confirmation, not a rebuild.
- Fresh E2E at 390px as guest: quick-list dialog → Area Select ends with "My area is not listed" sentinel → selecting it swaps to typed input ("Type your area / ward name") with a "Choose from the list" back-link → filled name/phone/area "Langdang Verify"/rent/note → real file upload via the hidden input (agent-browser upload "input[type=file]") → thumbnail + "Add another" + per-photo Remove buttons rendered → submit → "Done, Verify!" success screen.
- DB check: ListingLead row with block "Langdang Verify" (free text) + photos JSON ["/api/files/…png"]; AreaRequest row NEW, source FORM, requester name/phone captured, leadId linked. GET /api/files/<name> → 200 image/png.
- Agent side (dev login Marcus): New homes tab showed Area requests card (badge "1 waiting to be added") with Add/Dismiss, and the lead card with the amber "New area — add it above" badge + "Open photo 1 in a new tab" thumbnail. Tapped Add → card flipped to "No pending requests"; GET /api/settings confirmed "Langdang Verify" appended; lead's "New area" badge auto-cleared (live settings push).
- Selectable-everywhere check: guest quick-list Area Select now lists "Langdang Verify" before the "My area is not listed" sentinel — the added area is instantly usable.
- Desktop 1280px dialog renders correctly; console clean (only benign HMR/Radix dev messages); lint clean.
- Cleanup: test lead, area request and upload file deleted, blocks restored to the original 10 wards → baseline 7 users / 0 leads / 10 enquiries / 15 listings / 0 area requests. Temp scripts removed. Screenshots .shots/v47-reverify-quick-area.png, v47-reverify-desktop.png.

Stage Summary:
- Both user-requested features are confirmed live and working end-to-end in the running app: (47) "SELECT AREA / WARD NOT THERE → OPTION TO SELECT → SAY TO AGENT → AGENT ADDS IT" — the full guest→agent loop passes, with the added area instantly selectable in every form; (48) optional photo upload works in the listing flow with previews, multi-add and remove, photos riding along to the agent. No code changes were needed this session — pure verification + data hygiene.
---
Task ID: 50
Agent: Z.ai Code
Task: Delete all mock data — wipe every seeded/demo listing, person, interaction and test artifact so the platform starts clean for real data.

Work Log:
- Surveyed all 19 tables first. Deleted (respecting FK order): 20 contactLogs, 3 savedHomes, 2 ratings, 3 tenancies, 105 habitEvents, 3 payments, 10 enquiries, 1 ownerNote, 2 agentOwners, 5 agentClients (CRM), 15 properties, 39 sessions, and the 5 mock CLIENT/OWNER users (Grace Awungshi, Tennyson Murry, Dev Program, Ngathan Shimray, Ringkahao Kazingmei). Removed 3 orphaned files from public/uploads (kept .gitkeep).
- Kept deliberately (NOT mock data): the 2 staff accounts — ADMIN "iShim Admin" (9000000001) + AGENT "Marcus Chonsinrao" (9856001103) — because Google sign-in is staff-only with no bootstrap path; with zero ADMIN rows nobody could ever sign in to provision real staff, reaching the panel only via manual DB edits. Also kept: Settings (10 real Ukhrul wards, amenities, houseTypes, ₹499 pricing config), the Privacy ContentPage (real legal content), and the 3 marketing AdBanners (generic platform value props, admin-managed in the Ads tab — say the word and they go too).
- Verified empty-state UX end-to-end at 390px: guest home renders (hero/search/ads live, Featured homes gracefully empty, Browse by block still lists the 10 real wards), Search tab shows the empty "Everything on iShim" state with Clear filters, agent panel clean (0 listings / 0 leads across all tabs, no waiting badges), admin control centre clean (People tab lists exactly the 2 staff; settings intact). Console clean, lint clean.
- Final DB: 2 users (staff only) · 0 everything else. Temp scripts removed. Screenshot .shots/v50-empty-home.png.

Stage Summary:
- iShim now starts from a genuinely clean slate: zero fake listings, people, conversations, payments or analytics — real data enters through the live flows (guest quick-list → agent publishes; admin provisions staff by Google email in People). If the team later wants the two dev staff accounts removed as well, that needs a one-line manual DB seed of a new ADMIN first (no bootstrap exists by design — staff sign-in is invite-only).
---
Task ID: 51
Agent: Z.ai Code
Task: Admin panel simplification + a simple Areas/Wards manager (names AND images) that both admin and agents can use — "admin panel layouts are too complicated and where can admin add new ward names and its images, and agents can do add the ward and the images".

Work Log:
- Data model: new `wardImages` setting (block name → image url JSON map) — server AppSettings + DEFAULT, readSettings (corrupt-row safe) and upsertSettings (persisted Setting row) in helpers.ts; mirrored in client types.ts. Ward photos are no longer hardcoded — home-view's BLOCK_IMAGES stays only as a seeded fallback behind settings.wardImages priority.
- New PATCH /api/areas (staff-only ADMIN + AGENT): accepts {blocks?, wardImages?}, validates (string arrays / flat map, 60-char keys, 500-char urls, ≤200 blocks), upserts, returns fresh public settings. PATCH /api/settings also accepts wardImages (ADMIN) for completeness.
- New shared WardManager component (ward-manager.tsx): one simple card — add row (name input + optional "Photo (optional)" upload via existing /api/upload + Add ward; Enter-key support), scrollable ward list (max-h-96) with photo thumb / letter fallback, "Has photo" status, per-ward Photo/Change + remove-photo + Remove buttons. Every action saves straight through areasApi.save → PATCH /api/areas and pushes fresh settings into the store (home tiles, form selects, filters all update live). No effects (conditional-friendly, lint-clean).
- Admin panel simplified: 9 tabs → 8. "To review" merged into Listings (ApprovalsTab now sits at the top of the Listings tab), Ads + Pages merged into one "Content" tab, and the new dedicated "Areas" tab (Area requests queue + Ward manager) is the obvious single home for everything area-related. Settings tab slimmed accordingly (area requests card + blocks ChipEditor removed; keeps pricing, amenities, house types, backup, language).
- Agent panel: WardManager mounted directly in the "New homes" intake tab right below the area-requests queue — agents get full ward + photo management without a new tab.
- Home page: browse-by-block tiles now render settings.wardImages[name] first, then the seeded BLOCK_IMAGES fallback, then the shared scenic default.
- Verification: lint + tsc clean. curl gates — anon PATCH /api/areas 401, agent 200 (blocks + wardImages persisted), admin /api/settings wardImages 200, bad body 400. Browser E2E 390px — admin Areas tab renders queue + manager (10 wards, add row disabled until name), added "Chadong" with uploaded photo → "Photo ready" chip → toast, list shows "Has photo" + "Remove photo", API confirms blocks+wardImages, home tile for Chadong renders the uploaded /api/files image; agent intake shows the manager (11 areas — admin's add visible live), agent changes Hungpung's photo via its row input (wardImages updated server-side) and removes "Chadong" via the row Remove (ward entry + image entry both cleaned); desktop 1280px renders; console clean.
- Cleanup: wardImages reset {}, Chadong removed, 2 test uploads deleted, all test sessions purged → baseline 2 staff users / 0 data rows, original 10 wards.

Stage Summary:
- "Where do I add wards and their images?" now has one obvious answer for the whole team: Areas. Admin gets a dedicated Areas tab (requests queue + the ward list with photos); agents manage the exact same list from New homes; any change is live site-wide in one tap. The admin panel is lighter too — 8 tabs with To-review folded into Listings and Ads+Pages folded into Content — and ward photos are real data the team can change any time instead of hardcoded files.
---
Task ID: 52
Agent: Z.ai Code
Task: Supabase integration — migrate the database from local SQLite to Supabase Postgres and move image uploads from local disk to Supabase Storage ("add supabase for me ask me what u need").

Work Log:
- Collected the 4 credentials from the user (project URL, anon key, service_role key, DB URI). Scope per recommendation: Postgres DB + Storage; Supabase Auth skipped — custom staff auth + Google OAuth kept.
- Three environment blockers found and solved: (1) direct host db.lwtwuslzvgqbvodvrbyq.supabase.co is IPv6-only while the sandbox has IPv4 egress only → switched to the Supavisor session pooler; (2) the shell exports a stale DATABASE_URL (old SQLite) that overrides .env → all Prisma/CLI commands run with `unset DATABASE_URL`; (3) the project's real region was unknown — raw-socket region probes gave misleading results (pooler edge accepts TLS from byte 0), so regions were tested with `prisma db push` itself → project lives in aws-0-ap-northeast-1 (Tokyo).
- Migration: schema provider sqlite → postgresql; `db push` created all 16 tables in Supabase Postgres. Real rows dumped from legacy SQLite via bun:sqlite (booleans arrive as 0/1 → coerced for Postgres) and re-seeded: 2 staff users (Google sign-in preserved — no bootstrap exists), 18 settings (10 real Ukhrul wards, amenities, houseTypes, ₹499 pricing), the privacy ContentPage, 3 AdBanners. Original db/custom.db kept untouched as rollback snapshot.
- Storage: @supabase/supabase-js@2.117 installed. New src/lib/supabase.ts — server-only service-role client (never client-side), public `uploads` bucket auto-ensure (cached per process). Bucket pre-created via Management API (public:true, confirmed). /api/upload rewritten: Supabase Storage is primary (generated name, exact content-type, 1-year cache control → permanent CDN public URL); legacy local-disk + /api/files/[name] kept as automatic fallback when Supabase env is absent or Storage errors. One bug fixed en route: SupabaseClient.from() is the Postgrest DB accessor — storage requires client.storage.from().
- Browser E2E on the new backend (390px): guest home renders with all 10 ward tiles from Postgres; agent quick-login works (session row created in Postgres, CRM renders 0-listing baseline); ward manager golden path — filled "Supabase Test", real photo upload through /api/upload → "Photo ready" → Add ward → /api/settings shows block + wardImages entry with a https://lwtwuslzvgqbvodvrbyq.supabase.co/storage/v1/object/public/uploads/... URL → GET that URL 200 image/jpeg from the CDN → home page tile renders the CDN-hosted image (confirmed in DOM) → removed the ward via UI → blocks and wardImages both cleaned.
- Cleanup: 2 test files deleted from the bucket via Storage API (200), logout purged the session row; final DB = 2 staff / 0 sessions / 10 wards / wardImages {} / 0 leads; public/uploads back to .gitkeep only. tsc + eslint clean; dev.log has no runtime errors post-fix; temp scripts (region probe, dump, seed) and the dead scripts/final.ts leftover removed.

Stage Summary:
- iShim now runs on Supabase: the whole database (16 tables) lives in Supabase Postgres (region ap-northeast-1) reached through the IPv4 session pooler, and every image upload — listing photos, lead photos, ward images, banners — lands in the public `uploads` Storage bucket and is served from Supabase's CDN by a permanent URL, with the old local-disk path kept as a transparent fallback. Nothing was lost in the move (staff accounts, ward list, settings, privacy page, banners carried over) and the app was verified end-to-end in the browser on the new backend. The platform is now deploy-ready: no SQLite file or local disk dependencies remain. .env carries SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only secret), NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
---
Task ID: 53
Agent: Z.ai Code
Task: Make jihalshimray1@gmail.com an admin.

Work Log:
- Reviewed the Google staff sign-in gate (src/app/api/auth/google/callback): it matches by googleSub first, then by email — attaching the googleSub on first sign-in — and requires role AGENT|ADMIN. Pre-creating a User row with the email + role ADMIN is therefore the exact provisioning path the platform expects.
- The POST /api/admin/users provisioning API requires name + phone which the user did not provide, so created the row directly via Prisma: name "Jihal Shimray" (derived from the email; editable in People), phone "" (unique-safe; display-only field), email jihalshimray1@gmail.com, role ADMIN. No other staff rows touched.
- Simulated the callback's two-step lookup + role gate → PASS (session would be created as ADMIN).
- Browser check as admin: People tab lists the new row — "Jihal Shimray · jihalshimray1@gmail.com", role combobox "Admin", Verify/Ban actions, Impersonate correctly disabled for admins. Logged out (session purged), browser closed.
- Final DB: 3 users (2 ADMIN incl. new + 1 AGENT) / 0 sessions / everything else unchanged. Screenshot .shots/v53-new-admin-people.png.

Stage Summary:
- jihalshimray1@gmail.com is now an ADMIN. The real person just opens iShim → More → "Sign in with Google" and signs in with that Google account: the callback matches the pre-added email, links their googleSub and lands them straight into the control centre. Name/phone are placeholders ("Jihal Shimray", blank) — one tap in People to correct once known.
---
Task ID: 54
Agent: Z.ai Code
Task: Set up Google OAuth credentials ("now how to et up google credentials").

Work Log:
- Guided the user through Google Cloud Console (project → consent screen → Web-application OAuth client); they supplied Client ID 106967498345-…apps.googleusercontent.com and Client Secret GOCSPX-….
- Wired GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET into .env (no GOOGLE_REDIRECT_URI — the app auto-detects origin from x-forwarded-host, so the same config serves the preview gateway and future domains). Dev server restarted.
- Verified: GET /api/auth/google now 307-redirects to accounts.google.com with the correct client_id and state cookie; browser click-through (More → Sign in with Google → Continue with Google) lands on the real Google account-chooser page with the client_id attached — OAuth is live end-to-end up to Google's consent screen.
- Remaining user-side step (cannot be done from the sandbox): in Google Console → Credentials → the iShim web client, add the exact "Authorized redirect URI" for the address they browse iShim from: <their-url>/api/auth/google/callback (plus matching JavaScript origin). If they see "Error 400: redirect_uri_mismatch", the error page displays the exact URI to copy. Takes effect immediately.
- Dev quick-login buttons remain available for local testing (production-blocked); the real Google path is now the production staff login. Worklog note: jihalshimray1@gmail.com (Task 53) can sign in with Google as soon as the redirect URI is whitelisted.

Stage Summary:
- Google OAuth is configured and verified live: the "Continue with Google" flow now reaches Google's real consent screen with iShim's client. Only the redirect-URI whitelist entry in Google Console (their exact browsing URL + /api/auth/google/callback) stands between the team and real Google sign-ins.
