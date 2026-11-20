import type { CategoryBombPrompt } from './categoryBombCategories'

export type CategoryBombPhase = 'PLACEMENT' | 'READY' | 'ACTIVE' | 'EXPLODED'
export type CategoryBombTurnPolicy = 'fair-cycle' | 'chaos'
export type CategoryBombDisplayMode = 'radial' | 'name-only'
export type CategoryBombExplosionReason = 'timer' | 'foul'
export type CategoryBombSeat =
  | 'top-left' | 'top-center' | 'top-right'
  | 'right-top' | 'right-center' | 'right-bottom'
  | 'bottom-right' | 'bottom-center' | 'bottom-left'
  | 'left-bottom' | 'left-center' | 'left-top'

export interface CategoryBombPlayer {
  id: string
  name: string
  seat: CategoryBombSeat | null
}

export interface CategoryBombSettings {
  players: CategoryBombPlayer[]
  turnPolicy: CategoryBombTurnPolicy
}

export interface CategoryBombRound {
  id: string
  phase: CategoryBombPhase
  settings: CategoryBombSettings
  displayMode: CategoryBombDisplayMode
  categoryId: string
  categoryLabel: string
  currentPlayerId: string | null
  remainingCyclePlayerIds: string[]
  deadlineMs: number | null
  extensionGrantedMs: number
  actionToken: number
  explodedPlayerId: string | null
  explosionReason: CategoryBombExplosionReason | null
}

const seats: CategoryBombSeat[] = [
  'top-left', 'top-center', 'top-right',
  'right-top', 'right-center', 'right-bottom',
  'bottom-right', 'bottom-center', 'bottom-left',
  'left-bottom', 'left-center', 'left-top',
]

const seatAngles: Record<CategoryBombSeat, number> = {
  'top-left': -135, 'top-center': -90, 'top-right': -60,
  'right-top': -30, 'right-center': 0, 'right-bottom': 30,
  'bottom-right': 60, 'bottom-center': 90, 'bottom-left': 135,
  'left-bottom': 150, 'left-center': 180, 'left-top': -150,
}

const seatTemplates: Partial<Record<number, number[]>> = {
  2: [1, 7],
  3: [1, 5, 9],
  4: [1, 4, 7, 10],
}

function clampRandom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(value, 0.999999999999)
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(clampRandom(random()) * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function choosePrompt(prompts: CategoryBombPrompt[], random: () => number, avoidId?: string): CategoryBombPrompt {
  const choices = avoidId && prompts.length > 1 ? prompts.filter((prompt) => prompt.id !== avoidId) : prompts
  if (choices.length < 1) throw new Error('Category Bomb needs at least one category prompt.')
  return choices[Math.floor(clampRandom(random()) * choices.length)]
}

function radialSeatIndexes(count: number): number[] {
  const template = seatTemplates[count]
  if (template) return template
  return Array.from({ length: count }, (_, index) => Math.floor(index * seats.length / count))
}

function normalizeSettings(settings: CategoryBombSettings): CategoryBombSettings {
  const displayMode = deriveCategoryBombDisplayMode(settings.players.length)
  const indexes = displayMode === 'radial' ? radialSeatIndexes(settings.players.length) : []
  return {
    turnPolicy: settings.turnPolicy,
    players: settings.players.map((player, index) => ({
      id: player.id,
      name: player.name.trim(),
      seat: displayMode === 'radial' ? seats[indexes[index]] : null,
    })),
  }
}

function nextPlayer(round: CategoryBombRound, random: () => number): Pick<CategoryBombRound, 'currentPlayerId' | 'remainingCyclePlayerIds'> {
  const ids = round.settings.players.map((player) => player.id)
  if (round.settings.turnPolicy === 'chaos') {
    const candidates = ids.filter((id) => id !== round.currentPlayerId)
    return {
      currentPlayerId: candidates[Math.floor(clampRandom(random()) * candidates.length)],
      remainingCyclePlayerIds: [],
    }
  }

  let queue = round.remainingCyclePlayerIds
  if (queue.length === 0) {
    queue = shuffle(ids, random)
    if (queue[0] === round.currentPlayerId && queue.length > 1) queue = [...queue.slice(1), queue[0]]
  }
  return { currentPlayerId: queue[0], remainingCyclePlayerIds: queue.slice(1) }
}

export function deriveCategoryBombDisplayMode(playerCount: number): CategoryBombDisplayMode {
  return playerCount <= 12 ? 'radial' : 'name-only'
}

export function validateCategoryBombSettings(settings: CategoryBombSettings): string[] {
  const errors: string[] = []
  if (settings.players.length < 2) errors.push('Add at least 2 players.')
  const names = settings.players.map((player) => player.name.trim())
  if (names.some((name) => !name)) errors.push('Every player needs a name.')
  if (names.some((name) => [...name].length > 24)) errors.push('Player names must be 24 characters or fewer.')
  const normalized = names.filter(Boolean).map((name) => name.toLocaleLowerCase())
  if (new Set(normalized).size !== normalized.length) errors.push('Player names must be unique.')
  const ids = settings.players.map((player) => player.id)
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.push('Every player needs a unique id.')
  if (!['fair-cycle', 'chaos'].includes(settings.turnPolicy)) errors.push('Choose a valid turn mode.')
  return errors
}

export function sampleCategoryBombDurationMs(playerCount: number, random: () => number = Math.random): number {
  const minimum = 20 + 3 * playerCount
  const maximum = 30 + 5 * playerCount
  return (minimum + Math.floor(clampRandom(random()) * (maximum - minimum + 1))) * 1_000
}

export function createCategoryBombRound(
  settings: CategoryBombSettings,
  prompts: CategoryBombPrompt[],
  random: () => number = Math.random,
): CategoryBombRound {
  const errors = validateCategoryBombSettings(settings)
  if (errors.length > 0) throw new Error(errors.join(' '))
  const normalized = normalizeSettings(settings)
  const displayMode = deriveCategoryBombDisplayMode(normalized.players.length)
  const category = choosePrompt(prompts, random)
  return {
    id: `category-bomb-${Date.now()}-${Math.floor(clampRandom(random()) * 1_000_000)}`,
    phase: displayMode === 'radial' ? 'PLACEMENT' : 'READY',
    settings: normalized,
    displayMode,
    categoryId: category.id,
    categoryLabel: category.label,
    currentPlayerId: null,
    remainingCyclePlayerIds: [],
    deadlineMs: null,
    extensionGrantedMs: 0,
    actionToken: 0,
    explodedPlayerId: null,
    explosionReason: null,
  }
}

export function swapCategoryBombSeats(round: CategoryBombRound, firstPlayerId: string, secondPlayerId: string): CategoryBombRound {
  if (round.phase !== 'PLACEMENT' || round.displayMode !== 'radial' || firstPlayerId === secondPlayerId) return round
  const first = round.settings.players.find((player) => player.id === firstPlayerId)
  const second = round.settings.players.find((player) => player.id === secondPlayerId)
  if (!first || !second) return round
  return {
    ...round,
    settings: {
      ...round.settings,
      players: round.settings.players.map((player) => player.id === firstPlayerId
        ? { ...player, seat: second.seat }
        : player.id === secondPlayerId ? { ...player, seat: first.seat } : player),
    },
  }
}

export function armCategoryBombRound(round: CategoryBombRound, random: () => number = Math.random, now = Date.now()): CategoryBombRound {
  if (!['PLACEMENT', 'READY'].includes(round.phase)) return round
  const queue = shuffle(round.settings.players.map((player) => player.id), random)
  return {
    ...round,
    phase: 'ACTIVE',
    currentPlayerId: queue[0],
    remainingCyclePlayerIds: round.settings.turnPolicy === 'fair-cycle' ? queue.slice(1) : [],
    deadlineMs: now + sampleCategoryBombDurationMs(round.settings.players.length, random),
    extensionGrantedMs: 0,
    actionToken: round.actionToken + 1,
    explodedPlayerId: null,
    explosionReason: null,
  }
}

export function syncCategoryBombClock(round: CategoryBombRound, now = Date.now()): CategoryBombRound {
  if (round.phase !== 'ACTIVE' || round.deadlineMs === null || now < round.deadlineMs) return round
  return {
    ...round,
    phase: 'EXPLODED',
    deadlineMs: null,
    remainingCyclePlayerIds: round.remainingCyclePlayerIds,
    explodedPlayerId: round.currentPlayerId,
    explosionReason: 'timer',
  }
}

export function acceptCategoryBombAnswer(
  round: CategoryBombRound,
  actionToken: number,
  now = Date.now(),
  random: () => number = Math.random,
): CategoryBombRound {
  const current = syncCategoryBombClock(round, now)
  if (current !== round || round.phase !== 'ACTIVE' || round.deadlineMs === null || actionToken !== round.actionToken) return current
  const extension = Math.min(1_500, 15_000 - round.extensionGrantedMs)
  const next = nextPlayer(round, random)
  return {
    ...round,
    ...next,
    deadlineMs: round.deadlineMs + extension,
    extensionGrantedMs: round.extensionGrantedMs + extension,
    actionToken: round.actionToken + 1,
  }
}

export function callCategoryBombFoul(round: CategoryBombRound, actionToken: number, now = Date.now()): CategoryBombRound {
  const current = syncCategoryBombClock(round, now)
  if (current !== round || round.phase !== 'ACTIVE' || actionToken !== round.actionToken) return current
  return {
    ...round,
    phase: 'EXPLODED',
    deadlineMs: null,
    explodedPlayerId: round.currentPlayerId,
    explosionReason: 'foul',
  }
}

export function replayCategoryBombRound(
  round: CategoryBombRound,
  prompts: CategoryBombPrompt[],
  random: () => number = Math.random,
  now = Date.now(),
): CategoryBombRound {
  const category = choosePrompt(prompts, random, round.categoryId)
  const prepared: CategoryBombRound = {
    ...round,
    id: `category-bomb-${now}-${Math.floor(clampRandom(random()) * 1_000_000)}`,
    phase: round.displayMode === 'radial' ? 'PLACEMENT' : 'READY',
    categoryId: category.id,
    categoryLabel: category.label,
    currentPlayerId: null,
    remainingCyclePlayerIds: [],
    deadlineMs: null,
    extensionGrantedMs: 0,
    actionToken: 0,
    explodedPlayerId: null,
    explosionReason: null,
  }
  return armCategoryBombRound(prepared, random, now)
}

export function getCategoryBombArrowAngle(round: CategoryBombRound): number | null {
  if (round.displayMode !== 'radial' || !round.currentPlayerId) return null
  const seat = round.settings.players.find((player) => player.id === round.currentPlayerId)?.seat
  return seat ? getCategoryBombSeatAngle(seat) : null
}

export function getCategoryBombSeatAngle(seat: CategoryBombSeat): number {
  return seatAngles[seat]
}
