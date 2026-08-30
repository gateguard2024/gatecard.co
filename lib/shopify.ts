import 'server-only'
import type { StoreProduct } from './types'

/**
 * Shopify — the merch catalogue, and nothing else.
 *
 * WHY SHOPIFY AT ALL (D1): the store is dropship. Supplier routing, tracking
 * sync, returns and multi-state sales tax on physical goods is months of work
 * that differentiates nothing. Shopify already does it.
 *
 * WHY NOT SHOPIFY CHECKOUT: the resident should pay once, in the portal. Two
 * checkouts in one flow is a drop-off cliff, and merch paid for on Shopify
 * never reaches the Stripe Connect commission ledger, so dealers wouldn't earn
 * on it.
 *
 * WHAT THAT COSTS, stated plainly: Shopify's checkout is also what calculates
 * tax and shipping and what triggers fulfilment. Charging on Stripe means we
 * take on tax (Stripe Tax) and shipping (flat rate per property to start), and
 * we must create the order in Shopify afterwards or no supplier ever ships.
 * See createFulfilmentOrder below.
 *
 * CREDENTIAL ITEMS ARE NOT SHOPIFY PRODUCTS. A fob has to be enrolled in Brivo
 * against a named resident at a property; no dropship supplier can do that. Key
 * tags and fobs stay local and are fulfilled through the provisioning queue.
 */

const API_VERSION = '2025-07'

export function shopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN)
}

export function shopifyAdminConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN)
}

interface StorefrontProductNode {
  id: string
  title: string
  description: string
  availableForSale: boolean
  featuredImage: { url: string; altText: string | null } | null
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } }
  variants: { nodes: { id: string; availableForSale: boolean }[] }
}

const CATALOG_QUERY = `
  query Catalog($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      products(first: $first) {
        nodes {
          id
          title
          description
          availableForSale
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
          variants(first: 1) { nodes { id availableForSale } }
        }
      }
    }
  }
`

async function storefront<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  if (!shopifyConfigured()) return null

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
      },
      body: JSON.stringify({ query, variables }),
      // The catalogue changes rarely and a move-in must not wait on Shopify.
      next: { revalidate: 300 },
    },
  )

  if (!res.ok) {
    console.error('[shopify] storefront', res.status, await res.text().catch(() => ''))
    return null
  }
  const json = (await res.json()) as { data?: T; errors?: unknown }
  if (json.errors) {
    console.error('[shopify] storefront errors', JSON.stringify(json.errors).slice(0, 400))
    return null
  }
  return json.data ?? null
}

/**
 * Products for one property.
 *
 * One store, a collection per property, plus a shared collection every property
 * sees. That keeps property-branded merch possible (an East Ponds doormat)
 * without running a Shopify account per property, which would not survive a
 * dealer channel.
 *
 * Returns null — not an empty list — when Shopify is unreachable, so the caller
 * can fall back rather than render an empty store that looks deliberate.
 */
export async function fetchStoreProducts(args: {
  propertyHandle: string | null
  sharedHandle?: string
  limit?: number
}): Promise<StoreProduct[] | null> {
  if (!shopifyConfigured()) return null

  const handles = [args.propertyHandle, args.sharedHandle ?? 'community-store']
    .filter((h): h is string => Boolean(h))

  const collected: StoreProduct[] = []
  const seen = new Set<string>()

  for (const handle of handles) {
    const data = await storefront<{ collection: { products: { nodes: StorefrontProductNode[] } } | null }>(
      CATALOG_QUERY, { handle, first: args.limit ?? 24 },
    )
    if (!data?.collection) continue

    for (const n of data.collection.products.nodes) {
      if (seen.has(n.id)) continue          // a product in both collections
      seen.add(n.id)
      collected.push({
        id: n.variants.nodes[0]?.id ?? n.id, // the variant is what gets ordered
        name: n.title,
        blurb: n.description?.split('\n')[0]?.slice(0, 120) ?? '',
        priceCents: Math.round(parseFloat(n.priceRange.minVariantPrice.amount) * 100),
        imageEmoji: '📦',                    // images come from imageUrl below
        imageUrl: n.featuredImage?.url ?? null,
        fulfilment: 'merch',
        inStock: n.availableForSale,
      })
    }
  }

  return collected
}

/**
 * SUPERSEDED — kept for reference, not wired.
 *
 * This was the "charge on Stripe, then create the order" path. Issuing a
 * per-resident discount code instead means the money and the order are one
 * transaction inside Shopify, which removes tax, shipping rates, the shipping
 * address, and the charged-but-not-shipped failure mode all at once.
 *
 * Do not re-wire this without re-reading docs/SHOPIFY.md — the reasons it was
 * retired are the same reasons it looked attractive.
 *
 * Create the Shopify order AFTER Stripe has taken the money.
 *
 * This is the half people forget. Shopify is what tells the dropship supplier
 * to ship; charging on Stripe and never creating an order means the resident
 * pays and nothing arrives.
 *
 * Called from the provisioning queue, never inline from the Stripe webhook —
 * if this fails, the money is already taken and the work has to be retried and
 * visible, not lost in a 500.
 *
 * The order is created already paid, referencing the Stripe payment intent, so
 * Shopify never tries to collect and the two systems reconcile.
 */
export interface FulfilmentLine { variantId: string; quantity: number }

export interface FulfilmentAddress {
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  province: string
  zip: string
  country?: string
}

const ORDER_MUTATION = `
  mutation CreateOrder($order: OrderCreateOrderInput!) {
    orderCreate(order: $order) {
      order { id name }
      userErrors { field message }
    }
  }
`

export async function createFulfilmentOrder(args: {
  orderId: string
  email: string | null
  phone: string | null
  address: FulfilmentAddress
  lines: FulfilmentLine[]
  shippingCents: number
  stripePaymentIntentId: string
}): Promise<{ shopifyOrderId: string; name: string }> {
  if (!shopifyAdminConfigured()) {
    throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not set; cannot create the order.')
  }
  if (!args.lines.length) {
    throw new Error('Refusing to create an empty Shopify order')
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        query: ORDER_MUTATION,
        variables: {
          order: {
            email: args.email ?? undefined,
            phone: args.phone ?? undefined,
            // Already collected. Shopify must not chase the resident for money
            // Stripe has taken.
            financialStatus: 'PAID',
            lineItems: args.lines.map(l => ({
              variantId: l.variantId,
              quantity: l.quantity,
            })),
            shippingAddress: {
              firstName: args.address.firstName,
              lastName: args.address.lastName,
              address1: args.address.address1,
              address2: args.address.address2,
              city: args.address.city,
              provinceCode: args.address.province,
              zip: args.address.zip,
              countryCode: args.address.country ?? 'US',
            },
            shippingLines: args.shippingCents > 0
              ? [{ title: 'Shipping', priceSet: { shopMoney: {
                  amount: (args.shippingCents / 100).toFixed(2), currencyCode: 'USD' } } }]
              : [],
            // The thread back to Stripe. Without this the two systems cannot be
            // reconciled when something goes wrong at 2am.
            tags: ['gatecard', `order:${args.orderId}`],
            note: `GateCard order ${args.orderId} · Stripe ${args.stripePaymentIntentId}`,
          },
        },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Shopify admin ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    data?: { orderCreate?: {
      order?: { id: string; name: string }
      userErrors?: { field: string[]; message: string }[]
    } }
    errors?: unknown
  }

  const errs = json.data?.orderCreate?.userErrors
  if (errs?.length) {
    throw new Error(`Shopify rejected the order: ${errs.map(e => e.message).join('; ')}`)
  }
  const order = json.data?.orderCreate?.order
  if (!order) {
    throw new Error(`Shopify returned no order: ${JSON.stringify(json).slice(0, 300)}`)
  }

  return { shopifyOrderId: order.id, name: order.name }
}


// ─────────────────────────────────────────────────────────────────────────────
// Per-resident store codes
// ─────────────────────────────────────────────────────────────────────────────

const DISCOUNT_MUTATION = `
  mutation CreateCode($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`

/**
 * A code is a welcome gift and an attribution key at the same time.
 *
 * Single-use and personal, so a Shopify orders/create webhook naming the code
 * names the resident — which is how merch revenue still reaches the commission
 * ledger without us handling the money.
 *
 * Human-readable but not guessable: a property prefix someone can read out over
 * the phone, plus enough randomness that codes can't be enumerated. Ambiguous
 * characters are excluded so a resident reading it off a screen gets it right.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1

export function generateStoreCode(propertySlug: string): string {
  const prefix = propertySlug.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'STORE'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  const body = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
  return `${prefix}-${body}`
}

export async function createResidentDiscountCode(args: {
  code: string
  percentOff: number
  expiresAt: Date
  /** Restricts the discount to a collection, so it can't be used on gift cards. */
  collectionId?: string
}): Promise<{ discountId: string }> {
  if (!shopifyAdminConfigured()) {
    throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not set; cannot issue a store code.')
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        query: DISCOUNT_MUTATION,
        variables: {
          input: {
            title: `GateCard move-in — ${args.code}`,
            code: args.code,
            startsAt: new Date().toISOString(),
            endsAt: args.expiresAt.toISOString(),
            // Single use, full stop. Both limits matter: usageLimit stops the
            // code being shared, appliesOncePerCustomer stops one account
            // reusing it.
            usageLimit: 1,
            appliesOncePerCustomer: true,
            customerSelection: { all: true },
            customerGets: {
              value: { percentage: args.percentOff / 100 },
              items: args.collectionId
                ? { collections: { add: [args.collectionId] } }
                : { all: true },
            },
          },
        },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Shopify admin ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    data?: { discountCodeBasicCreate?: {
      codeDiscountNode?: { id: string }
      userErrors?: { message: string }[]
    } }
  }
  const errs = json.data?.discountCodeBasicCreate?.userErrors
  if (errs?.length) throw new Error(`Shopify rejected the code: ${errs.map(e => e.message).join('; ')}`)

  const id = json.data?.discountCodeBasicCreate?.codeDiscountNode?.id
  if (!id) throw new Error('Shopify returned no discount id')
  return { discountId: id }
}
