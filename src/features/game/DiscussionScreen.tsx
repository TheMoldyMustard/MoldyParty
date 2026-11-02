import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function DiscussionScreen() {
  const game = useGameStore((state) => state.game)!
  const beginVoting = useGameStore((state) => state.beginVoting)
  const initialSeconds = game.discussionDurationSeconds
  const [remaining, setRemaining] = useState(initialSeconds ?? 0)
  const [running, setRunning] = useState(initialSeconds !== null)

  useEffect(() => {
    if (!running || remaining <= 0) return
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [remaining, running])

  return (
    <main className="screen discussion-screen">
      <span className="eyebrow">Everyone can look</span>
      <h1>Discussion time</h1>
      <p>Describe the secret word without making it too obvious.</p>
      {initialSeconds !== null ? (
        <div className="timer-card">
          <strong aria-live="polite">{formatTime(remaining)}</strong>
          <button className="button button--secondary" type="button" onClick={() => setRunning((value) => !value)}>{running ? 'Pause timer' : 'Resume timer'}</button>
        </div>
      ) : <div className="timer-card timer-card--open"><strong>Open discussion</strong><span>No timer this round</span></div>}
      <div className="discussion-tips"><span>Ask specifics</span><span>Watch reactions</span><span>Defend your clues</span></div>
      <button className="button button--hero" type="button" onClick={beginVoting}>Proceed to voting</button>
    </main>
  )
}
