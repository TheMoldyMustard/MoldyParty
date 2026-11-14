export interface HistoryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StoredHistory {
  version: 1
  packs: Record<string, string[]>
}

export interface NoRepeatHistory {
  getUsed(packId: string): string[]
  markUsed(packId: string, word: string): void
  clear(packId?: string): void
}

const STORAGE_KEY = 'moldyparty-charades-history'

function emptyHistory(): StoredHistory {
  return { version: 1, packs: {} }
}

function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase()
}

export function createNoRepeatHistory(
  storage: HistoryStorage = localStorage,
  maxPerPack = 500,
): NoRepeatHistory {
  function read(): StoredHistory {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '') as Partial<StoredHistory>
      if (parsed.version !== 1 || !parsed.packs || typeof parsed.packs !== 'object') return emptyHistory()
      const packs: Record<string, string[]> = {}
      for (const [packId, words] of Object.entries(parsed.packs)) {
        if (!Array.isArray(words)) continue
        packs[packId] = words
          .filter((word): word is string => typeof word === 'string')
          .map(normalizeWord)
          .filter(Boolean)
          .slice(-maxPerPack)
      }
      return { version: 1, packs }
    } catch {
      return emptyHistory()
    }
  }

  function write(history: StoredHistory) {
    storage.setItem(STORAGE_KEY, JSON.stringify(history))
  }

  return {
    getUsed(packId) {
      return [...(read().packs[packId] ?? [])]
    },
    markUsed(packId, word) {
      const normalized = normalizeWord(word)
      if (!normalized) return
      const history = read()
      const words = (history.packs[packId] ?? []).filter((candidate) => candidate !== normalized)
      history.packs[packId] = [...words, normalized].slice(-maxPerPack)
      write(history)
    },
    clear(packId) {
      if (!packId) {
        storage.removeItem(STORAGE_KEY)
        return
      }
      const history = read()
      delete history.packs[packId]
      write(history)
    },
  }
}

export const noRepeatHistory = createNoRepeatHistory()
