import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { gameStore } from './store/gameStore'

const setup = {
  playerNames: ['Alex', 'Blair', 'Casey'],
  impostorCount: 1,
  pack: {
    id: 'test', packName: 'Test', category: 'Test', source: 'builtIn' as const,
    items: [{ word: 'Moon', hint: 'Orbit' }],
  },
  hintsEnabled: true,
  jesterEnabled: false,
  outlierEnabled: false,
  outlierHintsEnabled: false,
  absoluteVotingEnabled: false,
  discussionDurationSeconds: null,
}

describe('MoldyParty app shell', () => {
  beforeEach(() => {
    localStorage.clear()
    gameStore.setState({
      setup: null,
      game: null,
      sessionsById: {},
      activeSessionId: null,
      pendingSessionName: null,
      lobbyIntent: 'default',
    })
  })

  it('introduces MoldyParty as a home for offline party games', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'MoldyParty', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Impostor', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/find the impostors before they blend in/i)).toBeInTheDocument()
    expect(screen.getByText(/offline party games/i)).toBeInTheDocument()
    expect(screen.queryByText('Pass it. Bluff it. Find them.')).not.toBeInTheDocument()
  })

  it('opens the four session actions from Impostor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /open impostor/i }))

    expect(screen.getByRole('button', { name: 'Create new session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue a session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View session stats' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete session' })).toBeInTheDocument()
  })

  it('names a new session before opening round setup', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Create new session' }))

    await user.type(screen.getByLabelText('Session name'), 'Friday Crew')
    await user.click(screen.getByRole('button', { name: 'Set up session' }))

    expect(screen.getByRole('heading', { name: 'Who can you trust?' })).toBeInTheDocument()
    expect(gameStore.getState().pendingSessionName).toBe('Friday Crew')
  })

  it('views a saved session stats table without starting a round', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().returnToLobby()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Friday Crew' }))

    await user.click(screen.getByRole('button', { name: 'View session stats' }))

    expect(screen.getByRole('heading', { name: 'Friday Crew stats' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Friday Crew session stats' })).toHaveTextContent('Alex')
    expect(gameStore.getState().game).toBeNull()
  })

  it('continues the selected session at its unfinished round', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().confirmRole()
    gameStore.getState().returnToLobby()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Continue a session' }))

    expect(screen.getByRole('heading', { name: 'Pass to Blair' })).toBeInTheDocument()
  })

  it('locks player names when a saved session continues to setup', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.setState((state) => ({
      sessionsById: {
        ...state.sessionsById,
        [state.activeSessionId!]: { ...state.sessionsById[state.activeSessionId!], currentGame: null },
      },
      game: null,
      activeSessionId: null,
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Continue a session' }))

    expect(screen.getByLabelText('Player 1 name')).toBeDisabled()
  })

  it('returns from saved-session setup to the session manager', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.setState((state) => ({
      sessionsById: {
        ...state.sessionsById,
        [state.activeSessionId!]: { ...state.sessionsById[state.activeSessionId!], currentGame: null },
      },
      game: null,
      activeSessionId: null,
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Continue a session' }))
    await user.click(screen.getByRole('button', { name: '← MoldyParty' }))

    expect(screen.getByRole('heading', { name: 'Impostor sessions' })).toBeInTheDocument()
  })

  it('confirms before deleting only the selected session', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().returnToLobby()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Friday Crew' }))
    const selectedSession = screen.getByRole('button', { name: 'Friday Crew' })
    expect(selectedSession).toHaveAttribute('aria-pressed', 'true')
    const deleteButton = screen.getByRole('button', { name: 'Delete session' })
    await user.click(deleteButton)

    expect(screen.getByRole('dialog')).toHaveTextContent('Friday Crew')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(gameStore.getState().sessionsById).not.toEqual({})
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteButton).toHaveFocus()

    await user.click(deleteButton)
    await user.click(screen.getByRole('button', { name: 'Delete Friday Crew' }))
    expect(gameStore.getState().sessionsById).toEqual({})
  })
})
