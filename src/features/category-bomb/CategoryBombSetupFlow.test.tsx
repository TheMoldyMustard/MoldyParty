import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryBombSetupScreen from './CategoryBombSetupScreen'
import CategoryBombPlacementScreen from './CategoryBombPlacementScreen'
import CategoryBombReadyScreen from './CategoryBombReadyScreen'
import { categoryBombStore } from '../../store/categoryBombStore'

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`)
}

describe('Category Bomb setup and pre-round screens', () => {
  beforeEach(() => {
    localStorage.clear()
    categoryBombStore.setState({ round: null })
  })

  it('validates names and starts a radial setup for twelve players', async () => {
    const user = userEvent.setup()
    render(<CategoryBombSetupScreen onBack={() => undefined} initialPlayerNames={names(12)} />)
    expect(screen.getByText('Radial board')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: 'Arrange players' }))
    expect(categoryBombStore.getState().round).toMatchObject({ phase: 'PLACEMENT', displayMode: 'radial' })
  })

  it('switches automatically at the thirteenth player and returns to radial after removal', async () => {
    const user = userEvent.setup()
    render(<CategoryBombSetupScreen onBack={() => undefined} initialPlayerNames={names(12)} />)
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    expect(screen.getByText('Large group — current name only')).toBeInTheDocument()
    expect(screen.getByText(/the arrow and seating board are hidden/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove player 13' }))
    expect(screen.getByText('Radial board')).toBeInTheDocument()
  })

  it('keeps a fifty-player roster usable and starts name-only ready mode', async () => {
    const user = userEvent.setup()
    render(<CategoryBombSetupScreen onBack={() => undefined} initialPlayerNames={names(50)} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(50)
    await user.click(screen.getByRole('button', { name: 'Start large-group game' }))
    expect(categoryBombStore.getState().round).toMatchObject({ phase: 'READY', displayMode: 'name-only' })
  })

  it('shows actionable validation errors without starting', async () => {
    const user = userEvent.setup()
    render(<CategoryBombSetupScreen onBack={() => undefined} initialPlayerNames={['Alex', ' alex ']} />)
    await user.click(screen.getByRole('button', { name: 'Arrange players' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Player names must be unique.')
    expect(categoryBombStore.getState().round).toBeNull()
  })

  it('swaps radial names and arms from the placement screen', async () => {
    categoryBombStore.getState().startSetup(names(4), 'fair-cycle')
    const before = categoryBombStore.getState().round!
    const [first, second] = before.settings.players
    const user = userEvent.setup()
    render(<CategoryBombPlacementScreen round={before} onBack={() => undefined} />)
    expect(screen.getByTestId('category-bomb-placement-arrow')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Move ${first.name}` }))
    await user.click(screen.getByRole('button', { name: `Swap with ${second.name}` }))
    expect(categoryBombStore.getState().round?.settings.players[0].seat).toBe(second.seat)
    await user.click(screen.getByRole('button', { name: 'Arm bomb' }))
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
  })

  it('renders no seats or arrow in large-group ready mode', async () => {
    categoryBombStore.getState().startSetup(names(13), 'fair-cycle')
    const round = categoryBombStore.getState().round!
    const user = userEvent.setup()
    render(<CategoryBombReadyScreen round={round} onBack={() => undefined} />)
    expect(screen.queryByTestId('category-bomb-placement-arrow')).not.toBeInTheDocument()
    expect(screen.queryByTestId('category-bomb-seat')).not.toBeInTheDocument()
    expect(screen.getByText(/current player's name will fill the screen/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Arm bomb' }))
    expect(categoryBombStore.getState().round?.phase).toBe('ACTIVE')
  })
})
