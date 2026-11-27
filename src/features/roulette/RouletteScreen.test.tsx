import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RouletteScreen from './RouletteScreen'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Name Roulette screen', () => {
  it('starts with two editable names and supports adding and removing rows', async () => {
    const user = userEvent.setup()
    render(<RouletteScreen onBack={() => undefined} />)

    expect(screen.getByRole('heading', { name: 'Name Roulette' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Remove name/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add name' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Remove name 2' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('copies a saved session roster into editable name rows', async () => {
    const sourceNames = ['Alex', 'Blair', 'Casey']
    const user = userEvent.setup()
    render(<RouletteScreen
      onBack={() => undefined}
      rosterOptions={[{ id: 'impostor:one', label: 'Impostor · Friday Crew', names: sourceNames }]}
    />)

    await user.selectOptions(screen.getByLabelText('Saved session roster'), 'impostor:one')
    await user.click(screen.getByRole('button', { name: 'Use session names' }))

    expect(screen.getAllByRole('textbox').map((input) => (input as HTMLInputElement).value)).toEqual(sourceNames)
    expect(screen.getByRole('status')).toHaveTextContent('Copied 3 names from Impostor · Friday Crew.')
    await user.clear(screen.getByLabelText('Name 1'))
    await user.type(screen.getByLabelText('Name 1'), 'Changed')
    expect(sourceNames).toEqual(['Alex', 'Blair', 'Casey'])
  })

  it('copies an over-limit session intact and explains the edits needed before spinning', async () => {
    const roster = Array.from({ length: 51 }, (_, index) => index === 0 ? 'A'.repeat(25) : `Player ${index + 1}`)
    const user = userEvent.setup()
    render(<RouletteScreen
      onBack={() => undefined}
      rosterOptions={[{ id: 'impostor:large', label: 'Impostor · Large Group', names: roster }]}
    />)

    await user.selectOptions(screen.getByLabelText('Saved session roster'), 'impostor:large')
    await user.click(screen.getByRole('button', { name: 'Use session names' }))

    expect(screen.getAllByRole('textbox')).toHaveLength(51)
    expect(screen.getByLabelText('Name 1')).toHaveValue('A'.repeat(25))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter no more than 50 names.')
    expect(screen.getByRole('alert')).toHaveTextContent('Names must be 24 characters or fewer.')
    expect(screen.queryByRole('img', { name: /Roulette wheel/i })).not.toBeInTheDocument()
  })

  it('shows actionable errors and keeps the draft when names are invalid', async () => {
    const user = userEvent.setup()
    render(<RouletteScreen onBack={() => undefined} />)

    await user.type(screen.getByLabelText('Name 1'), 'Alex')
    await user.type(screen.getByLabelText('Name 2'), ' alex ')
    await user.click(screen.getByRole('button', { name: 'Spin the wheel' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Names must be unique.')
    expect(screen.getByLabelText('Name 1')).toHaveValue('Alex')
    expect(screen.getByLabelText('Name 2')).toHaveValue(' alex ')
    expect(screen.queryByRole('heading', { name: /wins/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Roulette wheel/i })).not.toBeInTheDocument()
  })

  it('preserves pasted input so trimmed length errors can be corrected explicitly', () => {
    render(<RouletteScreen onBack={() => undefined} />)
    const pasted = `    ${'😀'.repeat(25)}`

    fireEvent.change(screen.getByLabelText('Name 1'), { target: { value: pasted } })
    fireEvent.change(screen.getByLabelText('Name 2'), { target: { value: 'Blair' } })
    fireEvent.click(screen.getByRole('button', { name: 'Spin the wheel' }))

    expect(screen.getByLabelText('Name 1')).toHaveValue(pasted)
    expect(screen.getByRole('alert')).toHaveTextContent('Names must be 24 characters or fewer.')
  })

  it('preselects one winner, blocks a second spin, and announces the result', async () => {
    vi.useFakeTimers()
    const random = vi.fn(() => 0.6)
    render(<RouletteScreen onBack={() => undefined} random={random} spinDurationMs={1_000} />)
    fireEvent.change(screen.getByLabelText('Name 1'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Name 2'), { target: { value: 'Blair' } })

    const spin = screen.getByRole('button', { name: 'Spin the wheel' })
    fireEvent.click(spin)
    expect(spin).toBeDisabled()
    expect(screen.getAllByRole('textbox')[0]).toBeDisabled()
    expect(random).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('heading', { name: 'Blair wins!' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The wheel picked Blair.')
    expect(random).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Spin again' })).toBeEnabled()
  })

  it('clears the previous winner when a name changes', async () => {
    vi.useFakeTimers()
    render(<RouletteScreen onBack={() => undefined} random={() => 0} spinDurationMs={100} />)
    fireEvent.change(screen.getByLabelText('Name 1'), { target: { value: 'Alex' } })
    fireEvent.change(screen.getByLabelText('Name 2'), { target: { value: 'Blair' } })
    fireEvent.click(screen.getByRole('button', { name: 'Spin the wheel' }))
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByRole('heading', { name: 'Alex wins!' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name 1'), { target: { value: 'Alexa' } })

    expect(screen.queryByRole('heading', { name: /wins!/i })).not.toBeInTheDocument()
  })

  it('finishes immediately when reduced motion is requested', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const user = userEvent.setup()
    render(<RouletteScreen onBack={() => undefined} random={() => 0} spinDurationMs={3_500} />)
    await user.type(screen.getByLabelText('Name 1'), 'Alex')
    await user.type(screen.getByLabelText('Name 2'), 'Blair')

    await user.click(screen.getByRole('button', { name: 'Spin the wheel' }))

    expect(await screen.findByRole('heading', { name: 'Alex wins!' })).toBeInTheDocument()
  })

  it('keeps full accessible labels when a dense wheel uses number labels', async () => {
    const roster = Array.from({ length: 30 }, (_, index) => `Player ${index + 1}`)
    const user = userEvent.setup()
    render(<RouletteScreen
      onBack={() => undefined}
      rosterOptions={[{ id: 'category-bomb:large', label: 'Category Bomb · Large Group', names: roster }]}
    />)
    await user.selectOptions(screen.getByLabelText('Saved session roster'), 'category-bomb:large')
    await user.click(screen.getByRole('button', { name: 'Use session names' }))

    const wheel = screen.getByRole('img', { name: 'Roulette wheel with 30 names' })
    expect(within(wheel).getByText('Player 30')).toBeInTheDocument()
    expect(within(wheel).getByText('30', { selector: 'text' })).toBeInTheDocument()
  })

  it('uses numbered sectors before twelve long labels can overlap', async () => {
    const roster = Array.from({ length: 12 }, (_, index) => `Wide Player ${index + 1}`)
    const user = userEvent.setup()
    render(<RouletteScreen
      onBack={() => undefined}
      rosterOptions={[{ id: 'category-bomb:twelve', label: 'Category Bomb · Twelve', names: roster }]}
    />)
    await user.selectOptions(screen.getByLabelText('Saved session roster'), 'category-bomb:twelve')
    await user.click(screen.getByRole('button', { name: 'Use session names' }))

    const wheel = screen.getByRole('img', { name: 'Roulette wheel with 12 names' })
    expect(within(wheel).getByText('12', { selector: 'text' })).toBeInTheDocument()
    expect(within(wheel).getByText('Wide Player 12', { selector: 'title' })).toBeInTheDocument()
  })

  it('focuses the heading and resets scroll when the screen opens', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    render(<RouletteScreen onBack={() => undefined} />)

    expect(screen.getByRole('heading', { name: 'Name Roulette' })).toHaveFocus()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 })
  })

  it('returns to MoldyParty through the supplied navigation callback', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<RouletteScreen onBack={onBack} />)

    await user.click(screen.getByRole('button', { name: '← MoldyParty' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
