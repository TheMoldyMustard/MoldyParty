import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { beginTurn, createCharadesSession, type CharadesSettings } from '../../domain/charades'
import { appStore } from '../../store/appStore'
import { charadesStore } from '../../store/charadesStore'
import { gameStore } from '../../store/gameStore'

const henyoSettings: CharadesSettings = {
  mode: 'henyo',
  packId: 'test-pack',
  packName: 'Test Pack',
  durationSeconds: 120,
  categories: [],
  vibes: [],
  motionEnabled: false,
  henyoTapAnswersEnabled: true,
  noRepeatEnabled: false,
}

async function openNewSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /open forehead charades/i }))
  await user.click(screen.getByRole('button', { name: 'Create new session' }))
  await user.type(screen.getByLabelText('Session name'), 'Test Crew')
  await user.click(screen.getByRole('button', { name: 'Set up session' }))
}

describe('Forehead Charades interface', () => {
  beforeEach(() => {
    localStorage.clear()
    appStore.setState({ activeGameId: null, recoveryNotice: '' })
    charadesStore.setState({ session: null, sessionsById: {}, activeSessionId: null, pendingSessionName: null })
    gameStore.setState({ game: null, setup: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('launches setup with all four modes and Henyo fixed at two minutes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openNewSession(user)
    expect(screen.getByRole('heading', { name: 'Forehead Charades' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Classic/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Henyo/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /One-Word/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Team Relay/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Henyo/i }))
    expect(screen.getByText('2:00 fixed')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Food / Pagkain' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Pop Culture / Local' })).toBeInTheDocument()
  })

  it('enables tilt by default for new sessions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openNewSession(user)
    const tiltControls = screen.getByRole('checkbox', { name: 'Tilt controls' })
    expect(tiltControls).toBeEnabled()
    expect(tiltControls).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Start game' }))

    expect(charadesStore.getState().session?.settings.motionEnabled).toBe(true)
  })

  it('persists an explicit tilt opt-out for tap-only play', async () => {
    const user = userEvent.setup()
    render(<App />)

    await openNewSession(user)
    const tiltControls = screen.getByRole('checkbox', { name: 'Tilt controls' })

    await user.click(tiltControls)
    expect(tiltControls).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Start game' }))

    expect(charadesStore.getState().session?.settings.motionEnabled).toBe(false)
  })

  it('runs Get Ready before the timer, accepts a correct tap, and shows the recap', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openNewSession(user)
    await user.click(screen.getByRole('checkbox', { name: /Tilt controls/i }))
    await user.click(screen.getByRole('button', { name: 'Start game' }))

    expect(screen.getByRole('heading', { name: /Get ready/i })).toBeInTheDocument()
    vi.useFakeTimers()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Get Ready' })); await Promise.resolve() })
    for (let second = 0; second < 3; second += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    }

    const firstWord = charadesStore.getState().session?.currentCard?.word
    expect(firstWord).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Correct' }))
    expect(charadesStore.getState().session?.currentEvents).toHaveLength(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByRole('heading', { name: 'Round recap' })).toBeInTheDocument()
    expect(screen.getByText(firstWord!)).toBeInTheDocument()
    expect(screen.getByText('1 point')).toBeInTheDocument()
    expect(screen.getByLabelText('Completed turn stats')).toHaveTextContent('1 correct')
    expect(screen.getByLabelText('Completed turn stats')).toHaveTextContent('0 passes')
  })

  it('keeps Henyo answer buttons separate from scoring and applies a five-second foul', async () => {
    const active = beginTurn(createCharadesSession(henyoSettings, [
      { word: 'Adobo', category: 'food' },
      { word: 'Balut', category: 'food' },
    ], () => 0.99), Date.now())
    charadesStore.setState({ session: active })
    appStore.setState({ activeGameId: 'charades' })
    const user = userEvent.setup()
    render(<App />)
    const cardToken = charadesStore.getState().session!.currentCardToken
    const deadline = charadesStore.getState().session!.deadlineMs

    await user.click(screen.getByRole('button', { name: 'Oo / Yes' }))
    expect(charadesStore.getState().session?.currentEvents).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Foul (-5s)' }))

    expect(charadesStore.getState().session?.currentCardToken).toBe(cardToken)
    expect(charadesStore.getState().session?.deadlineMs).toBe(deadline! - 5_000)
    expect(charadesStore.getState().session?.currentEvents).toEqual([
      expect.objectContaining({ type: 'foul', seconds: -5 }),
    ])
  })

  it('confirms aborting an unfinished turn and keeps the saved session', async () => {
    charadesStore.getState().createSession('Guess Crew')
    charadesStore.getState().startSession({
      ...henyoSettings,
      players: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Blair' }],
    }, [
      { word: 'Adobo', category: 'food' },
      { word: 'Balut', category: 'food' },
    ])
    appStore.setState({ activeGameId: 'charades' })
    const sessionId = charadesStore.getState().activeSessionId!
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Abort game' }))
    expect(screen.getByRole('dialog', { name: 'Abort this game?' })).toBeInTheDocument()
    await user.click(screen.getByRole('dialog').querySelector('.button--danger') as HTMLButtonElement)

    expect(charadesStore.getState().session).toBeNull()
    expect(charadesStore.getState().sessionsById[sessionId]).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Forehead Charades sessions' })).toBeInTheDocument()
  })

  it('collects two relay rosters and names the first rotating holder', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openNewSession(user)
    await user.click(screen.getByRole('radio', { name: /Team Relay/i }))
    await user.clear(screen.getByLabelText('Team 1 name')); await user.type(screen.getByLabelText('Team 1 name'), 'Molds')
    await user.clear(screen.getByLabelText('Player 1 name')); await user.type(screen.getByLabelText('Player 1 name'), 'Alex')
    await user.clear(screen.getByLabelText('Player 2 name')); await user.type(screen.getByLabelText('Player 2 name'), 'Blair')
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    await user.clear(screen.getByLabelText('Player 3 name')); await user.type(screen.getByLabelText('Player 3 name'), 'Casey')
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    await user.clear(screen.getByLabelText('Player 4 name')); await user.type(screen.getByLabelText('Player 4 name'), 'Devon')
    await user.clear(screen.getByLabelText('Team 2 name')); await user.type(screen.getByLabelText('Team 2 name'), 'Spores')
    await user.selectOptions(screen.getByLabelText('Relay rounds'), '3')
    await user.click(screen.getByRole('button', { name: 'Start game' }))

    expect(screen.getByRole('heading', { name: 'Get ready, Alex' })).toBeInTheDocument()
    expect(screen.getByText('Molds')).toBeInTheDocument()
  })

  it('supports keyboard fallback for pass and correct', () => {
    const classic: CharadesSettings = { ...henyoSettings, mode: 'classic', durationSeconds: 60, henyoTapAnswersEnabled: false }
    charadesStore.setState({ session: beginTurn(createCharadesSession(classic, [
      { word: 'Adobo', category: 'food' },
      { word: 'Balut', category: 'food' },
    ], () => 0.99), Date.now()) })
    appStore.setState({ activeGameId: 'charades' })
    render(<App />)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(charadesStore.getState().session?.currentEvents.map((event) => event.type === 'card' ? event.outcome : event.type)).toEqual(['pass', 'correct'])
  })
})
