import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PackRepository } from './packDb'
import PackManager from './PackManager'

function fakeRepository(): PackRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
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

  it('validates pasted JSON as the user types', async () => {
    const user = userEvent.setup()
    render(<PackManager repository={fakeRepository()} />)

    await user.click(screen.getByRole('tab', { name: 'Import JSON' }))
    await user.click(screen.getByLabelText('Paste pack JSON'))
    await user.paste('{oops')

    expect(screen.getByRole('alert')).toHaveTextContent('That is not valid JSON.')
  })
})
