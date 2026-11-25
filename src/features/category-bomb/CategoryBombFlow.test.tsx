import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { appStore } from '../../store/appStore'
import { categoryBombStore } from '../../store/categoryBombStore'
import CategoryBombGame from './CategoryBombGame'
import type { CategoryBombDeviceController } from './useCategoryBombDevices'

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`)
}

function start(count: number, bonus?: { enabled: boolean; minMs: number; maxMs: number }) {
  categoryBombStore.getState().startSetup(names(count), 'fair-cycle', bonus)
  categoryBombStore.getState().arm(Date.now())
}

describe('Category Bomb flow', () => {
  beforeEach(() => {
    localStorage.clear()
    categoryBombStore.setState({ round: null, sessionsById: {}, activeSessionId: null, pendingSessionName: null })
    appStore.setState({ activeGameId: null, recoveryNotice: '' })
  })

  afterEach(() => vi.useRealTimers())

  it('opens Category Bomb sessions from the home card', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Category Bomb', level: 2 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open category bomb/i }))
    expect(screen.getByRole('heading', { name: 'Category Bomb sessions' })).toBeInTheDocument()
  })

  it('confirms aborting an active bomb before discarding it', async () => {
    start(3)
    const onExit = vi.fn()
    const user = userEvent.setup()
    render(<CategoryBombGame onExit={onExit} onSetup={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Abort game' }))
    expect(screen.getByRole('dialog', { name: 'Abort this game?' })).toBeInTheDocument()
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abort game' }))

    expect(categoryBombStore.getState().round).toBeNull()
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('renders radial players and passes without an award when the bonus is disabled', async () => {
    start(4)
    const deadline = categoryBombStore.getState().round!.deadlineMs
    const firstName = categoryBombStore.getState().round!.settings.players.find((player) => player.id === categoryBombStore.getState().round!.currentPlayerId)!.name
    const user = userEvent.setup()
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    expect(screen.getByTestId('category-bomb-arrow')).toBeInTheDocument()
    expect(screen.getAllByTestId('category-bomb-active-seat')).toHaveLength(4)
    expect(screen.getByRole('status')).toHaveTextContent(firstName)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(String(categoryBombStore.getState().round!.deadlineMs))
    await user.click(screen.getByRole('button', { name: new RegExp(`Accept ${firstName}`) }))
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
    expect(categoryBombStore.getState().round?.deadlineMs).toBe(deadline)
    expect(screen.getByText(/'s turn$/)).not.toHaveTextContent(firstName)
  })

  it('shows the actual sampled bonus and the capped applied amount', async () => {
    const user = userEvent.setup()
    start(4, { enabled: true, minMs: 1_700, maxMs: 1_700 })
    const initialDeadline = categoryBombStore.getState().round!.deadlineMs!
    const { unmount } = render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    await user.click(screen.getByRole('button', { name: /accept .* answer and pass/i }))
    expect(screen.getByText('+1.7s')).toBeInTheDocument()
    expect(categoryBombStore.getState().round?.deadlineMs).toBe(initialDeadline + 1_700)
    unmount()

    start(4, { enabled: true, minMs: 500, maxMs: 500 })
    categoryBombStore.setState((state) => ({
      round: state.round ? { ...state.round, extensionGrantedMs: 14_800 } : null,
    }))
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    await user.click(screen.getByRole('button', { name: /accept .* answer and pass/i }))
    expect(screen.getByText('+0.2s')).toBeInTheDocument()
  })

  it('accepts only once when the bomb is double-clicked', async () => {
    start(4)
    const token = categoryBombStore.getState().round!.actionToken
    const user = userEvent.setup()
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    await user.dblClick(screen.getByRole('button', { name: /accept .* answer and pass/i }))
    expect(categoryBombStore.getState().round?.actionToken).toBe(token + 1)
  })

  it('renders only the current name for thirteen players with no arrow or perimeter roster', () => {
    start(13)
    const currentName = categoryBombStore.getState().round!.settings.players.find((player) => player.id === categoryBombStore.getState().round!.currentPlayerId)!.name
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    expect(screen.getByRole('heading', { name: currentName })).toBeInTheDocument()
    expect(screen.getByText('Pass to')).toBeInTheDocument()
    expect(screen.queryByTestId('category-bomb-arrow')).not.toBeInTheDocument()
    expect(screen.queryByTestId('category-bomb-active-seat')).not.toBeInTheDocument()
  })

  it('requires an uninterrupted hold for a foul and supports keyboard hold', () => {
    vi.useFakeTimers()
    start(3)
    const { unmount } = render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    const foul = screen.getByRole('button', { name: /hold to explode/i })
    fireEvent.pointerDown(foul)
    act(() => vi.advanceTimersByTime(599))
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
    fireEvent.pointerUp(foul)
    act(() => vi.advanceTimersByTime(1))
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
    unmount()

    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    const keyboardFoul = screen.getByRole('button', { name: /hold to explode/i })
    fireEvent.keyDown(keyboardFoul, { key: ' ' })
    act(() => vi.advanceTimersByTime(600))
    expect(categoryBombStore.getState().round?.explosionReason).toBe('foul')
  })

  it('cancels a keyboard foul hold with Escape', () => {
    vi.useFakeTimers()
    start(3)
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    const foul = screen.getByRole('button', { name: /hold to explode/i })
    fireEvent.keyDown(foul, { key: ' ' })
    fireEvent.keyDown(foul, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(600))
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
  })

  it('reconciles timer expiry and replays with the same roster', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    start(3)
    categoryBombStore.setState((state) => ({ round: state.round ? { ...state.round, deadlineMs: 10_200 } : null }))
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    act(() => vi.advanceTimersByTime(250))
    expect(screen.getByRole('heading', { name: /got exploded/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New bomb' }))
    expect(categoryBombStore.getState().round).toMatchObject({ phase: 'ACTIVE' })
    expect(categoryBombStore.getState().round?.settings.players).toHaveLength(3)
  })

  it('shows a compact completed-bomb snapshot and returns to sessions', async () => {
    vi.useFakeTimers()
    start(3)
    const onExit = vi.fn()
    render(<CategoryBombGame onExit={onExit} onSetup={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /accept .* answer and pass/i }))
    fireEvent.pointerDown(screen.getByRole('button', { name: /hold to explode/i }))
    act(() => vi.advanceTimersByTime(600))

    expect(screen.getByLabelText('Completed bomb stats')).toHaveTextContent('1 accepted answer')
    expect(screen.getByLabelText('Completed bomb stats')).toHaveTextContent('Foul explosion')
    fireEvent.click(screen.getByRole('button', { name: 'Return to sessions' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('restarts devices and announces each re-armed explosion', () => {
    vi.useFakeTimers()
    start(3)
    const devices: CategoryBombDeviceController = {
      start: vi.fn(async () => undefined),
      playAccept: vi.fn(),
      playExplosion: vi.fn(),
      stop: vi.fn(async () => undefined),
    }
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} deviceController={devices} />)
    const explode = () => {
      fireEvent.pointerDown(screen.getByRole('button', { name: /hold to explode/i }))
      act(() => vi.advanceTimersByTime(600))
    }

    explode()
    expect(devices.playExplosion).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'New bomb' }))
    explode()
    expect(devices.playExplosion).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'New bomb' }))
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
    expect(devices.start).toHaveBeenCalled()
  })

  it('recovers an explicitly active Category Bomb round through the app shell', () => {
    start(3)
    appStore.setState({ activeGameId: 'category-bomb' })
    render(<App />)
    expect(screen.getByText(categoryBombStore.getState().round!.categoryLabel)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept .* answer and pass/i })).toBeInTheDocument()
  })

  it('keeps the roster and turn policy when returning from placement to setup', async () => {
    categoryBombStore.getState().startSetup(['Alex', 'Blair', 'Casey', 'Devon'], 'chaos', {
      enabled: true,
      minMs: 1_200,
      maxMs: 2_400,
    })
    appStore.setState({ activeGameId: 'category-bomb' })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '← Setup' }))
    expect(screen.getByLabelText('Player 1 name')).toHaveValue('Alex')
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
    expect(screen.getByRole('radio', { name: /^Chaos/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Add random time on pass/i })).toBeChecked()
    expect(screen.getByLabelText('Minimum seconds')).toHaveValue(1.2)
    expect(screen.getByLabelText('Maximum seconds')).toHaveValue(2.4)
  })

  it('keeps a large roster when returning from ready to setup', async () => {
    categoryBombStore.getState().startSetup(names(13), 'fair-cycle')
    appStore.setState({ activeGameId: 'category-bomb' })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '← Setup' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(13)
    expect(screen.getByLabelText('Player 13 name')).toHaveValue('Player 13')
    expect(screen.getByRole('radio', { name: /^Fair cycle/ })).toBeChecked()
  })
})
