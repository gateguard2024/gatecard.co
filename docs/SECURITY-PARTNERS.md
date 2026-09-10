# In-Unit Security Partners — Research Findings

**Researched:** 2026-09-10
**Question:** Behind an "In-unit security" toggle on the resident move-in "Optional services" screen, can we programmatically enroll a resident with SimpliSafe (or a comparable brand), or is the only path a referral link / lead handoff?

---

## Summary — what is and is not possible

**SimpliSafe: there is no partner API. Programmatic enrollment is not available.**

- SimpliSafe publishes **no public API, no partner API, and no developer portal**. The only statement resembling an official position is third-party: the maintainers of the community Python library state plainly that "SimpliSafe™ has no official API." ([simplisafe-python intro](https://simplisafe-python.readthedocs.io/en/latest/intro.html))
- There **is** a real, reverse-engineered API used by Home Assistant. It is **unofficial, undocumented, unlicensed for commercial use, and explicitly warned to break without notice**. It is not a partner option and must not be used to create customer accounts. (See §1.)
- SimpliSafe **does** run a partner program, but it is a **lead-capture form and an email address** — a four-field "Contact Us" form and `partnerships-uk@simplisafe.co.uk` for the UK. No tiers, no portal, no promo-code system, no API are documented anywhere public. ([simplisafe.com/partner-with-us](https://simplisafe.com/partner-with-us), [simplisafe.co.uk/partner-with-us](https://simplisafe.co.uk/partner-with-us))
- **"Property Managers" is a named partner vertical** on that page — so the conversation is a real one to have — but nothing about how it works mechanically is published. Getting details requires a sales call.
- SimpliSafe's **Terms of Sale prohibit resale**: purchases "are for end user customers only" and transfers or resales "to dealers, resellers or distributors or any other third-party anywhere in the world are prohibited and invalidate the Limited Warranty." This rules out us buying kits and reselling them per unit. ([simplisafe.com/legal/terms-sale](https://simplisafe.com/legal/terms-sale))
- There **is** a documented consumer **Referral Program** (referrer gets a $200 Visa gift card, friend gets 50% off + free Video Doorbell Pro, 45-day click window). It is designed for existing customers referring friends, not for a business channel. ([support article](https://support.simplisafe.com/articles/orders-warranty/simplisafe-referral-program), [simplisafe.com/share](https://simplisafe.com/share))
- There **is** an affiliate program, but the network and terms are **inconsistently reported by third parties** and SimpliSafe publishes nothing itself. (See §4.)

**Bottom line:** today, the only defensible things to put behind the toggle for SimpliSafe are **(b) an affiliate/referral link with tracking** or **(d) lead capture with human follow-up**. **(a) API enrollment does not exist.** **(c) a promo code is plausible but undocumented** — it would come out of a negotiated partner deal, not off the shelf.

---

## 1. Public API

**No public or partner REST API. No developer portal.** There is no `developer.simplisafe.com`, no API docs on simplisafe.com, and no API reference in the support site. Searches of simplisafe.com surface only legal pages and support forum threads.

- Customers have asked for one on SimpliSafe's own support forum; the thread contains **no official SimpliSafe response** committing to an API. ([Public API? — SimpliSafe Support](https://support.simplisafe.com/conversations/apps-and-login/public-api/6190c6788ea41ebb06236870))
- The clearest available statement, from the community library's docs: *"SimpliSafe™ has no official API; therefore, this library may stop working at any time without warning."* ([simplisafe-python](https://simplisafe-python.readthedocs.io/en/latest/intro.html))

### The unofficial API — do not build on this

There is a well-known reverse-engineered API. Be explicit about what it is:

- **`benhutchins/simplisafe`** — "Unofficial SimpliSafe API Documentation," built by **decompiling SimpliSafe's mobile apps**. Carries the disclaimer: *"This documentation is unofficial, and should be used without warranty of any kind."* The repo was **archived (read-only) on 2024-08-28**. ([GitHub](https://github.com/benhutchins/simplisafe), [docs](http://benhutchins.github.io/simplisafe/))
- **`simplisafe-python`** — the async Python client behind the [Home Assistant SimpliSafe integration](https://www.home-assistant.io/integrations/simplisafe/). ([readthedocs](https://simplisafe-python.readthedocs.io/en/latest/api.html), [PyPI](https://pypi.org/project/simplisafe-python/))
- Forum users note SimpliSafe has repeatedly **changed the login protocol**, breaking these clients. ([support thread](https://support.simplisafe.com/conversations/apps-and-login/public-api/6190c6788ea41ebb06236870))

**Why it is unusable for us:** it authenticates *as an existing consumer account* against SimpliSafe's own app endpoints. It exposes arm/disarm and sensor state for a system that already exists — it has **no account-creation, ordering, or provisioning surface at all**. Even if it did, using it commercially to enroll customers would be undocumented, unlicensed, unsupported, and would break silently. **Not a partner option.**

---

## 2. Partner / reseller program

**A program exists in name. It is a lead form.**

SimpliSafe runs a "Partner with Us" page listing six partner verticals: **Membership Association, Telecommunications, Insurance, Homebuilders, Property Managers, Financial Services**.

- US page: [simplisafe.com/partner-with-us](https://simplisafe.com/partner-with-us) — the only interactive element is a **"Contact Us" form with four fields: First name, Last name, Company, Email**.
- UK page: [simplisafe.co.uk/partner-with-us](https://simplisafe.co.uk/partner-with-us) — same verticals, plus a published contact: **partnerships-uk@simplisafe.co.uk**. Positioning: *"SimpliSafe partners with innovative companies to bring holistic solutions to customers everywhere."*

**What is NOT published anywhere:**
- Partner tiers or levels — **none documented**
- A partner portal — **none documented**
- Whether partners get a referral link, promo code, or co-branded landing page — **not stated**
- Any API or technical integration for partners — **not stated**
- A self-serve signup page — **does not exist**; the entry point is the contact form / email only

There is real-world precedent for these partnerships being **marketing/distribution deals, not technical integrations** — e.g. the Branch insurance partnership, announced as a bundling/distribution arrangement. ([Insurance Innovation Reporter](https://iireporter.com/branch-partners-with-home-protection-and-security-system-vendor-simplisafe/))

**Reseller/dealer path: explicitly closed.** Terms of Sale: purchases "are for end user customers only"; resale "to dealers, resellers or distributors or any other third-party anywhere in the world are prohibited and invalidate the Limited Warranty." Customers may buy "on behalf of a business," but SimpliSafe "retains discretion to impose additional limitations." ([terms-sale](https://simplisafe.com/legal/terms-sale))

> **UNVERIFIED:** whether a negotiated Property Manager partnership would in practice include a promo code, a co-branded landing page, or any API. Nothing public confirms or denies it. This can only be established by contacting SimpliSafe directly.

---

## 3. Multifamily / property management

**"Property Managers" is a named vertical, with a three-line value proposition and nothing else.**

Exact published copy: *"Generate incremental tenant revenue. Streamline how you monitor your properties. Protect vacant properties from break-ins and theft."* ([simplisafe.co.uk/partner-with-us](https://simplisafe.co.uk/partner-with-us), same vertical listed on [simplisafe.com/partner-with-us](https://simplisafe.com/partner-with-us))

"Generate incremental tenant revenue" implies a revenue-share or resident-billed model — but **no per-unit pricing, bulk program, unit-count tiers, PMS integration, or provisioning workflow is published**.

- **No dedicated multifamily product page** exists on simplisafe.com (unlike ADT and Vivint, which both have one).
- **No PMS integrations** (Yardi / RealPage / Entrata / AppFolio / ResMan) are listed by SimpliSafe or by those vendors.
- SimpliSafe does not appear in multifamily-industry roundups of smart-apartment platforms the way ADT Multifamily, Vivint Smart Properties, and SmartRent do.

> **UNVERIFIED:** existence of any bulk or per-unit SimpliSafe program. Absence of public documentation is not proof of absence, but there is nothing to build against.

---

## 4. Affiliate program

**An affiliate program exists. The US network and terms are not published by SimpliSafe and third-party directories contradict each other.**

Confirmed:
- **UK program runs on Awin** — official merchant profile, **30-day attribution window**, "60-day money back guarantee and 30-day validation window," contact `partnerships-uk@simplisafe.co.uk`. Commission described only as "generous" — **no number published**. ([Awin merchant profile 27387](https://ui.awin.com/merchant-profile/27387))
- **SimpliSafe uses Impact** as a media platform — named in SimpliSafe's own job posting for Director, Performance Media, which also lists "affiliate" as an owned channel: *"Media Platforms (Google, Meta, iSpot, Impact, etc.)"*. ([SimpliSafe Careers](https://careers.simplisafe.com/job/?job_id=8084265))

Conflicting third-party claims for the **US** program — treat all as **UNVERIFIED**:

| Source | Network | Commission | Cookie |
|---|---|---|---|
| [LinkClicky](https://linkclicky.com/affiliate-program/simplisafe-home-security/) | Impact | $25/sale | not stated |
| [FlexOffers](https://www.flexoffers.com/affiliate-programs/simplisafe-affiliate-program/) | FlexOffers (sub-network) | $8/sale | 1 day — *and the page says "we are not currently offering this affiliate program in our system"* |
| [Lasso](https://getlasso.co/affiliate/simplisafe/) | FlexOffers | $8/sale | 1 day |
| [UpPromote](https://uppromote.com/affiliate-program-directory/simplisafe/) | Awin | $8/sale | ~30 days ("can vary by network") |

**There is no affiliate page on simplisafe.com.** A site-scoped search returns only legal, support, and careers pages. Terms must be confirmed with SimpliSafe or with Impact directly.

**Separately — the consumer Referral Program is documented and concrete:**
- Referrer: **$200 Visa gift card**, emailed 60 days after the referred purchase completes
- Friend: **50% off a new system + free Video Doorbell Pro**
- Mechanics: shareable direct link, email invite, or friend enters the referrer's name at checkout
- **45 days** for the friend to click through and activate
- Valid for **new customers only**; the referrer must be an existing customer
- ([support article](https://support.simplisafe.com/articles/orders-warranty/simplisafe-referral-program), terms at [simplisafe.com/share](https://simplisafe.com/share))

> **UNVERIFIED:** whether a property-management company may operate the consumer referral program at scale on behalf of residents. The support article states no commercial-use restriction, but full T&Cs at simplisafe.com/share should be read by counsel before relying on this. Assume it is **not** intended for business channel use.

---

## 5. Competitors — is anyone better integrated?

Short version: **nobody in DIY home security offers a public enrollment API.** The real integrations live in the multifamily smart-apartment category, and they are sales-led partnerships with PMS integrations — not self-serve APIs.

- **ADT Multifamily** — a genuine, dedicated multifamily division built on the **IOTAS** acquisition (2021); smart-apartment platform sold per-community. `adt.com/multifamily-paid/smart-communities` now redirects to **Everon** following ADT's commercial spin-off, so the current org structure needs confirming. **Worth a call.** ([ADT newsroom](https://newsroom.adt.com/safe-stories/adt-multifamily-showcases-innovative-smart-apartment-technology-and-on-the-go-protection-at-apartmentalize), [IOTAS acquisition](https://www.securitysystemsnews.com/article/adt-acquires-portland-based-smart-home-automation-provider-iotas), [iotashome.com/adt](https://www.iotashome.com/adt/))
- **Vivint Smart Properties** — dedicated multifamily product with **Vivint Site Manager**, a property-staff portal that explicitly supports "onboard new residents." Sales-led (demo request form); **no public API documented**. Markets ~$50/mo rent premium per unit. **Worth a call.** ([vivint.com/multifamily](https://www.vivint.com/multifamily))
- **SmartRent** — the deepest multifamily integration story: live PMS integrations with **Yardi, RealPage, Entrata, ResMan, Knock, Funnel**, plus hardware partners including Ring. Entry point is an **integration request form**, not public developer docs. **Worth a call — most likely to have a usable partner integration path.** ([integrations](https://smartrent.com/integrations-partnerships/), [PMS integrations announcement](https://smartrent.com/news/smartrent-integrates-pms-yardi-realpage-entrata-resman/))
- **Latch → DOOR** — rebranded; multifamily access control with published **PMS integrations** (AppFolio and others). Access control, not in-unit alarm/monitoring — adjacent to our toggle, not a substitute. ([door.com/pms-integrations](https://door.com/pms-integrations), [AppFolio partner page](https://www.appfolio.com/partners/latch))
- **Ring / Amazon** — consumer devices sold retail; Amazon's multifamily play is **Key for Business / Amazon Key access control**, announced June 2025, plus Ring WallCall/Ring In intercom for MDUs. No consumer-security enrollment API. ([Amazon Key for multifamily](https://www.businesswire.com/news/home/20250610732201/en/Amazon-Introduces-New-Key-Access-Control-System-for-Multi-Family-Properties))
- **Kangaroo** — has an actual **real estate / property manager page**: kits at **$99 incl. 1 year of professional monitoring**, **20% off orders of 5+**, custom branding at **1,000+ units**, direct contact `vanessa@heykangaroo.com`. Lowest-friction bulk program found, but it is **manual bulk purchasing, not an API**. Good fit if the toggle just needs to trigger a kit shipment. **Worth a call.** ([heykangaroo real estate](https://info.heykangaroo.com/real-estate))
- **Abode** — integrations are consumer smart-home only (HomeKit, Alexa, Google Nest, Home Assistant). **No partner or enrollment API.** ([goabode.com/integrations](https://goabode.com/integrations/))
- **Wyze** — has a **business partnership** page and a documented affiliate program, but no multifamily enrollment API. ([business partnership](https://www.wyze.com/pages/business-partnership), [affiliate program](https://support.wyze.com/hc/en-us/articles/21945222316187-About-Wyze-Affiliate-Program))

> **UNVERIFIED:** none of ADT, Vivint, SmartRent, Kangaroo, or DOOR publishes a self-serve partner API for resident enrollment. All require a sales conversation to learn what technical integration, if any, is on offer. Do not assume an API exists until a partner agreement and docs are in hand.

---

## 6. What we can actually build today

Ranked by how well it serves the toggle, with the honest availability call for SimpliSafe:

### (a) Real API enrollment — **NOT AVAILABLE for SimpliSafe**
No public API, no partner API, no developer portal, and resale is contractually prohibited. The reverse-engineered API has no account-creation surface and is unusable commercially. Do not scope this. ([terms-sale](https://simplisafe.com/legal/terms-sale), [no official API](https://simplisafe-python.readthedocs.io/en/latest/intro.html))

### (b) Affiliate / referral link with tracking — **AVAILABLE, best realistic option**
Toggle-on records the resident's intent in our system and hands off to a tracked SimpliSafe URL (affiliate link via Impact/Awin, or a partner-issued link). We keep attribution and can report conversions per community. Requires signing up with the affiliate network and confirming US terms, since **nothing about the US program is published**. Caveat: if the US program really carries a **1-day cookie**, attribution will leak badly for a move-in flow where residents decide days later — negotiate a longer window as part of a direct partner deal. ([FlexOffers](https://www.flexoffers.com/affiliate-programs/simplisafe-affiliate-program/), [Awin UK 30-day](https://ui.awin.com/merchant-profile/27387))

### (c) Promo code — **PLAUSIBLE BUT UNDOCUMENTED for SimpliSafe**
No self-serve mechanism to obtain a partner promo code exists publicly. A community-specific code would have to come out of a negotiated Property Manager partnership. Also: a code alone gives us **no conversion visibility** unless SimpliSafe reports redemptions back to us. Treat as a nice-to-have layered on top of (b), not a standalone plan.

### (d) Lead capture + human follow-up — **AVAILABLE, guaranteed to work**
Toggle-on captures name/unit/email/consent in our portal; we either hand the lead to SimpliSafe through the partner contact channel or have the community's leasing team follow up. This is, in fact, exactly the mechanism SimpliSafe's own partner program runs on — a four-field contact form. Zero integration risk, but the slowest conversion and it puts human work back on the leasing office. ([partner-with-us](https://simplisafe.com/partner-with-us))

---

## Recommendation

1. **Do not scope API enrollment for SimpliSafe.** It does not exist. Any roadmap item that assumes "create a SimpliSafe order via API" should be closed now. The evidence is unambiguous: no developer portal, no partner API, no official API by SimpliSafe's own community's account, and a Terms of Sale that prohibits resale to third parties.

2. **Ship the toggle as (b) + (d) — a tracked deep link with a captured lead behind it.** Build it deliberately partner-agnostic: `optional_services.in_unit_security` stores `{ provider, resident_id, unit_id, opted_in_at, outbound_link_id }` and fires an outbound tracked redirect. That way we own attribution regardless of which brand we sign, and we can swap providers per community without touching the resident-facing flow. Add (c) promo code as an optional per-community field so a negotiated code can drop in later with no code change.

3. **Contact SimpliSafe's Property Managers partner track in parallel** — [simplisafe.com/partner-with-us](https://simplisafe.com/partner-with-us) (US form) and `partnerships-uk@simplisafe.co.uk` (UK). Ask three specific questions: (i) is there any partner API or bulk-provisioning mechanism for property managers; (ii) can we get a community-scoped promo code with redemption reporting back to us; (iii) what attribution window applies to a partner link. Everything material here is unpublished, so this call is the only way to find out.

4. **If SimpliSafe cannot offer more than a link, the single best alternative is SmartRent.** It is the only one of the comparables with a demonstrated pattern of integrating into the property-management stack — live PMS integrations with Yardi, RealPage, Entrata, ResMan, Knock and Funnel — which means the technical conversation about programmatic resident provisioning is one they already have regularly. Entry point: [smartrent.com/contact-smartrent/integration-request/](https://smartrent.com/contact-smartrent/integration-request/). **ADT Multifamily** and **Vivint Smart Properties** are the strong runners-up on product fit (both purpose-built for apartments, both with property-staff portals that already handle resident onboarding). **Kangaroo** is the cheapest, fastest path if the toggle only needs to ship a $99 monitored kit to the unit — 20% off at 5+ units, a named contact, no integration required.

5. **Do not use the reverse-engineered SimpliSafe API for anything.** Not for enrollment, not for status display, not for a demo. It is undocumented, unlicensed, archived upstream, and SimpliSafe has broken it repeatedly by changing auth.
