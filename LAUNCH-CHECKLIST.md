# iShim — Launch Checklist

Run this top-to-bottom on the **live URL** after deploying. The app is a
single Next.js route (`/`) with client-side views; the API lives under
`/api/**`; staff sign in with Google only (no phone login).

Automated spots first (substitute the live domain):

```bash
BASE=https://ishim.discoverukhrul.site
curl -s -o /dev/null -w "%{http_code}\n" $BASE/                          # 200
curl -s "$BASE/api/properties?limit=1" | head -c 120                     # {"items":[…
curl -s $BASE/api/settings | python3 -m json.tool | head -5              # pricing JSON
curl -s -X POST $BASE/api/payments/cashfree/order -H 'Content-Type: application/json' -d '{}' -w "\n%{http_code}\n"   # 401/400/501 — never a 500 crash
curl -s -o /dev/null -w "%{http_code}\n" $BASE/some-missing-page         # 404 branded page
```

## 1 · Guest (desktop 1280×900)

- [ ] Home renders: hero, omnibox with Everything/Homes/Business tabs,
      highlights carousel, Featured homes, Browse by block, footer.
- [ ] **Sign in button is visible in the top nav when logged out.**
- [ ] Search a word (e.g. "house") → result header shows "N results · homes &
      business"; ward chip + text query compose (0 results is valid when the
      word isn't in that ward); rent chips narrow further; Clear search resets.
- [ ] Business tab → business quick filters (Shop/Office/Cafe…), ward counts
      change, header wording switches to "spaces".
- [ ] Listing detail: gallery (counter, arrows, dots), price + deposit,
      bedrooms/bathrooms, amenities, Owner/Agent contact tabs, ratings blocks,
      Views counter increments.
- [ ] **Share button** (next to Save, and under the contact grid) → native
      share sheet on mobile / WhatsApp fallback on desktop. The shared
      `https://ishim.discoverukhrul.site/p/<id>` link renders a WhatsApp
      preview card with photo, title and ₹price.
- [ ] Unknown URL → branded 404 with Go Home / Search Properties.

## 2 · Client (guests — no account needed)

- [ ] Save home on a card → toast + heart fills; profile → Saved homes shows
      it (device-local for guests); remove works.
- [ ] Detail → Book a visit → pick date + time slot + message → request
      submitted (dialog closes). Verify it reached the owner: sign in as the
      listing's owner → Enquiries inbox shows the visit with date/time.
- [ ] WhatsApp/Call buttons work (tel:/wa.me links, tracked in Contact
      history).
- [ ] Logout (staff sessions only).

## 3 · Owner (via an agent or the quick form)

- [ ] Add Home → fill title/description/rent/deposit/block/type/amenities +
      photo → Submit → listing appears as PENDING.
- [ ] (After real Cashfree keys) Mark as Rented → "Pay via UPI" opens the
      Cashfree sheet → complete a sandbox ₹fee payment → listing closes as
      RENTED, one Payment row in Admin → Financials. Without keys: graceful
      "payments coming soon" state.

## 4 · Admin (Google sign-in only)

- [ ] Google sign-in lands on the admin dashboard (email pre-added by the
      admin — the ONLY sign-in path; there are no demo logins).
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
      Google OAuth client with the live domain origins).
- [ ] DB backup taken (Supabase → Database → Backups).
- [ ] Cashfree sandbox order paid successfully once in production mode.
