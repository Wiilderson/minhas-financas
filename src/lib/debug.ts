/** Logs só em desenvolvimento (npm run dev) */
const enabled = import.meta.env.DEV

export function debugLog(label: string, data?: unknown): void {
  if (!enabled) return
  if (data !== undefined) {
    console.log(`[Finanças] ${label}`, data)
  } else {
    console.log(`[Finanças] ${label}`)
  }
}

export function debugGroup(label: string, fn: () => void): void {
  if (!enabled) return
  console.group(`[Finanças] ${label}`)
  fn()
  console.groupEnd()
}
