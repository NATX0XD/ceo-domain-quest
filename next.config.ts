import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16: hide the on-screen dev indicator so visual captures are clean.
  devIndicators: false,
  // ไม่ให้ไฟล์ภาพ QA/เอกสารถูกลากติดเข้า serverless function (route ที่อ่านไฟล์ด้วย process.cwd())
  outputFileTracingExcludes: {
    '*': ['docs/**', 'UI/**', '.playwright-cli/**', 'supabase/**', 'scripts/**', '**/*.test.ts', '**/*.test.tsx'],
  },
}

export default nextConfig
