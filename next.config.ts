import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ให้ทดสอบบนมือถือจริงผ่าน Wi-Fi ได้ (http://<IP เครื่อง>:3000) — มีผลเฉพาะ dev
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*', '*.local'],
  reactStrictMode: true,
  // Next 16: hide the on-screen dev indicator so visual captures are clean.
  devIndicators: false,
  // ไม่ให้ไฟล์ภาพ QA/เอกสารถูกลากติดเข้า serverless function (route ที่อ่านไฟล์ด้วย process.cwd())
  outputFileTracingExcludes: {
    '*': ['docs/**', 'UI/**', '.playwright-cli/**', 'supabase/**', 'scripts/**', '**/*.test.ts', '**/*.test.tsx'],
  },
}

export default nextConfig
