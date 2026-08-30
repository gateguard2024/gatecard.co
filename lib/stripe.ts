import 'server-only'
import Stripe from 'stripe'
import { configured, requireEnv } from './env'
import type { CommissionEntry } from './commission'

/**
 * Stripe — the movement layer for the CARD rail only.
 *
 * Nothing on the mandatory rail passes through here. Access and parking are
 * part of the lease; how they are collected is unresolved (AGENTS.md D3), and
 * no failure in this file may ever reach a credential.
 */

let client: Stripe | null = null

export function stripe(): Stripe {
  if (!configured.stripe()) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.')
  }
  if (!client) {
    client = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      // Pinned deliberately — an implicit version bump is a silent behaviour
      // change in a payment path.
      apiVersion: '2026-08-26.dahlia',
      appInfo: { name: 'GateCard Move-In Portal' },
    })
  }
  return client
}

export interface CheckoutLine {
  name: string
  amountCents: number
  qty: number
}

/**
 * One charge on the platform account. Transfers to the tiers happen later,
 * after the hold period — see transferCommission.
 *
 * The idempotency key is the order id, so a resident double-tapping Check out
 * cannot produce two charges.
 */
export interface ShipTo {
  name: string
  address1: string
  address2?: string
  city: string
  province: string
  zip: string
}

export async function createOrderPaymentIntent(args: {
  orderId: string
  siteId: string
  residentId: string
  lines: CheckoutLine[]
  shippingCents?: number
  customerEmail?: string | null
  /**
   * Required when the basket contains physical goods: Stripe Tax needs a
   * destination, and so does the dropship supplier.
   */
  shipTo?: ShipTo | null
}): Promise<Stripe.PaymentIntent> {
  const goods = args.lines.reduce((n, l) => n + l.amountCents * l.qty, 0)
  const amount = goods + (args.shippingCents ?? 0)
  if (amount <= 0) throw new Error('Refusing to charge a zero-value order')

  return stripe().paymentIntents.create(
    {
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: args.customerEmail ?? undefined,
      description: args.lines.map(l => `${l.qty}× ${l.name}`).join(', '),

      // Physical goods shipped across state lines create a tax position. Stripe
      // Tax computes it from the destination; a flat guess would be a liability
      // rather than a bug.
      ...(args.shipTo
        ? {
            shipping: {
              name: args.shipTo.name,
              address: {
                line1: args.shipTo.address1,
                line2: args.shipTo.address2,
                city: args.shipTo.city,
                state: args.shipTo.province,
                postal_code: args.shipTo.zip,
                country: 'US',
              },
            },
          }
        : {}),

      metadata: {
        order_id: args.orderId,
        site_id: args.siteId,
        resident_id: args.residentId,
        rail: 'card', // never 'mandatory' — that rail does not reach Stripe
      },
    },
    { idempotencyKey: `order:${args.orderId}` },
  )
}

/**
 * Move one ledger entry's money to a connected account.
 *
 * Separate charges and transfers, not application fees: a single payment can
 * owe up to four parties, and `application_fee_amount` splits two ways.
 *
 * Idempotent on the ledger entry id, so a retried payout run cannot pay a
 * dealer twice.
 */
export async function transferCommission(args: {
  entryId: string
  entry: CommissionEntry
  destinationAccountId: string
  sourceChargeId?: string
}): Promise<Stripe.Transfer> {
  if (!configured.connect()) {
    throw new Error('Stripe Connect is not configured. Set STRIPE_CONNECT_CLIENT_ID.')
  }
  return stripe().transfers.create(
    {
      amount: args.entry.amountCents,
      currency: 'usd',
      destination: args.destinationAccountId,
      source_transaction: args.sourceChargeId,
      metadata: {
        entry_id: args.entryId,
        tier: args.entry.tier,
        party_org_id: args.entry.partyOrgId,
        pay_period: args.entry.payPeriod,
        rate_pct: String(args.entry.ratePct),
      },
    },
    { idempotencyKey: `commission:${args.entryId}` },
  )
}

/**
 * Express accounts: Stripe carries KYC and 1099s, which is the difference
 * between onboarding hundreds of dealers and not.
 */
export async function createDealerConnectAccount(args: {
  orgId: string
  email: string
  returnUrl: string
  refreshUrl: string
}): Promise<{ accountId: string; onboardingUrl: string }> {
  const s = stripe()
  const account = await s.accounts.create(
    {
      type: 'express',
      email: args.email,
      capabilities: { transfers: { requested: true } },
      metadata: { org_id: args.orgId },
    },
    { idempotencyKey: `connect:${args.orgId}` },
  )
  const link = await s.accountLinks.create({
    account: account.id,
    type: 'account_onboarding',
    return_url: args.returnUrl,
    refresh_url: args.refreshUrl,
  })
  return { accountId: account.id, onboardingUrl: link.url }
}

export function verifyWebhook(body: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(
    body, signature, requireEnv('STRIPE_WEBHOOK_SECRET'),
  )
}
