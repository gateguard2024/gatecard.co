import { NextResponse } from 'next/server'
import { configured } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'
import { toE164 } from '@/lib/brivo'

export const dynamic = 'force-dynamic'

/**
 * Screens 01-03 are complete. This is the only endpoint that matters.
 *
 * It takes no payment and cannot fail because of one. Everything after this
 * point in the portal is optional, and a resident who closes the tab here still
 * walks up to the gate with a working key.
 */
export async function POST(req: Request) {
  if (!configured.supabase()) {
    return NextResponse.json(
      { error: 'not_configured', detail: 'Supabase env is not set; portal is running on mock data.' },
      { status: 503 },
    )
  }

  const body = (await req.json()) as {
    siteId?: string
    residentId?: string
    mobile?: string
    parkingTierCode?: string
    vehicle?: {
      plate?: string; state?: string; make?: string; model?: string; color?: string
    }
  }

  const mobile = toE164(body.mobile)
  if (!body.siteId || !body.residentId || !mobile) {
    return NextResponse.json(
      { error: 'invalid', detail: 'siteId, residentId and a valid mobile number are required.' },
      { status: 400 },
    )
  }

  const db = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: session, error: sessErr } = await db
    .from('move_in_sessions')
    .insert({
      site_id: body.siteId,
      resident_id: body.residentId,
      status: 'activated',
      activated_at: now,
      mobile_e164: mobile,
    })
    .select('id')
    .single()
  if (sessErr) {
    return NextResponse.json({ error: 'db', detail: sessErr.message }, { status: 500 })
  }

  // Parking is recorded here, not charged here. Whether an upgrade costs money
  // and how that money is collected is unresolved (AGENTS.md D3) — the
  // assignment does not wait on it.
  if (body.parkingTierCode) {
    const { data: tier } = await db
      .from('site_parking_tiers')
      .select('id')
      .eq('site_id', body.siteId)
      .eq('code', body.parkingTierCode)
      .maybeSingle()

    if (tier?.id) {
      const { error: parkErr } = await db.from('parking_assignments').insert({
        site_id: body.siteId,
        resident_id: body.residentId,
        tier_id: tier.id,
        plate: body.vehicle?.plate ?? null,
        plate_state: body.vehicle?.state ?? null,
        vehicle_make: body.vehicle?.make ?? null,
        vehicle_model: body.vehicle?.model ?? null,
        vehicle_color: body.vehicle?.color ?? null,
        status: 'active',
      })
      // A parking failure must not block the credential. Log and carry on —
      // the leasing office can assign a space; nobody can un-strand a resident
      // at the gate at 9pm.
      if (parkErr) console.error('[activate] parking assignment failed', parkErr)
    }
  }

  if (configured.inngest()) {
    await inngest.send({
      name: 'movein/activated',
      data: {
        sessionId: session.id as string,
        siteId: body.siteId,
        residentId: body.residentId,
        mobile,
      },
    })
  }

  return NextResponse.json({ ok: true, sessionId: session.id, activated: true })
}
