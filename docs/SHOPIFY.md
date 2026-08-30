# Shopify — catalogue and dropship fulfilment

## What Shopify is for here

The community store is **dropship**. Supplier routing, tracking sync, returns
and multi-state sales tax on physical goods is months of work that
differentiates nothing. Shopify already does it, so it owns the merch
catalogue and the fulfilment.

**What it is not for: credentials.** A fob or key tag has to be enrolled in
Brivo against a named resident at a specific property, and no dropship supplier
can do that. Those stay in `site_store_products` and are fulfilled through the
provisioning queue. The resident sees one grid and cannot tell them apart —
`fulfilment` is what tells the order handler.

## The decision that was made: one checkout, in the portal

The resident pays once, on Stripe, inside the portal. Two checkouts in one flow
is a drop-off cliff, and merch paid for on Shopify's own checkout never reaches
the Stripe Connect commission ledger — dealers would earn nothing on store
sales.

**The trap in that decision:** Shopify's checkout is also what calculates tax
and shipping, and what triggers fulfilment. Taking payment on Stripe means we
inherit all three.

| Job | Normally Shopify | Now ours |
|---|---|---|
| Take payment | Shopify checkout | **Stripe** (keeps the commission ledger whole) |
| Sales tax | Shopify Tax | **Stripe Tax**, or a flat assumption we can defend |
| Shipping cost | Shopify rates | **Flat rate per property** to start |
| Tell the supplier to ship | Automatic on order | **Admin API order creation, by us** |
| Tracking, returns | Shopify | Shopify (unchanged) |

That fourth row is the one people forget. Charge on Stripe, never create the
Shopify order, and the resident pays while nothing ever ships.

## How it works now

```
resident checks out in the portal
        │
        ▼
Stripe PaymentIntent          ← one payment, one interface
  goods + shipping
  Stripe Tax from the destination
        │  webhook: payment_intent.succeeded
        ▼
order marked paid  →  event: order/fulfil
        │
        ▼
provisioning job 'shopify_order'   ← QUEUED, retried 5×, visible to staff
        │
        ▼
Shopify orderCreate (financialStatus: PAID)
        │
        ▼
supplier ships · tracking flows back through Shopify
```

**Why the Shopify call is queued and not inline in the webhook.** By the time it
runs, the money is already taken. If it fails inline, the resident has paid and
nothing ships, and the only trace is a 500 in a log. Queued, it retries, and a
row appears in `unfulfilled_paid_orders` — which is the view someone should look
at daily, because a row there is a resident who paid for something nobody is
shipping.

**Why not create the Shopify order first and charge second.** Every abandoned
card would leave an unpaid order in Shopify to reconcile. Worse problem.

**Idempotency, twice.** The queue key is `shopify:{orderId}`, and the order row
is only updated `where shopify_order_id is null`. A replayed Stripe webhook or a
retried job cannot produce two orders.

**Shipping address.** Dropship needs one and the flow never asked. We know it —
the resident is moving into a known unit at a known property — so it is derived
rather than collected. `sites.merch_ship_to` decides between the unit and
`c/o Leasing Office`, because a resident moving in on the 5th may not be able to
receive a parcel at the unit before then. If a property has no complete address,
checkout refuses with a clear reason rather than shipping into a void.

## Still to decide before checkout is wired

1. **Tax.** Physical goods shipped to residents create nexus questions. Stripe
   Tax handles it for a fee; a flat rate does not, and getting it wrong is a
   liability rather than a bug. **This needs an answer from someone who owns
   the tax position, not a default from me.**
2. **Shipping.** Flat rate per property is fine for six SKUs. It stops being
   fine when the store grows, which is the stated intention.
3. **Refunds.** A refund has to happen in both systems, or Shopify shows paid
   and Stripe shows refunded forever.

Tax is the one that needs an owner. `automatic_tax` is not switched on yet —
the PaymentIntent carries the shipping destination so Stripe Tax *can* compute
it, but enabling it is a decision about your tax position, not a default I
should pick. Until then the charge is goods plus flat shipping, with no tax
line.

## Setting the store up

1. Create one Shopify store — **not one per property**. A store per property
   means a Shopify account per property, which will not survive a dealer
   channel.
2. Collections:
   - `community-store` — products every property sees
   - one per property, handle matching the site slug (`east-ponds`)
   A product can be in both; it is de-duplicated on the way in.
3. Custom app (Settings → Apps → Develop apps):
   - **Storefront API** token, scope `unauthenticated_read_product_listings`
     → `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (public, read-only, safe in the client)
   - **Admin API** token, scopes `write_orders`, `read_products`
     → `SHOPIFY_ADMIN_ACCESS_TOKEN` (secret, server only, never in the browser)
4. Env:
   ```
   SHOPIFY_STORE_DOMAIN=gateguard-store.myshopify.com
   SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
   SHOPIFY_ADMIN_ACCESS_TOKEN=...
   SHOPIFY_SHARED_COLLECTION=community-store
   ```

The catalogue appears as soon as the Storefront token is set — no code change.
Without it, the store falls back to the credential items alone, and a Shopify
outage does the same rather than emptying the store or blocking a move-in.

## Growing the store later

The stated intention is residents shopping the store beyond move-in. That is a
different surface — a standalone `/[siteSlug]/store` outside the move-in flow,
with its own cart and order history — and it is the point at which flat-rate
shipping and a hand-rolled tax assumption stop being defensible. Worth
revisiting the checkout decision then; the catalogue layer does not change.
