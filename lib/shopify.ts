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
 * Create the Shopify order AFTER Stripe has taken the money.
 *
 * This is the half people forget. Shopify is what tells the dropship supplier
 * to ship; charging on Stripe and never creating an order means the resident
 * pays and nothing arrives.
 *
 * The order is created already paid, with the Stripe payment intent recorded,
 * so the two systems can be reconciled. Idempotent on the order id.
 *
 * NOT WIRED YET — tax and shipping have to be settled first. See docs/SHOPIFY.md.
 */
export async function createFulfilmentOrder(_args: {
  orderId: string
  email: string | null
  shippingAddress: Record<string, string>
  lines: { variantId: string; quantity: number }[]
  stripePaymentIntentId: string
}): Promise<never> {
  throw new Error(
    'Shopify fulfilment orders are not wired yet. Settle tax (Stripe Tax vs ' +
    'Shopify) and shipping rates first — see docs/SHOPIFY.md.',
  )
}
