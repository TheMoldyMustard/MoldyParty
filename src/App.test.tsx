import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('MoldyParty app shell', () => {
  it('introduces the Impostor game from the main heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'MoldyParty', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Impostor', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/find the impostors before they blend in/i)).toBeInTheDocument()
  })
})
