import { useState, type ReactNode } from 'react'
import AbortGameDialog from './features/game/AbortGameDialog'
import InstallPrompt from './components/InstallPrompt'
import UpdatePrompt from './components/UpdatePrompt'
import DiscussionScreen from './features/game/DiscussionScreen'
import GameOverScreen from './features/game/GameOverScreen'
import LobbyScreen, { type LobbyDraft } from './features/game/LobbyScreen'
import OutlierGuessScreen from './features/game/OutlierGuessScreen'
import RoleRevealScreen from './features/game/RoleRevealScreen'
import SessionManagerScreen from './features/game/SessionManagerScreen'
import VotingScreen from './features/game/VotingScreen'
import PackManager from './features/packs/PackManager'
import { gameStore, useGameStore } from './store/gameStore'

type AppView = 'home' | 'sessions' | 'lobby' | 'packs'

function AppContent() {
  const [view, setView] = useState<AppView>('home')
  const [lobbyDraft, setLobbyDraft] = useState<LobbyDraft | null>(null)
  const [preferredPackId, setPreferredPackId] = useState<string | null>(null)
  const [lobbyNotice, setLobbyNotice] = useState('')
  const game = useGameStore((state) => state.game)
  const changeCategory = useGameStore((state) => state.changeCategory)
  const returnToLobby = useGameStore((state) => state.returnToLobby)
  const abortGame = useGameStore((state) => state.abortGame)
  const createSession = useGameStore((state) => state.createSession)
  const continueSession = useGameStore((state) => state.continueSession)
  const activeSessionId = useGameStore((state) => state.activeSessionId)

  if (game?.phase === 'GAME_OVER') return <GameOverScreen
    onChangeCategory={() => { changeCategory(); setView('sessions') }}
    onReturnToLobby={() => { returnToLobby(); setView('sessions') }}
  />

  let activeGameScreen: ReactNode = null
  if (game?.phase === 'ROLE_REVEAL') activeGameScreen = <RoleRevealScreen key={game.currentRevealIndex} />
  if (game?.phase === 'DISCUSSION') activeGameScreen = <DiscussionScreen />
  if (game?.phase === 'VOTING') activeGameScreen = <VotingScreen />
  if (game?.phase === 'OUTLIER_GUESS') activeGameScreen = <OutlierGuessScreen />
  if (activeGameScreen) return <>
    {activeGameScreen}
    <AbortGameDialog onConfirm={() => { abortGame(); setView('sessions') }} />
  </>

  if (view === 'sessions') return <SessionManagerScreen
    onBack={() => setView('home')}
    onCreate={(name) => { createSession(name); setLobbyDraft(null); setView('lobby') }}
    onContinue={(sessionId) => {
      continueSession(sessionId)
      if (!gameStore.getState().game) setView('lobby')
    }}
  />
  if (view === 'lobby') return <LobbyScreen draft={lobbyDraft} preferredPackId={preferredPackId} onPreferredPackApplied={() => setPreferredPackId(null)} notice={lobbyNotice} onDraftChange={setLobbyDraft} onBack={() => setView('sessions')} onManagePacks={() => setView('packs')} rosterLocked={activeSessionId !== null} />
  if (view === 'packs') return <main className="screen"><nav className="topbar"><button className="text-button" onClick={() => setView('lobby')}>← Back to setup</button></nav><PackManager onImported={(packId) => { setPreferredPackId(packId); setLobbyNotice('Pack imported and ready in your round.'); setView('lobby') }} /></main>

  return (
    <main className="app-shell">
      <header className="brand-lockup">
        <span className="eyebrow">Offline party games for suspicious friends</span>
        <h1>MoldyParty</h1>
        <p>Pick a game, pass the device, and make your own fun anywhere.</p>
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
          <button type="button" onClick={() => setView('sessions')}>Open Impostor <span aria-hidden="true">→</span></button>
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
