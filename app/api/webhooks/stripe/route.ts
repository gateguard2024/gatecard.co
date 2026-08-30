import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { configured } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWebhook } from '@/lib/stripe'
import { inngest } from '@/lib/inngest/client'

export const dynamic = 'force-dynamic'

/**
 * Stripe webhook.
 *
 * Stripe replays events, so everything here is idempotent: the order row is
 * matched on the payment intent id and only moved forward, never re-fulfilled.
 *
 * A failed payment updates the ORDER and nothing else. There is deliberately no
 * path from here to a credential — a declined card must never close a gate.
 */
export async function POST(req: Request) {
  if (!configured.stripe() || !configured.supabase()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'no_signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = verifyWebhook(await req.text(), signature)
  } catch (err) {
    return NextResponse.json(
      { error: 'bad_signature', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    )
  }

  const db = supabaseAdmin()

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : ''

    const { data: order, error } = await db
      .from('resident_orders')
      .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_charge_id: chargeId })
      .eq('stripe_payment_intent_id', pi.id)
      .neq('status', 'paid')             // replay guard
      .select('id, site_id, resident_id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 })

    // Already processed by an earlier delivery — acknowledge, don't re-fulfil.
    if (!order) return NextResponse.json({ received: true, duplicate: true })

    if (configured.inngest()) {
      await inngest.send({
        name: 'order/paid',
        data: {
          orderId: order.id as string,
          siteId: order.site_id as string,
          residentId: order.resident_id as string,
          chargeId,
        },
      })
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    await db.from('resident_orders').update({
      status: 'failed',
      failure_reason: pi.last_payment_error?.message ?? 'unknown',
    }).eq('stripe_payment_intent_id', pi.id)
    // Nothing else happens. The resident's access is untouched.
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const { data: order } = await db
      .from('resident_orders')
      .update({ status: 'refunded' })
      .eq('stripe_charge_id', charge.id)
      .select('id')
      .maybeSingle()

    // Reverse any commission still inside its hold window — the reason the
    // hold exists at all.
    if (order?.id) {
      await db.from('resident_commission_entries')
        .update({ status: 'reversed', reversed_at: new Date().toISOString() })
        .eq('order_id', order.id)
        .in('status', ['accrued', 'held'])
    }
  }

  return NextResponse.json({ received: true })
}
