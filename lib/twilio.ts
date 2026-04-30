import twilio from 'twilio'

export function twilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('Twilio credentials not configured')
  return twilio(sid, token)
}

export const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? ''

// TwiML app URL — Twilio calls this when resident answers
export function twimlUrl(eventId: string, siteSlug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gatecard.co'
  return `${base}/api/call/twiml?eventId=${eventId}&siteSlug=${siteSlug}`
}
