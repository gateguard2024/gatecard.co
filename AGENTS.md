# GateCard — Agent Context

> **v8.31 reset.** This repo was a multi-tenant visitor kiosk. It is now the
> **Nexus Resident Move-In Portal**. The visitor app lives elsewhere — see below.
> Previous state is on the `visitor-archive` branch and the `pre-v8.31-visitor` tag.

---

## APPLICATION LANDSCAPE — get this right every time

| App | URL | Repo | Purpose |
|-----|-----|------|---------|
| SOC Operations | ggsoc.com | GGSOC | Call center for SOC staff. Live production. DO NOT BREAK. |
| Dealer Portal (Nexus) | portal.gateguard.co | gateguard-portal | Dealer ops, CRM, quoting, field service, billing. 128 Supabase tables. |
| Corporate site | gateguard.co | gateguard-web | Marketing. Currently a bare create-next-app scaffold. |
| Visitor kiosks | one Vercel deploy per property | `*-Visitor` repos | Next 14, env-var config, Brivo + Twilio direct, no Supabase. One repo per property. |
| **Resident Move-In Portal** | gatecard.co | **THIS REPO** | Resident move-in: identity, credentials, parking, services, store. |

**There is no visitor flow in this repo any more.** Visitors are served by the
per-property repos (Stonegate-Visitor, East-Ponce-Village-Visitor, Flint-River-Visitor,
Lyv-Buckhead-Visitor, Rhythm-Camp-Creek-Visitor, Villages-on-Riverwalk-Visitors).
Do not re-add directory search, masked calls, or gate-open flows here.

**Who uses this app:** residents moving into a Gate Guard property. Not dealers, not
SOC agents, not visitors.

---

## THE BUSINESS MODEL THIS SERVES

Gate Guard's new play is **resident-funded**: bill the *resident* at move-in and at
renewal rather than the property. The program becomes free to the property and hands
back their access bills, fob spend and gate repair budget.

Position this **indirectly** in any copy — sell the outcome ("no gate line item",
"self-funding"), never the mechanics of who gets billed.

Six-tier revenue hierarchy: corporate → master agent → master dealer →
(sales partner / install dealer / service dealer) → client.

---

## LOCKED DECISIONS — do not re-litigate

Decided with rationale recorded. If you think one is wrong, argue against the recorded
reasoning; do not restate the options.

### D1 — Platform: build, don't buy
Next.js + Supabase + Clerk. Stripe as the money layer. Shopify headless **only** as the
dropship merch catalog.

*Why not Shopify as the spine:* the core object is a fee bound to a lease — prorated at
move-in, tied to a unit, ends at move-out, re-bills at renewal. Shopify subscription apps
assume consumer replenishment and cannot model resident → unit → property → lease. That
relationship would end up in customer tags and metafields and break as properties grow.

*Why Shopify still earns a place:* supplier routing, tracking sync, returns and
multi-state sales tax on physical goods is months of undifferentiated work.

### D2 — The parking + access fee is mandatory, written into the lease
Not resident opt-in.

### D3 — Screens 01-03 take no payment. How the mandatory fee is collected is OPEN.

**Status: unresolved. Do not build a collection path for the mandatory fee yet.**

An earlier concept had the parking + access fee posting to the resident's rent ledger,
Gate Guard invoicing the property, the property collecting. **Gate Guard does not have
access to the rent ledger.** That concept came from a different discussion and was never
validated. It is recorded here only so it is not re-proposed as settled.

What survives from it, and still governs the UX:

1. **Screens 01-03 have no checkout.** Identity, credential and parking complete with no
   payment of any kind. This is a hard UX constraint regardless of how the fee is
   eventually collected.
2. **Non-payment must never affect gate access.** Denying gate or building access for
   non-payment reads as a self-help lockout or utility shutoff in most states - illegal,
   and it is the landlord's remedy, not a vendor's. **There is no code path from a failed
   charge to a revoked credential.** This holds under every collection model.
3. Gate Guard should not become a consumer collections operation - no dunning, no
   chargeback handling on the mandatory fee.

**Card payments are for optional items only:** fobs, key tags, store merch, renters
insurance, DirecTV, security deposit and monitoring.

When the collection question reopens, the live options are: property invoicing with the
property posting manually, a PMS-side integration if one becomes reachable, or direct
resident card billing - which reintroduces (1) and (3) and needs the lockout constraint
enforced explicitly.

### D4 — Revenue share via Stripe Connect, ledger in Supabase
- **Separate charges and transfers**, not application fees — up to four parties per
  transaction. Charge on the platform account, then N transfers, each tagged with party
  and tier in metadata.
- **Supabase owns the commission ledger.** Stripe is the movement layer, not the source
  of truth. Connect cannot answer "what does this master agent earn this month."
- **Express accounts** for dealers — Stripe handles KYC and 1099s.
- **Hold commissions ~30 days** before release, so refunds and chargebacks don't require
  clawback logic.

### D5 — Fobs and key tags are credentials, not merch
A fob must be enrolled in Brivo against a named resident at a property; no dropship
supplier can do that. **Ship blank and inert, enroll on first tap at the gate.** Same
code path whether ordered on the access screen or in the store. The resident cannot tell
the two order types apart and shouldn't; the order handler must.

### D6 — Third-party services are not carts
- **Internet / DirecTV:** order intake and commission tracking. Pricing and provisioning
  live with the carrier. Building a cart for DirecTV is a trap.
- **Security system:** a quote flow — configurator → deposit + monitoring subscription →
  scheduled install. This is FORGE (the Nexus quote builder) pointed at a resident
  instead of a property. **Reuse it, don't rebuild.**
- **Renters insurance:** likely the highest-attach item wherever the lease mandates
  coverage.

### D7 — The offer engine is the actual product
A per-property rules table computing what a given resident may see. East Ponds has a bulk
internet ROE, so internet cannot be sold there — the card becomes an activation helper
instead. Another property excludes DirecTV. Parking tiers, prices, counts and whether LPR
exists all vary.

**Never hardcode this and never scatter it through conditionals in the UI.** It is a
first-class table. It is also the strongest argument for building rather than buying.

### D8 — Provisioning is a durable job queue
Inngest. Trigger: activation or payment succeeds → issue Brivo credential, assign parking
space, generate GateCard, send welcome. Must be **idempotent, retriable, and expose a
status screen the leasing office can read.**

---

## PMS INTEGRATION — read before proposing anything

**Gate Guard does not integrate with property management systems. Brivo does.**

Brivo already carries certified connectors to RealPage, Entrata, Yardi and Rent Manager.
Read the roster out of Brivo; write credentials back into it. One integration surface,
and it's the one Gate Guard is already deepest in.

A prior session burned a cycle designing around Yardi's Interface Partner program
(requires two years in business, programming experience, and three active Voyager clients
before you may even apply). That entire sequencing dissolves. Do not revisit it.

What still holds:
- **Brivo is a credential sync, not a rent roll.** Name, unit, move-in/move-out dates.
  Very likely no lease financial terms, rent amounts or ledger balances.
- **Brivo has no financial object**, so it cannot post a charge to a ledger. D3 therefore
  runs on manual property invoicing. That is correct for v1.
- The PMS → Brivo sync is **one-way, PMS as master**. Plates, parking assignments and
  purchases do not flow back. If a property wants them in Yardi, that is a report you
  generate, not a sync.
- The Brivo ↔ PMS connector is licensed **per property account**. Verify per property;
  it is a deployment prerequisite, not an assumption.

---

## TWO MONEY RAILS - never cross them

| | Mandatory (parking + access) | Optional (services, security, store) |
|---|---|---|
| Path | **OPEN - see D3.** No ledger access. Not built. | Resident -> checkout -> Stripe Connect -> dealer tiers + Gate Guard |
| Instrument | Undecided | Card on file |
| Failure mode | Undecided | Retry, dun, or drop the item |
| Never | Affects gate access | Affects gate access |

The rails stay separate whatever D3 resolves to. Optional-item failures drop the item;
they never touch a credential.

---

## BUILD ORDER - UX FIRST

**Current phase: UX only.** Build and agree the six screens against mock data before
wiring anything. No Supabase queries, no Stripe calls, no Brivo reads, no Clerk gating
until the screens are signed off.

Mock data lives in `lib/mock/`. Every screen reads from the same typed shapes the real
backend will satisfy, so wiring is a swap of the data source, not a rewrite.

---

## THE SIX SCREENS

Mobile-first. Move-in happens on a phone in a parking lot, not at a desk. Desktop layouts
are not designed yet.

| # | Route | Purpose | Checkout? |
|---|-------|---------|-----------|
| 01 | `/[siteSlug]/move-in` | Confirm identity, unit, move-in date (pre-filled from Brivo); one editable field (mobile); explicit "nothing to pay here" | No |
| 02 | `/[siteSlug]/move-in/access` | Credential choice — phone key (free, default), fob, key tag; household members each get their own link; GateCard photo deferred | Card, fobs only |
| 03 | `/[siteSlug]/move-in/parking` | Space tier with real inventory counts, vehicle and plate; upgrades post to ledger | No |
| 04 | `/[siteSlug]/move-in/services` | Offer-engine filtered; prominent skip | Card |
| 05 | `/[siteSlug]/move-in/store` | Dropship merch + credential items; the only real cart | Card |
| 06 | `/[siteSlug]/move-in/confirmation` | Grouped by **state** — working now / on the way / scheduled — not by product; both rails shown separately; Add to Wallet is the only button | — |

### UX principles
- **The property owns the header.** Gate Guard is subordinate — the resident's
  relationship is with their community. Property name and accent are per-property tokens.
- **Never block activation on anything optional.** A declined fob, a missing photo, an
  abandoned session after screen 02 — access must already be live.
- **"Not your unit?" routes to the leasing office**, so a stale sync is never a dead end.
- **Screens 01–03 must complete on a bad connection, in under four minutes, with no
  payment.** Test every proposed feature against this.
- **Support routes to the property, not to Gate Guard.** Taking resident tier-one support
  undercuts the property relationship and buries you in tickets.

### Follow-up sequence — most revenue arrives here, not on screen 04
Day 0 confirmation SMS · Day 3 "did it work?" · Day 10 insurance nudge (only where the
lease requires it) · Day 30 settled-in security offer · Month 10 renewal re-open ·
Move-out revoke and settle.

### Metrics
Activation completion (01–03) is the only one that really matters. Wallet-add rate
predicts support load. Time from link to first unlock is product health. Also: attach rate
per screen, manual-add rate (sync quality), leasing tickets per move-in (renewal risk).

---

## UNVERIFIED — check before building on these

1. **Does the Brivo sync carry resident email and/or phone?** If not there is no magic
   link and the entry point collapses; fallback is a QR code at key handover. **Verify
   field-by-field against a live Brivo account, not the docs.** Highest-risk assumption
   in the design.
2. **Does the property's Brivo account have its PMS connector enabled?** Licensed per
   account.
3. **Sync interval, and what move-out carries.** Nightly misses same-day leases. Move-out
   drives stopping recurring billing.
4. **Will property managers accept manual ledger posting from an invoice?** All of D3
   rests on this.
5. **Does a mandatory lease-required access fee read as rent in the jurisdiction?** Some
   states treat mandatory ancillary fees as rent. **Needs counsel — nothing here is legal
   advice.**
6. **Does Brivo's API expose mobile credential issuance and wallet provisioning?** The
   confirmation screen's most valuable action depends on it.

---

## MOVE-IN / MOVE-OUT DETECTION

**Brivo does not push roster changes.** Its event subscriptions carry ACCESS
events — door opens — over webhooks. User created/removed is not among them;
every published Brivo integration polls the user endpoint on a schedule. So a
move-in is *detected*, not *received*: it is a Brivo user id we have never seen
at this site. A move-out is a user id that stopped appearing.

That makes absence the move-out signal, and **absence lies**. A truncated page,
a 500 on page 4, or a PMS blip look exactly like residents leaving. The previous
sync deactivated every resident missing from a single fetch with no guard — one
bad response would have emptied a property's intercom directory.

Four defences, all in `lib/reconcile.ts`, which is pure and tested:

1. **Baseline mode.** A site's first run adopts the whole roster as pre-existing
   and fires nothing. Onboarding 832 units must not send 832 welcome emails.
   Leaving baseline is a deliberate act — never inferred.
2. **Incomplete fetch proves nothing.** A run that didn't page cleanly can never
   conclude a move-out.
3. **Shrink guard.** A roster that fell more than the site's threshold is a bad
   pull, not an exodus. The run records what it *would* have done, emails staff,
   and changes nothing.
4. **Confirmation runs + grace period.** Absent from N consecutive clean runs
   AND past the grace window. Removed and re-added inside it produces no event.

Other cases that are neither move-in nor move-out: an **internal transfer**
(unit changes, parking follows, credential doesn't) and a **return** after a
previous move-out (a new tenancy, treated like a fresh move-in — which is why
tenancies are their own table and notifications key on them, not on the person).

**On move-out, three things must happen** or they become support calls:
recurring subscriptions end, the parking space is released back to inventory,
and outstanding invite links are revoked. Credentials are NOT revoked from here
— Brivo removing them *is* the revocation, and the PMS is master.

**Resident emails are gated per site** (`auto_invite_residents`, default false).
Staff get one digest per run; residents get individual invites. Auto-mailing
real people off a roster nobody has watched yet is a one-time mistake.

### Units are Brivo SITES — and that name collides with ours

⚠️ **`sites` in our schema is a PROPERTY (East Ponds). A Brivo "site" is a UNIT
(214).** Anything referring to Brivo's concept is named `unitSite` /
`brivo_unit_site`. Confusing the two silently maps a whole roster to the wrong
property.

Brivo exposes no user→site edge. Access runs:

    user ──< membership >── group ──< permission >── site (the unit)

So the unit map is built **group-first**: list groups, resolve each group's
unit, list that group's members. That is ~300 requests for an 832-resident
property instead of 832, and it's the direction the API supports.

**The hard part is telling a unit from an amenity.** Residents also have access
to the vehicle gate, the clubhouse, the pool and the package room — all Brivo
sites. With no rule, every resident "lives in" the Main Gate.
`sites.brivo_unit_pattern` (regex) plus `brivo_unit_exclude` decide it; the
default heuristic is digits with an optional letter. A resident matching **more
than one** unit-like name gets no unit and is flagged — usually a stale
permission from a previous unit, or a pattern that is too loose.

The map is cached (`brivo_unit_map_cache`, 6h default). A new resident is always
absent from it, so an unmapped id forces a rebuild rather than waiting out the
TTL. A failed rebuild serves the stale map instead of discarding it — a slightly
old unit beats none. Units are only ever filled IN, never blanked, so a lookup
failure can't read as a building-wide unit change.

**Run `/api/brivo/probe?siteSlug=x` before enabling sync at a property.** It is
read-only and answers the three questions that decide whether this works: which
names look like units vs amenities, whether residents map to exactly one unit,
and whether the roster carries email and phone (assumption #1). `?pattern=` lets
you try a regex without saving it.

---

## CALLBOX DIRECTORY — A PRIVACY CONTROL

The digital callbox directory is what a guest or courier searches to call a
resident. Whether a resident appears in it is their choice where the property
allows it (`sites.directory_mode`: required / optional / hidden), and they pick
how their name shows — full, first name + last initial, or just the unit.

**Two rules, both load-bearing:**

1. **Listing never affects access.** There is no code path from
   `directory_listed` to a credential. An unlisted resident opens the gate
   exactly like a listed one.
2. **Unlisted must not silently break deliveries.** The screen says plainly what
   stops working, because a resident who finds out via a missed package blames
   the building, not the setting.

**Downstream, and easy to miss:** the Pi agent writes residents into the UniFi
Access intercom directory. It must read the `callbox_directory` view, not the
`residents` table — otherwise an opt-out is cosmetic and the resident's name is
still on the screen at the gate. The view also excludes residents with no phone,
since an entry nobody can ring is furniture.

Defaults are a property decision, not ours: an unstaffed gate reasonably
mandates listing, a staffed lobby can default to unlisted.

---

## WHERE THINGS LIVE

| Path | What it is |
|------|-----------|
| `supabase/migrations/200_move_in_portal.sql` | Schema for the PORTAL project (jtvxfmhlmokyuzdxxqpp). Additive only. Not yet run. |
| `supabase/seeds/east_ponds.sql` | One property's catalogs. Every number is a placeholder. |
| `lib/env.ts` | Which integrations are configured. Nothing assumes a service exists. |
| `lib/data/` | The only place that decides mock vs Supabase. Screens can't tell. |
| `lib/data/rows.ts` | Hand-written row types. Replace with `supabase gen types` once the migration has run. |
| `lib/commission.ts` | Six-tier split. Pure — no Stripe, no Supabase, no clock. Test this one. |
| `lib/stripe.ts` | Card rail only. Separate charges and transfers, not application fees. |
| `lib/brivo.ts` | Roster in, credentials out. `auditContactCoverage()` answers assumption #1. |
| `lib/provisioning.ts` | The queue. Idempotency keys derive from the work, never the run. |
| `lib/inngest/functions.ts` | Activation, fulfilment, commission release. |
| `app/api/move-in/activate` | Screens 01-03 complete. Takes no payment, cannot fail on one. |
| `app/api/checkout` | Card rail. Prices re-read server-side, never trusted from the client. |
| `app/api/webhooks/stripe` | Replay-safe. No path from a declined card to a credential. |
| `app/api/health` | Which integrations are actually wired. |
| `lib/reconcile.ts` | Pure move-in/move-out diff. 27 assertions. The guards live here. |
| `lib/lifecycle.ts` | Fetch, apply, notify. The reconciler decides; this acts. |
| `lib/notify.ts` | Resend + templates. Every send claims an idempotency key first. |
| `app/api/sync/brivo` | Per-site roster sync. One property failing never stops the others. |
| `supabase/migrations/201_resident_lifecycle.sql` | Tenancies, lifecycle events, sync runs, invites. |
| `supabase/migrations/202_brivo_site_credentials.sql` | Per-site Brivo creds + unit field mapping. |

**Current state: no env is set, so the portal runs on mock data.** `/api/health`
reports what is live. Endpoints that need a service return 503 with the reason
rather than half-working.

---

## TECH NOTES

- Next.js 16 App Router, TypeScript, React 19
- Tailwind v4 — tokens in `app/globals.css` `@theme`, no `tailwind.config.ts`
- Clerk organizations map to properties; Supabase RLS scoped by property
- Design: near-black charcoal (NOT navy), Montserrat, gold accent, mobile-first,
  `max-w-[430px]` centered, safe-area insets. Per-property accent overrides the gold.

⚠️ **All prices, tier names, counts and dates currently in the code are illustrative
placeholders. None came from Russel.** Do not treat them as real.
