import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { gameStore } from './store/gameStore'
import { categoryBombStore } from './store/categoryBombStore'
import { appStore } from './store/appStore'

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

function completePrivateRound() {
  gameStore.getState().confirmRole(); gameStore.getState().confirmRole(); gameStore.getState().confirmRole()
  gameStore.getState().beginVoting()
  for (const targetId of ['player-2', 'player-1', 'player-2']) {
    gameStore.getState().showVote()
    gameStore.getState().castVote(targetId)
    gameStore.getState().confirmVote()
  }
}

describe('MoldyParty app shell', () => {
  beforeEach(() => {
    localStorage.clear()
    categoryBombStore.setState({ round: null })
    appStore.setState({ activeGameId: null, recoveryNotice: '' })
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
    expect(screen.getByRole('heading', { name: 'Category Bomb', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/find the impostors before they blend in/i)).toBeInTheDocument()
    expect(screen.getByText(/offline party games/i)).toBeInTheDocument()
    expect(screen.queryByText('Pass it. Bluff it. Find them.')).not.toBeInTheDocument()
  })

  it('shows only the useful session action when no sessions exist', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /open impostor/i }))

    expect(screen.getByRole('button', { name: 'Create new session' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue a session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View session stats' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete session' })).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'View stats for Friday Crew' }))

    expect(screen.getByRole('heading', { name: 'Friday Crew stats' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Friday Crew session stats' })).toHaveTextContent('Alex')
    expect(gameStore.getState().game).toBeNull()
  })

  it('continues a session immediately from its card', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().confirmRole()
    gameStore.getState().returnToLobby()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    await user.click(screen.getByRole('button', { name: 'Continue Friday Crew' }))

    expect(screen.getByRole('heading', { name: 'Pass to Blair' })).toBeInTheDocument()
  })

  it('can cancel or confirm aborting an active game without recording it', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    const sessionId = gameStore.getState().activeSessionId!
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: 'Abort game' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abort game' }))
    const abortDialog = screen.getByRole('dialog')
    expect(abortDialog).toHaveTextContent('Abort this game?')
    expect(abortDialog).toHaveAccessibleDescription('This clears the current round. Completed session stats stay unchanged.')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Pass to Alex' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Abort game' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abort game' }))

    expect(screen.getByRole('heading', { name: 'Impostor sessions' })).toBeInTheDocument()
    expect(gameStore.getState().sessionsById[sessionId].currentGame).toBeNull()
    expect(gameStore.getState().sessionsById[sessionId].completedRounds).toBe(0)
  })

  it('does not show abort controls after a round is complete', () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().confirmRole(); gameStore.getState().confirmRole(); gameStore.getState().confirmRole()
    gameStore.getState().beginVoting()
    for (const targetId of ['player-2', 'player-1', 'player-2']) {
      gameStore.getState().showVote()
      gameStore.getState().castVote(targetId)
      gameStore.getState().confirmVote()
    }

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Blair was voted out' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abort game' })).not.toBeInTheDocument()
  })

  it('changes category directly within the active saved session', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    completePrivateRound()
    const sessionId = gameStore.getState().activeSessionId!
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Change category' }))

    expect(screen.getByRole('heading', { name: 'Pick a category' })).toHaveFocus()
    expect(screen.getByLabelText('Player 1 name')).toBeDisabled()
    expect(gameStore.getState().activeSessionId).toBe(sessionId)
    expect(Object.keys(gameStore.getState().sessionsById)).toEqual([sessionId])
  })

  it('returns from a completed round to the session manager', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    completePrivateRound()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Return to sessions' }))

    expect(screen.getByRole('heading', { name: 'Impostor sessions' })).toBeInTheDocument()
    expect(gameStore.getState().activeSessionId).toBeNull()
  })

  it('keeps the abort control available through discussion and voting', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame({ ...setup, discussionDurationSeconds: 180 })
    gameStore.getState().confirmRole(); gameStore.getState().confirmRole(); gameStore.getState().confirmRole()
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Discussion time' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abort game' })).toBeInTheDocument()
    expect(gameStore.getState().isDiscussionTimerRunning).toBe(true)
    gameStore.getState().beginVoting()
    expect(screen.getByRole('button', { name: 'Abort game' })).toBeInTheDocument()
    gameStore.getState().showVote()
    gameStore.getState().castVote('player-2')
    await user.click(screen.getByRole('button', { name: 'Abort game' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Who should be voted out?' })).toBeInTheDocument()
    expect(gameStore.getState().pendingVote).toEqual(['player-2'])
    expect(gameStore.getState().isDiscussionTimerRunning).toBe(true)
  })

  it('keeps the abort control available during Outlier guessing', () => {
    gameStore.getState().createSession('Special Crew')
    gameStore.getState().startGame({
      ...setup,
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon'],
      outlierEnabled: true,
    })
    gameStore.getState().confirmRole(); gameStore.getState().confirmRole(); gameStore.getState().confirmRole(); gameStore.getState().confirmRole()
    gameStore.getState().beginVoting()
    for (const [index, voterId] of ['player-1', 'player-2', 'player-3', 'player-4'].entries()) {
      gameStore.getState().showVote()
      gameStore.getState().castVote(voterId === 'player-2' ? 'player-1' : 'player-2')
      gameStore.getState().confirmVote()
      if (index < 3) expect(gameStore.getState().game?.phase).toBe('VOTING')
    }

    render(<App />)

    expect(screen.getByRole('heading', { name: /Pass to/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abort game' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Continue Friday Crew' }))

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
    await user.click(screen.getByRole('button', { name: 'Continue Friday Crew' }))
    await user.click(screen.getByRole('button', { name: '← MoldyParty' }))

    expect(screen.getByRole('heading', { name: 'Impostor sessions' })).toBeInTheDocument()
  })

  it('renames a session from its card without continuing it', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().returnToLobby()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))

    await user.click(screen.getByRole('button', { name: 'Rename Friday Crew' }))
    const renameDialog = screen.getByRole('dialog', { name: 'Rename Friday Crew' })
    const nameInput = within(renameDialog).getByLabelText('Session name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Weekend Crew')
    await user.click(within(renameDialog).getByRole('button', { name: 'Save session name' }))

    expect(screen.getByRole('button', { name: 'Continue Weekend Crew' })).toBeInTheDocument()
    expect(gameStore.getState().sessionsById[Object.keys(gameStore.getState().sessionsById)[0]].name).toBe('Weekend Crew')
    expect(gameStore.getState().activeSessionId).toBeNull()
    expect(gameStore.getState().game).toBeNull()
  })

  it('confirms before deleting the session whose card action was used', async () => {
    gameStore.getState().createSession('Friday Crew')
    gameStore.getState().startGame(setup)
    gameStore.getState().returnToLobby()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open impostor/i }))
    const deleteButton = screen.getByRole('button', { name: 'Delete Friday Crew' })
    await user.click(deleteButton)

    const deleteDialog = screen.getByRole('dialog')
    expect(deleteDialog).toHaveTextContent('Friday Crew')
    expect(deleteDialog).toHaveAccessibleDescription('This permanently removes its stats and any unfinished round from this browser.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(gameStore.getState().sessionsById).not.toEqual({})
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteButton).toHaveFocus()

    await user.click(deleteButton)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Friday Crew' }))
    expect(gameStore.getState().sessionsById).toEqual({})
    expect(screen.getByRole('button', { name: 'Create new session' })).toHaveFocus()
  })
})
