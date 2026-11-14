import type { CharadesCategory, CharadesVibe, WordItem, WordPack } from '../../domain/types'

export type ParseResult =
  | { ok: true; pack: WordPack }
  | { ok: false; error: string }

type UnknownRecord = Record<string, unknown>

const CHARADES_CATEGORIES: CharadesCategory[] = ['person', 'place', 'object', 'animal', 'food', 'pop-culture', 'other']
const CHARADES_VIBES: CharadesVibe[] = ['casual', 'pop-culture-local', 'chaos-hard']

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeItems(value: unknown): WordItem[] | string {
  if (!Array.isArray(value) || value.length === 0) {
    return 'Add at least one word.'
  }

  const items: WordItem[] = []
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate) || typeof candidate.word !== 'string') {
      return `Item ${index + 1} needs a word.`
    }
    const word = candidate.word.trim()
    if (!word) {
      return 'Words cannot be blank.'
    }

    const item: WordItem = { word }
    if ('category' in candidate) {
      if (typeof candidate.category !== 'string' || !CHARADES_CATEGORIES.includes(candidate.category as CharadesCategory)) {
        return `Item ${index + 1} has an unknown Charades category.`
      }
      item.category = candidate.category as CharadesCategory
    }
    if ('vibes' in candidate) {
      if (
        !Array.isArray(candidate.vibes)
        || candidate.vibes.some((vibe) => typeof vibe !== 'string' || !CHARADES_VIBES.includes(vibe as CharadesVibe))
      ) {
        return `Item ${index + 1} has an unknown Charades vibe.`
      }
      item.vibes = [...new Set(candidate.vibes as CharadesVibe[])]
    }
    if ('charadesOnly' in candidate) {
      if (typeof candidate.charadesOnly !== 'boolean') {
        return `Item ${index + 1} has an invalid charadesOnly flag.`
      }
      item.charadesOnly = candidate.charadesOnly
    }

    if ('hints' in candidate) {
      if (!Array.isArray(candidate.hints) || candidate.hints.length === 0) {
        return 'Each hints array needs at least 1 hint.'
      }
      if (candidate.hints.some((hint) => typeof hint !== 'string' || !hint.trim())) {
        return 'All hints must be non-empty strings.'
      }
      const hints = candidate.hints.map((hint) => (hint as string).trim())
      item.hint = hints[0]
      item.hints = hints
    } else if ('hint' in candidate) {
      if (typeof candidate.hint !== 'string' || !candidate.hint.trim()) {
        return `Item ${index + 1} has an invalid hint.`
      }
      item.hint = candidate.hint.trim()
    }
    items.push(item)
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
    items: pack.items.map((item) => ({
      word: item.word,
      ...(item.hints?.length ? { hints: item.hints } : item.hint ? { hint: item.hint } : {}),
      ...(item.charadesOnly !== undefined ? { charadesOnly: item.charadesOnly } : {}),
      ...(item.category ? { category: item.category } : {}),
      ...(item.vibes ? { vibes: item.vibes } : {}),
    })),
  }, null, 2)
}
