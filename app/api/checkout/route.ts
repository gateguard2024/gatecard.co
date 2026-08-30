import { NextResponse } from 'next/server'
import { configured } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase'
import { createOrderPaymentIntent, type ShipTo } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

interface LineIn {
  kind: 'credential' | 'merch' | 'service'
  refId: string
  qty: number
}

/**
 * The CARD rail. Fobs, key tags, store merch, services.
 *
 * Prices are re-read from the database, never taken from the request — the
 * client sends what the resident chose, not what it costs.
 */
export async function POST(req: Request) {
  if (!configured.supabase() || !configured.stripe()) {
    return NextResponse.json(
      {
        error: 'not_configured',
        detail: 'Supabase and Stripe env are required for checkout.',
        supabase: configured.supabase(),
        stripe: configured.stripe(),
      },
      { status: 503 },
    )
  }

  const body = (await req.json()) as {
    siteId?: string; residentId?: string; sessionId?: string; lines?: LineIn[]
  }
  if (!body.siteId || !body.residentId || !body.lines?.length) {
    return NextResponse.json(
      { error: 'invalid', detail: 'siteId, residentId and at least one line are required.' },
      { status: 400 },
    )
  }

  const db = supabaseAdmin()

  // Resolve every line server-side.
  const priced: { kind: LineIn['kind']; refId: string; name: string; qty: number; unit: number }[] = []

  for (const line of body.lines) {
    const qty = Math.max(1, Math.min(10, Math.floor(line.qty || 1)))

    if (line.kind === 'credential') {
      const { data } = await db.from('site_credential_options')
        .select('label, price_cents')
        .eq('site_id', body.siteId).eq('kind', line.refId).eq('active', true)
        .maybeSingle()
      if (data) priced.push({ kind: 'credential', refId: line.refId, name: data.label as string, qty, unit: data.price_cents as number })

    } else if (line.kind === 'merch') {
      const { data } = await db.from('site_store_products')
        .select('name, price_cents, in_stock, fulfilment')
        .eq('id', line.refId).eq('active', true)
        .maybeSingle()
      if (data?.in_stock) {
        priced.push({
          // A fob bought in the store is still a credential to the fulfiler,
          // even though the resident sees one grid (D5).
          kind: data.fulfilment === 'credential' ? 'credential' : 'merch',
          refId: line.refId, name: data.name as string, qty, unit: data.price_cents as number,
        })
      }

    } else {
      const { data } = await db.from('site_offer_rules')
        .select('resident_price_cents, mode, service_catalog(name)')
        .eq('id', line.refId).eq('site_id', body.siteId).eq('active', true)
        .maybeSingle()
      // Only 'sellable' offers are chargeable. 'included' and 'quote' reaching
      // checkout means the client is out of step with the offer engine.
      if (data?.mode === 'sellable' && data.resident_price_cents) {
        const svc = data.service_catalog as { name?: string } | null
        priced.push({
          kind: 'service', refId: line.refId,
          name: svc?.name ?? 'Service', qty,
          unit: data.resident_price_cents as number,
        })
      }
    }
  }

  if (!priced.length) {
    return NextResponse.json(
      { error: 'nothing_chargeable', detail: 'No requested line resolved to a sellable item.' },
      { status: 400 },
    )
  }

  const subtotal = priced.reduce((n, p) => n + p.unit * p.qty, 0)

  // ── Where physical goods go ────────────────────────────────────────────────
  // Dropship needs a real address and the flow never asks for one. We know it:
  // the resident is moving into a specific unit at a known property. What we
  // can't assume is that they can receive a parcel there before their move-in
  // date, so the property decides — unit, or held at the leasing office.
  const needsShipping = priced.some(p => p.kind === 'merch')
  let shipTo: ShipTo | null = null
  let shippingCents = 0

  if (needsShipping) {
    const { data: site } = await db.from('sites')
      .select('name, address, city, state, zip, merch_ship_to, merch_shipping_cents')
      .eq('id', body.siteId).maybeSingle()
      .returns<{
        name: string; address: string | null; city: string | null
        state: string | null; zip: string | null
        merch_ship_to: string | null; merch_shipping_cents: number | null
      }>()

    const { data: resident } = await db.from('residents')
      .select('first_name, last_name, unit_number')
      .eq('id', body.residentId).maybeSingle()
      .returns<{ first_name: string; last_name: string; unit_number: string | null }>()

    if (!site?.address || !site.city || !site.state || !site.zip) {
      return NextResponse.json(
        {
          error: 'no_shipping_address',
          detail: `${site?.name ?? 'This property'} has no complete address, so ` +
                  'physical goods cannot be shipped. Set address, city, state and zip on the site.',
        },
        { status: 409 },
      )
    }

    const toOffice = site.merch_ship_to === 'leasing_office'
    shippingCents = site.merch_shipping_cents ?? 0
    shipTo = {
      name: `${resident?.first_name ?? ''} ${resident?.last_name ?? ''}`.trim(),
      address1: site.address,
      address2: toOffice
        ? 'c/o Leasing Office'
        : resident?.unit_number ? `Unit ${resident.unit_number}` : undefined,
      city: site.city,
      province: site.state,
      zip: site.zip,
    }
  }

  const { data: order, error: orderErr } = await db
    .from('resident_orders')
    .insert({
      site_id: body.siteId,
      resident_id: body.residentId,
      session_id: body.sessionId ?? null,
      status: 'pending',
      subtotal_cents: subtotal,
      shipping_cents: shippingCents,
      total_cents: subtotal + shippingCents,
      ship_to: needsShipping ? (shipTo?.address2?.includes('Leasing') ? 'leasing_office' : 'unit') : null,
      shipping_address: shipTo ? { ...shipTo } : null,
    })
    .select('id')
    .single()
  if (orderErr) return NextResponse.json({ error: 'db', detail: orderErr.message }, { status: 500 })

  const { error: itemsErr } = await db.from('resident_order_items').insert(
    priced.map(p => ({
      order_id: order.id,
      kind: p.kind,
      ref_id: p.kind === 'credential' && !p.refId.includes('-') ? null : p.refId,
      name: p.name,
      qty: p.qty,
      unit_price_cents: p.unit,
    })),
  )
  if (itemsErr) return NextResponse.json({ error: 'db', detail: itemsErr.message }, { status: 500 })

  const intent = await createOrderPaymentIntent({
    orderId: order.id as string,
    siteId: body.siteId,
    residentId: body.residentId,
    lines: priced.map(p => ({ name: p.name, amountCents: p.unit, qty: p.qty })),
    shippingCents,
    shipTo,
  })

  await db.from('resident_orders')
    .update({ stripe_payment_intent_id: intent.id })
    .eq('id', order.id)

  return NextResponse.json({
    orderId: order.id,
    clientSecret: intent.client_secret,
    subtotalCents: subtotal,
    shippingCents,
    totalCents: subtotal + shippingCents,
    shipTo,
  })
}
