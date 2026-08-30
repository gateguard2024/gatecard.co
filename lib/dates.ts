/**
 * Dates that don't drift.
 *
 * `new Date('2026-09-05')` parses as UTC midnight. Render that in Eastern and
 * you get "Friday, September 4" — the resident's move-in date, shown a day
 * early, on the screen whose entire job is confirming their move-in date.
 *
 * Every date in this app is a calendar date, not an instant. Parse it as one.
 */

export function parseCalendarDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  // Local midnight, so formatting can never cross a day boundary.
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function formatMoveInDate(iso: string): string {
  return parseCalendarDate(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}
