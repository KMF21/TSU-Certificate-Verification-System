import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Bulk uploads send up to 10,000 checked rows in one request.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'www.tsuniversity.edu.ng' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
