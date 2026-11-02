import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

/** Live classroom controls stay in the repository for later work, but are not part of self-paced mode. */
export const LIVE_CONTROL_ENABLED = false

export { VOICE_SUBMISSION_ENABLED } from './voice-feature'

export function redirectIfLiveControlDisabled(): void {
  if (!LIVE_CONTROL_ENABLED) redirect('/teacher')
}

export function liveControlNotFound(): NextResponse {
  return NextResponse.json(
    { error: 'not-found', message: 'การควบคุมคาบสดถูกปิดในโหมดเรียนด้วยตนเอง' },
    { status: 404 },
  )
}
