import { getTeamScores, type CharadesSession } from '../../domain/charades'

interface SessionSummaryScreenProps {
  session: CharadesSession
  onExit: () => void
}

export default function SessionSummaryScreen({ session, onExit }: SessionSummaryScreenProps) {
  const teams = session.settings.teams
  const scores = getTeamScores(session)
  if (!teams) return null
  const best = Math.max(...scores)
  const tied = scores[0] === scores[1]
  return <main className="screen charades-summary-screen">
    <span className="eyebrow">Team Relay complete</span>
    <h1>{tied ? 'It’s a tie!' : `${teams[scores[0] === best ? 0 : 1].name} wins!`}</h1>
    <div className="relay-scoreboard">{teams.map((team, index) => <article className={scores[index] === best ? 'relay-score relay-score--leader' : 'relay-score'} key={team.id}><strong>{team.name}</strong><span>{scores[index]} points</span><small>{session.teamTurnCounts[index]} turns</small></article>)}</div>
    <button className="button button--hero" type="button" onClick={onExit}>Return to sessions</button>
  </main>
}
