export type GamePhase = 'LOBBY' | 'ROLE_REVEAL' | 'DISCUSSION' | 'VOTING' | 'GAME_OVER'
export type PlayerRole = 'INNOCENT' | 'IMPOSTOR'

export interface Player {
  id: string
  name: string
  role: PlayerRole
  hasViewedRole: boolean
}

export interface WordItem {
  word: string
  hint: string
  hints?: string[]
}

export interface WordPack {
  id: string
  packName: string
  category: string
  source: 'builtIn' | 'custom'
  items: WordItem[]
  createdAt?: string
  updatedAt?: string
}

export interface VoteRecord {
  voterId: string
  targetId: string | null
}

export interface VoteResult {
  counts: Record<string, number>
  topCandidateIds: string[]
  eliminatedPlayerId: string | null
  isTie: boolean
}

export interface GameState {
  phase: GamePhase
  round: number
  players: Player[]
  impostorCount: number
  selectedPackId: string
  selectedPackName: string
  currentWord: string
  currentHint: string
  hintsEnabled: boolean
  discussionDurationSeconds: number | null
  currentRevealIndex: number
  isRoleVisible: boolean
  currentVoterIndex: number
  votes: VoteRecord[]
  voteResult: VoteResult | null
}

export interface GameSetupInput {
  playerNames: string[]
  impostorCount: number
  pack: WordPack
  hintsEnabled: boolean
  discussionDurationSeconds: number | null
  round?: number
}

export type SetupErrors = string[]

export interface PWAConfig {
  name: string
  shortName: string
  description: string
  themeColor: string
  backgroundColor: string
  display: 'standalone'
  startUrl: string
}
