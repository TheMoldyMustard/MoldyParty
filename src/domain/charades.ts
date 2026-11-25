import type { CharadesCategory, CharadesVibe, WordItem } from './types'

export type CharadesMode = 'classic' | 'henyo' | 'one-word' | 'team-relay'
export type CharadesPhase = 'GET_READY' | 'ACTIVE' | 'ROUND_SUMMARY' | 'SESSION_SUMMARY'
export type CharadesOutcome = 'correct' | 'pass'

export interface CharadesPlayer {
  id: string
  name: string
}

export interface CharadesTeam {
  id: string
  name: string
  members: string[]
  memberPlayerIds?: string[]
}

export interface CharadesSettings {
  mode: CharadesMode
  packId: string
  packName: string
  durationSeconds: 60 | 75 | 90 | 120
  categories: CharadesCategory[]
  vibes: CharadesVibe[]
  motionEnabled: boolean
  henyoTapAnswersEnabled: boolean
  noRepeatEnabled: boolean
  teams?: [CharadesTeam, CharadesTeam]
  relayRounds?: 3 | 4 | 5
  players?: CharadesPlayer[]
  holderRotationOffset?: number
}

export interface CharadesCard {
  key: string
  word: string
  category: CharadesCategory
}

export interface CharadesCardEvent {
  type: 'card'
  key: string
  word: string
  category: CharadesCategory
  outcome: CharadesOutcome
  occurredAtMs: number
}

export interface CharadesFoulEvent {
  type: 'foul'
  seconds: -5
  occurredAtMs: number
}

export type CharadesTurnEvent = CharadesCardEvent | CharadesFoulEvent

export interface CharadesTurnSummary {
  teamId: string | null
  teamName: string | null
  holderName: string
  holderPlayerId: string | null
  score: number
  events: CharadesTurnEvent[]
  activeDurationMs: number
  statsRecorded: boolean
}

export interface CharadesSession {
  settings: CharadesSettings
  phase: CharadesPhase
  cards: CharadesCard[]
  remainingDeck: CharadesCard[]
  previousWordKey: string | null
  currentCard: CharadesCard | null
  currentCardToken: number
  deadlineMs: number | null
  currentEvents: CharadesTurnEvent[]
  turnSummaries: CharadesTurnSummary[]
  activeTeamIndex: 0 | 1
  teamTurnCounts: [number, number]
  startedAtMs: number | null
  relayResultRecorded: boolean
}

export interface ModePolicy {
  label: string
  durationChoices: readonly (60 | 75 | 90 | 120)[]
  relayRounds?: readonly (3 | 4 | 5)[]
}

export const MODE_POLICIES: Record<CharadesMode, ModePolicy> = {
  classic: { label: 'Classic', durationChoices: [60, 75, 90] },
  henyo: { label: 'Henyo', durationChoices: [120] },
  'one-word': { label: 'One-Word', durationChoices: [60, 75, 90] },
  'team-relay': { label: 'Team Relay', durationChoices: [60, 75, 90], relayRounds: [3, 4, 5] },
}

export function validateCharadesSettings(settings: CharadesSettings, eligibleCount: number): string[] {
  const errors: string[] = []
  const policy = MODE_POLICIES[settings.mode]
  if (!policy.durationChoices.includes(settings.durationSeconds)) {
    errors.push(`Choose a valid duration for ${policy.label} mode.`)
  }
  if (eligibleCount < 2) errors.push('Choose filters with at least 2 eligible words.')
  if (settings.players) {
    const ids = settings.players.map((player) => player.id)
    const names = settings.players.map((player) => player.name.trim().toLocaleLowerCase())
    if (settings.players.length < 2) errors.push('Add at least 2 players.')
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.push('Every player needs a unique id.')
    if (names.some((name) => !name) || new Set(names).size !== names.length) errors.push('Player names must be present and unique.')
    if (settings.holderRotationOffset !== undefined && (!Number.isInteger(settings.holderRotationOffset) || settings.holderRotationOffset < 0 || settings.holderRotationOffset >= settings.players.length)) {
      errors.push('The player rotation position is invalid.')
    }
  }
  if (settings.mode === 'team-relay') {
    const teams = settings.teams
    if (!teams || teams.some((team) => !team.name.trim())) errors.push('Both teams need a name.')
    if (!teams || teams.some((team) => team.members.length === 0 || team.members.some((member) => !member.trim()))) {
      errors.push('Each team needs at least one member.')
    }
    if (!settings.relayRounds || !MODE_POLICIES['team-relay'].relayRounds?.includes(settings.relayRounds)) {
      errors.push('Choose 3, 4, or 5 relay rounds.')
    }
    if (settings.players) {
      const hasStableAssignments = Boolean(teams?.every((team) => Array.isArray(team.memberPlayerIds)))
      const playerIds = settings.players.map((player) => player.id)
      const assigned = hasStableAssignments ? teams!.flatMap((team) => team.memberPlayerIds ?? []) : []
      if (!hasStableAssignments || assigned.length !== playerIds.length || new Set(assigned).size !== playerIds.length || assigned.some((id) => !playerIds.includes(id))) {
        errors.push('Assign every player to exactly one team.')
      }
    }
  }
  return errors
}

function normalizeKey(word: string): string {
  return word.trim().toLocaleLowerCase()
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function avoidPreviousFirst(deck: CharadesCard[], previousWordKey: string | null): CharadesCard[] {
  if (deck.length < 2 || !previousWordKey || deck[0].key !== previousWordKey) return deck
  const replacementIndex = deck.findIndex((card) => card.key !== previousWordKey)
  if (replacementIndex <= 0) return deck
  const result = [...deck]
  ;[result[0], result[replacementIndex]] = [result[replacementIndex], result[0]]
  return result
}

function buildDeck(
  cards: CharadesCard[],
  random: () => number,
  usedWordKeys: string[] = [],
  previousWordKey: string | null = null,
): CharadesCard[] {
  const used = new Set(usedWordKeys.map(normalizeKey))
  const unseen = cards.filter((card) => !used.has(card.key))
  const candidates = unseen.length > 0 ? unseen : cards
  return avoidPreviousFirst(shuffle(candidates, random), previousWordKey)
}

export function createCharadesSession(
  settings: CharadesSettings,
  items: WordItem[],
  random: () => number = Math.random,
  history: { usedWordKeys?: string[]; previousWordKey?: string | null } = {},
): CharadesSession {
  const errors = validateCharadesSettings(settings, items.length)
  if (errors.length > 0) throw new Error(errors.join(' '))
  const cards = items.map((item) => ({
    key: normalizeKey(item.word),
    word: item.word.trim(),
    category: item.category ?? 'other',
  }))
  return {
    settings,
    phase: 'GET_READY',
    cards,
    remainingDeck: buildDeck(cards, random, history.usedWordKeys, history.previousWordKey),
    previousWordKey: history.previousWordKey ?? null,
    currentCard: null,
    currentCardToken: 0,
    deadlineMs: null,
    currentEvents: [],
    turnSummaries: [],
    activeTeamIndex: 0,
    teamTurnCounts: [0, 0],
    startedAtMs: null,
    relayResultRecorded: false,
  }
}

export function getCurrentHolder(session: CharadesSession): { teamId: string | null; teamName: string | null; playerId: string | null; memberName: string } {
  if (session.settings.mode !== 'team-relay' || !session.settings.teams) {
    const players = session.settings.players
    const offset = session.settings.holderRotationOffset ?? 0
    const player = players?.[(offset + session.turnSummaries.length) % players.length]
    return { teamId: null, teamName: null, playerId: player?.id ?? null, memberName: player?.name ?? 'Next player' }
  }
  const teamIndex = session.activeTeamIndex
  const team = session.settings.teams[teamIndex]
  const memberIndex = session.teamTurnCounts[teamIndex] % team.members.length
  const playerId = team.memberPlayerIds?.[memberIndex] ?? null
  const memberName = playerId
    ? session.settings.players?.find((player) => player.id === playerId)?.name ?? team.members[memberIndex]
    : team.members[memberIndex]
  return { teamId: team.id, teamName: team.name, playerId, memberName }
}

function takeNextCard(session: CharadesSession, random: () => number): Pick<CharadesSession, 'currentCard' | 'remainingDeck'> {
  const deck = session.remainingDeck.length > 0
    ? session.remainingDeck
    : buildDeck(session.cards, random, [], session.previousWordKey)
  return { currentCard: deck[0], remainingDeck: deck.slice(1) }
}

export function beginTurn(session: CharadesSession, now: number, random: () => number = Math.random): CharadesSession {
  if (session.phase !== 'GET_READY') return session
  const next = takeNextCard(session, random)
  return {
    ...session,
    ...next,
    phase: 'ACTIVE',
    currentCardToken: session.currentCardToken + 1,
    deadlineMs: now + session.settings.durationSeconds * 1000,
    currentEvents: [],
    startedAtMs: now,
  }
}

function finalizeTurn(session: CharadesSession): CharadesSession {
  if (session.phase !== 'ACTIVE') return session
  const holder = getCurrentHolder(session)
  const summary: CharadesTurnSummary = {
    teamId: holder.teamId,
    teamName: holder.teamName,
    holderName: holder.memberName,
    holderPlayerId: holder.playerId,
    score: session.currentEvents.filter((event) => event.type === 'card' && event.outcome === 'correct').length,
    events: session.currentEvents,
    activeDurationMs: session.startedAtMs === null || session.deadlineMs === null ? 0 : Math.max(0, session.deadlineMs - session.startedAtMs),
    statsRecorded: false,
  }
  const counts: [number, number] = [...session.teamTurnCounts]
  if (session.settings.mode === 'team-relay') counts[session.activeTeamIndex] += 1
  return {
    ...session,
    phase: 'ROUND_SUMMARY',
    currentCard: null,
    deadlineMs: null,
    startedAtMs: null,
    turnSummaries: [...session.turnSummaries, summary],
    teamTurnCounts: counts,
  }
}

export function syncClock(session: CharadesSession, now: number): CharadesSession {
  if (session.phase !== 'ACTIVE' || session.deadlineMs === null || now < session.deadlineMs) return session
  return finalizeTurn(session)
}

export function submitOutcome(
  session: CharadesSession,
  outcome: CharadesOutcome,
  cardToken: number,
  now: number,
  random: () => number = Math.random,
): CharadesSession {
  if (session.phase !== 'ACTIVE' || session.deadlineMs === null || !session.currentCard) return session
  if (now >= session.deadlineMs) return syncClock(session, now)
  if (cardToken !== session.currentCardToken) return session
  const played = session.currentCard
  const event: CharadesCardEvent = {
    type: 'card',
    key: played.key,
    word: played.word,
    category: played.category,
    outcome,
    occurredAtMs: now,
  }
  const withPlayed = {
    ...session,
    previousWordKey: played.key,
    currentEvents: [...session.currentEvents, event],
  }
  const next = takeNextCard(withPlayed, random)
  return {
    ...withPlayed,
    ...next,
    currentCardToken: session.currentCardToken + 1,
  }
}

export function applyFoul(session: CharadesSession, now: number): CharadesSession {
  if (session.phase !== 'ACTIVE' || session.settings.mode !== 'henyo' || session.deadlineMs === null) return session
  if (now >= session.deadlineMs) return syncClock(session, now)
  const penalized: CharadesSession = {
    ...session,
    deadlineMs: session.deadlineMs - 5_000,
    currentEvents: [...session.currentEvents, { type: 'foul', seconds: -5, occurredAtMs: now }],
  }
  return penalized.deadlineMs !== null && penalized.deadlineMs <= now ? finalizeTurn(penalized) : penalized
}

export function advanceFromSummary(session: CharadesSession): CharadesSession {
  if (session.phase !== 'ROUND_SUMMARY') return session
  if (session.settings.mode === 'team-relay') {
    const requiredRounds = session.settings.relayRounds ?? 3
    if (session.teamTurnCounts.every((count) => count >= requiredRounds)) {
      return { ...session, phase: 'SESSION_SUMMARY' }
    }
    return {
      ...session,
      phase: 'GET_READY',
      activeTeamIndex: session.activeTeamIndex === 0 ? 1 : 0,
      currentEvents: [],
    }
  }
  return { ...session, phase: 'GET_READY', currentEvents: [] }
}

export function getTeamScores(session: CharadesSession): [number, number] {
  if (!session.settings.teams) return [0, 0]
  return session.turnSummaries.reduce<[number, number]>((scores, summary) => {
    const index = session.settings.teams?.findIndex((team) => team.id === summary.teamId) ?? -1
    if (index === 0 || index === 1) scores[index] += summary.score
    return scores
  }, [0, 0])
}
