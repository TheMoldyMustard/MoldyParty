import { useMemo } from 'react'
import { useCategoryBombStore } from '../../store/categoryBombStore'
import SavedSessionManager from '../sessions/SavedSessionManager'
import CategoryBombSessionStatsTable from './CategoryBombSessionStatsTable'

interface CategoryBombSessionManagerScreenProps {
  onBack: () => void
  onCreate: (name: string) => void
  onContinue: (sessionId: string) => void
  notice?: string
}

export default function CategoryBombSessionManagerScreen({ onBack, onCreate, onContinue, notice }: CategoryBombSessionManagerScreenProps) {
  const sessionsById = useCategoryBombStore((state) => state.sessionsById)
  const renameSession = useCategoryBombStore((state) => state.renameSession)
  const deleteSession = useCategoryBombStore((state) => state.deleteSession)
  const sessions = useMemo(() => Object.values(sessionsById).map((session) => ({
    id: session.id,
    name: session.name,
    playerCount: session.players.length,
    completedCount: session.completedBombs,
    completedUnit: 'bomb',
    updatedAt: session.updatedAt,
  })), [sessionsById])
  return <SavedSessionManager
    gameName="Category Bomb"
    sessions={sessions}
    onBack={onBack}
    onCreate={onCreate}
    onContinue={onContinue}
    onRename={renameSession}
    onDelete={deleteSession}
    notice={notice}
    renderStats={(sessionId) => sessionsById[sessionId] ? <CategoryBombSessionStatsTable session={sessionsById[sessionId]} /> : null}
  />
}
