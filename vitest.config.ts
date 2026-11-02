import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// '@/…' ตาม tsconfig paths — ให้เทสต์ของ route ที่ import ผ่าน alias โหลดได้
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
})
