import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'

const REVEAL_DISTANCE_PX = 56

export default function RoleRevealScreen() {
  const game = useGameStore((state) => state.game)!
  const showRole = useGameStore((state) => state.showRole)
  const hideRole = useGameStore((state) => state.hideRole)
  const confirmRole = useGameStore((state) => state.confirmRole)
  const [hasRevealed, setHasRevealed] = useState(false)
  const gestureStart = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const player = game.players[game.currentRevealIndex]

  const roleContent = (() => {
    switch (player.role) {
      case 'IMPOSTOR':
        return <><small>You are the</small><strong>Impostor</strong><em>{game.hintsEnabled ? `Hint: ${game.currentHint}` : 'No hint'}</em></>
      case 'JESTER':
        return <><small>You are the</small><strong>Jester</strong><em>Get yourself voted out</em></>
      case 'OUTLIER':
        return <><small>You are the</small><strong>Outlier</strong><em>Guess the secret word after voting</em><em>{game.outlierHintsEnabled ? `Hint: ${game.currentHint}` : 'No hint'}</em></>
      case 'INNOCENT':
        return <><small>Your word is</small><strong>{game.currentWord}</strong><em>Blend in. Find the impostor.</em></>
    }
  })()

  useEffect(() => {
    const mask = () => hideRole()
    const maskWhenHidden = () => { if (document.visibilityState !== 'visible') hideRole() }
    window.addEventListener('blur', mask)
    window.addEventListener('pointercancel', mask)
    document.addEventListener('visibilitychange', maskWhenHidden)
    return () => {
      window.removeEventListener('blur', mask)
      window.removeEventListener('pointercancel', mask)
      document.removeEventListener('visibilitychange', maskWhenHidden)
    }
  }, [hideRole])

  function reveal() { setHasRevealed(true); showRole() }

  return (
    <main className="screen private-screen">
      <span className="round-badge">Round {game.round}</span>
      <span className="eyebrow">Secret role · {game.currentRevealIndex + 1} of {game.players.length}</span>
      <h1>Pass to {player.name}</h1>
      <p>Shield the screen. Only {player.name} should look.</p>

      <button
        className="reveal-pad"
        type="button"
        aria-label="Drag up to reveal your role"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          gestureStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          const start = gestureStart.current
          if (!start || start.pointerId !== event.pointerId || game.isRoleVisible) return
          const deltaY = start.y - event.clientY
          const deltaX = Math.abs(event.clientX - start.x)
          if (deltaY >= REVEAL_DISTANCE_PX && deltaY > deltaX) reveal()
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          gestureStart.current = null
        }}
        onPointerCancel={() => { gestureStart.current = null; hideRole() }}
        onBlur={hideRole}
        onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') reveal() }}
      >
        {game.isRoleVisible ? (
          <span className={`role-card role-card--${player.role.toLowerCase()}`} data-testid="private-role">
            {roleContent}
          </span>
        ) : <span className="reveal-instruction"><strong>Drag up to reveal</strong><small>Swipe upward, then tap when you’re done</small></span>}
      </button>

      <button className="button button--secondary" type="button" disabled={!hasRevealed} onClick={confirmRole}>I’ve seen my role</button>
    </main>
  )
}
