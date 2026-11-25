import { useMemo } from 'react'
import { useCharadesStore } from '../../store/charadesStore'
import SavedSessionManager from '../sessions/SavedSessionManager'
import CharadesSessionStatsTable from './CharadesSessionStatsTable'

interface CharadesSessionManagerScreenProps {
  onBack: () => void
  onCreate: (name: string) => void
  onContinue: (sessionId: string) => void
  notice?: string
}

export default function CharadesSessionManagerScreen({ onBack, onCreate, onContinue, notice }: CharadesSessionManagerScreenProps) {
  const sessionsById = useCharadesStore((state) => state.sessionsById)
  const renameSession = useCharadesStore((state) => state.renameSession)
  const deleteSession = useCharadesStore((state) => state.deleteSession)
  const sessions = useMemo(() => Object.values(sessionsById).map((session) => ({
    id: session.id,
    name: session.name,
    playerCount: session.players.length,
    completedCount: session.completedTurns,
    completedUnit: 'turn',
    updatedAt: session.updatedAt,
  })), [sessionsById])

  return <SavedSessionManager
    gameName="Forehead Charades"
    sessions={sessions}
    onBack={onBack}
    onCreate={onCreate}
    onContinue={onContinue}
    onRename={renameSession}
    onDelete={deleteSession}
    notice={notice}
    renderStats={(sessionId) => sessionsById[sessionId] ? <CharadesSessionStatsTable session={sessionsById[sessionId]} /> : null}
  />
}
