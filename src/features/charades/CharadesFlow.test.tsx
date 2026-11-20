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

describe('Forehead Charades interface', () => {
  beforeEach(() => {
    localStorage.clear()
    appStore.setState({ activeGameId: null, recoveryNotice: '' })
    charadesStore.setState({ session: null })
    gameStore.setState({ game: null, setup: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('launches setup with all four modes and Henyo fixed at two minutes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /open forehead charades/i }))
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

  it('marks tilt controls as work in progress and prevents motion-enabled sessions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /open forehead charades/i }))
    const tiltControls = screen.getByRole('checkbox', { name: /Tilt controls — Work in progress/i })
    expect(tiltControls).toBeDisabled()
    expect(tiltControls).not.toBeChecked()

    fireEvent.click(tiltControls)
    expect(tiltControls).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Start game' }))

    expect(charadesStore.getState().session?.settings.motionEnabled).toBe(false)
  })

  it('runs Get Ready before the timer, accepts a correct tap, and shows the recap', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open forehead charades/i }))
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

  it('collects two relay rosters and names the first rotating holder', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open forehead charades/i }))
    await user.click(screen.getByRole('radio', { name: /Team Relay/i }))
    await user.clear(screen.getByLabelText('Team 1 name')); await user.type(screen.getByLabelText('Team 1 name'), 'Molds')
    await user.type(screen.getByLabelText('Team 1 members'), 'Alex, Blair')
    await user.clear(screen.getByLabelText('Team 2 name')); await user.type(screen.getByLabelText('Team 2 name'), 'Spores')
    await user.type(screen.getByLabelText('Team 2 members'), 'Casey, Devon')
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
