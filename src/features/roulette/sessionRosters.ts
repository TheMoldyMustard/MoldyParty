export type RouletteSourceGameId = 'impostor' | 'charades' | 'category-bomb'

export interface RouletteRosterOption {
  id: string
  label: string
  names: string[]
}

interface SessionRosterRecord {
  name: string
  updatedAt: string
  players: Array<{ name: string }>
}

interface SessionRosterSource {
  gameId: RouletteSourceGameId
  gameLabel: string
  sessions: Record<string, SessionRosterRecord>
}

export function createRouletteRosterOptions(sources: SessionRosterSource[]): RouletteRosterOption[] {
  return sources.flatMap((source) => Object.entries(source.sessions).flatMap(([sessionId, session]) => {
    const names = session.players.map((player) => player.name)
    if (names.filter((name) => name.trim()).length < 2) return []
    return [{
      option: {
        id: `${source.gameId}:${sessionId}`,
        label: `${source.gameLabel} · ${session.name}`,
        names: [...names],
      },
      updatedAt: session.updatedAt,
    }]
  }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((entry) => entry.option)
}
