# Brivo Access API — Integration Spec for the Resident Move-In Portal

Researched 2026-09-09 against Brivo's current public documentation.
Primary sources are Brivo's own docs; where a claim comes from a third-party
integrator's documentation it is labelled as such, because those describe one
vendor's account, not the contract.

> **Method note.** Brivo's endpoint-level reference lives in
> `https://apidocs.brivo.com/access/access-api-context.yaml` and per-tag OpenAPI
> 3.1 files whose names are only listed inside that YAML
> ([llms.txt](https://apidocs.brivo.com/access/llms.txt)). Those files are served
> as binary/compressed and could **not** be decoded by the research tooling in
> this session. Everything below that would have come from them is marked
> **UNVERIFIED** and needs a second pass with a tool that can read the YAML, or a
> live sandbox key.

---

## 1. Summary — confirmed vs unverified

### Confirmed against Brivo documentation

| Claim | Source |
|---|---|
| Auth host `https://auth.brivo.com`, API host `https://api.brivo.com`; EU variants `auth.eu.brivo.com` / `api.eu.brivo.com` | [api-overview.md](https://apidocs.brivo.com/access/api-overview.md) |
| Every API call needs BOTH a bearer token AND an `api-key` header | [api-overview.md](https://apidocs.brivo.com/access/api-overview.md) |
| Both `grant_type=password` and 3-legged `authorization_code` are supported | [api-overview.md](https://apidocs.brivo.com/access/api-overview.md) |
| Access token lives **300 seconds**; refresh is "mandatory, not optional" | [llms.txt](https://apidocs.brivo.com/access/llms.txt) |
| Paging is `offset` + `pageSize`, default 20, **max 100**; response `{data, offset, pageSize, count}` | [api-overview.md](https://apidocs.brivo.com/access/api-overview.md) |
| Null/empty fields are **omitted** from responses, not returned as `null` | [api-overview.md](https://apidocs.brivo.com/access/api-overview.md) |
| Path prefix is `/v1/api/...` (e.g. `https://api.brivo.com/v1/api/sites`) | [llms.txt](https://apidocs.brivo.com/access/llms.txt) |
| 150 endpoints in the Access API | [llms.txt](https://apidocs.brivo.com/access/llms.txt) |
| Rate limits: dev key 25,000 calls/month and 25 calls/sec; production key 50 calls/sec on a tiered monthly quota (Tier 0–3, 100k–2M calls) | [Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf) |
| Production API keys must be **enabled by a Brivo employee** after a certification call | [Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf) |
| Webhook event subscriptions cover "activity events and administrative journals" | [Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf) |
| The RealPage connector **fetches units from RealPage and creates Brivo sites** from them | [Brivo: RealPage](https://support.brivo.com/l/en/category/710jbsomrs-realpage) |
| Yardi ↔ Brivo is **one-way, Yardi as source of truth, syncing hourly**; a passed move-out date revokes access | [Yardi Voyager and Brivo Integration Instructions](https://resources.brivo.com/sales-sheets/yardi-voyager-and-brivo-integration-instructions) |
| Brivo Wallet Pass (Apple/Google) is a **separate purchase**, enabled per account, and the badge is added to the wallet **from inside the Brivo Mobile Pass app** | [Brivo: Apple Wallet badge](https://www.brivo.com/products/access-control/credentials/apple-wallet/) |
| A Brivo Mobile Pass is issued by assigning a Mobile Pass credential to a user who **must already have an email address** on their profile | [Brivo: Issuing a Brivo Mobile Pass](https://support.brivo.com/l/en/article/5axixpga74-issuing-a-brivo-mobile-pass) |
| An unknown card presented at a reader lands in "Unknown Card Scans" and needs **manual admin action** to become a credential | [Latitude Security KB: Adding Unknown Credentials to the Card Bank](https://support.latitudesecurity.com/portal/en/kb/articles/unknown-credentials) |

### Unverified — do not build on these without a live account

- The exact `User` response schema (which contact fields exist and what they are called).
- Whether the API can **create a Brivo Mobile Pass credential and trigger its invite**.
- Whether **roster changes** (user created / deleted / group membership changed) are
  available as webhook event types, or only pollable.
- Whether a Brivo `group` object carries a `siteId` / `siteName` — `lib/brivo-topology.ts`
  depends on this and it is not corroborated by any source found.
- Whether the "Unknown Card Scans" bank is exposed over the API at all.
- Whether the PMS connectors are reachable by a third party in any form.

---

## 2. AUTH

### Hosts and headers

Source: [api-overview.md](https://apidocs.brivo.com/access/api-overview.md)

| | Production | EU |
|---|---|---|
| Auth | `https://auth.brivo.com` | `https://auth.eu.brivo.com` |
| API | `https://api.brivo.com` | `https://api.eu.brivo.com` |

Calls to the **API host** require:

```
api-key: <developer portal API key>
Authorization: bearer <ACCESS_TOKEN>
Content-type: application/json
```

Calls to the **auth host** require:

```
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
Content-type: application/x-www-form-urlencoded
```

TLS 1.2 or newer is required.
([api-overview.md](https://apidocs.brivo.com/access/api-overview.md))

### Credentials needed — all four, per account

1. **Client ID + Client Secret** — from an OAuth application registered in the
   Brivo Access account.
2. **API key ("Mashery" key)** — from the Brivo **Developer Portal**
   (`developer.brivo.com`), sent as the `api-key` header on every API call.
   ([api-overview.md](https://apidocs.brivo.com/access/api-overview.md);
   [Nexla: Brivo connector](https://docs.nexla.com/user-guides/connectors/brivo_api))
3. **Username + Password** of a Brivo administrator, for the password grant.
4. (For the 3-legged flow instead of 3: a **refresh token** obtained once by
   walking a human through `https://auth.brivo.com/oauth/authorize`.)
   ([Nexla: Brivo connector](https://docs.nexla.com/user-guides/connectors/brivo_api))

**Yes — the API key must be provisioned by Brivo.** Developer keys are
self-service but capped at 25,000 calls/month; **production keys are "enabled by
a Brivo team member"** only after registering at `developer.brivo.com`, emailing
`BrivoAPI@brivo.com`, taking a 30-minute technical call, and passing a
certification demonstration.
([Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf))

A sandbox account is "a production account that does not have access control
data" — usable to prove auth and object shapes, but you need a demo hardware kit
or a real property to see a realistic roster. (same PDF)

### Grants

Both are documented ([api-overview.md](https://apidocs.brivo.com/access/api-overview.md)):

- **Password grant** — `POST /oauth/token` with
  `grant_type=password&username=…&password=…`. This is what `lib/brivo.ts`
  already does, and it is a documented flow, not a hack. A third-party
  integrator (Maptician) confirms it is the normal shape for "Brivo custom app
  integrations."
  ([Maptician: Brivo Technical Overview](https://help.maptician.com/en_US/presence/brivo-technical-overview))
- **3-legged authorization code** — `GET /oauth/authorize` → code → `POST
  /oauth/token` with `grant_type=authorization_code`. The partner program's build
  guide steers certified partners toward this flow.
  ([Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf))

### Token lifetime and refresh — this is a live defect in our code

```json
{ "access_token": "…", "token_type": "bearer",
  "refresh_token": "…", "expires_in": 300 }
```

> "The `access_token` returned by the password grant expires in **300 seconds**.
> This is short enough that any multi-call flow … will outlive a single token.
> Refresh is mandatory, not optional."
> — [llms.txt](https://apidocs.brivo.com/access/llms.txt)

Refresh:

```
POST https://auth.brivo.com/oauth/token
Authorization: Basic {BASE64_CLIENT_CREDENTIALS}
api-key: {api-key}
Content-type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={REFRESH_TOKEN}
```

Note the `api-key` header is present on the **refresh** request in Brivo's own
example, unlike the initial password-grant example.

**What this means for us.** `lib/brivo.ts#getToken` mints a token and discards
the refresh token; `lib/brivo-topology.ts#buildUnitMap` then takes that one token
through a group-first crawl that is explicitly designed to be ~300 sequential
requests. Any property where that crawl takes longer than five minutes will fail
partway through with a 401 — and `buildUnitMap` treats a failed page as an
incomplete map, which is the right guard but the wrong reason. **A token manager
that persists the refresh token and refreshes proactively is a prerequisite for
the topology crawl, not a nicety.**

### Browser calls are impossible

`auth.brivo.com` and `api.brivo.com` cannot be called from a browser — CORS
blocks it, and Brivo's own guidance is to proxy through a dev server.
([llms.txt](https://apidocs.brivo.com/access/llms.txt)) Every Brivo call must
originate from our server. This is already true of `lib/brivo.ts`
(`import 'server-only'`), and it is a hard constraint, not a preference.

---

## 3. ROSTER READ

### Endpoints

The endpoint index below is drawn from a third-party connector catalogue
([Nexla: Brivo connector](https://docs.nexla.com/user-guides/connectors/brivo_api)),
cross-checked against Brivo's own path convention
(`https://api.brivo.com/v1/api/<resource>`,
[llms.txt](https://apidocs.brivo.com/access/llms.txt)). **The exact paths and
verbs are UNVERIFIED** against Brivo's reference files.

| Purpose | Object |
|---|---|
| List users (cardholders) in the account | Users |
| Get one user | User |
| List credentials assigned to a user | User Credentials |
| List access groups a user belongs to | User Access Groups |
| Query whether a user is suspended | User Suspended Status |
| Create / update / delete a user | Users |
| Suspend / reinstate a user | Users |
| List account-wide custom field definitions | Custom Fields |

`GET /v1/api/users` is the roster read, and it is the one call we already make.

### Fields

Brivo does not publish the `User` schema on any page reachable in this research.
What is corroborated:

- **Name** — `firstName` / `lastName`. (Used by every integrator; our code reads them.)
- **Email** — present on the user profile, and **required** before a Mobile Pass
  can be issued ([Issuing a Brivo Mobile Pass](https://support.brivo.com/l/en/article/5axixpga74-issuing-a-brivo-mobile-pass)).
  Its presence on a given *roster* is a data question, not an API question.
- **Phone** — our code reads `phoneNumbers[0].number`. **UNVERIFIED** shape.
- **Custom fields** — account-wide, user-scoped, and retrievable. Axonius fetches
  "Custom Fields, Assigned Credentials, Suspended Status, Groups" as *extended*
  user data, which implies **custom fields are not returned on the plain
  `GET /users` list and need a second call or an expansion flag**
  ([Axonius: Brivo](https://docs.axonius.com/docs/brivo)). That matters: our
  `brivo_unit_source='custom_field'` path may be N+1, not free.

> ⚠️ **"Empty or null fields are omitted from JSON responses, not returned as
> `null`."** ([api-overview.md](https://apidocs.brivo.com/access/api-overview.md))
> A resident with no email has **no `email` key at all**. Any probe that counts
> contact coverage must test for key absence, not for a null value.
> `auditContactCoverage()` in `lib/brivo.ts` is written correctly for this
> (`u.email ?? null`), but any future field mapping must respect it.

### Pagination

Source: [api-overview.md](https://apidocs.brivo.com/access/api-overview.md)

- `offset` — records to skip, default `0`
- `pageSize` — default **20**, maximum **100**
- Response: `{ "data": [...], "offset": 0, "pageSize": 20, "count": 0 }`

Our `pageSize=100` is at the documented ceiling. Our termination test
(`page.length < pageSize`) works but is weaker than it needs to be — the response
carries a `count`, and **paging until `offset + data.length >= count` is a
stronger completeness proof**, which matters a great deal here because
`lib/reconcile.ts` refuses to conclude a move-out from an incomplete fetch. Using
`count` turns "we think we got everything" into "the server told us how many
there were."

### Filtering

Format `<field>__<op>:<value>`, operators `eq` `ne` `gt` `lt`, multiple values
comma-separated, multiple filters semicolon-separated
([llms.txt](https://apidocs.brivo.com/access/llms.txt)):

```
?filter=site__eq:111;occurred__gt:2024-01-01T00:00:00Z
```

Using `:` instead of `__` between field and operator returns
`400 "Invalid filter format"`. Which fields are filterable on `/users` is
**UNVERIFIED**.

### Rate limits

Source: [Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf)

| | Per second | Per month |
|---|---|---|
| Developer key | 25 | 25,000 |
| Production key | 50 | Tier 0–3, 100,000 → 2,000,000 |

Usage is included for accounts on Professional or Enterprise Edition; otherwise
Brivo bills the tier through the authorized dealer.

> ⚠️ **This is a budget the current design will overrun.** The group-first unit
> map is ~300 requests per rebuild for an 832-unit property. At the default
> `brivo_topology_ttl_minutes = 360` that is 4 rebuilds/day ≈ 1,200 calls/day ≈
> **36,000 calls/month for one property**, before the roster read itself and
> before any cache-miss rebuild forced by a new resident. Three properties
> exhaust a 100,000-call Tier 0 quota. The per-property API key mitigates this
> (each property's quota is its own) **only if the quota is per account rather
> than per developer key — UNVERIFIED, and worth asking Brivo directly.**

---

## 4. UNIT TOPOLOGY

### The object hierarchy

Confirmed shape, assembled from
[Nexla's object catalogue](https://docs.nexla.com/user-guides/connectors/brivo_api),
Brivo's [credentials page](https://www.brivo.com/products/access-control/credentials/),
and a dealer's account of group management
([Decision Tree Technologies](https://dtree.freshdesk.com/support/solutions/articles/150000213355-brivo-access-user-and-group-management)):

```
Account
├── Site ................. "physical locations/facilities"
│   └── Access Point ..... a door/entry point; carries site + control panel association
├── Control Panel ........ hardware controller
├── User (cardholder)
│   ├── Credential ....... card / fob / PIN / mobile / wallet; assigned or unassigned
│   ├── Custom Field values
│   └── Group membership
├── Group ("Access Group")
│   └── Privilege ........ (access point × schedule)
├── Schedule / Holiday
└── Credential Format
```

Access is granted **only** through groups: "A user not in any group will have no
door access," and a group is edited by assigning a schedule to each door
([Decision Tree Technologies](https://dtree.freshdesk.com/support/solutions/articles/150000213355-brivo-access-user-and-group-management)).

### Is there a native "unit" field? — Our assumption is CORRECT, with a caveat

Nothing in Brivo's model is a unit. There is no `unit` object and no documented
`unit` property on a user. A unit number can only live in one of three places,
which is exactly what `sites.brivo_unit_source` already encodes:

1. a **Brivo site** named for the unit,
2. a **group** named for the unit,
3. a **custom field** on the user.

**Brivo's own RealPage connector confirms (1) is the shape Brivo itself
produces:** the integration "fetches units from RealPage" and "can automatically
create new sites in Brivo" from them
([Brivo: RealPage](https://support.brivo.com/l/en/category/710jbsomrs-realpage)).
So `AGENTS.md`'s "**Units are Brivo SITES**" is not a local quirk of East Ponce —
it is what a PMS-connected Brivo account looks like when Brivo builds it. The
naming-collision warning in `203_brivo_unit_topology.sql` is well placed.

The caveat: that is a *convention produced by a connector*, not a guarantee of
the data model. An account set up by hand, or by a different connector, may
model units as groups. Keeping `brivo_unit_source` per site is the right call.

### There IS no user→site edge — CORRECT

No documented endpoint returns a user's sites. Access reaches a site only through
`user → group → privilege → access point → site`.

### But one claim in AGENTS.md needs correcting

> `AGENTS.md`: "it's the direction the API supports"

A **`User Access Groups` endpoint exists** — "List access groups a user belongs
to" ([Nexla](https://docs.nexla.com/user-guides/connectors/brivo_api)). So the
user→group direction is supported too. Group-first is the right choice **for cost**
(~300 calls vs ~832), not because the other direction is unavailable. That
matters practically: for a *single* new resident arriving mid-day, one
`GET /users/{id}/groups` call answers "which unit?" far more cheaply than forcing
a full 300-call rebuild. Under the rate limits in §3 that difference is the
difference between fitting inside Tier 0 and not.

**Recommendation:** keep the group-first crawl as the bulk/cache path, and add a
per-user lookup as the cache-miss path, instead of `getUnitMap`'s current
"unmapped id forces a full rebuild."

### ⚠️ A likely bug: `group.siteId` is not corroborated

`lib/brivo-topology.ts` resolves a group's unit like this:

```
cfg.source === 'group' ? g.name : (g.siteId ? siteName.get(g.siteId) : g.siteName ?? g.name)
```

Every description of a Brivo group found in this research links a group to
**doors** via privileges and schedules, and one dealer states groups are
effectively site-agnostic, spanning devices across sites
([Decision Tree Technologies](https://dtree.freshdesk.com/support/solutions/articles/150000213355-brivo-access-user-and-group-management)).
**Whether the group object carries `siteId` or `siteName` at all is UNVERIFIED.**
If it does not, `brivo_unit_source='brivo_site'` silently produces an empty label
for every group, `isUnitName('')` returns false, every group is skipped, and the
run ends with "No Brivo site looked like a unit" — the exact failure message
already in `lib/lifecycle.ts`.

The path that is definitely available is one hop longer:

```
group → (privileges / access points) → accessPoint.siteId → site.name
```

`Access Points` are documented as carrying "control panel and site association,"
and `Site Access Points` lists a site's doors
([Nexla](https://docs.nexla.com/user-guides/connectors/brivo_api)). **Whether a
`groups/{id}/access-points` or group-privileges endpoint exists is UNVERIFIED**
and is the single most important thing to confirm before the topology code is
trusted. `/api/brivo/probe` should dump the raw group JSON so this is answered
from one real response.

### How to reliably determine a user's unit

In order of preference, once verified against a live account:

1. **Custom field**, if the property populates one — one field read, unambiguous.
2. **Group name**, if groups are named for units — `user → groups`, filter by the
   unit pattern.
3. **Site via access point** — `user → groups → access points → site`, with the
   unit/amenity pattern applied to the site name.

The amenity-vs-unit problem `AGENTS.md` describes is real and unavoidable in all
three: a resident legitimately belongs to the pool group and the main gate group.
`brivo_unit_pattern` + `brivo_unit_exclude` + "more than one match ⇒ flag, never
guess" is the correct handling, and no API feature removes the need for it.

---

## 5. CREDENTIALS

### Operations

From [Nexla's catalogue](https://docs.nexla.com/user-guides/connectors/brivo_api)
(**exact paths and verbs UNVERIFIED**):

| Operation | Notes |
|---|---|
| List credentials in the account | "assigned or unassigned" |
| Get one credential | |
| Create credential | card / badge / PIN |
| Delete credential | |
| Assign credential to user | |
| Remove credential from user | |
| List credentials assigned to a user | |
| List credential formats | e.g. HID 26-bit |

Brivo's product page confirms central issue/update/**remote revoke** across
sites ([Brivo: Credentials](https://www.brivo.com/products/access-control/credentials/)).

### Credential types

Source: [Brivo: Credential Management](https://www.brivo.com/products/access-control/credentials/)

- **Mobile credentials** — Brivo Mobile Pass; Brivo Unified Credential (BUC)
- **Digital wallet** — Apple Wallet / Google Wallet (see §6)
- **Physical cards** — including dual-technology and encrypted smart cards (DESFire)
- **Fobs**
- **PINs** — "either assigned to a user or time-limited"
- **Biometrics**
- **License plates**

PIN issuance over the API is corroborated in practice: CourtReserve's Brivo
integration "automatically generates PIN codes for all members" once the API key
is entered
([CourtReserve: Brivo integration](https://help.courtreserve.com/en/articles/10126640-brivo-integration-access-control)).

### Can a credential be created unassigned and enrolled on first use? — PARTLY, and NOT the way D5 assumes

**Unassigned credentials exist.** The account-level credential list explicitly
covers credentials "assigned or unassigned"
([Nexla](https://docs.nexla.com/user-guides/connectors/brivo_api)), and `Create
Credential` and `Assign Credential to User` are separate operations. So the
"create a credential object now, bind it to a person later" half of D5 is fine.

**Enrollment on first tap is NOT automatic.** Brivo's behaviour for a card it
does not know is to log it under **Credentials → Unknown Card Scans**. An
administrator must then find the scan by time and door, pick the card format
(Brivo *suggests* formats rather than detecting one), assign an external ID, save
it to the card bank, and then — in a separate workflow — assign it to a user
([Latitude Security KB](https://support.latitudesecurity.com/portal/en/kb/articles/unknown-credentials)).

> ⚠️ **This challenges D5 directly.** "Ship blank and inert, enroll on first tap
> at the gate" describes a self-enrolling reader. Brivo gives you an *unknown
> scan log*, not self-enrollment. Whether that log is exposed over the API — and
> therefore whether we could build the automation ourselves (poll unknown scans,
> match by time window + door + the resident we know is expecting a fob, create
> and assign) — is **UNVERIFIED** and is a top-priority question for Brivo.
>
> If it is not exposed, D5's fulfilment model must change: either the fob is
> pre-encoded with a known card number that we write into Brivo at ship time
> (which means the supplier must tell us the number, i.e. it is no longer a
> dropship blank), or a leasing-office staff member enrolls it manually.

---

## 6. MOBILE PASS — the "Add to Wallet" button does not work the way the design assumes

### How a Brivo Mobile Pass is actually issued

In the Brivo Access UI: open the user, **confirm they have an email address on
their profile**, go to Credentials → Assign Credential → Mobile Pass, confirm the
email, choose the invite language, save. An invite is then sent to that address.
([Brivo: Issuing a Brivo Mobile Pass](https://support.brivo.com/l/en/article/5axixpga74-issuing-a-brivo-mobile-pass))

**An email address is mandatory.** That is a hard dependency, and it converts
`AGENTS.md` assumption #1 from "we would like contact details for the magic link"
into "**without an email address in Brivo, the resident cannot receive a mobile
credential at all**" — regardless of how our portal reaches them.

### Wallet provisioning

Source: [Brivo: Employee Badge in Apple Wallet](https://www.brivo.com/products/access-control/credentials/apple-wallet/)

Brivo Wallet Pass is:

1. **A separate purchase.** Administrators "enable Brivo Wallet Pass in their
   Brivo Access account" — it is not included by default.
2. **Reached through the Brivo Mobile Pass app.** The documented user journey is:
   receive the Brivo Mobile Pass **email invitation** → **download the Brivo
   Mobile Pass app** → open the badge in the app → tap **"Add to Apple Wallet"**
   *there*. The same page states users need "the latest version of the Brivo
   Mobile Pass app" to get the badge into Apple Wallet.

Google Wallet is supported on the same Brivo Wallet Pass product
([Brivo: Google Wallet](https://www.brivo.com/products/access-control/credentials/google-wallet/)).

> ⚠️ **Consequence for the confirmation screen.** There is **no documented
> Apple/Google Wallet provisioning API** — no signed `.pkpass`, no Google Wallet
> save link, nothing our page can hand to the OS. An "Add to Wallet" button in
> our portal cannot add anything to a wallet. The most it can honestly be is a
> deep link / App Store link to the Brivo Mobile Pass app, shown after the
> resident's Brivo invite email has gone out — and even that only works at
> properties that have bought Brivo Wallet Pass.
>
> `AGENTS.md` lists "Add to Wallet is the only button" on the confirmation
> screen. **That button needs to be redesigned around the real flow**: "Check
> your email for your Brivo pass" → "Get the app" → (optionally, for Wallet Pass
> properties) "then add it to your wallet from the app."

### Can the API issue a mobile pass?

**UNVERIFIED.** No public page found states that a Mobile Pass credential can be
created and its invite triggered over the REST API. Circumstantial evidence in
both directions:

- **For:** Brivo's **Identity Connector** performs "automated provisioning" of
  mobile credentials in real time during onboarding from Okta / Microsoft Entra
  ID ([Apple Wallet page](https://www.brivo.com/products/access-control/credentials/apple-wallet/)),
  so a programmatic issuance path exists inside Brivo. Nexudus's coworking
  integration says its customers "receive their Brivo passes via email" as a
  result of automated group/contract handling
  ([Nexudus: Integrating Brivo](https://help.nexudus.com/docs/integrating-brivo)).
- **Against:** every first-party article describing Mobile Pass issuance
  describes a manual UI action, and none mention the API.

This is question #6 in `AGENTS.md`'s unverified list and it remains open. It is
the single highest-value question to put to Brivo, because the answer decides
whether move-in credentialing is fully automated or ends with "the leasing office
clicks Assign Credential."

---

## 7. EVENTS / WEBHOOKS

### What exists

- An **Event Subscriptions** object — "webhook event subscriptions configured for
  the account" — with list operations
  ([Nexla](https://docs.nexla.com/user-guides/connectors/brivo_api)). **Create /
  update / delete verbs and paths are UNVERIFIED.**
- Partners get "webhook-based event subscriptions for real-time access to
  **activity events and administrative journals**"
  ([Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf)).
- Pollable log endpoints: **Access Events** ("badge swipes, unlock actions") and
  **Audit Events** ("administrative audit event log entries")
  ([Nexla](https://docs.nexla.com/user-guides/connectors/brivo_api)).
- `/events/access` supports the standard filter syntax, and its `occurred` filter
  is **capped to a 24-hour window**
  ([llms.txt](https://apidocs.brivo.com/access/llms.txt)) — so it is a tail, not
  an archive. Anything we need beyond 24 hours we must store.

### Event types

Access/security event types documented by an unofficial reference
([zachheine/brivo-unofficial-api-docs](https://github.com/zachheine/brivo-unofficial-api-docs)) —
**third-party, UNVERIFIED against Brivo**:

| Code | Name | Type |
|---|---|---|
| 2004 | Open | `security_event_type.successful_access` |
| 5006 | Invalid Cred Threshold Passed | `security_event_type.failed_access` |
| 5012 | Failed Access Unknown Cred | `security_event_type.failed_access` |
| 5017 | Failed Access User Not Enabled | `security_event_type.failed_access` |
| 5034 | Undownloaded Credential | `security_event_type.failed_access` |

Note **5012 "Failed Access Unknown Cred"** — that is the event fired when a blank
fob is tapped at a reader. If it is deliverable by webhook and carries the card
number, it is the hook D5's enroll-on-first-tap flow would need. **UNVERIFIED.**

### Does Brivo push roster changes? — AGENTS.md is PROBABLY RIGHT, but the claim is stronger than the evidence

`AGENTS.md` states flatly: "**Brivo does not push roster changes.** Its event
subscriptions carry ACCESS events — door opens — over webhooks. User
created/removed is not among them."

**Supporting evidence:**

- Maptician, a production Brivo integration, subscribes to webhooks **only** for
  access events (`securityAction` = "Open") and separately performs "user and
  location ID synchronization … **daily at 4:40 AM Eastern** via Brivo's API
  endpoints"
  ([Maptician: Brivo Technical Overview](https://help.maptician.com/en_US/presence/brivo-technical-overview)).
  If roster webhooks existed, a mature integration would not be polling nightly.
- Every documented event type found is an access/security event.

**Evidence that complicates it:**

- Brivo's partner program says subscriptions cover activity events **and
  administrative journals**
  ([Technology Partner Program Overview (PDF)](https://resources.brivo.com/wp-content/uploads/securepdfs/2024/08/technology-partner-program-overview.pdf)).
  Creating, deleting or suspending a user *is* an administrative action, and a
  pollable **Audit Events** endpoint exists that logs exactly that class of
  change. If admin-journal events are push-subscribable and include user
  create/delete, then **roster changes may in fact be pushable** and the polling
  reconciliation loop would be a fallback rather than the only option.

> **Verdict: AGENTS.md's operational conclusion stands — build the polling
> reconciliation loop — but its factual claim should be softened from "user
> created/removed is not among them" to "UNVERIFIED; no roster event type is
> documented publicly, and the one production integration we can inspect polls
> nightly." The `Audit Events` / administrative-journal path is a real lead worth
> one question to Brivo.**

Nothing here weakens the four defences in `lib/reconcile.ts`. Even with roster
webhooks, absence-based reconciliation is still needed as the backstop for missed
deliveries — and the shrink guard, baseline mode and confirmation runs all remain
correct. Note also that a PMS-driven move-out **removes the user's access in
Brivo automatically**
([Yardi sales sheet](https://resources.brivo.com/sales-sheets/yardi-voyager-and-brivo-integration-instructions)),
which is precisely the "absence" signal `reconcile.ts` is built to read.

---

## 8. PMS CONNECTOR

### It is a Brivo-operated feature, configured inside Brivo Access

Not an API surface. The RealPage connector is enabled from within Brivo Access:
Configuration → Integrations tab → enable RealPage, then wait for the initial
sync job or trigger it manually; units and residents each have their own Sync
button and a "Last Sync date"
([Brivo: RealPage](https://support.brivo.com/l/en/category/710jbsomrs-realpage)).

The Yardi connector requires Brivo to be a qualified Yardi vendor, a Yardi case
to load the Brivo package into the customer's Voyager database, the ILS Guest
Card Interface, and the property handing **Brivo** the Voyager URL, interface
credentials and database details
([Yardi Voyager and Brivo Integration Instructions](https://resources.brivo.com/sales-sheets/yardi-voyager-and-brivo-integration-instructions)).

**Is it API-accessible to third parties? — UNVERIFIED, but almost certainly no.**
No endpoint for configuring, triggering or reading PMS sync state appears in any
catalogue found. What a third party can do is read the *result*: the users, sites
and groups the connector wrote. That is exactly what our design already does, and
it is the right seam.

### What is knowable about how it writes move-ins / move-outs

| | RealPage | Yardi Voyager |
|---|---|---|
| Direction | PMS → Brivo | PMS → Brivo, "Yardi is the single source of truth" |
| Units | Fetched from RealPage; **Brivo sites created automatically** | Brivo pulls "base building and unit access" |
| Residents | Synced into Brivo users; visible under both the Site section and the Users tab | Resident + lease data including move-in/move-out dates |
| Move-out | Not stated | Once the move-out date passes in Yardi, **Brivo removes the resident's access automatically** |
| Cadence | Manual/triggered sync buttons + an initial sync job | **Hourly**, plus a manual "Resync Integration Now" |

Sources: [Brivo: RealPage](https://support.brivo.com/l/en/category/710jbsomrs-realpage),
[Yardi Voyager and Brivo Integration Instructions](https://resources.brivo.com/sales-sheets/yardi-voyager-and-brivo-integration-instructions).

**This answers `AGENTS.md` unverified item #3 for Yardi: the sync interval is
hourly, and move-out carries a date that Brivo acts on by removing access.**
Hourly is good news — it means same-day leases are visible within the hour, and
our own sync cadence, not Brivo's, becomes the limiting factor.

**One nuance against `AGENTS.md`.** `AGENTS.md` states the PMS → Brivo sync is
"one-way, PMS as master." The Yardi sales sheet supports that exactly. But
Brivo's multifamily marketing page claims "**bi-directional sync where
supported**, move-outs can automatically revoke credentials with no manual
cleanup"
([Brivo: Multifamily](https://www.brivo.com/industry/multifamily-security-systems/)).
Marketing copy is not a contract, and the example given (move-outs revoking
credentials) is one-way anyway. **Treat "one-way, PMS as master" as correct and
"bi-directional where supported" as UNVERIFIED marketing** — but it is worth one
question, because if any write-back path exists for *any* PMS, the "plates and
parking are a report, not a sync" decision could be revisited for that PMS.

**Deployment prerequisite stands:** the connector is per-account and per-property
configuration. `AGENTS.md` unverified item #2 remains open and must be checked
property by property.

---

## 9. GAPS — what Brivo does not provide

Brivo is a credential system. Everything below has no home in it and must be
owned by our database.

**Identity and tenancy**
- No **unit** object. No lease, no lease term, no renewal date.
- No **tenancy** concept — no way to distinguish "same person, new lease" from
  "same person, still here." (`201_resident_lifecycle.sql` is correct to key
  notifications on tenancies, not people.)
- No **household** relation. Brivo has users and groups; "the primary resident
  and the two other adults on this lease" is ours to model.
- No **internal transfer** signal. A unit change is a group-membership change,
  indistinguishable from a permission edit without our own before/after state.
- No **move-in / move-out event stream** we can rely on (see §7).

**Money — Brivo has no financial object at all**
- No charge, invoice, balance, ledger, subscription, refund, or payout.
- Therefore no concession tracking, no proration, no merchant-of-record concept.
- This is why D3 (collect at sign-up via Stripe) is not merely convenient but
  forced, and why the "no code path from a failed charge to a credential"
  constraint is easy to hold: Brivo cannot even see the charge.

**Portal state**
- No invite tokens, magic links, or session state.
- No consent records — directory opt-in, marketing opt-in, terms acceptance.
- No **who granted whom** audit. `AGENTS.md` requires that one adult provisioning
  access for another be written to an audit trail with the grantor's identity.
  Brivo's audit journal records *the API user* that made the change — which is
  our service account, not the resident. **This must be our own audit table.**
- No **offer engine** — per-property rules, availability, pricing, ROE exclusions.

**Physical world beyond doors**
- No vehicles, plates, parking spaces or inventory.
- No **callbox directory** with per-resident listing preferences and display-name
  choice. Brivo has no `directory_listed` and no display-name variant. The
  `callbox_directory` view is entirely ours, and the Pi agent reading it rather
  than `residents` is what makes the opt-out real.
- No merch, orders, shipments, or supplier routing.

**Communications**
- No resident notification system we can use for our own messages. Brivo sends
  its own Mobile Pass invite; everything else (day-0 SMS, day-3 check-in,
  renewal) is ours, and each send must claim an idempotency key.

**Operational**
- No **contact-coverage guarantee**. Email is required for a Mobile Pass, but
  nothing forces the PMS to have supplied one. `auditContactCoverage()` measures
  a data quality problem Brivo will not fix.
- **24-hour access-event window** (§7) — any access history we want to keep, we
  store.
- No unit/amenity distinction (§4) — `brivo_unit_pattern` has no Brivo analogue.

---

## 10. What we must build ourselves

In rough order of how load-bearing it is:

1. **A token manager with refresh.** 300-second tokens plus a ~300-request
   topology crawl means the current mint-once pattern will fail mid-run at scale.
   Persist `refresh_token`, refresh proactively, and retry once on
   `401 invalid_token`. Prerequisite for §4's crawl.
2. **A call budget.** Track calls per property per month against the Tier 0–3
   quota. Raise the topology TTL, add the per-user cache-miss lookup instead of a
   full rebuild, and page with `count`. Without this, three properties on a Tier 0
   key is an outage.
3. **The polling reconciliation loop** — already built in `lib/reconcile.ts` and
   `lib/lifecycle.ts`, and this research supports keeping it as the primary
   mechanism regardless of what the admin-journal webhook turns out to do.
4. **The unit map**, including the amenity/unit discrimination and the
   ambiguity flag. Add the `group → access point → site` fallback path in case
   groups carry no `siteId` (§4).
5. **Tenancies, lifecycle events, and the sync-run audit** — `201_resident_lifecycle.sql`.
6. **The whole money layer** — Stripe, Connect, the commission ledger, concessions.
7. **The offer engine** — per-property rules (D7).
8. **Vehicles, parking inventory, and assignment.**
9. **The callbox directory view with listing preferences.**
10. **Invites, consent, and the grantor audit trail.**
11. **A credential-fulfilment model that survives §5** — do not ship code that
    assumes a blank fob self-enrolls until the unknown-scan API question is
    answered.
12. **A confirmation screen that tells the truth about wallets** (§6).

---

## 11. Open questions to ask Brivo

Ordered by how much is blocked behind the answer.

1. **Can a Brivo Mobile Pass credential be created and its invite sent entirely
   over the REST API?** If not, what does Brivo Identity Connector call that we
   cannot? *(Blocks: fully automated move-in credentialing. §6)*
2. **Is there any Apple Wallet / Google Wallet provisioning available to an
   integrator** — a save link, a signed pass, anything — or is the Brivo Mobile
   Pass app the only route into a wallet? *(Blocks: the confirmation screen's
   primary action. §6)*
3. **Are "Unknown Card Scans" exposed over the API** (list, and create-credential
   -from-scan)? Is `5012 Failed Access Unknown Cred` deliverable by webhook, and
   does its payload carry the raw card number and format? *(Blocks: D5's ship-blank,
   enroll-on-first-tap fob model. §5)*
4. **Which event types can an event subscription deliver?** Specifically: are
   administrative-journal events (user created / deleted / suspended / group
   membership changed) push-subscribable, or access events only? *(Decides whether
   polling is the only option. §7)*
5. **Does a `group` object carry a site association**, and is there an endpoint
   listing a group's access points or privileges? *(Blocks: `lib/brivo-topology.ts`
   working at all on a `brivo_unit_source='brivo_site'` account. §4)*
6. **Is the monthly call quota scoped per API key or per Brivo account?** We
   intend one Brivo account per property; does each get its own quota, or do they
   share our developer key's? *(Decides the whole polling cadence. §3)*
7. **What is the exact `User` schema** — the field names for email, phone
   numbers, and custom-field values, and whether custom fields are returned on the
   `/users` list or need a per-user call? *(Sizes the roster read. §3)*
8. **Is any part of the PMS connector reachable over the API** — sync status,
   last-sync time, trigger-resync, or per-resident sync provenance? Even read-only
   sync status would let us tell a resident "your lease hasn't reached us yet"
   instead of "not your unit?" *(§7 of AGENTS.md's UX. §8)*
9. **What does "bi-directional sync where supported" mean concretely**, and for
   which PMS? *(Could reopen the plates/parking write-back decision. §8)*
10. **For a RealPage- or Yardi-connected multifamily account, what exactly does
    Brivo write** — does the resident user get an email and phone from the PMS,
    and is the unit encoded in the site name, a group name, or a custom field?
    *(Answers AGENTS.md assumption #1 generically instead of property by
    property. §3, §4)*

---

## Appendix — corrections to AGENTS.md

| AGENTS.md says | Research says |
|---|---|
| "Units are Brivo SITES" | **Confirmed**, and stronger than assumed — Brivo's own RealPage connector creates a Brivo site per unit. |
| "Brivo exposes no user→site edge … it's the direction the API supports" | First half correct. Second half imprecise: a `User Access Groups` endpoint exists, so user→group works too. Group-first is a **cost** optimisation, and a per-user lookup should be added for cache misses. |
| "Brivo does not push roster changes … user created/removed is not among them" | **Operationally sound, factually unproven.** No roster event type is publicly documented and the one inspectable production integration polls nightly — but Brivo's partner PDF says subscriptions cover "administrative journals," which is the class of event a user-create would fall into. Soften to UNVERIFIED and ask. |
| "Brivo does not carry a unit number natively" (migration 202) | **Confirmed.** No unit object, no unit field. |
| "The Brivo ↔ PMS connector is licensed per property account" | **Confirmed** — configured inside each Brivo Access account's Integrations tab. |
| "The PMS → Brivo sync is one-way, PMS as master" | **Confirmed for Yardi** by Brivo's own sales sheet. Brivo marketing separately claims "bi-directional sync where supported" — UNVERIFIED. |
| Unverified #3, "sync interval, and what move-out carries" | **Answered for Yardi:** hourly, and a passed move-out date makes Brivo remove access automatically. |
| Unverified #6, "does Brivo expose mobile credential issuance and wallet provisioning?" | **Wallet provisioning: no**, not to integrators — the badge is added from inside the Brivo Mobile Pass app, and Wallet Pass is a separate per-account purchase. **Mobile pass issuance via API: still UNVERIFIED.** |
| Confirmation screen: "Add to Wallet is the only button" | **Needs redesign.** Our page cannot add anything to a wallet. |
| D5: "ship blank and inert, enroll on first tap at the gate" | **At risk.** Brivo logs unknown cards for manual admin review; it does not self-enroll. API access to that log is UNVERIFIED. |
| `lib/brivo.ts` mints a token per operation | **Insufficient.** 300-second lifetime; refresh is documented as mandatory for multi-call flows. |
| `pageSize=100` | **Correct** — that is the documented maximum. |
