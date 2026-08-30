import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The repo can live on a network-mounted filesystem where memory-mapped
  // build output fails. NEXT_DIST_DIR moves .next off the mount when needed.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
}

export default nextConfig
