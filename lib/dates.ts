/**
 * Dates that don't drift, and don't break hydration.
 *
 * Two separate traps, both of which show up as a date that is subtly wrong or
 * a page that renders but won't respond.
 *
 * 1. `new Date('2026-09-05')` parses as UTC midnight. Rendered in Eastern that
 *    is "Friday, September 4" — the resident's move-in date, a day early, on
 *    the screen whose whole job is confirming it.
 *
 * 2. `toLocaleDateString` uses the runtime's timezone. On the server that is
 *    UTC; in the resident's browser it is wherever they are. Different strings
 *    for the same date means a hydration mismatch, and a mismatch can leave
 *    React's handlers unattached — a form that looks fine and does nothing.
 *
 * So: parse as a calendar date, and format from the parts with no locale and
 * no timezone involved. Server and client cannot disagree.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function parseCalendarDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  // Local midnight, so formatting can never cross a day boundary.
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** "Saturday, September 5" — identical on the server and in the browser. */
export function formatMoveInDate(iso: string): string {
  const dt = parseCalendarDate(iso)
  return `${DAYS[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}`
}
