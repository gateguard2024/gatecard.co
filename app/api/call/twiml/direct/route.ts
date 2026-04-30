import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

// GET /api/call/twiml/direct?eventId=…&siteSlug=…&dialTo=+1xxx
// Returns TwiML that connects the visitor intercom straight through to the destination
// Used for leasing office and security/emergency calls (no IVR press-1 gate logic)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const dialTo  = searchParams.get('dialTo')
  const eventId = searchParams.get('eventId') ?? ''

  if (!dialTo) {
    return new NextResponse('<Response><Say>Configuration error. Please contact the property manager.</Say></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  const VoiceResponse = twilio.twiml.VoiceResponse
  const twiml = new VoiceResponse()

  // Announce to the recipient that this is from the GateGuard intercom
  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    'Incoming call from the GateGuard visitor intercom. Connecting now.'
  )

  const dial = twiml.dial({ timeout: 30, callerId: process.env.TWILIO_FROM ?? '' })
  dial.number(dialTo)

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Twilio can POST or GET to TwiML URLs
export const POST = GET
