import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useGameStore } from '../../store/gameStore'
import SessionStatsTable from './SessionStatsTable'

interface SessionManagerScreenProps {
  onBack: () => void
  onCreate: (name: string) => void
  onContinue: (sessionId: string) => void
}

export default function SessionManagerScreen({ onBack, onCreate, onContinue }: SessionManagerScreenProps) {
  const sessionsById = useGameStore((state) => state.sessionsById)
  const deleteSession = useGameStore((state) => state.deleteSession)
  const sessions = useMemo(
    () => Object.values(sessionsById).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [sessionsById],
  )
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null)
  const [isCreating, setIsCreating] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [statsSessionId, setStatsSessionId] = useState<string | null>(null)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const selected = selectedId ? sessionsById[selectedId] : null
  const statsSession = statsSessionId ? sessionsById[statsSessionId] : null
  const pendingDelete = deleteSessionId ? sessionsById[deleteSessionId] : null

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!pendingDelete || !dialog) return
    const deleteTrigger = deleteButtonRef.current
    const background = Array.from(dialog.parentElement?.children ?? []).filter((element) => element !== dialog) as HTMLElement[]
    background.forEach((element) => { element.inert = true })
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    cancelDeleteRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDeleteSessionId(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog!.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      background.forEach((element) => { element.inert = false })
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      deleteTrigger?.focus()
    }
  }, [pendingDelete])

  function submitNewSession(event: FormEvent) {
    event.preventDefault()
    onCreate(sessionName)
  }

  if (statsSession) return <main className="screen session-manager">
    <nav className="topbar"><button className="text-button" type="button" onClick={() => setStatsSessionId(null)}>← Sessions</button><span>Local stats</span></nav>
    <header className="screen-heading"><span className="eyebrow">Session history</span><h1>{statsSession.name} stats</h1><p>{statsSession.completedRounds} completed round{statsSession.completedRounds === 1 ? '' : 's'}.</p></header>
    <SessionStatsTable session={statsSession} />
  </main>

  return <main className="screen session-manager">
    <nav className="topbar"><button className="text-button" type="button" onClick={onBack}>← MoldyParty</button><span>Impostor</span></nav>
    <header className="screen-heading"><span className="eyebrow">Saved locally</span><h1>Impostor sessions</h1><p>Create a group, continue a saved game, or inspect the table.</p></header>

    {sessions.length === 0
      ? <p className="session-empty">No saved sessions yet. Create one to start tracking your group.</p>
      : <section className="session-list" aria-label="Saved sessions">{sessions.map((session) => <button
          aria-label={session.name}
          aria-pressed={selectedId === session.id}
          className={`session-card ${selectedId === session.id ? 'session-card--selected' : ''}`}
          type="button"
          key={session.id}
          onClick={() => setSelectedId(session.id)}
        >
          <strong>{session.name}</strong>
          <span>{session.players.length} players · {session.completedRounds} completed round{session.completedRounds === 1 ? '' : 's'}</span>
          <small>Updated <time dateTime={session.updatedAt}>{new Date(session.updatedAt).toLocaleDateString()}</time></small>
        </button>)}</section>}

    <div className="session-actions" aria-label="Session actions">
      <button className="button button--hero" type="button" onClick={() => setIsCreating(true)}>Create new session</button>
      {selected && <>
        <button className="button button--secondary" type="button" onClick={() => onContinue(selected.id)}>Continue a session</button>
        <button className="button button--secondary" type="button" onClick={() => setStatsSessionId(selected.id)}>View session stats</button>
        <button ref={deleteButtonRef} className="button button--danger" type="button" onClick={() => setDeleteSessionId(selected.id)}>Delete session</button>
      </>}
    </div>

    {isCreating && <form className="session-create" onSubmit={submitNewSession}>
      <label>Session name<input aria-label="Session name" autoFocus value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="Friday Crew" /></label>
      <div className="button-row"><button className="button button--hero" type="submit">Set up session</button><button className="button button--secondary" type="button" onClick={() => setIsCreating(false)}>Cancel</button></div>
    </form>}

    {pendingDelete && <dialog ref={deleteDialogRef} className="session-dialog" aria-labelledby="delete-session-title" aria-describedby="delete-session-description" onCancel={(event) => { event.preventDefault(); setDeleteSessionId(null) }}>
      <span className="eyebrow">Delete local data</span>
      <h2 id="delete-session-title">Delete {pendingDelete.name}?</h2>
      <p id="delete-session-description">This permanently removes its stats and any unfinished round from this browser.</p>
      <div className="button-row"><button className="button button--danger" type="button" onClick={() => { deleteSession(pendingDelete.id); setDeleteSessionId(null); setSelectedId(null) }}>Delete {pendingDelete.name}</button><button ref={cancelDeleteRef} className="button button--secondary" type="button" onClick={() => setDeleteSessionId(null)}>Cancel</button></div>
    </dialog>}
  </main>
}
