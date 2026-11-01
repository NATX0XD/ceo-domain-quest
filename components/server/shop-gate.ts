import { redirect } from 'next/navigation'
import { loadShopProfile } from './game-state'

/** Server-only gate for student routes that require a completed shop setup. */
export async function requireShopProfile(studentId: string) {
  const profile = await loadShopProfile(studentId)
  if (!profile) redirect('/setup')
  return profile
}

export async function hasShopProfile(studentId: string) {
  return (await loadShopProfile(studentId)) !== null
}
