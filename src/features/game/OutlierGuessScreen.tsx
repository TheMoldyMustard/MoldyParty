import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import PassDeviceMask from './PassDeviceMask'

export default function OutlierGuessScreen() {
  const game = useGameStore((state) => state.game)!
  const isReady = useGameStore((state) => state.isOutlierGuessReady)
  const pendingGuess = useGameStore((state) => state.pendingOutlierGuess)
  const showGuess = useGameStore((state) => state.showOutlierGuess)
  const hideGuess = useGameStore((state) => state.hideOutlierGuess)
  const setGuess = useGameStore((state) => state.setOutlierGuess)
  const confirmGuess = useGameStore((state) => state.confirmOutlierGuess)
  const outliers = game.players.filter((player) => player.role === 'OUTLIER')
  const outlier = outliers[game.currentOutlierGuessIndex]

  useEffect(() => {
    const maskWhenHidden = () => {
      if (document.visibilityState !== 'visible') hideGuess()
    }
    window.addEventListener('blur', hideGuess)
    window.addEventListener('pagehide', hideGuess)
    document.addEventListener('visibilitychange', maskWhenHidden)
    return () => {
      window.removeEventListener('blur', hideGuess)
      window.removeEventListener('pagehide', hideGuess)
      document.removeEventListener('visibilitychange', maskWhenHidden)
    }
  }, [hideGuess])

  if (!outlier) return null

  if (!isReady) {
    return <PassDeviceMask
      playerName={outlier.name}
      eyebrow="Private Outlier guess"
      actionLabel={`I’m ${outlier.name}`}
      onReady={showGuess}
      round={game.round}
    />
  }

  return (
    <main className="screen private-screen outlier-guess-screen">
      <span className="eyebrow">Outlier’s private guess</span>
      <h1>Guess the secret word</h1>
      <p>Your answer stays hidden until every private action is complete.</p>
      <label className="guess-card">
        <span>Your word guess</span>
        <input
          autoComplete="off"
          autoFocus
          value={pendingGuess}
          onChange={(event) => setGuess(event.target.value)}
        />
      </label>
      <button
        className="button button--hero"
        type="button"
        disabled={!pendingGuess.trim()}
        onClick={confirmGuess}
      >
        Lock in guess
      </button>
    </main>
  )
}
