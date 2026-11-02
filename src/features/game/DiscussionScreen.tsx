import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function DiscussionScreen() {
  const game = useGameStore((state) => state.game)!
  const beginVoting = useGameStore((state) => state.beginVoting)
  const remaining = useGameStore((state) => state.discussionRemainingSeconds) ?? 0
  const running = useGameStore((state) => state.isDiscussionTimerRunning)
  const pauseTimer = useGameStore((state) => state.pauseDiscussionTimer)
  const resumeTimer = useGameStore((state) => state.resumeDiscussionTimer)
  const syncTimer = useGameStore((state) => state.syncDiscussionTimer)
  const initialSeconds = game.discussionDurationSeconds

  useEffect(() => {
    syncTimer()
    if (!running) return
    const timer = window.setInterval(syncTimer, 500)
    return () => window.clearInterval(timer)
  }, [running, syncTimer])

  return (
    <main className="screen discussion-screen">
      <span className="eyebrow">Everyone can look</span>
      <h1>Discussion time</h1>
      <p>Describe the secret word without making it too obvious.</p>
      {initialSeconds !== null ? (
        <div className="timer-card">
          <strong aria-live="polite">{formatTime(remaining)}</strong>
          <button className="button button--secondary" type="button" onClick={running ? pauseTimer : resumeTimer}>{running ? 'Pause timer' : 'Resume timer'}</button>
        </div>
      ) : <div className="timer-card timer-card--open"><strong>Open discussion</strong><span>No timer this round</span></div>}
      <div className="discussion-tips"><span>Ask specifics</span><span>Watch reactions</span><span>Defend your clues</span></div>
      <button className="button button--hero" type="button" onClick={beginVoting}>Proceed to voting</button>
    </main>
  )
}
