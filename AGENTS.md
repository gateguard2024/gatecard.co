# GateCard — Agent Context

## What this is
GateCard is the visitor portal and resident app for GateGuard properties.
Live at gatecard.co. Companion to portal.gateguard.co (SOC dashboard).

## Tech Stack
- Next.js 16 App Router, TypeScript, React 19
- Tailwind CSS v4 (config via globals.css @theme — no tailwind.config.ts)
- Supabase (same project as portal — shared schema)
- Twilio (masked calls: visitor calls resident without revealing either number)
- Eagle Eye Networks (EEN snapshot on visitor arrival)

## Routing
- `/[siteSlug]` — visitor entry hub for a property (QR code destination)
- `/[siteSlug]/directory` — resident directory + search
- `/[siteSlug]/call` — active call screen (query: ?resident=ID&name=NAME&unit=UNIT)
- `/[siteSlug]/packages` — package room entry flow
- `/[siteSlug]/leasing` — leasing office call
- `/[siteSlug]/emergency` — emergency flow
- `/resident` — resident dashboard (protected, auth TBD)

## Key API Routes
- `POST /api/call/initiate` — start masked Twilio call to resident
- `POST /api/call/twiml` — Twilio webhook: IVR (press 1 to open gate)
- `GET  /api/call/status?callSid=` — poll Twilio call status
- `POST /api/gate/open` — open gate via Brivo (calls portal API)
- `POST /api/access-events` — log visitor event to Supabase
- `GET  /api/residents?siteSlug=` — fetch resident directory for a site
- `GET  /api/sites/[slug]` — fetch site/property info

## Supabase Tables Used
- `residents` — unit, name, phone (hashed), active status
- `access_events` — visitor logs, call SID, photo_url, outcome, entry_type
- `sites` (or `properties`) — property info, gate IDs, EEN camera IDs

## Design System
Dark navy (NOT black). See globals.css @theme for tokens.
- Background: #080E1A
- Surface: #0C1827
- Primary blue: #2563EB
- Mobile-first, max-w-[430px] centered, safe-area insets

## Visitor Call Flow
1. Visitor scans QR → lands on /[siteSlug]
2. Taps "Call Resident" → goes to /[siteSlug]/directory
3. Searches and taps a resident → navigates to /[siteSlug]/call?resident=ID
4. Frontend calls POST /api/call/initiate → Twilio dials resident
5. Page polls GET /api/call/status every 2s
6. Resident answers → hears IVR: "Press 1 to open gate, 2 to decline"
7. Resident presses 1 → /api/call/twiml calls /api/gate/open
8. Gate opens via Brivo → access_event logged → page shows success

## Routing (updated)
- `/[siteSlug]` — welcome hub (2 tiles: Deliveries, Visitors & Leasing + emergency corner btn)
- `/[siteSlug]/visit` — combined Visitors & Leasing landing (→ directory or leasing)
- `/[siteSlug]/directory` — resident search
- `/[siteSlug]/call` — active call screen
- `/[siteSlug]/packages` — carrier selection for package room
- `/[siteSlug]/leasing` — leasing office direct dial
- `/[siteSlug]/emergency` — emergency (911 + SOC)
- `/resident` — resident dashboard (Sprint 2, magic-link auth)

## KORE Wireless Super SIM
Twilio's IoT/Super SIM was acquired by KORE Wireless in June 2023.
API architecture is nearly identical but auth and base URL changed.

**Base URL:** `https://supersim.api.korewireless.com/v1`
**Auth:** OAuth 2.0 client credentials
  - Token URL: `https://api.korewireless.com/api-services/v1/auth/token`
  - Header: `Authorization: Bearer <token>`
  - NOT Twilio Basic Auth

**Key resources:**
- `Sim` — the physical/eSIM card; set `Status=active` to activate
- `Fleet` — config group for SIMs; every active SIM needs one
- `Network Access Profile (NAP)` — applied at Fleet level, controls which carriers

**Activating a SIM:**
1. POST to `/v1/Sims/{SID}` with `Fleet=HF...`, `Status=active`, optional `CallbackUrl`
2. API returns `202 Accepted` (async)
3. KORE sends final status to `CallbackUrl` once network activation is complete

**Device config (TRB141):**
- APN: `super`
- Username: blank
- Password: blank
- Data Roaming: **ENABLED** (required — SIM uses multiple IMSIs)

**Env vars:** `KORE_CLIENT_ID`, `KORE_CLIENT_SECRET`, `KORE_FLEET_SID`
**Helper:** `lib/kore-sim.ts` — `getKoreToken()`, `activateSim()`, `deactivateSim()`, `getSim()`, `listSims()`

## Sprint Schedule
- Sprint 1 (Apr 30 – May 6): Visitor portal live, access_events, demo env
- Sprint 2 (May 7 – May 27): Trade show demo, TRB141 gate relay
- Sprint 3 (May 28 – Jun 17): Resident billing, PMS sync
- Sprint 4 (Jun 18 – Jun 30): QA, prod deploy, dealer onboard
