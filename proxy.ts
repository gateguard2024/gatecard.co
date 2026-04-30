import { NextRequest, NextResponse } from 'next/server'

// Public paths — no auth required (visitor flows)
const PUBLIC_PATHS = [
  '/',
  '/api/call/twiml',   // Twilio webhook must be public
  '/api/call/status',
  '/api/sites',
  '/api/residents',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow Twilio webhook and all visitor-facing routes
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.match(/^\/[a-z0-9-]+($|\/)/) // /[siteSlug] and sub-routes
  ) {
    return NextResponse.next()
  }

  // /resident routes — auth placeholder (Clerk or magic link in Sprint 2)
  if (pathname.startsWith('/resident')) {
    // TODO: add Clerk or token auth in Sprint 2
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
