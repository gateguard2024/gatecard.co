import { NextRequest, NextResponse } from 'next/server'
import { twilioClient } from '@/lib/twilio'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/call/cancel  body: { callSid, eventId }
// Visitor taps "End Call" before the resident answers.
export async function POST(req: NextRequest) {
  try {
    const { callSid, eventId } = await req.json()

    if (callSid) {
      const twilio = twilioClient()
      await twilio.calls(callSid).update({ status: 'completed' }).catch(() => {})
    }

    if (eventId) {
      const db = supabaseAdmin()
      await db
        .from('access_events')
        .update({ outcome: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', eventId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[call/cancel]', err)
    return NextResponse.json({ error: 'Failed to cancel call' }, { status: 500 })
  }
}
