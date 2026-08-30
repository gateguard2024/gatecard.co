import { NextResponse, type NextRequest } from 'next/server'
import { configured } from '@/lib/env'
import { inngest } from '@/lib/inngest/client'

export const dynamic = 'force-dynamic'

/** Daily nudge for the commission release job. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!configured.inngest()) {
    return NextResponse.json({ ok: false, reason: 'inngest_not_configured' }, { status: 503 })
  }
  await inngest.send({ name: 'commissions/release', data: {} })
  return NextResponse.json({ ok: true })
}
