import { useState } from 'react'
import type { CharadesSession } from '../../domain/charades'
import { charadesStore } from '../../store/charadesStore'

interface RoundSummaryScreenProps {
  session: CharadesSession
  onExit: () => void
}

export default function RoundSummaryScreen({ session, onExit }: RoundSummaryScreenProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const summary = session.turnSummaries.at(-1)
  if (!summary) return null
  return <main className="screen charades-summary-screen">
    <span className="eyebrow">{summary.teamName ?? summary.holderName}</span>
    <h1>Round recap</h1>
    <strong className="summary-score">{summary.score} {summary.score === 1 ? 'point' : 'points'}</strong>
    <ol className="charades-word-review">
      {summary.events.map((event, index) => event.type === 'foul'
        ? <li className="word-review word-review--foul" key={`foul-${event.occurredAtMs}-${index}`}>Foul · -5 seconds</li>
        : <li className={`word-review word-review--${event.outcome}`} key={`${event.key}-${event.occurredAtMs}`}>
          <button type="button" aria-expanded={selectedWord === `${event.key}-${index}`} onClick={() => setSelectedWord((current) => current === `${event.key}-${index}` ? null : `${event.key}-${index}`)}>
            <span aria-hidden="true">{event.outcome === 'correct' ? '✓' : '↷'}</span> {event.word}
          </button>
          {selectedWord === `${event.key}-${index}` && <small>{event.outcome === 'correct' ? 'Guessed correctly' : 'Passed'} · {event.category}</small>}
        </li>)}
    </ol>
    <div className="button-row">
      <button className="button" type="button" onClick={() => charadesStore.getState().advanceFromSummary()}>{session.settings.mode === 'team-relay' ? 'Next turn' : 'Play another round'}</button>
      <button className="button button--secondary" type="button" onClick={onExit}>Finish</button>
    </div>
  </main>
}
