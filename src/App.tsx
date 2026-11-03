import { useState } from 'react'
import InstallPrompt from './components/InstallPrompt'
import UpdatePrompt from './components/UpdatePrompt'
import DiscussionScreen from './features/game/DiscussionScreen'
import GameOverScreen from './features/game/GameOverScreen'
import LobbyScreen, { type LobbyDraft } from './features/game/LobbyScreen'
import OutlierGuessScreen from './features/game/OutlierGuessScreen'
import RoleRevealScreen from './features/game/RoleRevealScreen'
import VotingScreen from './features/game/VotingScreen'
import PackManager from './features/packs/PackManager'
import { useGameStore } from './store/gameStore'

type AppView = 'home' | 'lobby' | 'packs'

function AppContent() {
  const [view, setView] = useState<AppView>('home')
  const [lobbyDraft, setLobbyDraft] = useState<LobbyDraft | null>(null)
  const game = useGameStore((state) => state.game)
  const changeCategory = useGameStore((state) => state.changeCategory)
  const returnToLobby = useGameStore((state) => state.returnToLobby)

  if (game?.phase === 'ROLE_REVEAL') return <RoleRevealScreen key={game.currentRevealIndex} />
  if (game?.phase === 'DISCUSSION') return <DiscussionScreen />
  if (game?.phase === 'VOTING') return <VotingScreen />
  if (game?.phase === 'OUTLIER_GUESS') return <OutlierGuessScreen />
  if (game?.phase === 'GAME_OVER') return <GameOverScreen
    onChangeCategory={() => { changeCategory(); setView('lobby') }}
    onReturnToLobby={() => { returnToLobby(); setView('home') }}
  />

  if (view === 'lobby') return <LobbyScreen draft={lobbyDraft} onDraftChange={setLobbyDraft} onBack={() => setView('home')} onManagePacks={() => setView('packs')} />
  if (view === 'packs') return <main className="screen"><nav className="topbar"><button className="text-button" onClick={() => setView('lobby')}>← Back to setup</button></nav><PackManager /></main>

  return (
    <main className="app-shell">
      <header className="brand-lockup">
        <span className="eyebrow">Pass it. Bluff it. Find them.</span>
        <h1>MoldyParty</h1>
        <p>Offline party games made for one shared screen.</p>
      </header>

      <section className="game-card" aria-labelledby="impostor-title">
        <div className="game-card__art" aria-hidden="true">
          <span className="spore spore--one" />
          <span className="spore spore--two" />
          <span className="game-card__eye">◉</span>
        </div>
        <div className="game-card__content">
          <span className="pill">Launch game</span>
          <h2 id="impostor-title">Impostor</h2>
          <p>Find the impostors before they blend in.</p>
          <button type="button" onClick={() => setView('lobby')}>Set up a round <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <footer>Built for 3+ suspicious friends</footer>
    </main>
  )
}

function App() {
  return <><AppContent /><InstallPrompt /><UpdatePrompt /></>
}

export default App
