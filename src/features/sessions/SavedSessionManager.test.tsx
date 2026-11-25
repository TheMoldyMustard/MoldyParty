import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SavedSessionManager from './SavedSessionManager'

describe('SavedSessionManager', () => {
  it('creates and continues sessions through callbacks without owning a game store', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    const onContinue = vi.fn()

    const { rerender } = render(<SavedSessionManager
      gameName="Category Bomb"
      sessions={[]}
      onBack={vi.fn()}
      onCreate={onCreate}
      onContinue={onContinue}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      renderStats={() => null}
    />)

    await user.click(screen.getByRole('button', { name: 'Create new session' }))
    await user.type(screen.getByLabelText('Session name'), 'Friday Crew')
    await user.click(screen.getByRole('button', { name: 'Set up session' }))
    expect(onCreate).toHaveBeenCalledWith('Friday Crew')

    rerender(<SavedSessionManager
      gameName="Category Bomb"
      sessions={[{
        id: 'session-1',
        name: 'Friday Crew',
        playerCount: 4,
        completedCount: 3,
        completedUnit: 'bomb',
        updatedAt: '2026-11-24T12:00:00.000Z',
      }]}
      onBack={vi.fn()}
      onCreate={onCreate}
      onContinue={onContinue}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      renderStats={() => null}
    />)

    await user.click(screen.getByRole('button', { name: 'Continue Friday Crew' }))
    expect(onContinue).toHaveBeenCalledWith('session-1')
  })
})
