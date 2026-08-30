import { inngest, type MoveInEvents } from './client'
import { supabaseAdmin } from '@/lib/supabase'
import { enqueue } from '@/lib/provisioning'
import { computeCommissions, type CommissionRate, type PartyMap, type Tier, type ItemKind } from '@/lib/commission'
import { transferCommission } from '@/lib/stripe'
import { createFulfilmentOrder, shopifyAdminConfigured } from '@/lib/shopify'

/**
 * Provisioning and payouts.
 *
 * Every step is idempotent on something derived from the work, not the run —
 * Inngest retries, Stripe replays webhooks, and deploys overlap. The system has
 * to survive all three doing the same thing twice.
 */

/**
 * Screens 01-03 are done. Issue the credential and assign parking.
 *
 * This runs on activation, NOT on payment. A resident who abandons at screen 04
 * or whose card declines still has a working key — that is the whole ordering
 * of the portal, enforced here rather than hoped for.
 */
export const onActivated = inngest.createFunction(
  { id: 'move-in-activated', retries: 4, triggers: [{ event: 'movein/activated' }] },
  async ({ event, step }) => {
    const { sessionId, siteId, residentId, mobile } =
      event.data as MoveInEvents['movein/activated']

    await step.run('queue-credential', () =>
      enqueue({
        kind: 'brivo_credential',
        siteId, residentId,
        payload: { mobile },
        idempotencyKey: `cred:${residentId}:phone`,
      }))

    await step.run('queue-parking', () =>
      enqueue({
        kind: 'parking_assign',
        siteId, residentId,
        idempotencyKey: `parking:${sessionId}`,
      }))

    await step.run('queue-gatecard', () =>
      enqueue({
        kind: 'gatecard_issue',
        siteId, residentId,
        idempotencyKey: `gatecard:${residentId}`,
      }))

    // Day 0 of the follow-up sequence.
    await step.run('queue-welcome', () =>
      enqueue({
        kind: 'welcome_message',
        siteId, residentId,
        payload: { mobile },
        idempotencyKey: `welcome:${sessionId}`,
      }))

    return { queued: 4 }
  },
)

/**
 * A card payment cleared. Fulfil the items and write the commission ledger.
 *
 * Note what is absent: nothing here touches a credential. Optional items
 * failing must never walk back access that is already live.
 */
export const onOrderPaid = inngest.createFunction(
  { id: 'order-paid', retries: 4, triggers: [{ event: 'order/paid' }] },
  async ({ event, step }) => {
    const { orderId, siteId, residentId } =
      event.data as MoveInEvents['order/paid']
    const db = supabaseAdmin()

    interface ItemRow {
      id: string
      kind: string
      amount_cents: number
      ref_id: string | null
      name: string
    }

    const items = await step.run('load-items', async (): Promise<ItemRow[]> => {
      const { data, error } = await db
        .from('resident_order_items')
        .select('id, kind, amount_cents, ref_id, name')
        .eq('order_id', orderId)
        .returns<ItemRow[]>()
      if (error) throw error
      return data ?? []
    })

    // Physical credentials ship blank and inert; enrollment happens on first
    // tap at the gate (D5). The job records the pending enrollment so the
    // leasing office can see it.
    // Physical goods go to the supplier through Shopify. Queued, not inline:
    // the money is already taken, so this has to be retried and visible rather
    // than lost in a failed webhook.
    await step.run('queue-shopify-order', async () => {
      const merch = items.filter(i => i.kind === 'merch')
      if (!merch.length) return 0
      await enqueue({
        kind: 'shopify_order',
        siteId, residentId,
        payload: { orderId },
        idempotencyKey: `shopify:${orderId}`,
      })
      await inngest.send({ name: 'order/fulfil', data: { orderId } })
      return merch.length
    })

    await step.run('queue-fulfilment', async () => {
      for (const it of items) {
        if (it.kind === 'credential') {
          await enqueue({
            kind: 'fob_enroll',
            siteId, residentId, orderItemId: it.id,
            payload: { name: it.name },
            idempotencyKey: `enroll:${it.id}`,
          })
        } else if (it.kind === 'service') {
          await enqueue({
            kind: 'service_order',
            siteId, residentId, orderItemId: it.id,
            payload: { offerRuleId: it.ref_id, name: it.name },
            idempotencyKey: `service:${it.id}`,
          })
        }
      }
      return items.length
    })

    await step.run('write-commission-ledger', async () => {
      const [site, rates] = await Promise.all([
        db.from('sites')
          .select('org_id, master_dealer_id, install_dealer_id, service_dealer_id')
          .eq('id', siteId).single(),
        db.from('resident_commission_rates')
          .select('site_id, tier, rate_pct, item_kind')
          .eq('active', true)
          .or(`site_id.eq.${siteId},site_id.is.null`),
      ])
      if (site.error) throw site.error
      if (rates.error) throw rates.error

      const s = site.data as Record<string, string | null>
      const parties: PartyMap = {}
      if (s.org_id) parties.master_agent = s.org_id
      if (s.master_dealer_id) parties.master_dealer = s.master_dealer_id
      if (s.install_dealer_id) parties.install_dealer = s.install_dealer_id
      if (s.service_dealer_id) parties.service_dealer = s.service_dealer_id

      const entries = computeCommissions({
        siteId,
        items: items.map(i => ({
          id: i.id,
          kind: i.kind as ItemKind,
          amountCents: i.amount_cents,
        })),
        parties,
        rates: (rates.data ?? []).map((r): CommissionRate => ({
          tier: r.tier as Tier,
          ratePct: Number(r.rate_pct),
          itemKind: (r.item_kind ?? null) as ItemKind | null,
          siteId: (r.site_id ?? null) as string | null,
        })),
      })

      if (!entries.length) return 0

      const { error } = await db.from('resident_commission_entries').insert(
        entries.map(e => ({
          site_id: siteId,
          order_id: orderId,
          order_item_id: e.orderItemId,
          party_org_id: e.partyOrgId,
          tier: e.tier,
          basis_cents: e.basisCents,
          rate_pct: e.ratePct,
          amount_cents: e.amountCents,
          status: 'held',
          hold_until: e.holdUntil,
          pay_period: e.payPeriod,
        })),
      )
      if (error) throw error
      return entries.length
    })

    return { ok: true }
  },
)

/**
 * Release held commissions whose hold window has passed, and transfer them.
 *
 * The hold exists so a refund inside the window is a status change here rather
 * than money already sitting in a dealer's bank account.
 */
export const releaseCommissions = inngest.createFunction(
  { id: 'release-commissions', retries: 2, triggers: [{ event: 'commissions/release' }] },
  async ({ step }) => {
    const db = supabaseAdmin()

    interface DueRow {
      id: string
      tier: string
      party_org_id: string
      amount_cents: number
      rate_pct: number
      pay_period: string
      basis_cents: number
      order_item_id: string | null
      hold_until: string
      order_id: string | null
    }

    const due = await step.run('load-due', async (): Promise<DueRow[]> => {
      const { data, error } = await db
        .from('resident_commission_entries')
        .select('id, tier, party_org_id, amount_cents, rate_pct, pay_period, ' +
                'basis_cents, order_item_id, hold_until, order_id')
        .eq('status', 'held')
        .lte('hold_until', new Date().toISOString().slice(0, 10))
        .limit(500)
        .returns<DueRow[]>()
      if (error) throw error
      return data ?? []
    })

    let paid = 0
    for (const e of due) {
      await step.run(`transfer-${e.id}`, async () => {
        const { data: acct, error } = await db
          .from('dealer_connect_accounts')
          .select('stripe_account_id, payouts_enabled')
          .eq('org_id', e.party_org_id)
          .maybeSingle()
          .returns<{ stripe_account_id: string; payouts_enabled: boolean }>()
        if (error) throw error

        // No onboarded account yet is not an error — the entry stays held and
        // is picked up on a later run once the dealer finishes onboarding.
        if (!acct?.stripe_account_id || !acct.payouts_enabled) return 'waiting'

        const transfer = await transferCommission({
          entryId: e.id,
          entry: {
            tier: e.tier as Tier,
            partyOrgId: e.party_org_id,
            orderItemId: e.order_item_id ?? '',
            basisCents: e.basis_cents,
            ratePct: Number(e.rate_pct),
            amountCents: e.amount_cents,
            holdUntil: e.hold_until,
            payPeriod: e.pay_period,
          },
          destinationAccountId: acct.stripe_account_id,
        })

        await db.from('resident_commission_entries').update({
          status: 'paid',
          stripe_transfer_id: transfer.id,
          transferred_at: new Date().toISOString(),
        }).eq('id', e.id)

        paid += 1
        return 'paid'
      })
    }

    return { considered: due.length, paid }
  },
)



/**
 * Place the Shopify order for a paid basket.
 *
 * Runs from the queue so a Shopify outage costs a retry rather than a resident
 * who paid and never received anything. Idempotent twice over: the queue key is
 * the order id, and the order row is only updated if shopify_order_id is still
 * null.
 */
export const placeShopifyOrder = inngest.createFunction(
  { id: 'place-shopify-order', retries: 5, triggers: [{ event: 'order/fulfil' }] },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string }
    const db = supabaseAdmin()

    if (!shopifyAdminConfigured()) {
      // Not an error worth retrying into oblivion — it is a configuration gap,
      // and it should be visible on the order rather than buried in retries.
      await db.from('resident_orders')
        .update({ fulfilment_error: 'Shopify admin token not configured' })
        .eq('id', orderId)
      return { skipped: 'shopify_not_configured' }
    }

    const placed = await step.run('create-order', async () => {
      interface OrderRow {
        id: string
        resident_id: string
        site_id: string
        shopify_order_id: string | null
        shipping_address: Record<string, string> | null
        shipping_cents: number | null
        stripe_payment_intent_id: string | null
      }

      const { data: order, error } = await db
        .from('resident_orders')
        .select('id, resident_id, site_id, shopify_order_id, shipping_address, ' +
                'shipping_cents, stripe_payment_intent_id')
        .eq('id', orderId)
        .single()
        .returns<OrderRow>()
      if (error) throw error

      // Already placed by an earlier attempt.
      if (order.shopify_order_id) return { already: true as const }

      const [{ data: items }, { data: resident }] = await Promise.all([
        db.from('resident_order_items')
          .select('ref_id, qty, kind').eq('order_id', orderId).eq('kind', 'merch')
          .returns<{ ref_id: string | null; qty: number; kind: string }[]>(),
        db.from('residents')
          .select('first_name, last_name, email, phone').eq('id', order.resident_id).single()
          .returns<{ first_name: string; last_name: string; email: string | null; phone: string | null }>(),
      ])

      const lines = (items ?? [])
        .filter(i => i.ref_id)
        .map(i => ({ variantId: i.ref_id!, quantity: i.qty }))
      if (!lines.length) return { already: true as const }

      const addr = order.shipping_address
      if (!addr?.address1) {
        throw new Error('Order has no shipping address; cannot fulfil physical goods')
      }

      const result = await createFulfilmentOrder({
        orderId,
        email: resident?.email ?? null,
        phone: resident?.phone ?? null,
        address: {
          firstName: resident?.first_name ?? '',
          lastName: resident?.last_name ?? '',
          address1: addr.address1,
          address2: addr.address2,
          city: addr.city,
          province: addr.province,
          zip: addr.zip,
        },
        lines,
        shippingCents: order.shipping_cents ?? 0,
        stripePaymentIntentId: order.stripe_payment_intent_id ?? '',
      })

      await db.from('resident_orders').update({
        shopify_order_id: result.shopifyOrderId,
        shopify_order_name: result.name,
        fulfilment_error: null,
      }).eq('id', orderId).is('shopify_order_id', null)

      return { already: false as const, ...result }
    })

    return placed
  },
)

export const functions = [
  onActivated,
  onOrderPaid,
  releaseCommissions,
  placeShopifyOrder,
]
