import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { createRound } from '../../domain/game'
import type { GameSetupInput } from '../../domain/types'
import { gameStore } from '../../store/gameStore'

async function openConfiguredLobby() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /set up a round/i }))
  const nameInputs = screen.getAllByLabelText(/player \d+ name/i)
  await user.clear(nameInputs[0]); await user.type(nameInputs[0], 'Alex')
  await user.clear(nameInputs[1]); await user.type(nameInputs[1], 'Blair')
  await user.clear(nameInputs[2]); await user.type(nameInputs[2], 'Casey')
  return user
}

async function revealAndConfirm(user: ReturnType<typeof userEvent.setup>, playerName: string) {
  expect(screen.getByRole('heading', { name: `Pass to ${playerName}` })).toBeInTheDocument()
  const reveal = screen.getByRole('button', { name: /drag up to reveal/i })
  fireEvent.pointerDown(reveal, { pointerId: 1, clientY: 300, clientX: 100 })
  fireEvent.pointerMove(reveal, { pointerId: 1, clientY: 230, clientX: 100 })
  expect(screen.getByTestId('private-role')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /seen my role/i }))
}

describe('Impostor game interface', () => {
  beforeEach(() => {
    localStorage.clear()
    gameStore.setState({
      setup: null,
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      pendingOutlierGuess: '',
      isOutlierGuessReady: false,
      lobbyIntent: 'default',
    })
  })

  it('edits players and blocks invalid setup', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    expect(screen.getAllByLabelText(/player \d+ name/i)).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Remove player 4' }))

    const inputs = screen.getAllByLabelText(/player \d+ name/i)
    await user.clear(inputs[2])
    await user.type(inputs[2], 'alex')
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Player names must be unique.')
  })

  it('keeps unfinished setup while visiting custom pack management', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Manage custom packs' }))
    await user.click(screen.getByRole('button', { name: '← Back to setup' }))

    expect(screen.getByLabelText('Player 1 name')).toHaveValue('Alex')
    expect(screen.getByLabelText('Player 2 name')).toHaveValue('Blair')
    expect(screen.getByLabelText('Player 3 name')).toHaveValue('Casey')
  })

  it('offers optional Jester and Outlier roles with Outlier hints off by default', async () => {
    const user = await openConfiguredLobby()

    expect(screen.getByLabelText('Jester')).not.toBeChecked()
    expect(screen.getByLabelText('Outlier')).not.toBeChecked()
    expect(screen.getByLabelText('Give Outlier a hint')).toBeDisabled()

    await user.click(screen.getByLabelText('Outlier'))
    expect(screen.getByLabelText('Give Outlier a hint')).not.toBeDisabled()
    expect(screen.getByLabelText('Give Outlier a hint')).not.toBeChecked()
  })

  it('blocks a setup that leaves no word-knowing Innocent', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByLabelText('Jester'))
    await user.click(screen.getByLabelText('Outlier'))
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Leave at least one player as an Innocent.')
  })

  it('reveals special-role goals without exposing the secret word', async () => {
    const setup: GameSetupInput = {
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon', 'Emery'],
      impostorCount: 1,
      pack: {
        id: 'special-test',
        packName: 'Special Test',
        category: 'Test',
        source: 'builtIn',
        items: [{ word: 'Moon', hint: 'Orbit' }],
      },
      hintsEnabled: true,
      jesterEnabled: true,
      outlierEnabled: true,
      outlierHintsEnabled: true,
      absoluteVotingEnabled: false,
      discussionDurationSeconds: null,
    }
    gameStore.setState({ game: createRound(setup, () => 0), setup })
    const user = userEvent.setup()
    render(<App />)

    await revealAndConfirm(user, 'Alex')
    await revealAndConfirm(user, 'Blair')

    const jesterReveal = screen.getByRole('button', { name: /drag up to reveal/i })
    fireEvent.pointerDown(jesterReveal, { pointerId: 1, clientY: 300, clientX: 100 })
    fireEvent.pointerMove(jesterReveal, { pointerId: 1, clientY: 230, clientX: 100 })
    expect(screen.getByTestId('private-role')).toHaveTextContent('Jester')
    expect(screen.getByTestId('private-role')).toHaveTextContent('Get yourself voted out')
    expect(screen.getByTestId('private-role')).not.toHaveTextContent('Moon')
    await user.click(screen.getByRole('button', { name: /seen my role/i }))

    const outlierReveal = screen.getByRole('button', { name: /drag up to reveal/i })
    fireEvent.pointerDown(outlierReveal, { pointerId: 1, clientY: 300, clientX: 100 })
    fireEvent.pointerMove(outlierReveal, { pointerId: 1, clientY: 230, clientX: 100 })
    expect(screen.getByTestId('private-role')).toHaveTextContent('Outlier')
    expect(screen.getByTestId('private-role')).toHaveTextContent('Guess the secret word after voting')
    expect(screen.getByTestId('private-role')).toHaveTextContent('Hint: Orbit')
    expect(screen.getByTestId('private-role')).not.toHaveTextContent('Moon')
  })

  it('masks a revealed role when focus leaves the reveal control', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))
    const reveal = screen.getByRole('button', { name: /drag up to reveal/i })

    fireEvent.keyDown(reveal, { key: ' ' })
    expect(screen.getByTestId('private-role')).toBeInTheDocument()
    fireEvent.blur(reveal)
    expect(screen.queryByTestId('private-role')).not.toBeInTheDocument()
  })

  it('only reveals after an upward drag crosses the gesture threshold', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))
    const reveal = screen.getByRole('button', { name: /drag up to reveal/i })

    fireEvent.pointerDown(reveal, { pointerId: 1, clientY: 300, clientX: 100 })
    fireEvent.pointerMove(reveal, { pointerId: 1, clientY: 260, clientX: 100 })
    expect(screen.queryByTestId('private-role')).not.toBeInTheDocument()
    fireEvent.pointerUp(reveal, { pointerId: 1, clientY: 260, clientX: 100 })

    fireEvent.pointerDown(reveal, { pointerId: 2, clientY: 300, clientX: 100 })
    fireEvent.pointerMove(reveal, { pointerId: 2, clientY: 330, clientX: 100 })
    expect(screen.queryByTestId('private-role')).not.toBeInTheDocument()
    fireEvent.pointerUp(reveal, { pointerId: 2, clientY: 330, clientX: 100 })

    fireEvent.pointerDown(reveal, { pointerId: 3, clientY: 300, clientX: 100 })
    fireEvent.pointerMove(reveal, { pointerId: 3, clientY: 230, clientX: 100 })
    expect(screen.getByTestId('private-role')).toBeInTheDocument()
  })

  it('collects the Outlier guess behind a private hand-off before showing results', async () => {
    const setup: GameSetupInput = {
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon'],
      impostorCount: 1,
      pack: {
        id: 'outlier-test',
        packName: 'Outlier Test',
        category: 'Test',
        source: 'builtIn',
        items: [{ word: 'Moon', hint: 'Orbit' }],
      },
      hintsEnabled: true,
      jesterEnabled: false,
      outlierEnabled: true,
      outlierHintsEnabled: false,
      absoluteVotingEnabled: false,
      discussionDurationSeconds: null,
    }
    const game = createRound(setup, () => 0)
    gameStore.setState({
      setup,
      game: {
        ...game,
        phase: 'OUTLIER_GUESS',
        voteResult: {
          counts: { 'player-1': 0, 'player-2': 3, 'player-3': 0, 'player-4': 1 },
          topCandidateIds: ['player-2'],
          eliminatedPlayerId: 'player-2',
          isTie: false,
        },
      },
    })
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Pass to Casey' })).toBeInTheDocument()
    expect(screen.queryByText('Moon')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I’m Casey' }))

    const guessInput = screen.getByLabelText('Your word guess')
    expect(screen.getByRole('button', { name: 'Lock in guess' })).toBeDisabled()
    expect(screen.queryByText('Moon')).not.toBeInTheDocument()
    await user.type(guessInput, 'Moon')
    await user.click(screen.getByRole('button', { name: 'Lock in guess' }))

    expect(screen.getByRole('heading', { name: 'Blair was voted out' })).toBeInTheDocument()
  })

  it('plays a full private round through voting and result reveal', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))

    await revealAndConfirm(user, 'Alex')
    await revealAndConfirm(user, 'Blair')
    await revealAndConfirm(user, 'Casey')

    expect(screen.getByRole('heading', { name: 'Discussion time' })).toBeInTheDocument()
    expect(screen.getByText('03:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pause timer' }))
    expect(screen.getByRole('button', { name: 'Resume timer' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Proceed to voting' }))

    for (const [voter, target] of [['Alex', 'Blair'], ['Blair', 'Alex'], ['Casey', 'Blair']] as const) {
      expect(screen.getByRole('heading', { name: `Pass to ${voter}` })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: `I’m ${voter}` }))
      const ballot = screen.getByRole('group', { name: 'Vote for one player' })
      expect(within(ballot).queryByRole('button', { name: voter })).not.toBeInTheDocument()
      const targetButton = within(ballot).getByRole('button', { name: target })
      await user.click(targetButton)
      expect(targetButton).toHaveAttribute('aria-pressed', 'true')
      await user.click(screen.getByRole('button', { name: 'Lock in vote' }))
    }

    expect(screen.getByRole('heading', { name: 'Blair was voted out' })).toBeInTheDocument()
    expect(screen.getByText(/secret word/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Absolute Voting' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change category' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to lobby' })).toBeInTheDocument()
  })

  it('uses a public ballot without passing the device when Absolute Voting is enabled', async () => {
    const user = await openConfiguredLobby()
    expect(screen.getByLabelText('Absolute Voting')).not.toBeChecked()
    await user.click(screen.getByLabelText('Absolute Voting'))
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))

    await revealAndConfirm(user, 'Alex')
    await revealAndConfirm(user, 'Blair')
    await revealAndConfirm(user, 'Casey')
    await user.click(screen.getByRole('button', { name: 'Proceed to voting' }))

    expect(screen.queryByRole('heading', { name: 'Pass to Alex' })).not.toBeInTheDocument()
    expect(screen.getByText(/Everyone can see this ballot/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Blair' }))
    await user.click(screen.getByRole('button', { name: 'Lock in vote' }))

    expect(screen.getByText('Open vote · 2 of 3')).toBeInTheDocument()
  })

  it('can switch to Absolute Voting from the private voting handoff', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))
    await revealAndConfirm(user, 'Alex')
    await revealAndConfirm(user, 'Blair')
    await revealAndConfirm(user, 'Casey')
    await user.click(screen.getByRole('button', { name: 'Proceed to voting' }))

    expect(screen.getByRole('button', { name: 'Proceed to absolute voting' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Proceed to absolute voting' }))

    expect(screen.queryByRole('heading', { name: 'Pass to Alex' })).not.toBeInTheDocument()
    expect(screen.getByText(/Everyone can see this ballot/)).toBeInTheDocument()
  })

  it('reveals every player role and each special-role outcome at round end', () => {
    const setup: GameSetupInput = {
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon', 'Emery'],
      impostorCount: 1,
      pack: {
        id: 'result-test',
        packName: 'Result Test',
        category: 'Test',
        source: 'builtIn',
        items: [{ word: 'Moon', hint: 'Orbit' }],
      },
      hintsEnabled: true,
      jesterEnabled: true,
      outlierEnabled: true,
      outlierHintsEnabled: false,
      absoluteVotingEnabled: false,
      discussionDurationSeconds: null,
    }
    const game = createRound(setup, () => 0)
    gameStore.setState({
      setup,
      game: {
        ...game,
        phase: 'GAME_OVER',
        voteResult: {
          counts: { 'player-1': 0, 'player-2': 0, 'player-3': 4, 'player-4': 0, 'player-5': 1 },
          topCandidateIds: ['player-3'],
          eliminatedPlayerId: 'player-3',
          isTie: false,
        },
        outlierGuesses: [{ playerId: 'player-4', guess: 'Moon', isCorrect: true }],
      },
    })

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Casey was voted out' })).toBeInTheDocument()
    expect(screen.getByText('Casey won as Jester')).toBeInTheDocument()
    expect(screen.getByText('Devon won as Outlier')).toBeInTheDocument()
    expect(screen.getByText('Guess: Moon')).toBeInTheDocument()
    const roster = screen.getByRole('list', { name: 'Player roles' })
    expect(roster).toHaveTextContent('AlexInnocent')
    expect(roster).toHaveTextContent('BlairImpostor')
    expect(roster).toHaveTextContent('CaseyJesterVoted out')
    expect(roster).toHaveTextContent('DevonOutlier')
    expect(roster).toHaveTextContent('EmeryInnocent')
  })

  it('replays with the same settings from the result screen', async () => {
    const user = await openConfiguredLobby()
    await user.click(screen.getByRole('button', { name: 'Start secret round' }))
    await revealAndConfirm(user, 'Alex')
    await revealAndConfirm(user, 'Blair')
    await revealAndConfirm(user, 'Casey')
    await user.click(screen.getByRole('button', { name: 'Proceed to voting' }))

    for (const voter of ['Alex', 'Blair', 'Casey']) {
      await user.click(screen.getByRole('button', { name: `I’m ${voter}` }))
      await user.click(screen.getByRole('button', { name: 'Skip vote' }))
      await user.click(screen.getByRole('button', { name: 'Lock in vote' }))
    }

    expect(screen.getByRole('heading', { name: 'Nobody was voted out' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Absolute Voting' }))
    expect(gameStore.getState().game?.absoluteVotingEnabled).toBe(true)
    expect(gameStore.getState().setup?.absoluteVotingEnabled).toBe(true)
    expect(screen.getByText('Round 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pass to Alex' })).toBeInTheDocument()
  })
})
