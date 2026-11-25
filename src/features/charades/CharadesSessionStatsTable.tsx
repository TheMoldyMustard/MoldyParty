import type { CharadesSessionRecord } from '../../store/charadesStore'

interface CharadesSessionStatsTableProps {
  session: CharadesSessionRecord
}

function percent(correct: number, attempts: number): string {
  return attempts === 0 ? '—' : `${Math.round(correct / attempts * 100)}%`
}

export default function CharadesSessionStatsTable({ session }: CharadesSessionStatsTableProps) {
  const totals = session.players.reduce((result, player) => {
    const stats = session.statsByPlayerId[player.id]
    result.correct += stats.correct
    result.passes += stats.passes
    result.fouls += stats.henyoFouls
    return result
  }, { correct: 0, passes: 0, fouls: 0 })
  const modeLabels: Record<string, string> = { classic: 'Classic', henyo: 'Henyo', 'one-word': 'One-Word', 'team-relay': 'Team Relay' }
  return <>
    <div className="stats-summary" aria-label="Forehead Charades session totals">
      <span><strong>{session.completedTurns}</strong> turns</span>
      <span><strong>{session.completedRelayGames}</strong> relay games</span>
      <span><strong>{totals.correct}</strong> correct</span>
      <span><strong>{totals.passes}</strong> passes</span>
      <span><strong>{percent(totals.correct, totals.correct + totals.passes)}</strong> accuracy</span>
      <span><strong>{totals.fouls}</strong> Henyo fouls</span>
    </div>
    <div className="stats-table-wrap"><table className="stats-table" aria-label={`${session.name} Forehead Charades session stats`}>
      <caption className="sr-only">Cumulative Forehead Charades player statistics for {session.name}</caption>
      <thead><tr><th>Player</th><th>Turns</th><th>Correct</th><th>Passes</th><th>Accuracy</th><th>Correct/min</th><th>Best turn</th><th>Best streak</th><th>Fouls</th><th>Relay W-L-T</th></tr></thead>
      <tbody>{session.players.map((player) => {
        const stats = session.statsByPlayerId[player.id]
        const attempts = stats.correct + stats.passes
        const correctPerMinute = stats.activeDurationMs === 0 ? '—' : (stats.correct / (stats.activeDurationMs / 60_000)).toFixed(1)
        return <tr key={player.id}><th scope="row">{player.name}</th><td>{stats.turnsPlayed}</td><td>{stats.correct}</td><td>{stats.passes}</td><td>{percent(stats.correct, attempts)}</td><td>{correctPerMinute}</td><td>{stats.bestTurn}</td><td>{stats.longestCorrectStreak}</td><td>{stats.henyoFouls}</td><td>{stats.relayWins}-{stats.relayLosses}-{stats.relayTies}</td></tr>
      })}</tbody>
    </table></div>
    <div className="stats-table-wrap"><table className="stats-table" aria-label={`${session.name} mode breakdown`}>
      <caption>Mode breakdown</caption>
      <thead><tr><th>Player</th><th>Mode</th><th>Turns</th><th>Correct</th><th>Passes</th></tr></thead>
      <tbody>{session.players.flatMap((player) => Object.entries(session.statsByPlayerId[player.id].byMode).map(([mode, stats]) => <tr key={`${player.id}-${mode}`}><th scope="row">{player.name}</th><td>{modeLabels[mode] ?? mode}</td><td>{stats.turnsPlayed}</td><td>{stats.correct}</td><td>{stats.passes}</td></tr>))}</tbody>
    </table></div>
    <div className="stats-table-wrap"><table className="stats-table" aria-label={`${session.name} category breakdown`}>
      <caption>Category breakdown</caption>
      <thead><tr><th>Player</th><th>Category</th><th>Attempted</th><th>Correct</th><th>Accuracy</th></tr></thead>
      <tbody>{session.players.flatMap((player) => Object.entries(session.statsByPlayerId[player.id].byCategory).map(([category, stats]) => <tr key={`${player.id}-${category}`}><th scope="row">{player.name}</th><td>{category.replaceAll('-', ' ')}</td><td>{stats.attempted}</td><td>{stats.correct}</td><td>{percent(stats.correct, stats.attempted)}</td></tr>))}</tbody>
    </table></div>
  </>
}
