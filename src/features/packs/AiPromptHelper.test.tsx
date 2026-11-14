import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AiPromptHelper from './AiPromptHelper'

describe('AiPromptHelper', () => {
  it('copies a Henyo-ready Charades prompt when that generator mode is selected', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(<AiPromptHelper />)

    await user.selectOptions(screen.getByLabelText('Game format'), 'charades')
    await user.selectOptions(screen.getByLabelText('Charades mode'), 'henyo')
    await user.type(screen.getByLabelText('Pack topic'), 'Philippines')
    await user.click(screen.getByRole('button', { name: 'Copy AI prompt' }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('concrete nouns suitable for Pinoy Henyo'))
    expect(screen.getByRole('status')).toHaveTextContent('Prompt copied')
  })
})
