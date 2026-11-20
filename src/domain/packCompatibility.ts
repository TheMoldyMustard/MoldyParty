import type { CharadesCategory, CharadesVibe, PackGameId, WordItem, WordPack } from './types'

export interface CharadesPackFilters {
  categories?: CharadesCategory[]
  vibes?: CharadesVibe[]
}

const legacyCategoryMap: Record<string, CharadesCategory> = {
  animals: 'animal',
  places: 'place',
  objects: 'object',
  food: 'food',
  people: 'person',
  person: 'person',
  'pop culture': 'pop-culture',
}

function hasUsableHint(item: WordItem): boolean {
  if (item.hints?.some((hint) => hint.trim().length > 0)) return true
  return typeof item.hint === 'string' && item.hint.trim().length > 0
}

export function getItemCategory(item: WordItem, packCategory: string): CharadesCategory {
  if (item.category) return item.category
  return legacyCategoryMap[packCategory.trim().toLocaleLowerCase()] ?? 'other'
}

export function eligibleItems(
  pack: WordPack,
  gameId: PackGameId,
  filters: CharadesPackFilters = {},
): WordItem[] {
  if (gameId === 'impostor') {
    return pack.items.filter((item) => item.word.trim() && item.charadesOnly !== true && hasUsableHint(item))
  }

  const categories = filters.categories ?? []
  const vibes = filters.vibes ?? []
  return pack.items.filter((item) => {
    if (!item.word.trim()) return false
    if (categories.length > 0 && !categories.includes(getItemCategory(item, pack.category))) return false
    if (vibes.length > 0 && !item.vibes?.some((vibe) => vibes.includes(vibe))) return false
    return true
  })
}

export function isPackUsableFor(
  pack: WordPack,
  gameId: PackGameId,
  filters: CharadesPackFilters = {},
): boolean {
  return eligibleItems(pack, gameId, filters).length >= (gameId === 'charades' ? 2 : 1)
}
