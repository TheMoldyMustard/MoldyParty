import { useEffect, useRef, useState } from 'react'

interface AbortGameDialogProps {
  onConfirm: () => void
}

export default function AbortGameDialog({ onConfirm }: AbortGameDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return
    const trigger = triggerRef.current
    const background = Array.from(dialog.parentElement?.children ?? []).filter((element) => element !== dialog) as HTMLElement[]
    background.forEach((element) => { element.inert = true })
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    cancelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
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
  }, [isOpen])

  return <>
    <button ref={triggerRef} className="abort-game-trigger button button--danger" type="button" onClick={() => setIsOpen(true)}>Abort game</button>
    {isOpen && <dialog ref={dialogRef} className="session-dialog" aria-labelledby="abort-game-title" onCancel={(event) => { event.preventDefault(); setIsOpen(false) }}>
      <span className="eyebrow">Discard unfinished round</span>
      <h2 id="abort-game-title">Abort this game?</h2>
      <p>This clears the current round. Completed session stats stay unchanged.</p>
      <div className="button-row">
        <button className="button button--danger" type="button" onClick={() => { onConfirm(); setIsOpen(false) }}>Abort game</button>
        <button ref={cancelRef} className="button button--secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
      </div>
    </dialog>}
  </>
}
