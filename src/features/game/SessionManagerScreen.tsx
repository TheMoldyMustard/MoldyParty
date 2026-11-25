import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import SavedSessionManager from '../sessions/SavedSessionManager'
import SessionStatsTable from './SessionStatsTable'

interface SessionManagerScreenProps {
  onBack: () => void
  onCreate: (name: string) => void
  onContinue: (sessionId: string) => void
}

export default function SessionManagerScreen({ onBack, onCreate, onContinue }: SessionManagerScreenProps) {
  const sessionsById = useGameStore((state) => state.sessionsById)
  const renameSession = useGameStore((state) => state.renameSession)
  const deleteSession = useGameStore((state) => state.deleteSession)
  const sessions = useMemo(() => Object.values(sessionsById).map((session) => ({
    id: session.id,
    name: session.name,
    playerCount: session.players.length,
    completedCount: session.completedRounds,
    completedUnit: 'round',
    updatedAt: session.updatedAt,
  })), [sessionsById])

  return <SavedSessionManager
    gameName="Impostor"
    sessions={sessions}
    onBack={onBack}
    onCreate={onCreate}
    onContinue={onContinue}
    onRename={renameSession}
    onDelete={deleteSession}
    deleteDescription="This permanently removes its stats and any unfinished round from this browser."
    renderStats={(sessionId) => {
      const session = sessionsById[sessionId]
      return session ? <SessionStatsTable session={session} /> : null
    }}
  />
}
