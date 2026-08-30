import { NextResponse } from 'next/server'
import { configured } from '@/lib/env'
import { dataSource } from '@/lib/data'

export const dynamic = 'force-dynamic'

/**
 * What is actually wired. Worth having from day one: "the portal is up" and
 * "the portal can issue a credential" are different questions, and only this
 * answers the second.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    dataSource: dataSource(),
    integrations: {
      supabase: configured.supabase(),
      clerk: configured.clerk(),
      stripe: configured.stripe(),
      stripeConnect: configured.connect(),
      brivo: configured.brivo(),
      shopify: configured.shopify(),
      inngest: configured.inngest(),
      twilio: configured.twilio(),
      resend: configured.resend(),
    },
  })
}
