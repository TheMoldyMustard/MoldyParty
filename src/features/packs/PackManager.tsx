import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { WordItem, WordPack } from '../../domain/types'
import { packRepository, type PackRepository } from './packDb'
import { parseWordPackJson, serializeWordPack } from './packParser'
import AiPromptHelper from './AiPromptHelper'

interface PackManagerProps {
  repository?: PackRepository
  onPacksChanged?: (packs: WordPack[]) => void
}

const emptyItem = (): WordItem => ({ word: '', hint: '' })

export default function PackManager({
  repository = packRepository,
  onPacksChanged,
}: PackManagerProps) {
  const [mode, setMode] = useState<'manual' | 'import'>('manual')
  const [packName, setPackName] = useState('')
  const [items, setItems] = useState<WordItem[]>([emptyItem()])
  const [jsonText, setJsonText] = useState('')
  const [savedPacks, setSavedPacks] = useState<WordPack[]>([])
  const [message, setMessage] = useState('')
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
    const normalizedItems = items
      .map((item) => {
        const hint = item.hint.trim()
        return {
          word: item.word.trim(),
          hint,
          ...(item.hints?.length ? {
            hints: item.hints.map((storedHint, index) => index === 0 ? hint : storedHint.trim()),
          } : {}),
        }
      })
      .filter((item) => item.word)
    const result = parseWordPackJson(JSON.stringify({
      packName,
      category: 'Custom',
      items: normalizedItems,
    }))
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    const existing = editingPackId ? savedPacks.find((pack) => pack.id === editingPackId) : undefined
    await repository.put(existing ? {
      ...result.pack,
      id: existing.id,
      createdAt: existing.createdAt,
    } : result.pack)
    setMessage(existing ? 'Pack updated on this device.' : 'Pack saved on this device.')
    setEditingPackId(null)
    setPackName('')
    setItems([emptyItem()])
    await refresh()
  }

  async function importPack() {
    if (!parsedImport.ok) return
    await repository.put(parsedImport.pack)
    setMessage('Pack imported on this device.')
    setJsonText('')
    await refresh()
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
    setItems(pack.items.map((item) => ({ ...item })))
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
        <button role="tab" aria-selected={mode === 'import'} onClick={() => setMode('import')}>Import JSON</button>
      </div>

      {mode === 'manual' ? (
        <div className="stack">
          <label>Pack name<input value={packName} onChange={(event) => setPackName(event.target.value)} /></label>
          {items.map((item, index) => (
            <div className="word-row" key={index}>
              <label>Word {index + 1}<input value={item.word} onChange={(event) => updateItem(index, 'word', event.target.value)} /></label>
              <label>Hint {index + 1}<input value={item.hint} onChange={(event) => updateItem(index, 'hint', event.target.value)} /></label>
              {items.length > 1 && <button className="icon-button" aria-label={`Remove word ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
            </div>
          ))}
          <div className="button-row">
            <button className="button button--secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>Add another word</button>
            {editingPackId && <button className="text-button" type="button" onClick={() => { setEditingPackId(null); setPackName(''); setItems([emptyItem()]) }}>Cancel edit</button>}
            <button className="button" onClick={() => void saveManualPack()}>{editingPackId ? 'Update pack' : 'Save pack'}</button>
          </div>
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

      {message && <p className="status-message" role="status">{message}</p>}

      <div className="saved-packs">
        <h3>Saved on this device</h3>
        {savedPacks.length === 0 ? <p className="muted">No custom packs yet.</p> : savedPacks.map((pack) => (
          <article className="saved-pack" key={pack.id}>
            <div><strong>{pack.packName}</strong><span>{pack.items.length} words</span></div>
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
