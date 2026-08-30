import type { NextConfig } from 'next'

/**
 * Dev origins allowed to load /_next/* assets.
 *
 * Next 16 blocks cross-origin requests to dev resources by default: anything
 * whose Origin isn't allowlisted gets a 403 on every /_next/* request. The page
 * still server-renders, so it LOOKS fine — but no JavaScript loads, nothing
 * hydrates, typing doesn't format, and buttons never enable. It presents as a
 * broken form rather than a blocked request, which is a miserable thing to
 * debug.
 *
 * This portal is mobile-first, so it is nearly always opened from a phone on
 * the LAN rather than from localhost — which means tripping this is the normal
 * case here, not the exception. Private ranges are allowed by default and
 * NEXT_DEV_ORIGINS can override.
 *
 * Development only. It has no effect on a production build.
 */
const devOrigins = process.env.NEXT_DEV_ORIGINS
  ? process.env.NEXT_DEV_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [
      'localhost',
      '127.0.0.1',
      '192.168.*.*',   // home and office LANs
      '10.*.*.*',      // larger private networks
      '172.16.*.*',    // docker / VM bridges
      '*.local',       // Bonjour hostnames, e.g. russels-macbook.local
    ]

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,

  // The repo can live on a network-mounted filesystem where memory-mapped
  // build output fails. NEXT_DIST_DIR moves .next off the mount when needed.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
}

export default nextConfig
