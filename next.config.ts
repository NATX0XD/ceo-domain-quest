import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16: hide the on-screen dev indicator so visual captures are clean.
  devIndicators: false,
}

export default nextConfig
