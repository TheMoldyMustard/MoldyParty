import { useEffect, useRef } from 'react'
import { categoryBombStore, useCategoryBombStore } from '../../store/categoryBombStore'
import CategoryBombActiveScreen from './CategoryBombActiveScreen'
import CategoryBombExplosionScreen from './CategoryBombExplosionScreen'
import CategoryBombPlacementScreen from './CategoryBombPlacementScreen'
import CategoryBombReadyScreen from './CategoryBombReadyScreen'
import { useCategoryBombDevices, type CategoryBombDeviceController } from './useCategoryBombDevices'

interface CategoryBombGameProps {
  onExit: () => void
  onSetup: () => void
  deviceController?: CategoryBombDeviceController
}

export default function CategoryBombGame({ onExit, onSetup, deviceController }: CategoryBombGameProps) {
  const round = useCategoryBombStore((state) => state.round)
  const defaultDevices = useCategoryBombDevices()
  const devices = deviceController ?? defaultDevices
  const announcedExplosionId = useRef<string | null>(null)
  const previousPhase = useRef(round?.phase)

  useEffect(() => {
    const explosionKey = round ? `${round.id}:${round.actionToken}` : null
    if (round?.phase === 'EXPLODED' && announcedExplosionId.current !== explosionKey) {
      announcedExplosionId.current = explosionKey
      devices.playExplosion()
    }
    if (round?.phase === 'ACTIVE' && previousPhase.current !== 'ACTIVE') void devices.start()
    previousPhase.current = round?.phase
  }, [devices, round])

  if (!round) return null
  const arm = () => { void devices.start(); categoryBombStore.getState().arm() }
  if (round.phase === 'PLACEMENT') return <CategoryBombPlacementScreen round={round} onBack={onSetup} onArm={arm} />
  if (round.phase === 'READY') return <CategoryBombReadyScreen round={round} onBack={onSetup} onArm={arm} />
  if (round.phase === 'ACTIVE') return <CategoryBombActiveScreen round={round} devices={devices} onExit={() => {
    categoryBombStore.getState().abortRound()
    onExit()
  }} />
  return <CategoryBombExplosionScreen
    round={round}
    onExit={onExit}
    onReplay={() => { void devices.start(); categoryBombStore.getState().replay() }}
    onReviewRules={onSetup}
  />
}
