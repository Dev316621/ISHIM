# iShim — Launch Checklist (Day 4)

Run this top-to-bottom on the **live URL** after deploying per `DEPLOY.md`.
Everything below was executed and passed in the pre-launch environment on Day 4
(browser-verified with screenshots in `.shots/d4-*.png`); re-running it on the
real domain is the final gate before announcing.

Automated spots first (substitute `https://ishim.in`):

```bash
BASE=https://ishim.in
curl -s -o /dev/null -w "%{http_code}\n" $BASE/                          # 200
curl -s "$BASE/api/properties?limit=1" | head -c 120                     # {"items":[…
curl -s $BASE/api/settings | python3 -m json.tool | head -5              # pricing JSON
curl -s -X POST $BASE/api/payments/cashfree/order -H 'Content-Type: application/json' -d '{}' -w "\n%{http_code}\n"   # 401/400/501 — never a 500 crash
curl -s -o /dev/null -w "%{http_code}\n" $BASE/some-missing-page         # 404 branded page
bun run prelaunch                                                        # on the server: 0 FAIL
```

## 1 · Guest (desktop 1280×900)

- [ ] Home renders: hero, omnibox with Everything/Homes/Business tabs,
      highlights carousel, Featured homes, Browse by block (10 wards), footer.
- [ ] **Sign in button is visible in the top nav when logged out** (fixed on
      Day 4 — it used to be missing on desktop).
- [ ] Search a word (e.g. "house") → result header shows "N results · homes &
      business"; ward chip + text query compose (0 results is valid when the
      word isn't in that ward); rent chips narrow further; Clear search resets.
- [ ] Business tab → business quick filters (Shop/Office/Cafe…), ward counts
      change, header wording switches to "spaces".
- [ ] Listing detail: gallery (counter, arrows, dots), price + deposit,
      bedrooms/bathrooms, amenities, Owner/Agent contact tabs, ratings blocks,
      Views counter increments.
- [ ] Unknown URL → branded 404 with Go Home / Search Properties.

## 2 · Client (login by phone, e.g. demo 9856001104)

- [ ] Desktop nav: type phone → Sign in → nav shows "Profile".
- [ ] Save home on a card → toast + button flips to "Remove from saved";
      profile → Saved homes shows it; remove works.
- [ ] Detail → Book a visit → pick date + time slot + message → request
      submitted (dialog closes). Verify it reached the owner:
      log in as that listing's owner → Enquiries inbox shows the visit with
      date/time.
- [ ] WhatsApp/Call buttons work (tel:/wa.me links, tracked in Contact
      history).
- [ ] Logout.

## 3 · Owner (e.g. demo 9856001101 / 9856001102)

- [ ] Manual phone login (typed, not quick-fill) lands on Owner dashboard.
- [ ] Enquiries inbox lists visits/messages; "Update status" dropdown persists
      (New → Visit scheduled → reload keeps it).
- [ ] Add Home → fill title/description/rent/deposit/block/type/amenities +
      photo → Submit → listing appears as PENDING.
- [ ] (After real Cashfree keys) Mark as Rented → "Pay via UPI" opens the
      Cashfree sheet → complete a sandbox ₹fee payment → listing closes as
      RENTED, one Payment row in Admin → Financials. Without keys: graceful
      "payments coming soon" state + dev-only simulate button.

## 4 · Admin (9000000001 until replaced)

- [ ] Approvals: queue shows PENDING listings; Approve → listing goes live
      immediately (public count +1); Reject with reason → owner sees it.
- [ ] Users: roles dropdown, Ban button, verified badges.
- [ ] Properties: filter by status/mode, Feature toggle, status dropdown.
- [ ] Financials: revenue header + payment rows per vertical.
- [ ] Ads: banner cards with order/LIVE toggles. Content: 8 editable pages.
      Settings: free-window dates + per-vertical pricing.
- [ ] Impersonation (if used): pill shows while impersonating, exit returns.

## 5 · Cross-cutting

- [ ] Mobile 390×844: bottom tab bar (Home/Search/Profile), no horizontal
      overflow, detail + booking dialog usable, thumb-reach CTA sizes.
- [ ] Footer flush at page end (no floating gap) on desktop and mobile.
- [ ] Console: no page errors (Radix "controlled/uncontrolled" dev warnings
      are known and harmless).
- [ ] Rate limit: hammering contact endpoints returns 429 with a friendly
      message (don't skip — it protects real owners' phone numbers).

## 6 · Before you announce

- [ ] `bun run prelaunch` → 0 FAIL, warnings resolved (real Cashfree keys,
      `CASHFREE_MODE=production`, webhook registered in the dashboard,
      Google OAuth client, real admin phone).
- [ ] Demo decision executed: keep seeded listings for soft launch **or**
      `bun run db:reset` + seed real listings only; remove the "Dev Program"
      test user either way.
- [ ] DB backup taken (`cp db/custom.db db/backups/custom-$(date +%F).db`).
- [ ] Cashfree sandbox order paid successfully once in production mode.

**Day 4 status: all sections above passed in the pre-launch environment.**
Test residue from the regression was removed; the database is back to the
exact demo baseline (15 listings · 12 active / 3 rented, payments & intents
untouched).
