import type { CategoryBombSessionRecord } from '../../store/categoryBombStore'

interface CategoryBombSessionStatsTableProps {
  session: CategoryBombSessionRecord
}

export default function CategoryBombSessionStatsTable({ session }: CategoryBombSessionStatsTableProps) {
  const answersPerBomb = session.completedBombs === 0 ? '—' : (session.totalSuccessfulAnswers / session.completedBombs).toFixed(1)
  const survivalRate = (playerId: string) => {
    const stats = session.statsByPlayerId[playerId]
    return stats.bombsPlayed === 0 ? '—' : `${Math.round((stats.bombsPlayed - stats.explosions) / stats.bombsPlayed * 100)}%`
  }
  return <>
    <div className="stats-summary" aria-label="Category Bomb session totals">
      <span><strong>{session.completedBombs}</strong> bombs</span>
      <span><strong>{session.totalSuccessfulAnswers}</strong> successful answers</span>
      <span><strong>{answersPerBomb}</strong> answers/bomb</span>
      <span><strong>{session.longestBomb}</strong> longest bomb</span>
      <span><strong>{session.timerExplosions}/{session.foulExplosions}</strong> timer/foul</span>
    </div>
    <div className="stats-table-wrap"><table className="stats-table" aria-label={`${session.name} Category Bomb session stats`}>
      <caption className="sr-only">Cumulative Category Bomb player statistics for {session.name}</caption>
      <thead><tr><th>Player</th><th>Bombs</th><th>Answers</th><th>Explosions</th><th>Timer</th><th>Foul</th><th>Survival</th><th>Best bomb</th></tr></thead>
      <tbody>{session.players.map((player) => {
        const stats = session.statsByPlayerId[player.id]
        return <tr key={player.id}><th scope="row">{player.name}</th><td>{stats.bombsPlayed}</td><td>{stats.successfulAnswers}</td><td>{stats.explosions}</td><td>{stats.timerExplosions}</td><td>{stats.foulExplosions}</td><td>{survivalRate(player.id)}</td><td>{stats.bestBomb}</td></tr>
      })}</tbody>
    </table></div>
    {Object.keys(session.categoryStatsById).length > 0 && <div className="stats-table-wrap"><table className="stats-table" aria-label={`${session.name} Category Bomb category history`}>
      <caption>Category history</caption>
      <thead><tr><th>Category</th><th>Bombs</th><th>Explosions</th></tr></thead>
      <tbody>{Object.entries(session.categoryStatsById).sort(([first], [second]) => first.localeCompare(second)).map(([categoryId, stats]) => <tr key={categoryId}><th scope="row">{categoryId.replaceAll('-', ' ')}</th><td>{stats.bombsPlayed}</td><td>{stats.explosions}</td></tr>)}</tbody>
    </table></div>}
  </>
}
