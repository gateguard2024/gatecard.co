import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { twilioClient, TWILIO_FROM, twimlUrl } from '@/lib/twilio'

/**
 * POST /api/webhook/ubiquiti
 *
 * Receives callbox / door-station events from a local UniFi Access controller.
 *
 * Setup on the controller:
 *   UniFi OS → Access → Settings → Webhooks
 *   URL: https://gatecard.co/api/webhook/ubiquiti?secret=<ubiquiti_webhook_secret>
 *
 * Events we act on:
 *   access.door.intercom.start  — visitor pressed the callbox button
 *
 * Events we log but ignore:
 *   access.door.intercom.end
 *   access.door.unlock          — door was unlocked (by us or other means)
 *   access.door.open
 *   access.door.close
 *
 * Payload shape (UniFi Access v2 webhook):
 * {
 *   "event":     "access.door.intercom.start",
 *   "timestamp": 1714500000000,
 *   "data": {
 *     "device_id":  "abcdef1234",
 *     "door_name":  "Front Gate",
 *     "actor_id":   null,
 *     "actor_name": null
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Verify shared secret ────────────────────────────────────────────
    const secret = req.nextUrl.searchParams.get('secret')
    if (!secret) {
      return NextResponse.json({ error: 'Missing secret' }, { status: 401 })
    }

    // ── 2. Parse body ──────────────────────────────────────────────────────
    const body = await req.json() as {
      event:     string
      timestamp: number
      data?: {
        device_id?: string
        door_name?: string
        actor_id?:  string | null
      }
    }

    const { event, data } = body
    const deviceId = data?.device_id ?? null

    console.log('[ubiquiti webhook]', event, deviceId)

    // Only act on callbox button presses
    if (event !== 'access.door.intercom.start') {
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'No device_id in payload' }, { status: 422 })
    }

    const db = supabaseAdmin()

    // ── 3. Look up site by webhook secret + door device ID ─────────────────
    // The webhook secret ties the request to a specific site.
    // As a fallback we also match on ubiquiti_door_id.
    const { data: site } = await db
      .from('sites')
      .select('id, slug, name, ubiquiti_door_id, ubiquiti_webhook_secret')
      .eq('ubiquiti_webhook_secret', secret)
      .eq('active', true)
      .single()

    if (!site) {
      console.warn('[ubiquiti webhook] no site found for secret:', secret)
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // ── 4. Create access_event ─────────────────────────────────────────────
    const { data: accessEvent, error: eventErr } = await db
      .from('access_events')
      .insert({
        site_id:    site.id,
        entry_type: 'directory',   // visitor → directory selection
        outcome:    'initiated',
        call_sid:   null,
        photo_url:  null,
      })
      .select('id')
      .single()

    if (eventErr || !accessEvent) {
      console.error('[ubiquiti webhook] event insert error', eventErr)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    // ── 5. Determine who to call ───────────────────────────────────────────
    // For Ubiquiti callbox sites we route the visitor to the resident directory
    // by calling a configurable "callbox phone" (the kiosk tablet's SIM, or a
    // forwarding number that connects to the GateCard UI).
    //
    // Alternatively: if the site has a single leasing/guard number for callbox
    // events, dial that directly. Configurable via UBIQUITI_CALLBOX_TO_NUMBER
    // or per-site via a future `callbox_phone` column.
    //
    // Default behaviour: call the GateCard kiosk SIM so the visitor can use
    // the directory on screen. The kiosk SIM is stored in env var
    // UBIQUITI_KIOSK_PHONE (E.164).  If not set, we call a fallback number.

    const kiosk   = process.env.UBIQUITI_KIOSK_PHONE
    const dialTo  = kiosk || site_fallback(site.slug)

    if (!dialTo) {
      console.error('[ubiquiti webhook] no dialTo configured for site', site.slug)
      return NextResponse.json({ error: 'No kiosk phone configured' }, { status: 422 })
    }

    // ── 6. Dial via Twilio ─────────────────────────────────────────────────
    const twilio = twilioClient()
    const twiml  = twimlUrl(accessEvent.id, site.slug)

    const call = await twilio.calls.create({
      to:   dialTo,
      from: TWILIO_FROM,
      url:  twiml,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/call/status-webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30,
    })

    // ── 7. Update event with call SID ──────────────────────────────────────
    await db
      .from('access_events')
      .update({ call_sid: call.sid, outcome: 'ringing' })
      .eq('id', accessEvent.id)

    console.log('[ubiquiti webhook] call initiated', call.sid, 'for site', site.slug)

    return NextResponse.json({
      ok:      true,
      callSid: call.sid,
      eventId: accessEvent.id,
    })

  } catch (err) {
    console.error('[ubiquiti webhook] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** Fallback: derive a test number from slug (dev only) */
function site_fallback(_slug: string): string | null {
  return process.env.UBIQUITI_FALLBACK_PHONE ?? null
}
