import { useLayoutEffect, useRef } from 'react'
import type { WordPack } from '../../domain/types'

interface CategoryPickerProps {
  packs: WordPack[]
  selectedId: string
  onSelect: (id: string) => void
  onManagePacks: () => void
}

export default function CategoryPicker({ packs, selectedId, onSelect, onManagePacks }: CategoryPickerProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const syncCardHeight = () => {
      grid.style.removeProperty('--category-card-height')
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.category-option'))
      const tallest = Math.max(0, ...cards.map((card) => card.scrollHeight))
      if (tallest > 0) grid.style.setProperty('--category-card-height', `${tallest}px`)
    }

    syncCardHeight()
    window.addEventListener('resize', syncCardHeight)
    return () => window.removeEventListener('resize', syncCardHeight)
  }, [packs])

  return (
    <section className="setup-section" aria-labelledby="category-title">
      <div className="section-heading">
        <div><span className="step-number">02</span><h2 id="category-title">Pick a category</h2></div>
        <button className="text-button" type="button" onClick={onManagePacks}>Manage custom packs</button>
      </div>
      <div className="category-grid" ref={gridRef}>
        {packs.map((pack) => (
          <label className={`category-option ${selectedId === pack.id ? 'category-option--selected' : ''}`} key={pack.id}>
            <input type="radio" name="category" value={pack.id} checked={selectedId === pack.id} onChange={() => onSelect(pack.id)} />
            <span className="category-icon" aria-hidden="true">{pack.source === 'custom' ? '✦' : pack.packName === 'Animals' ? '◌' : pack.packName === 'Places' ? '⌂' : '◆'}</span>
            <strong className="category-option__name">{pack.packName}</strong>
            <small>{pack.items.length} words</small>
          </label>
        ))}
      </div>
    </section>
  )
}
