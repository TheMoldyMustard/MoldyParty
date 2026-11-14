import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { CharadesCategory, CharadesVibe, WordItem, WordPack } from '../../domain/types'
import { eligibleItems } from '../../domain/packCompatibility'
import { packRepository, type PackRepository } from './packDb'
import { parseWordPackJson, serializeWordPack } from './packParser'
import { parseManualHints } from './manualHints'
import AiPromptHelper from './AiPromptHelper'

interface PackManagerProps {
  repository?: PackRepository
  onPacksChanged?: (packs: WordPack[]) => void
  onImported?: (packId: string) => void
}

const emptyItem = (): WordItem => ({ word: '', hint: '' })

export default function PackManager({
  repository = packRepository,
  onPacksChanged,
  onImported,
}: PackManagerProps) {
  const [mode, setMode] = useState<'manual' | 'bulk' | 'import'>('manual')
  const [packName, setPackName] = useState('')
  const [items, setItems] = useState<WordItem[]>([emptyItem()])
  const [bulkWords, setBulkWords] = useState('')
  const [bulkCategory, setBulkCategory] = useState<CharadesCategory>('other')
  const [bulkVibes, setBulkVibes] = useState<CharadesVibe[]>([])
  const [jsonText, setJsonText] = useState('')
  const [savedPacks, setSavedPacks] = useState<WordPack[]>([])
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'status' | 'alert'>('status')
  const [editingPackId, setEditingPackId] = useState<string | null>(null)
  const parsedImport = useMemo(() => parseWordPackJson(jsonText), [jsonText])

  const refresh = useCallback(async () => {
    const packs = await repository.list()
    setSavedPacks(packs)
    onPacksChanged?.(packs)
  }, [onPacksChanged, repository])

  useEffect(() => {
    let active = true
    void repository.list().then((packs) => {
      if (active) {
        setSavedPacks(packs)
        onPacksChanged?.(packs)
      }
    })
    return () => { active = false }
  }, [onPacksChanged, repository])

  function updateItem(index: number, field: keyof WordItem, value: string) {
    setItems((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    ))
  }

  async function saveManualPack() {
    const existing = editingPackId ? savedPacks.find((pack) => pack.id === editingPackId) : undefined
    const normalizedItems = items
      .map((item) => {
        const hints = parseManualHints(item.hint ?? '')
        const hint = hints[0] ?? ''
        return {
          word: item.word.trim(),
          ...(hint ? { hint } : {}),
          ...(hints.length > 1 ? { hints } : {}),
          ...(item.charadesOnly === true ? { charadesOnly: true } : {}),
          ...(item.category ? { category: item.category } : {}),
          ...(item.vibes ? { vibes: item.vibes } : {}),
        }
      })
      .filter((item) => item.word)
    const result = parseWordPackJson(JSON.stringify({
      packName,
      category: existing?.category ?? 'Custom',
      items: normalizedItems,
    }))
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    await repository.put(existing ? {
      ...result.pack,
      id: existing.id,
      createdAt: existing.createdAt,
    } : result.pack)
    setMessage(existing ? 'Pack updated on this device.' : 'Pack saved on this device.')
    setMessageKind('status')
    setEditingPackId(null)
    setPackName('')
    setItems([emptyItem()])
    await refresh()
  }

  async function saveBulkPack() {
    const words = bulkWords.split(/\r?\n/).map((word) => word.trim()).filter(Boolean)
    const result = parseWordPackJson(JSON.stringify({
      packName,
      category: 'Mixed',
      items: words.map((word) => ({
        word,
        charadesOnly: true,
        category: bulkCategory,
        vibes: bulkVibes,
      })),
    }))
    if (!result.ok) {
      setMessage(result.error)
      setMessageKind('alert')
      return
    }
    await repository.put(result.pack)
    setMessage('Charades pack saved on this device.')
    setMessageKind('status')
    setPackName('')
    setBulkWords('')
    await refresh()
  }

  function toggleBulkVibe(vibe: CharadesVibe) {
    setBulkVibes((current) => current.includes(vibe)
      ? current.filter((candidate) => candidate !== vibe)
      : [...current, vibe])
  }

  async function importPack() {
    if (!parsedImport.ok) return
    try {
      await repository.put(parsedImport.pack)
      setMessage('Pack imported on this device.')
      setMessageKind('status')
      setJsonText('')
      await refresh()
      onImported?.(parsedImport.pack.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The pack could not be imported.')
      setMessageKind('alert')
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setJsonText(await file.text())
  }

  async function renamePack(pack: WordPack) {
    const nextName = window.prompt('Rename pack', pack.packName)
    if (nextName && nextName.trim() !== pack.packName) {
      await repository.rename(pack.id, nextName)
      await refresh()
    }
  }

  function editPack(pack: WordPack) {
    setMode('manual')
    setEditingPackId(pack.id)
    setPackName(pack.packName)
    setItems(pack.items.map((item) => ({
      ...item,
      hint: item.hints?.join(', ') ?? item.hint,
    })))
    setMessage('')
  }

  async function deletePack(pack: WordPack) {
    if (window.confirm(`Delete “${pack.packName}”?`)) {
      await repository.delete(pack.id)
      await refresh()
    }
  }

  function exportPack(pack: WordPack) {
    const blob = new Blob([serializeWordPack(pack)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${pack.packName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel pack-manager" aria-labelledby="pack-manager-title">
      <div className="section-heading">
        <div><span className="eyebrow">Your library</span><h2 id="pack-manager-title">Custom packs</h2></div>
      </div>

      <div className="tabs" role="tablist" aria-label="Custom pack input method">
        <button role="tab" aria-selected={mode === 'manual'} onClick={() => setMode('manual')}>Manual entry</button>
        <button role="tab" aria-selected={mode === 'bulk'} onClick={() => setMode('bulk')}>Charades bulk</button>
        <button role="tab" aria-selected={mode === 'import'} onClick={() => setMode('import')}>Import JSON</button>
      </div>

      {mode === 'manual' ? (
        <div className="stack">
          <label>Pack name<input value={packName} onChange={(event) => setPackName(event.target.value)} /></label>
          <aside className="hint-format-guide" role="note">
            <strong>Hint input guide</strong>
            <p>Enter one hint, or several separated by commas. Parentheses, square brackets, and quoted tuple values are accepted.</p>
            <code>Creation, Journey, Night</code>
            <code>(Creation, Journey, Night)</code>
            <small>When multiple hints are entered, one hint is chosen randomly at the start of each round.</small>
          </aside>
          {items.map((item, index) => (
            <div className="word-row" key={index}>
              <label>Word {index + 1}<input value={item.word} onChange={(event) => updateItem(index, 'word', event.target.value)} /></label>
              <label>Hints {index + 1}<input aria-label={`Hint ${index + 1}`} placeholder="Creation, Journey, Night" value={item.hint ?? ''} onChange={(event) => updateItem(index, 'hint', event.target.value)} /></label>
              {items.length > 1 && <button className="icon-button" aria-label={`Remove word ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
            </div>
          ))}
          <div className="button-row">
            <button className="button button--secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>Add another word</button>
            {editingPackId && <button className="text-button" type="button" onClick={() => { setEditingPackId(null); setPackName(''); setItems([emptyItem()]) }}>Cancel edit</button>}
            <button className="button" onClick={() => void saveManualPack()}>{editingPackId ? 'Update pack' : 'Save pack'}</button>
          </div>
        </div>
      ) : mode === 'bulk' ? (
        <div className="stack">
          <label>Charades pack name<input value={packName} onChange={(event) => setPackName(event.target.value)} /></label>
          <label>Words (one per line)<textarea rows={10} value={bulkWords} onChange={(event) => setBulkWords(event.target.value)} /></label>
          <span className="muted">{bulkWords.split(/\r?\n/).filter((word) => word.trim()).length} words</span>
          <label>Default category<select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value as CharadesCategory)}>
            <option value="person">Person / Tao</option>
            <option value="place">Place / Lugar</option>
            <option value="object">Object / Bagay</option>
            <option value="animal">Animal / Hayop</option>
            <option value="food">Food / Pagkain</option>
            <option value="pop-culture">Pop Culture</option>
            <option value="other">Other / Iba</option>
          </select></label>
          <fieldset className="rule-group"><legend>Default vibes</legend>
            <label><input type="checkbox" checked={bulkVibes.includes('casual')} onChange={() => toggleBulkVibe('casual')} /> Casual</label>
            <label><input type="checkbox" checked={bulkVibes.includes('pop-culture-local')} onChange={() => toggleBulkVibe('pop-culture-local')} /> Pop Culture / Local</label>
            <label><input type="checkbox" checked={bulkVibes.includes('chaos-hard')} onChange={() => toggleBulkVibe('chaos-hard')} /> Chaos / Hard</label>
          </fieldset>
          <button className="button" type="button" onClick={() => void saveBulkPack()}>Save Charades pack</button>
        </div>
      ) : (
        <div className="stack">
          <label>Paste pack JSON<textarea rows={9} value={jsonText} onChange={(event) => setJsonText(event.target.value)} /></label>
          <label className="file-input">Or choose a JSON file<input type="file" accept="application/json,.json" onChange={(event) => void uploadFile(event)} /></label>
          {jsonText && !parsedImport.ok && <p className="form-error" role="alert">{parsedImport.error}</p>}
          {parsedImport.ok && <div className="import-preview"><strong>{parsedImport.pack.packName}</strong><span>{parsedImport.pack.items.length} words ready</span></div>}
          <button className="button" disabled={!parsedImport.ok} onClick={() => void importPack()}>Import pack</button>
        </div>
      )}

      {message && <p className={messageKind === 'alert' ? 'status-message status-message--error' : 'status-message'} role={messageKind}>{message}</p>}

      <div className="saved-packs">
        <h3>Saved on this device</h3>
        {savedPacks.length === 0 ? <p className="muted">No custom packs yet.</p> : savedPacks.map((pack) => (
          <article className="saved-pack" key={pack.id}>
            <div><strong>{pack.packName}</strong><span>Impostor {eligibleItems(pack, 'impostor').length} · Charades {eligibleItems(pack, 'charades').length}</span></div>
            <details><summary>Preview</summary><p>{pack.items.map((item) => item.word).join(' · ')}</p></details>
            <div className="button-row button-row--compact">
              <button aria-label={`Edit ${pack.packName}`} onClick={() => editPack(pack)}>Edit</button>
              <button onClick={() => void renamePack(pack)}>Rename</button>
              <button onClick={() => exportPack(pack)}>Export</button>
              <button className="danger" onClick={() => void deletePack(pack)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      <AiPromptHelper />
    </section>
  )
}
