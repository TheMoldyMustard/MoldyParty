import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { appStore } from '../../store/appStore'
import { categoryBombStore } from '../../store/categoryBombStore'
import CategoryBombGame from './CategoryBombGame'

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`)
}

function start(count: number) {
  categoryBombStore.getState().startSetup(names(count), 'fair-cycle')
  categoryBombStore.getState().arm(Date.now())
}

describe('Category Bomb flow', () => {
  beforeEach(() => {
    localStorage.clear()
    categoryBombStore.setState({ round: null })
    appStore.setState({ activeGameId: null, recoveryNotice: '' })
  })

  afterEach(() => vi.useRealTimers())

  it('opens Category Bomb setup from the home card', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Category Bomb', level: 2 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open category bomb/i }))
    expect(screen.getByRole('heading', { name: 'Category Bomb', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who’s playing?' })).toBeInTheDocument()
  })

  it('renders radial players and passes with a fixed award without exposing the timer', async () => {
    start(4)
    const firstName = categoryBombStore.getState().round!.settings.players.find((player) => player.id === categoryBombStore.getState().round!.currentPlayerId)!.name
    const user = userEvent.setup()
    render(<CategoryBombGame onExit={() => undefined} onSetup={() => undefined} />)
    expect(screen.getByTestId('category-bomb-arrow')).toBeInTheDocument()
    expect(screen.getAllByTestId('category-bomb-active-seat')).toHaveLength(4)
    expect(screen.getByRole('status')).toHaveTextContent(firstName)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(String(categoryBombStore.getState().round!.deadlineMs))
    await user.click(screen.getByRole('button', { name: new RegExp(`Accept ${firstName}`) }))
    expect(screen.getByText('+1.5s')).toBeInTheDocument()
    expect(screen.getByText(/'s turn$/)).not.toHaveTextContent(firstName)
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

  it('recovers an explicitly active Category Bomb round through the app shell', () => {
    start(3)
    appStore.setState({ activeGameId: 'category-bomb' })
    render(<App />)
    expect(screen.getByText(categoryBombStore.getState().round!.categoryLabel)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept .* answer and pass/i })).toBeInTheDocument()
  })
})
