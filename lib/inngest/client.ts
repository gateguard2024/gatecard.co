import { Inngest } from 'inngest'

/**
 * Events this app emits. Payloads stay flat — they end up in logs and in the
 * Inngest run viewer, which is where someone debugs a resident's stuck key.
 *
 * v4 dropped EventSchemas in favour of typed triggers; until those are wired,
 * handlers assert against these types at the top of each function so the shape
 * is still stated in one place.
 */
export type MoveInEvents = {
  'movein/activated': {
    sessionId: string; siteId: string; residentId: string; mobile: string
  }
  'order/paid': {
    orderId: string; siteId: string; residentId: string; chargeId: string
  }
  'commissions/release': Record<string, never>
}

export const inngest = new Inngest({ id: 'gatecard-move-in' })
