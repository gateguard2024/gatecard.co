import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '@/lib/supabase'
import { unlockDoor } from '@/lib/ubiquiti'

const { VoiceResponse } = twilio.twiml

// POST /api/call/twiml/action?eventId=&siteSlug=
// Twilio posts here with the digit the resident pressed.
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const eventId  = searchParams.get('eventId')  ?? ''
  const siteSlug = searchParams.get('siteSlug') ?? ''

  const body = await req.formData()
  const digit = body.get('Digits') as string

  const response = new VoiceResponse()
  const db = supabaseAdmin()

  if (digit === '1') {
    // ── Open the gate ──────────────────────────────────────────────────────
    try {
      // Resolve site → hardware IDs (Brivo or Ubiquiti)
      const { data: site } = await db
        .from('sites')
        .select('brivo_account_id, brivo_access_point_id, ubiquiti_controller_url, ubiquiti_controller_token, ubiquiti_door_id')
        .eq('slug', siteSlug)
        .single()

      let opened = false

      // ── Brivo path ────────────────────────────────────────────────────────
      if (site?.brivo_account_id && site?.brivo_access_point_id) {
        const gateRes = await fetch(
          `${process.env.GATEGUARD_PORTAL_URL}/api/brivo/open`,
          {
            method: 'POST',
            headers: {
              'Content-Type':      'application/json',
              'x-internal-secret': process.env.GATEGUARD_API_SECRET ?? '',
            },
            body: JSON.stringify({
              accountId:    site.brivo_account_id,
              doorId:       site.brivo_access_point_id,
              operatorId:   `gatecard:event:${eventId}`,
              operatorName: 'GateCard Visitor',
            }),
          }
        )
        if (gateRes.ok) {
          opened = true
        } else {
          console.error('[twiml/action] Brivo open failed:', gateRes.status)
        }
      }

      // ── Ubiquiti path (fallback or primary for Ubiquiti-only sites) ───────
      if (!opened && site?.ubiquiti_controller_url && site?.ubiquiti_controller_token && site?.ubiquiti_door_id) {
        await unlockDoor(
          site.ubiquiti_controller_url,
          site.ubiquiti_controller_token,
          site.ubiquiti_door_id,
        )
        opened = true
      }

      await db
        .from('access_events')
        .update({ outcome: 'gate_opened', updated_at: new Date().toISOString() })
        .eq('id', eventId)

      response.say({ voice: 'Polly.Joanna' }, 'Gate is opening now. Welcome.')

    } catch (err) {
      console.error('[twiml/action] gate open error', err)
      response.say({ voice: 'Polly.Joanna' }, 'The gate is opening. Welcome.')
    }

  } else {
    // Declined (2 or anything else)
    await db
      .from('access_events')
      .update({ outcome: 'denied', updated_at: new Date().toISOString() })
      .eq('id', eventId)

    response.say(
      { voice: 'Polly.Joanna' },
      'Access has been declined. Goodbye.'
    )
  }

  response.hangup()

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
