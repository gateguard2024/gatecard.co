import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow images from EEN snapshots and Supabase storage
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.eagleeyenetworks.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
