import { useCallback, useEffect, useState } from 'react'
import { appStore } from '../../store/appStore'
import { charadesStore, useCharadesStore } from '../../store/charadesStore'
import ActiveRoundScreen from './ActiveRoundScreen'
import GetReadyScreen from './GetReadyScreen'
import RoundSummaryScreen from './RoundSummaryScreen'
import SessionSummaryScreen from './SessionSummaryScreen'
import { useCharadesDevices, type CharadesDeviceController, type CharadesDeviceStatus } from './useCharadesDevices'

interface CharadesGameProps {
  onExit: () => void
}

export default function CharadesGame({ onExit }: CharadesGameProps) {
  const session = useCharadesStore((state) => state.session)
  const [deviceStatus, setDeviceStatus] = useState<CharadesDeviceStatus>({ motion: 'off', wake: false, landscape: false })
  const recordDeviceOutcome = useCallback((outcome: 'correct' | 'pass') => {
    const current = charadesStore.getState().session
    if (!current || current.phase !== 'ACTIVE') return false
    const count = current.currentEvents.length
    charadesStore.getState().submitOutcome(outcome, current.currentCardToken, Date.now())
    const after = charadesStore.getState().session
    return Boolean(after && after.currentEvents.length === count + 1)
  }, [])
  const devices: CharadesDeviceController = useCharadesDevices(recordDeviceOutcome, setDeviceStatus)

  useEffect(() => {
    if (session?.phase === 'ROUND_SUMMARY' || session?.phase === 'SESSION_SUMMARY') void devices.stop()
  }, [devices, session?.phase])

  function exit() {
    void devices.stop()
    charadesStore.getState().resetSession()
    appStore.getState().setActiveGame(null)
    onExit()
  }

  if (!session) return null
  if (session.phase === 'GET_READY') return <GetReadyScreen session={session} devices={devices} deviceStatus={deviceStatus} onExit={exit} />
  if (session.phase === 'ACTIVE') return <ActiveRoundScreen session={session} devices={devices} deviceStatus={deviceStatus} onExit={exit} />
  if (session.phase === 'ROUND_SUMMARY') return <RoundSummaryScreen session={session} onExit={exit} />
  return <SessionSummaryScreen session={session} onExit={exit} />
}
