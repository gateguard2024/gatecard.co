import 'server-only'
import { supabaseAdmin } from './supabase'

/**
 * Outbound email, with a log that makes double-sending impossible.
 *
 * Every send is keyed on what it IS — tenancy plus message kind — not on when
 * it ran. A retried Inngest step, a replayed event and a re-run sync all
 * collide on the same key, and the second one is suppressed. Nobody gets two
 * "welcome to your new home" emails.
 */

const RESEND_URL = 'https://api.resend.com/emails'

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

export interface SendArgs {
  idempotencyKey: string
  to: string
  subject: string
  html: string
  kind: string
  siteId?: string
  residentId?: string
  replyTo?: string
}

export type SendResult =
  | { status: 'sent'; id: string | null }
  | { status: 'suppressed'; reason: string }
  | { status: 'failed'; error: string }

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const db = supabaseAdmin()

  // Claim the key first. If the insert conflicts, someone already sent this.
  const { error: claimErr } = await db.from('notification_log').insert({
    idempotency_key: args.idempotencyKey,
    site_id: args.siteId ?? null,
    resident_id: args.residentId ?? null,
    kind: args.kind,
    recipient: args.to,
    subject: args.subject,
    status: 'sent',
  })

  if (claimErr) {
    // 23505 = unique violation = already sent. That is a success, not an error.
    if ((claimErr as { code?: string }).code === '23505') {
      return { status: 'suppressed', reason: 'already_sent' }
    }
    return { status: 'failed', error: claimErr.message }
  }

  if (!resendConfigured()) {
    await db.from('notification_log')
      .update({ status: 'suppressed', error: 'RESEND_API_KEY not set' })
      .eq('idempotency_key', args.idempotencyKey)
    return { status: 'suppressed', reason: 'not_configured' }
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      // Release the key so a later run can retry rather than being suppressed
      // by a claim for a message that never actually went out.
      await db.from('notification_log').delete().eq('idempotency_key', args.idempotencyKey)
      return { status: 'failed', error: `resend ${res.status}: ${detail.slice(0, 300)}` }
    }

    const json = (await res.json()) as { id?: string }
    await db.from('notification_log')
      .update({ provider_id: json.id ?? null })
      .eq('idempotency_key', args.idempotencyKey)

    return { status: 'sent', id: json.id ?? null }
  } catch (err) {
    await db.from('notification_log').delete().eq('idempotency_key', args.idempotencyKey)
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

const shell = (accent: string, body: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
            background:#F2F5F8;padding:28px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;
              border:1px solid #E1E7EE;overflow:hidden;">
    <div style="height:4px;background:${accent};"></div>
    <div style="padding:26px 24px;color:#16202B;line-height:1.55;font-size:15px;">
      ${body}
    </div>
  </div>
  <p style="max-width:520px;margin:14px auto 0;text-align:center;color:#8494A6;font-size:11px;">
    Sent by Gate Guard on behalf of the property.
  </p>
</div>`

export interface MoveInRow {
  firstName: string
  lastName: string
  unitNumber: string | null
  email: string | null
  phone: string | null
  inviteUrl: string | null
}

/**
 * The staff digest — ONE email per sync run, not one per resident.
 *
 * A property onboarding forty units in an afternoon would otherwise send forty
 * separate emails, which is how a notification stream gets filtered to trash in
 * week one.
 */
export function staffDigestHtml(args: {
  propertyName: string
  accent: string
  movedIn: MoveInRow[]
  movedOut: { firstName: string; lastName: string; unitNumber: string | null }[]
  unitChanged: { firstName: string; lastName: string; from: string | null; to: string }[]
  guard: string | null
  needsAttention: string[]
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:3px 12px 3px 0;color:#68788A;font-size:13px;">${label}</td>
         <td style="padding:3px 0;font-size:13px;font-weight:600;">${value}</td></tr>`

  const section = (title: string, inner: string) =>
    inner ? `<h3 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;
                        color:#68788A;margin:22px 0 8px;">${title}</h3>${inner}` : ''

  const movedIn = args.movedIn.map(m => `
    <div style="border:1px solid #E1E7EE;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
      <div style="font-weight:600;font-size:15px;">${m.firstName} ${m.lastName}${
        m.unitNumber ? ` &middot; Unit ${m.unitNumber}` : ''}</div>
      <table style="margin-top:6px;border-collapse:collapse;">
        ${m.email ? row('Email', m.email) : ''}
        ${m.phone ? row('Mobile', m.phone) : ''}
        ${m.unitNumber ? '' : row('Unit', '<span style="color:#B4761A;">missing from Brivo</span>')}
      </table>
      ${m.inviteUrl
        ? `<a href="${m.inviteUrl}" style="display:inline-block;margin-top:10px;padding:8px 14px;
             background:${args.accent};color:#0C1C27;border-radius:8px;text-decoration:none;
             font-weight:600;font-size:13px;">Open their parking &amp; access registration</a>`
        : ''}
    </div>`).join('')

  const movedOut = args.movedOut.map(m =>
    `<div style="padding:7px 0;border-bottom:1px solid #EEF2F6;font-size:14px;">
       ${m.firstName} ${m.lastName}${m.unitNumber ? ` &middot; Unit ${m.unitNumber}` : ''}
     </div>`).join('')

  const changed = args.unitChanged.map(u =>
    `<div style="padding:7px 0;border-bottom:1px solid #EEF2F6;font-size:14px;">
       ${u.firstName} ${u.lastName} &middot; ${u.from ?? '—'} &rarr; <strong>${u.to}</strong>
     </div>`).join('')

  const attention = args.needsAttention.length
    ? `<div style="background:#FFF7E6;border:1px solid #F0D9A8;border-radius:10px;
                   padding:12px 14px;margin-top:18px;font-size:13px;color:#7A5A16;">
         <strong>Needs a look</strong>
         <ul style="margin:6px 0 0;padding-left:18px;">
           ${args.needsAttention.map(a => `<li>${a}</li>`).join('')}
         </ul>
       </div>` : ''

  const guard = args.guard
    ? `<div style="background:#FDECEC;border:1px solid #F3C0C0;border-radius:10px;
                   padding:12px 14px;margin-bottom:16px;font-size:13px;color:#8C2F2F;">
         <strong>Sync held back.</strong> ${args.guard}<br>
         No move-outs were processed. Nobody lost access.
       </div>` : ''

  return shell(args.accent, `
    <h2 style="margin:0 0 4px;font-size:19px;">${args.propertyName}</h2>
    <p style="margin:0 0 14px;color:#68788A;font-size:13px;">Resident changes since the last check</p>
    ${guard}
    ${section(`Moved in (${args.movedIn.length})`, movedIn)}
    ${section(`Changed unit (${args.unitChanged.length})`, changed)}
    ${section(`Moved out (${args.movedOut.length})`, movedOut)}
    ${attention}
  `)
}

/** The resident's own email — one link, one job. */
export function residentInviteHtml(args: {
  propertyName: string
  accent: string
  firstName: string
  unitNumber: string | null
  inviteUrl: string
  leasingPhone: string | null
}): string {
  return shell(args.accent, `
    <h2 style="margin:0 0 10px;font-size:20px;">Welcome to ${args.propertyName}, ${args.firstName}.</h2>
    <p style="margin:0 0 16px;">
      Register your vehicle for a parking pass and set up your gate access${
        args.unitNumber ? ` for unit ${args.unitNumber}` : ''}. It takes about two
      minutes on your phone, and there's nothing to pay.
    </p>
    <a href="${args.inviteUrl}"
       style="display:inline-block;padding:13px 22px;background:${args.accent};color:#0C1C27;
              border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
      Register my parking &amp; access
    </a>
    <p style="margin:18px 0 0;color:#68788A;font-size:13px;">
      Your phone becomes your key as soon as you finish${
        args.leasingPhone
          ? `. Questions about your unit or lease? Call the leasing office at
             <a href="tel:${args.leasingPhone}" style="color:#2E6E99;">${args.leasingPhone}</a>`
          : ''}.
    </p>
    <p style="margin:14px 0 0;color:#93A3B4;font-size:11px;">
      This link is just for you and expires in 30 days.
    </p>
  `)
}
