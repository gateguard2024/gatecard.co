# Shopify — catalogue and dropship fulfilment

## What Shopify is for here

The community store is **dropship**, and it now runs entirely inside Shopify.
The resident buys there, with a personal discount code we issue.

**Credentials do not go to Shopify.** A fob or key tag is a Brivo enrollment
against a named resident, shipped from Gate Guard stock. Those stay in our
checkout and our provisioning queue.

## The decision, and the one it replaced

An earlier design charged merch on Stripe inside the portal and then created the
Shopify order over the Admin API. One interface, one payment. It also meant
inheriting four things Shopify already did:

| | Portal checkout | Store code |
|---|---|---|
| Sales tax | Ours — Stripe Tax, and a tax position to own | Shopify |
| Shipping rates | Ours — flat rate per property | Shopify |
| Delivery address | Derived; the resident can't choose | The resident chooses |
| Fulfilment | Admin API order creation, queued and retried | Native |
| Charged but not shipped | Real risk, needed a queue and a daily view | **Cannot happen** |
| Refunds | Two systems to keep in step | One |

That last row is why this is better. When the money and the order are one
transaction, the whole failure mode disappears rather than being defended
against.

**What it costs, and how it's recovered.** Merch revenue no longer passes
through Stripe, so it doesn't reach the Connect commission ledger on its own.
The code recovers it: single-use and personal, so a Shopify `orders/create`
webhook naming the code names the resident, and the commission entry is written
from that. Much less machinery than creating orders.

**A side effect worth having.** Merch moves out of the move-in minute and into
the follow-up sequence — day 3, day 10, day 30 — which is where the handoff
says the revenue actually arrives. A code in every follow-up email is how a
store gets repeat visits; a one-time cart at move-in is not.

## The code

- **15% off, single use, 30 days**, one live code per resident.
- Format `EASTPO-K7M4QX` — a property prefix someone can read down the phone,
  plus randomness so codes can't be enumerated. No I, O, 0 or 1, because
  residents read these off a screen.
- Enforced single-use on both axes in Shopify: `usageLimit: 1` stops the code
  being shared, `appliesOncePerCustomer` stops one account reusing it.
- **Revoked automatically at move-out**, by a trigger on `resident_tenancies`.
  A welcome discount still working for someone who left in March is a small
  leak that never stops.
- Shown on screen 05 and screen 06, and sent by email — the resident should
  never have to come back to the portal to find it.

## Setting the store up

1. One Shopify store, **not one per property** — a store per property means a
   Shopify account per property, which will not survive a dealer channel.
2. Collections: `community-store` for everything, plus one per property named
   by site slug (`east-ponds`) if you want property-branded merch.
3. Custom app (Settings → Apps → Develop apps):
   - **Storefront API** token, `unauthenticated_read_product_listings`
     → `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (public, read-only)
   - **Admin API** token, `write_discounts`, `read_orders`, `read_products`
     → `SHOPIFY_ADMIN_ACCESS_TOKEN` (secret, server only)

   Note `write_orders` is no longer needed — nothing creates orders any more.
4. Env:
   ```
   SHOPIFY_STORE_DOMAIN=gateguard-store.myshopify.com
   SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
   SHOPIFY_ADMIN_ACCESS_TOKEN=...
   ```
5. Per property: `sites.store_url`, `sites.store_discount_percent` (default 15),
   `sites.store_code_days` (default 30). No `store_url` disables the store for
   that property and the card never renders.

## Still to do

- **Issue the code on activation.** The `store_code` provisioning job kind
  exists; the handler that calls `createResidentDiscountCode` is not written.
  Until then codes come from the mock data.
- **`orders/create` webhook** to mark a code redeemed and write the commission
  entry. Without it, store revenue is invisible to the ledger.
- **The retired path.** `createFulfilmentOrder()` in lib/shopify.ts is kept for
  reference and clearly marked. Don't re-wire it without re-reading this file —
  the reasons it was retired are the same reasons it looked attractive.
