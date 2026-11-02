import { getServiceClient } from '@/lib/db/client'
import { logEvent } from '@/lib/db/repo'
import { clampMissionSettings, type MissionSettings } from '@/lib/mission-settings'

export const M4_ATTEMPT_EVENT = 'm4-attempt-settings'
export type M4AttemptSettings = MissionSettings['m4']

export async function startM4Attempt(studentId: string, settings: M4AttemptSettings): Promise<void> {
  await logEvent(studentId, M4_ATTEMPT_EVENT, { settings })
}

/** Read the server-owned snapshot; the browser never supplies scoring thresholds. */
export async function currentM4AttemptSettings(studentId: string, fallback: M4AttemptSettings): Promise<M4AttemptSettings> {
  const { data, error } = await getServiceClient()
    .from('events')
    .select('payload')
    .eq('student_id', studentId)
    .eq('type', M4_ATTEMPT_EVENT)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`currentM4AttemptSettings: ${error.message}`)
  const payload = data?.[0]?.payload as { settings?: unknown } | undefined
  return payload?.settings ? clampMissionSettings('m4', payload.settings) : fallback
}
