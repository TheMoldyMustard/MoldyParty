import type { WordItem, WordPack } from '../../domain/types'

export type ParseResult =
  | { ok: true; pack: WordPack }
  | { ok: false; error: string }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeItems(value: unknown): WordItem[] | string {
  if (!Array.isArray(value) || value.length === 0) {
    return 'Add at least one word.'
  }

  const items: WordItem[] = []
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.word !== 'string') {
      return 'Each item needs a word and hint.'
    }
    const word = candidate.word.trim()
    if (!word) {
      return 'Words cannot be blank.'
    }

    if ('hints' in candidate) {
      if (!Array.isArray(candidate.hints) || candidate.hints.length !== 5) {
        return 'Each hints array must contain exactly 5 hints.'
      }
      if (candidate.hints.some((hint) => typeof hint !== 'string' || !hint.trim())) {
        return 'All 5 hints must be non-empty strings.'
      }
      const hints = candidate.hints.map((hint) => (hint as string).trim())
      items.push({ word, hint: hints[0], hints })
      continue
    }

    if (typeof candidate.hint !== 'string') {
      return 'Each item needs a word and hint.'
    }
    items.push({ word, hint: candidate.hint.trim() })
  }

  const normalizedWords = items.map((item) => item.word.toLocaleLowerCase())
  if (new Set(normalizedWords).size !== normalizedWords.length) {
    return 'Words must be unique within a pack.'
  }

  return items
}

function buildPack(packName: string, category: string, items: WordItem[]): WordPack {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    packName,
    category,
    source: 'custom',
    items,
    createdAt: now,
    updatedAt: now,
  }
}

export function parseWordPackJson(text: string): ParseResult {
  if (!text.trim()) {
    return { ok: false, error: 'Paste some JSON to continue.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That is not valid JSON.' }
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'The JSON must contain a pack object.' }
  }

  if ('items' in parsed) {
    if (typeof parsed.packName !== 'string' || !parsed.packName.trim()) {
      return { ok: false, error: 'The pack needs a name.' }
    }
    const items = normalizeItems(parsed.items)
    if (typeof items === 'string') {
      return { ok: false, error: items }
    }
    const category = typeof parsed.category === 'string' && parsed.category.trim()
      ? parsed.category.trim()
      : 'Custom'
    return { ok: true, pack: buildPack(parsed.packName.trim(), category, items) }
  }

  if (Array.isArray(parsed.words) && Array.isArray(parsed.hints)) {
    const words = parsed.words
    const hints = parsed.hints
    if (words.length !== hints.length) {
      return { ok: false, error: 'Words and hints must have the same length.' }
    }
    const items = normalizeItems(words.map((word, index) => ({ word, hint: hints[index] })))
    if (typeof items === 'string') {
      return { ok: false, error: items }
    }
    const packName = typeof parsed.packName === 'string' && parsed.packName.trim()
      ? parsed.packName.trim()
      : 'Imported Pack'
    return { ok: true, pack: buildPack(packName, 'Custom', items) }
  }

  return { ok: false, error: 'Use the items format or matching words and hints arrays.' }
}

export function serializeWordPack(pack: WordPack): string {
  return JSON.stringify({
    packName: pack.packName,
    category: pack.category,
    items: pack.items.map((item) => item.hints?.length
      ? { word: item.word, hints: item.hints }
      : { word: item.word, hint: item.hint }),
  }, null, 2)
}
