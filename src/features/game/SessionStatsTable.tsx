import type { PlayerRole, SessionRecord } from '../../domain/types'

interface SessionStatsTableProps {
  session: SessionRecord
}

const roleLabels: Record<PlayerRole, string> = {
  INNOCENT: 'Innocent',
  IMPOSTOR: 'Impostor',
  JESTER: 'Jester',
  OUTLIER: 'Outlier',
}

const roles = Object.keys(roleLabels) as PlayerRole[]

export default function SessionStatsTable({ session }: SessionStatsTableProps) {
  return <div className="session-stats-wrap">
    <table className="session-stats" aria-label={`${session.name} session stats`}>
      <thead><tr>
        <th>Player</th><th>Rounds</th><th>Total W–L</th><th>By role</th><th>Correct impostor votes</th><th>Wrong Innocent guesses</th><th>Voted for Jester</th><th>Voted out as Jester</th><th>Correct Outlier words</th>
      </tr></thead>
      <tbody>{session.players.map((player) => {
        const stats = session.statsByPlayerId[player.id]
        return <tr key={player.id}>
          <th scope="row">{player.name}</th>
          <td>{stats.roundsPlayed}</td>
          <td>{stats.wins.total}–{stats.losses.total}</td>
          <td><ul className="role-stat-list">{roles.map((role) => <li key={role}>
            <span>{roleLabels[role]}</span> {stats.rolesPlayed[role]} played · {stats.wins.byRole[role]}W/{stats.losses.byRole[role]}L
          </li>)}</ul></td>
          <td>{stats.correctImpostorGuesses}</td>
          <td>{stats.wrongImpostorGuesses}</td>
          <td>{stats.votesForJester}</td>
          <td>{stats.votedOutAsJester}</td>
          <td>{stats.correctOutlierGuesses}</td>
        </tr>
      })}</tbody>
    </table>
    <p className="session-stats-note">Group Vote affects wins and losses, but is not attributed to individual vote counters.</p>
  </div>
}
