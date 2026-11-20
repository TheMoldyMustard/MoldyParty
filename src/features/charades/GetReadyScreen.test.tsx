import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharadesSession, type CharadesSettings } from '../../domain/charades'
import { charadesStore } from '../../store/charadesStore'
import GetReadyScreen from './GetReadyScreen'
import type { CharadesDeviceController, CharadesDeviceStatus } from './useCharadesDevices'

const settings: CharadesSettings = {
  mode: 'classic', packId: 'test', packName: 'Test Pack', durationSeconds: 60,
  categories: [], vibes: [], motionEnabled: true, henyoTapAnswersEnabled: false, noRepeatEnabled: false,
}

function controller(status: CharadesDeviceStatus): CharadesDeviceController {
  return {
    start: vi.fn().mockResolvedValue(status),
    beginGameplay: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue(status),
    playOutcome: vi.fn(), playAnswer: vi.fn(), playFoul: vi.fn(), playCountdown: vi.fn(),
  }
}

async function finishCountdown() {
  for (let second = 0; second < 3; second += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
  }
}

describe('Get Ready tilt calibration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    charadesStore.setState({ session: createCharadesSession(settings, [
      { word: 'Adobo', category: 'food' }, { word: 'Balut', category: 'food' },
    ], () => 0.99) })
  })

  afterEach(() => {
    charadesStore.setState({ session: null })
    vi.useRealTimers()
  })

  it('holds the countdown until neutral, face-up Correct, and return-neutral calibration finish', async () => {
    const session = charadesStore.getState().session!
    const devices = controller({ motion: 'calibrating-neutral', wake: true, landscape: true })
    const view = render(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'calibrating-neutral', wake: true, landscape: true }} onExit={vi.fn()} />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Get Ready' })); await Promise.resolve() })
    expect(screen.getByText('Hold the phone neutral on your forehead')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()

    view.rerender(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'calibrating-correct', wake: true, landscape: true }} onExit={vi.fn()} />)
    expect(screen.getByText('Tilt the phone face up for Correct')).toBeInTheDocument()
    view.rerender(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'returning-neutral', wake: true, landscape: true }} onExit={vi.fn()} />)
    expect(screen.getByText('Return the phone to neutral')).toBeInTheDocument()
    view.rerender(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'armed', wake: true, landscape: true }} onExit={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('3')).toBeInTheDocument()

    await finishCountdown()
    expect(devices.beginGameplay).toHaveBeenCalledTimes(1)
    expect(charadesStore.getState().session?.phase).toBe('ACTIVE')
  })

  it('does not treat the pre-start off status as a tap-only result while motion starts calibrating', async () => {
    const session = charadesStore.getState().session!
    const devices = controller({ motion: 'calibrating-neutral', wake: true, landscape: true })
    render(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'off', wake: false, landscape: false }} onExit={vi.fn()} />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Get Ready' })); await Promise.resolve() })

    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('keeps motion services disabled for a recovered motion-enabled session', async () => {
    const session = charadesStore.getState().session!
    const devices = controller({ motion: 'off', wake: false, landscape: false })
    render(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'off', wake: false, landscape: false }} onExit={vi.fn()} />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Get Ready' })); await Promise.resolve() })

    expect(devices.start).toHaveBeenCalledWith(expect.objectContaining({ motionEnabled: false }))
  })

  it('cancels the countdown and restarts it only after rotation recalibration re-arms', async () => {
    const session = charadesStore.getState().session!
    const devices = controller({ motion: 'calibrating-neutral', wake: true, landscape: true })
    const view = render(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'calibrating-neutral', wake: true, landscape: true }} onExit={vi.fn()} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Get Ready' })); await Promise.resolve() })

    view.rerender(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'armed', wake: true, landscape: true }} onExit={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('3')).toBeInTheDocument()

    view.rerender(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'calibrating-neutral', wake: true, landscape: true }} onExit={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.queryByText('3')).not.toBeInTheDocument()
    expect(screen.getByText('Hold the phone neutral on your forehead')).toBeInTheDocument()

    view.rerender(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion: 'armed', wake: true, landscape: true }} onExit={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it.each(['off', 'denied', 'failed'] as const)('starts the countdown with tap fallback when motion is %s', async (motion) => {
    const session = charadesStore.getState().session!
    const devices = controller({ motion, wake: false, landscape: false })
    render(<GetReadyScreen session={session} devices={devices} deviceStatus={{ motion, wake: false, landscape: false }} onExit={vi.fn()} />)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Get Ready' })); await Promise.resolve() })
    expect(screen.getByText('3')).toBeInTheDocument()
    await finishCountdown()
    expect(devices.beginGameplay).toHaveBeenCalledTimes(1)
    expect(charadesStore.getState().session?.phase).toBe('ACTIVE')
  })
})
