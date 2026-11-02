export const M3_SHIFT_SIZE = 3
export const M3_CUSTOMER_POOL_SIZE = 18

export function m3SeenKey(studentId?: string | null): string {
  return `m3-customers-seen-v1:${studentId ?? 'guest'}`
}

export function readM3Seen(storage: Pick<Storage, 'getItem'> | null, studentId?: string | null): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(m3SeenKey(studentId))
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : []
  } catch {
    return []
  }
}

export function rememberM3Customers(
  storage: Pick<Storage, 'setItem'> | null,
  studentId: string | null | undefined,
  seen: readonly string[],
  ids: readonly string[],
): string[] {
  const next = [...new Set([...seen, ...ids])]
  // The server starts a new permutation after all customers have appeared once.
  const persisted = next.length >= M3_CUSTOMER_POOL_SIZE ? [] : next
  try {
    storage?.setItem(m3SeenKey(studentId), JSON.stringify(persisted))
  } catch {
    /* localStorage is an optional hint; the server event history remains authoritative. */
  }
  return persisted
}

export function isFreshM3Shift(ids: readonly string[], seen: readonly string[]): boolean {
  return ids.length === M3_SHIFT_SIZE && ids.every((id) => !seen.includes(id))
}
