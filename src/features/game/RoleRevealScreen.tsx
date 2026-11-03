import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'

export default function RoleRevealScreen() {
  const game = useGameStore((state) => state.game)!
  const showRole = useGameStore((state) => state.showRole)
  const hideRole = useGameStore((state) => state.hideRole)
  const confirmRole = useGameStore((state) => state.confirmRole)
  const [hasRevealed, setHasRevealed] = useState(false)
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
    window.addEventListener('pointerup', mask)
    window.addEventListener('pointercancel', mask)
    document.addEventListener('visibilitychange', maskWhenHidden)
    return () => {
      window.removeEventListener('blur', mask)
      window.removeEventListener('pointerup', mask)
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
        aria-label="Hold to reveal your role"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          reveal()
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          hideRole()
        }}
        onPointerCancel={hideRole}
        onPointerLeave={hideRole}
        onBlur={hideRole}
        onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') reveal() }}
        onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') hideRole() }}
      >
        {game.isRoleVisible ? (
          <span className={`role-card role-card--${player.role.toLowerCase()}`} data-testid="private-role">
            {roleContent}
          </span>
        ) : <span className="reveal-instruction"><strong>Hold to reveal</strong><small>Release to hide instantly</small></span>}
      </button>

      <button className="button button--secondary" type="button" disabled={!hasRevealed} onClick={confirmRole}>I’ve seen my role</button>
    </main>
  )
}
