import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PackRepository } from './packDb'
import PackManager from './PackManager'

function fakeRepository(packs = [] as Awaited<ReturnType<PackRepository['list']>>): PackRepository {
  return {
    list: vi.fn().mockResolvedValue(packs),
    put: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

describe('PackManager', () => {
  it('saves a manually entered word and hint', async () => {
    const user = userEvent.setup()
    const repository = fakeRepository()
    render(<PackManager repository={repository} />)

    await user.type(screen.getByLabelText('Pack name'), 'Friends')
    await user.type(screen.getByLabelText('Word 1'), 'Taylor')
    await user.type(screen.getByLabelText('Hint 1'), 'Singer')
    await user.click(screen.getByRole('button', { name: 'Save pack' }))

    expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({
      packName: 'Friends',
      items: [{ word: 'Taylor', hint: 'Singer' }],
    }))
    expect(await screen.findByText('Pack saved on this device.')).toBeInTheDocument()
  })

  it('saves comma-separated manual hints as a randomized hint pool', async () => {
    const user = userEvent.setup()
    const repository = fakeRepository()
    render(<PackManager repository={repository} />)

    expect(screen.getByRole('note')).toHaveTextContent('Creation, Journey, Night')
    expect(screen.getByRole('note')).toHaveTextContent('one hint is chosen randomly')
    await user.type(screen.getByLabelText('Pack name'), 'Games')
    await user.type(screen.getByLabelText('Word 1'), 'Minecraft')
    await user.type(screen.getByLabelText('Hint 1'), '(Creation, Journey, Night)')
    await user.click(screen.getByRole('button', { name: 'Save pack' }))

    expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({
      items: [{
        word: 'Minecraft',
        hint: 'Creation',
        hints: ['Creation', 'Journey', 'Night'],
      }],
    }))
  })

  it('saves a tagged word-only Charades pack from bulk input', async () => {
    const user = userEvent.setup()
    const repository = fakeRepository()
    render(<PackManager repository={repository} />)

    await user.click(screen.getByRole('tab', { name: 'Charades bulk' }))
    await user.type(screen.getByLabelText('Charades pack name'), 'Pinoy Party')
    await user.type(screen.getByLabelText('Words (one per line)'), 'Balut{enter}Adobo')
    await user.selectOptions(screen.getByLabelText('Default category'), 'food')
    await user.click(screen.getByLabelText('Chaos / Hard'))
    await user.click(screen.getByRole('button', { name: 'Save Charades pack' }))

    expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({
      packName: 'Pinoy Party',
      items: [
        { word: 'Balut', charadesOnly: true, category: 'food', vibes: ['chaos-hard'] },
        { word: 'Adobo', charadesOnly: true, category: 'food', vibes: ['chaos-hard'] },
      ],
    }))
  })

  it('validates pasted JSON as the user types', async () => {
    const user = userEvent.setup()
    render(<PackManager repository={fakeRepository()} />)

    await user.click(screen.getByRole('tab', { name: 'Import JSON' }))
    await user.click(screen.getByLabelText('Paste pack JSON'))
    await user.paste('{oops')

    expect(screen.getByRole('alert')).toHaveTextContent('That is not valid JSON.')
  })

  it('reports the imported pack id after a valid import', async () => {
    const user = userEvent.setup()
    const repository = fakeRepository()
    const onImported = vi.fn()
    render(<PackManager repository={repository} onImported={onImported} />)

    await user.click(screen.getByRole('tab', { name: 'Import JSON' }))
    await user.click(screen.getByLabelText('Paste pack JSON'))
    await user.paste(JSON.stringify({
      packName: 'Imported Friends',
      category: 'Custom',
      items: [{ word: 'Taylor', hint: 'Singer' }],
    }))
    await user.click(screen.getByRole('button', { name: 'Import pack' }))

    expect(onImported).toHaveBeenCalledWith(expect.any(String))
    expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({ packName: 'Imported Friends' }))
  })

  it('keeps the import view and reports storage failures', async () => {
    const user = userEvent.setup()
    const repository = fakeRepository()
    repository.put = vi.fn().mockRejectedValue(new Error('Storage unavailable'))
    const onImported = vi.fn()
    render(<PackManager repository={repository} onImported={onImported} />)

    await user.click(screen.getByRole('tab', { name: 'Import JSON' }))
    await user.click(screen.getByLabelText('Paste pack JSON'))
    await user.paste(JSON.stringify({ packName: 'Broken Import', category: 'Custom', items: [{ word: 'Taylor', hint: 'Singer' }] }))
    await user.click(screen.getByRole('button', { name: 'Import pack' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.getByRole('tab', { name: 'Import JSON' })).toHaveAttribute('aria-selected', 'true')
    expect(onImported).not.toHaveBeenCalled()
  })

  it('edits a saved pack in place and preserves its id', async () => {
    const user = userEvent.setup()
    const savedPack = {
      id: 'saved-pack',
      packName: 'Friends',
      category: 'Custom',
      source: 'custom' as const,
      items: [{ word: 'Taylor', hint: 'Singer' }],
      createdAt: '2026-11-02T00:00:00.000Z',
    }
    const repository = fakeRepository([savedPack])
    render(<PackManager repository={repository} />)

    await user.click(await screen.findByRole('button', { name: 'Edit Friends' }))
    expect(screen.getByLabelText('Pack name')).toHaveValue('Friends')
    await user.clear(screen.getByLabelText('Hint 1'))
    await user.type(screen.getByLabelText('Hint 1'), 'Pop star')
    await user.click(screen.getByRole('button', { name: 'Update pack' }))

    expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'saved-pack',
      createdAt: savedPack.createdAt,
      items: [{ word: 'Taylor', hint: 'Pop star' }],
    }))
  })

  it('preserves Charades metadata when a saved tagged pack is edited', async () => {
    const user = userEvent.setup()
    const savedPack = {
      id: 'charades-pack',
      packName: 'Chaos Cards',
      category: 'Mixed',
      source: 'custom' as const,
      items: [{ word: 'Invisible Roller Coaster', charadesOnly: true, category: 'other' as const, vibes: ['chaos-hard' as const] }],
      createdAt: '2026-11-02T00:00:00.000Z',
    }
    const repository = fakeRepository([savedPack])
    render(<PackManager repository={repository} />)

    await user.click(await screen.findByRole('button', { name: 'Edit Chaos Cards' }))
    await user.click(screen.getByRole('button', { name: 'Update pack' }))

    expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'charades-pack',
      items: [{
        word: 'Invisible Roller Coaster',
        charadesOnly: true,
        category: 'other',
        vibes: ['chaos-hard'],
      }],
    }))
  })

  it('shows per-game compatibility counts for a mixed pack', async () => {
    render(<PackManager repository={fakeRepository([{
      id: 'mixed-pack',
      packName: 'Mixed Pack',
      category: 'Mixed',
      source: 'custom',
      items: [
        { word: 'Adobo', hint: 'Ulam' },
        { word: 'Balut', charadesOnly: true },
      ],
    }])} />)

    expect(await screen.findByText('Impostor 1 · Charades 2')).toBeInTheDocument()
  })
})
