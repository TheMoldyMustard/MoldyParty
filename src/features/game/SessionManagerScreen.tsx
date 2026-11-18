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
  const renameSession = useGameStore((state) => state.renameSession)
  const deleteSession = useGameStore((state) => state.deleteSession)
  const sessions = useMemo(
    () => Object.values(sessionsById).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [sessionsById],
  )
  const [isCreating, setIsCreating] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [statsSessionId, setStatsSessionId] = useState<string | null>(null)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [postDeleteFocus, setPostDeleteFocus] = useState<{ sessionId: string | null } | null>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const continueButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const renameTriggerRef = useRef<HTMLButtonElement | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const renameDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const statsSession = statsSessionId ? sessionsById[statsSessionId] : null
  const pendingRename = renameSessionId ? sessionsById[renameSessionId] : null
  const pendingDelete = deleteSessionId ? sessionsById[deleteSessionId] : null

  useEffect(() => {
    if (!postDeleteFocus) return
    if (postDeleteFocus.sessionId) continueButtonRefs.current.get(postDeleteFocus.sessionId)?.focus()
    else createButtonRef.current?.focus()
  }, [postDeleteFocus])

  useEffect(() => {
    const dialog = renameDialogRef.current
    if (!pendingRename || !dialog) return
    const trigger = renameTriggerRef.current
    const background = Array.from(dialog.parentElement?.children ?? []).filter((element) => element !== dialog) as HTMLElement[]
    background.forEach((element) => { element.inert = true })
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    renameInputRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setRenameSessionId(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
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
      trigger?.focus()
    }
  }, [pendingRename])

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!pendingDelete || !dialog) return
    const trigger = deleteTriggerRef.current
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
      trigger?.focus()
    }
  }, [pendingDelete])

  function submitNewSession(event: FormEvent) {
    event.preventDefault()
    onCreate(sessionName)
  }

  function submitRename(event: FormEvent) {
    event.preventDefault()
    if (!pendingRename || !renameValue.trim()) return
    renameSession(pendingRename.id, renameValue)
    setRenameSessionId(null)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const index = sessions.findIndex((session) => session.id === pendingDelete.id)
    const nextSession = sessions[index + 1] ?? sessions[index - 1]
    setPostDeleteFocus({ sessionId: nextSession?.id ?? null })
    deleteSession(pendingDelete.id)
    setDeleteSessionId(null)
  }

  if (statsSession) return <main className="screen session-manager">
    <nav className="topbar"><button className="text-button" type="button" onClick={() => setStatsSessionId(null)}>← Sessions</button><span>Local stats</span></nav>
    <header className="screen-heading"><span className="eyebrow">Session history</span><h1>{statsSession.name} stats</h1><p>{statsSession.completedRounds} completed round{statsSession.completedRounds === 1 ? '' : 's'}.</p></header>
    <SessionStatsTable session={statsSession} />
  </main>

  return <main className="screen session-manager">
    <nav className="topbar"><button className="text-button" type="button" onClick={onBack}>← MoldyParty</button><span>Impostor</span></nav>
    <header className="screen-heading"><span className="eyebrow">Saved locally</span><h1>Impostor sessions</h1><p>Choose a session to continue, or use its quick actions.</p></header>

    {sessions.length === 0
      ? <p className="session-empty">No saved sessions yet. Create one to start tracking your group.</p>
      : <section className="session-list" aria-label="Saved sessions">{sessions.map((session) => <article className="session-card" key={session.id}>
          <button
            aria-label={`Continue ${session.name}`}
            className="session-card__primary"
            type="button"
            ref={(element) => {
              if (element) continueButtonRefs.current.set(session.id, element)
              else continueButtonRefs.current.delete(session.id)
            }}
            onClick={() => onContinue(session.id)}
          >
            <strong>{session.name}</strong>
            <span>{session.players.length} players · {session.completedRounds} completed round{session.completedRounds === 1 ? '' : 's'}</span>
            <small>Updated <time dateTime={session.updatedAt}>{new Date(session.updatedAt).toLocaleDateString()}</time></small>
          </button>
          <div className="session-card__actions" aria-label={`Actions for ${session.name}`}>
            <button className="session-card__icon" type="button" aria-label={`Rename ${session.name}`} title="Rename session" onClick={(event) => { renameTriggerRef.current = event.currentTarget; setRenameValue(session.name); setRenameSessionId(session.id) }}><span aria-hidden="true">✎</span></button>
            <button className="session-card__icon" type="button" aria-label={`View stats for ${session.name}`} title="View stats" onClick={() => setStatsSessionId(session.id)}><span aria-hidden="true">▥</span></button>
            <button className="session-card__icon session-card__icon--danger" type="button" aria-label={`Delete ${session.name}`} title="Delete session" onClick={(event) => { deleteTriggerRef.current = event.currentTarget; setDeleteSessionId(session.id) }}><span aria-hidden="true">×</span></button>
          </div>
        </article>)}</section>}

    <div className="session-actions" aria-label="Session actions">
      <button ref={createButtonRef} className="button button--hero" type="button" onClick={() => setIsCreating(true)}>Create new session</button>
    </div>

    {isCreating && <form className="session-create" onSubmit={submitNewSession}>
      <label>Session name<input aria-label="Session name" autoFocus value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder="Friday Crew" /></label>
      <div className="button-row"><button className="button button--hero" type="submit">Set up session</button><button className="button button--secondary" type="button" onClick={() => setIsCreating(false)}>Cancel</button></div>
    </form>}

    {pendingRename && <dialog ref={renameDialogRef} className="session-dialog" aria-labelledby="rename-session-title">
      <form onSubmit={submitRename}>
        <span className="eyebrow">Edit local session</span>
        <h2 id="rename-session-title">Rename {pendingRename.name}</h2>
        <label>Session name<input ref={renameInputRef} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></label>
        <div className="button-row"><button className="button button--hero" type="submit" disabled={!renameValue.trim()}>Save session name</button><button className="button button--secondary" type="button" onClick={() => setRenameSessionId(null)}>Cancel</button></div>
      </form>
    </dialog>}

    {pendingDelete && <dialog ref={deleteDialogRef} className="session-dialog" aria-labelledby="delete-session-title" aria-describedby="delete-session-description" onCancel={(event) => { event.preventDefault(); setDeleteSessionId(null) }}>
      <span className="eyebrow">Delete local data</span>
      <h2 id="delete-session-title">Delete {pendingDelete.name}?</h2>
      <p id="delete-session-description">This permanently removes its stats and any unfinished round from this browser.</p>
      <div className="button-row"><button className="button button--danger" type="button" onClick={confirmDelete}>Delete {pendingDelete.name}</button><button ref={cancelDeleteRef} className="button button--secondary" type="button" onClick={() => setDeleteSessionId(null)}>Cancel</button></div>
    </dialog>}
  </main>
}
