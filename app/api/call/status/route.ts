import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/call/status?eventId=
// Polled by the visitor's call screen every 2 seconds.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('access_events')
    .select('id, outcome, call_sid, photo_url')
    .eq('id', eventId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  return NextResponse.json({
    eventId:    data.id,
    outcome:    data.outcome,
    callSid:    data.call_sid,
    photoUrl:   data.photo_url,
    gateOpened: data.outcome === 'gate_opened',
  })
}
