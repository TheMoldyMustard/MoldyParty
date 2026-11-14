export interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
}

export interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

export interface WakeLockManager {
  acquire(): Promise<boolean>
  release(): Promise<void>
  isHeld(): boolean
}

export function createWakeLockManager(
  wakeLock: WakeLockLike | undefined,
  isVisible: () => boolean,
): WakeLockManager {
  let sentinel: WakeLockSentinelLike | null = null
  return {
    async acquire() {
      if (!wakeLock || !isVisible()) return false
      if (sentinel && !sentinel.released) return true
      try {
        sentinel = await wakeLock.request('screen')
        return true
      } catch {
        sentinel = null
        return false
      }
    },
    async release() {
      const current = sentinel
      sentinel = null
      if (current && !current.released) {
        try {
          await current.release()
        } catch {
          // A browser may release the advisory lock first.
        }
      }
    },
    isHeld() {
      return Boolean(sentinel && !sentinel.released)
    },
  }
}
