import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'

export default function RoleRevealScreen() {
  const game = useGameStore((state) => state.game)!
  const showRole = useGameStore((state) => state.showRole)
  const hideRole = useGameStore((state) => state.hideRole)
  const confirmRole = useGameStore((state) => state.confirmRole)
  const [hasRevealed, setHasRevealed] = useState(false)
  const player = game.players[game.currentRevealIndex]

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
        onPointerDown={reveal}
        onPointerUp={hideRole}
        onPointerCancel={hideRole}
        onPointerLeave={hideRole}
        onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') reveal() }}
        onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') hideRole() }}
      >
        {game.isRoleVisible ? (
          <span className={`role-card role-card--${player.role.toLowerCase()}`} data-testid="private-role">
            {player.role === 'IMPOSTOR' ? <><small>You are the</small><strong>Impostor</strong><em>{game.hintsEnabled ? `Hint: ${game.currentHint}` : 'No hint'}</em></> : <><small>Your word is</small><strong>{game.currentWord}</strong><em>Blend in. Find the impostor.</em></>}
          </span>
        ) : <span className="reveal-instruction"><strong>Hold to reveal</strong><small>Release to hide instantly</small></span>}
      </button>

      <button className="button button--secondary" type="button" disabled={!hasRevealed} onClick={confirmRole}>I’ve seen my role</button>
    </main>
  )
}
