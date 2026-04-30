import { NextRequest, NextResponse } from 'next/server'
import { twilioClient, TWILIO_FROM, twimlUrl } from '@/lib/twilio'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/call/initiate
// Body: { siteSlug, residentId?, entryType }
//
// directory  → residentId required, Twilio IVR (press 1 = gate open, press 2 = deny)
// leasing    → no residentId, Twilio <Dial> to site.leasing_phone
// emergency  → no residentId, Twilio <Dial> to site.soc_phone
// packages   → no Twilio call in Sprint 1 (unlock handled separately)

export async function POST(req: NextRequest) {
  try {
    const { siteSlug, residentId, entryType = 'directory' } = await req.json()

    if (!siteSlug) {
      return NextResponse.json({ error: 'siteSlug required' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // ── 1. Resolve site ───────────────────────────────────────────────────────
    const { data: site } = await db
      .from('sites')
      .select('id, slug, name, leasing_phone, soc_phone, brivo_site_id, een_camera_id')
      .eq('slug', siteSlug)
      .single()

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // ── 2. Resolve resident (directory only) ──────────────────────────────────
    let resident: { id: string; unit_number: string; phone: string } | null = null
    if (entryType === 'directory') {
      if (!residentId) {
        return NextResponse.json({ error: 'residentId required for directory calls' }, { status: 400 })
      }
      const { data } = await db
        .from('residents')
        .select('id, unit_number, phone')
        .eq('id', residentId)
        .eq('site_id', site.id)
        .eq('active', true)
        .single()

      if (!data) {
        return NextResponse.json({ error: 'Resident not found' }, { status: 404 })
      }
      resident = data
    }

    // ── 3. Determine dial-to number ───────────────────────────────────────────
    let dialTo: string | null = null
    if (entryType === 'directory') {
      dialTo = resident!.phone
    } else if (entryType === 'leasing') {
      dialTo = site.leasing_phone
    } else if (entryType === 'emergency') {
      dialTo = site.soc_phone
    }

    if (!dialTo) {
      return NextResponse.json(
        { error: `No phone configured for entry type: ${entryType}` },
        { status: 422 }
      )
    }

    // ── 4. Create access_event ─────────────────────────────────────────────────
    const { data: event, error: eventErr } = await db
      .from('access_events')
      .insert({
        site_id:       site.id,
        resident_id:   resident?.id ?? null,
        resident_unit: resident?.unit_number ?? null,
        entry_type:    entryType,
        outcome:       'initiated',
        call_sid:      null,
        photo_url:     null,
      })
      .select('id')
      .single()

    if (eventErr || !event) {
      console.error('[call/initiate] event insert error', eventErr)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    // ── 5. Capture EEN snapshot (fire-and-forget) ─────────────────────────────
    if (site.een_camera_id) {
      captureSnapshot(site.een_camera_id, event.id, db).catch(console.error)
    }

    // ── 6. Dial via Twilio ────────────────────────────────────────────────────
    const twilio = twilioClient()
    const twiml = entryType === 'directory'
      ? twimlUrl(event.id, siteSlug)                       // IVR flow
      : twimlDirectDialUrl(event.id, siteSlug, dialTo)     // straight dial-through

    const call = await twilio.calls.create({
      to:   dialTo,
      from: TWILIO_FROM,
      url:  twiml,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/call/status-webhook`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30,
    })

    // ── 7. Update event with call SID ──────────────────────────────────────────
    await db
      .from('access_events')
      .update({ call_sid: call.sid, outcome: 'ringing' })
      .eq('id', event.id)

    return NextResponse.json({
      callSid:    call.sid,
      eventId:    event.id,
      residentId: resident?.id ?? null,
    })

  } catch (err) {
    console.error('[call/initiate] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Direct-dial TwiML URL (leasing / emergency) — no IVR, just connect
function twimlDirectDialUrl(eventId: string, siteSlug: string, dialTo: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gatecard.co'
  const params = new URLSearchParams({ eventId, siteSlug, dialTo })
  return `${base}/api/call/twiml/direct?${params}`
}

// ── EEN snapshot helper ────────────────────────────────────────────────────────
async function captureSnapshot(
  cameraId: string,
  eventId: string,
  db: ReturnType<typeof supabaseAdmin>
) {
  try {
    const res = await fetch(
      `${process.env.GATEGUARD_PORTAL_URL ?? 'https://portal.gateguard.co'}/api/een/image?cameraId=${cameraId}`,
      {
        headers: {
          'x-internal-secret': process.env.GATEGUARD_API_SECRET ?? '',
        },
      }
    )
    if (!res.ok) return

    const blob   = await res.blob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    const path = `access-events/${eventId}/snapshot.jpg`
    const { error: uploadErr } = await db.storage
      .from('visitor-photos')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadErr) {
      console.error('[snapshot] upload error', uploadErr)
      return
    }

    const { data: urlData } = db.storage
      .from('visitor-photos')
      .getPublicUrl(path)

    await db
      .from('access_events')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', eventId)

  } catch (err) {
    console.error('[snapshot] error', err)
  }
}
