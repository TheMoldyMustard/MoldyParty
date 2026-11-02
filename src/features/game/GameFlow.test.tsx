import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
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
  const reveal = screen.getByRole('button', { name: /hold to reveal/i })
  fireEvent.pointerDown(reveal)
  expect(screen.getByTestId('private-role')).toBeInTheDocument()
  fireEvent.pointerUp(reveal)
  expect(screen.queryByTestId('private-role')).not.toBeInTheDocument()
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
      await user.click(within(ballot).getByRole('button', { name: target }))
      await user.click(screen.getByRole('button', { name: 'Lock in vote' }))
    }

    expect(screen.getByRole('heading', { name: 'Blair was voted out' })).toBeInTheDocument()
    expect(screen.getByText(/secret word/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change category' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to lobby' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByText('Round 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pass to Alex' })).toBeInTheDocument()
  })
})
