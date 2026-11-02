import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AiPromptHelper from './AiPromptHelper'
import { buildAiPackPrompt } from './aiPrompt'

describe('buildAiPackPrompt', () => {
  it('includes the topic, canonical schema, and strict JSON requirements', () => {
    const prompt = buildAiPackPrompt('Valorant Agents')

    expect(prompt).toContain('Valorant Agents')
    expect(prompt).toContain('"packName": "Valorant Agents"')
    expect(prompt).toContain('"items"')
    expect(prompt).toContain('{ "word": "Example", "hint": "Broad clue" }')
    expect(prompt).toContain('Return only valid JSON')
    expect(prompt).toContain('25 unique items')
  })
})

describe('AiPromptHelper', () => {
  it('copies a prompt generated from the entered topic', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    render(<AiPromptHelper />)

    await user.type(screen.getByLabelText('Pack topic'), 'Anime Characters')
    await user.click(screen.getByRole('button', { name: 'Copy AI prompt' }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Anime Characters'))
    expect(screen.getByRole('status')).toHaveTextContent('Prompt copied')
  })
})
