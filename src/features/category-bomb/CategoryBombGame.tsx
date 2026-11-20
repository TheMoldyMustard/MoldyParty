import { useEffect, useRef } from 'react'
import { categoryBombStore, useCategoryBombStore } from '../../store/categoryBombStore'
import CategoryBombActiveScreen from './CategoryBombActiveScreen'
import CategoryBombExplosionScreen from './CategoryBombExplosionScreen'
import CategoryBombPlacementScreen from './CategoryBombPlacementScreen'
import CategoryBombReadyScreen from './CategoryBombReadyScreen'
import { useCategoryBombDevices } from './useCategoryBombDevices'

interface CategoryBombGameProps {
  onExit: () => void
  onSetup: () => void
}

export default function CategoryBombGame({ onExit, onSetup }: CategoryBombGameProps) {
  const round = useCategoryBombStore((state) => state.round)
  const devices = useCategoryBombDevices()
  const announcedExplosionId = useRef<string | null>(null)

  useEffect(() => {
    if (round?.phase === 'EXPLODED' && announcedExplosionId.current !== round.id) {
      announcedExplosionId.current = round.id
      devices.playExplosion()
    }
  }, [devices, round?.id, round?.phase])

  if (!round) return null
  const arm = () => { void devices.start(); categoryBombStore.getState().arm() }
  if (round.phase === 'PLACEMENT') return <CategoryBombPlacementScreen round={round} onBack={onSetup} onArm={arm} />
  if (round.phase === 'READY') return <CategoryBombReadyScreen round={round} onBack={onSetup} onArm={arm} />
  if (round.phase === 'ACTIVE') return <CategoryBombActiveScreen round={round} devices={devices} onExit={onExit} />
  return <CategoryBombExplosionScreen round={round} onExit={onExit} />
}
