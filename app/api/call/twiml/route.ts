import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const { VoiceResponse } = twilio.twiml

// GET/POST /api/call/twiml?eventId=&siteSlug=
// Twilio calls this URL when the resident answers.
// IVR: "You have a visitor. Press 1 to open the gate, 2 to decline."
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const eventId  = searchParams.get('eventId')  ?? ''
  const siteSlug = searchParams.get('siteSlug') ?? ''

  const response = new VoiceResponse()

  const gather = response.gather({
    numDigits: 1,
    action: `${process.env.NEXT_PUBLIC_APP_URL}/api/call/twiml/action?eventId=${eventId}&siteSlug=${siteSlug}`,
    method: 'POST',
    timeout: 15,
  })

  gather.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    `You have a visitor at the gate. Press 1 to open the gate. Press 2 to decline.`
  )

  // If no input, say goodbye
  response.say({ voice: 'Polly.Joanna' }, 'No response received. Goodbye.')
  response.hangup()

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Also handle GET (Twilio sometimes uses GET)
export { POST as GET }
